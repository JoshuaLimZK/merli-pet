// @ts-check
import * as THREE from "three";
import {
    PET_CONFIG,
    CAMERA_CONFIG,
    ANIMATION_CONFIG,
    LIGHTING_CONFIG,
} from "./config.js";
import { loadPetModel } from "./model-loader.js";
import { crossFadeToAction, lerpRotation } from "./animation.js";

/**
 * @typedef {Object} ElectronAPI
 * @property {() => Promise<any>} getPetConfig
 * @property {(callback: (data: any) => void) => void} onMouseMove
 * @property {(callback: (data: any) => void) => void} onBehaviorStateChange
 * @property {(callback: (data: { stopped: boolean, angle: number }) => void) => void} onMove
 * @property {(callback: (data: { angle: number }) => void) => void} onSetRotation
 * @property {(callback: (data: { animation: string, duration?: number }) => void) => void} onPlayAnimation
 * @property {(callback: (data: { animation: string, enabled: boolean }) => void) => void} onToggleAnimation
 * @property {(ignore: boolean) => void} setIgnoreMouseEvents
 * @property {(offset: {x: number, y: number}) => void} startDrag
 * @property {() => void} stopDrag
 */

/** @type {Window & { electronAPI: ElectronAPI }} */
const win = /** @type {any} */ (window);

// Wrap initialization in async IIFE to use await
(async () => {
    // Get pet config from main process
    const petWindowConfig = await win.electronAPI.getPetConfig();

    // ============================================================================
    // Scene Setup
    // ============================================================================

    const container = document.getElementById("pet-container");
    if (!container) {
        throw new Error("Pet container element not found");
    }
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
        CAMERA_CONFIG.FOV,
        CAMERA_CONFIG.ASPECT,
        CAMERA_CONFIG.NEAR,
        CAMERA_CONFIG.FAR,
    );
    camera.position.z = CAMERA_CONFIG.POSITION_Z;
    camera.position.y = CAMERA_CONFIG.POSITION_Y;

    // Renderer
    const threeRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
    });
    threeRenderer.setSize(petWindowConfig.SIZE, petWindowConfig.SIZE);
    threeRenderer.setClearColor(0x000000, 0);
    container.appendChild(threeRenderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(
        LIGHTING_CONFIG.AMBIENT_COLOR,
        LIGHTING_CONFIG.AMBIENT_INTENSITY,
    );
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
        LIGHTING_CONFIG.DIRECTIONAL_COLOR,
        LIGHTING_CONFIG.DIRECTIONAL_INTENSITY,
    );
    directionalLight.position.set(
        LIGHTING_CONFIG.DIRECTIONAL_POSITION.x,
        LIGHTING_CONFIG.DIRECTIONAL_POSITION.y,
        LIGHTING_CONFIG.DIRECTIONAL_POSITION.z,
    );
    scene.add(directionalLight);

    // ============================================================================
    // Pet State (mutable)
    // ============================================================================

    /**
     * @typedef {'idle' | 'walk' | 'float' | 'push'} AnimationState
     */

    /**
     * @type {{
     *   model: THREE.Object3D | null,
     *   mixer: THREE.AnimationMixer | null,
     *   actions: Partial<Record<AnimationState, THREE.AnimationAction>>,
     *   currentState: AnimationState,
     *   currentRotationY: number,
     *   targetRotationY: number
     * }}
     */
    const petState = {
        model: null,
        mixer: null,
        actions: {},
        currentState: "idle",
        currentRotationY: 0,
        targetRotationY: 0,
    };

    // Raycaster for click detection
    /** @type {THREE.Raycaster} */
    const raycaster = new THREE.Raycaster();
    /** @type {THREE.Vector2} */
    const mouse = new THREE.Vector2();

    /** @type {boolean} */
    let isMouseWithinStopDistance = false;
    /** @type {number} */
    let animationTimeAccumulator = 0;
    /** @type {THREE.Clock} */
    const clock = new THREE.Clock();

    // ============================================================================
    // Load Model
    // ============================================================================

    try {
        const { model, mixer, actions } = await loadPetModel(
            scene,
            PET_CONFIG.MODEL_SIZE,
        );
        petState.model = model;
        petState.mixer = mixer;
        petState.actions = actions;

        // Start with walk animation
        if (petState.actions.walk) {
            petState.currentState = /** @type {AnimationState} */ (
                crossFadeToAction(
                    petState.actions,
                    petState.currentState,
                    "walk",
                    0,
                )
            );
        }
    } catch (error) {
        console.error("Failed to load pet model:", error);
    }

    // ============================================================================
    // Mouse & Behavior Handling
    // ============================================================================

    /**
     * @typedef {'follow' | 'wander' | 'idle' | 'dragging' | 'imageDragIn'} BehaviorState
     */

    /** @type {BehaviorState} */
    let currentBehaviorState = "follow";

    if (win.electronAPI) {
        win.electronAPI.onMove((data) => {
            const stopped = data.stopped;
            const angle = data.angle;

            if (stopped) {
                petState.currentState = /** @type {AnimationState} */ (
                    crossFadeToAction(
                        petState.actions,
                        petState.currentState,
                        "idle",
                    )
                );
                petState.targetRotationY = 0;
            } else {
                petState.currentState = /** @type {AnimationState} */ (
                    crossFadeToAction(
                        petState.actions,
                        petState.currentState,
                        "walk",
                    )
                );
                petState.targetRotationY = angle;
            }
        });

        // Handle behavior state changes from main process.
        win.electronAPI.onBehaviorStateChange((data) => {
            currentBehaviorState = data.state;
            console.log("Behavior state changed to:", currentBehaviorState);
        });

        // Handle rotation-only updates (no animation change)
        win.electronAPI.onSetRotation((data) => {
            petState.targetRotationY = data.angle;
        });

        // Handle animation triggers from main process
        win.electronAPI.onPlayAnimation((data) => {
            const animationName = /** @type {AnimationState} */ (
                data.animation
            );
            console.log("Playing animation:", animationName);
            petState.currentState = /** @type {AnimationState} */ (
                crossFadeToAction(
                    petState.actions,
                    petState.currentState,
                    animationName,
                    data.duration,
                )
            );
        });

        // Handle additive animation toggles (e.g., armsOut)
        win.electronAPI.onToggleAnimation((data) => {
            const action = petState.actions[data.animation];
            if (!action) {
                console.warn("Animation not found:", data.animation);
                return;
            }
            console.log("Toggle animation:", data.animation, data.enabled);
            if (data.enabled) {
                action.reset();
                action.play();
            } else {
                action.fadeOut(0.3);
            }
        });
    }

    // ============================================================================
    // Click Detection & Dragging (Raycasting)
    // ============================================================================

    /** @type {boolean} */
    let isDragging = false;
    /** @type {NodeJS.Timeout | null} */
    let dragHoldTimer = null;
    /** @type {{ x: number, y: number }} */
    let dragStartOffset = { x: 0, y: 0 }; // Offset from pet center to click point

    /**
     * Raycast to get hit info on the pet model
     * @param {MouseEvent} event - The mouse event
     * @returns {{ hitPoint: THREE.Vector3, hitObject: THREE.Object3D, normalizedY: number } | null} Hit information or null if no hit
     */
    function raycastPet(event) {
        if (!petState.model) return null;

        if (!container) return null;
        const rect = container.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(petState.model, true);

        if (intersects.length > 0) {
            const hitPoint = intersects[0].point;
            const hitObject = intersects[0].object;

            const box = new THREE.Box3().setFromObject(petState.model);
            const size = box.getSize(new THREE.Vector3());
            const min = box.min;

            const normalizedY = (hitPoint.y - min.y) / size.y;

            return { hitPoint, hitObject, normalizedY };
        }

        return null;
    }

    // Enable mouse events when hovering over the container
    container.addEventListener("mouseenter", () => {
        win.electronAPI.setIgnoreMouseEvents(false);
    });

    container.addEventListener("mouseleave", () => {
        // Only re-enable ignore if not dragging
        if (!isDragging) {
            win.electronAPI.setIgnoreMouseEvents(true);
        }
    });

    // Handle mouse down - start hold timer if on top region
    container.addEventListener("mousedown", (event) => {
        const hit = raycastPet(event);

        if (hit && hit.normalizedY > 0.66) {
            // Clicked on top region - start hold timer
            const clickX = event.screenX;
            const clickY = event.screenY;

            // Calculate offset from pet window center to click position
            // Pet window center is at (window.screenX + size/2, window.screenY + size/2)
            const petCenterX = window.screenX + petWindowConfig.SIZE / 2;
            const petCenterY = window.screenY + petWindowConfig.SIZE / 2;

            dragHoldTimer = setTimeout(() => {
                isDragging = true;
                // Store offset so pet maintains relative position to cursor
                dragStartOffset.x = petCenterX - clickX;
                dragStartOffset.y = petCenterY - clickY;
                win.electronAPI.startDrag(dragStartOffset);
                console.log(
                    "Started dragging pet with offset:",
                    dragStartOffset,
                );
            }, 300); // Hold time in ms
        }
    });

    // Cancel drag if mouse is released before hold time
    container.addEventListener("mouseup", () => {
        if (dragHoldTimer) {
            clearTimeout(dragHoldTimer);
            dragHoldTimer = null;
        }
    });

    // Cancel drag if mouse leaves before hold time
    container.addEventListener("mouseleave", () => {
        if (dragHoldTimer) {
            clearTimeout(dragHoldTimer);
            dragHoldTimer = null;
        }
    });

    // Handle mouse up - stop dragging (listen on document to catch release anywhere)
    document.addEventListener("mouseup", (event) => {
        // Clear hold timer if still pending
        if (dragHoldTimer) {
            clearTimeout(dragHoldTimer);
            dragHoldTimer = null;
        }

        if (isDragging) {
            isDragging = false;
            win.electronAPI.stopDrag();
            console.log("Stopped dragging pet");

            // Check if mouse is still over the container
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const isOverContainer =
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom;

            if (!isOverContainer) {
                win.electronAPI.setIgnoreMouseEvents(true);
            }
            // If still over container, keep mouse events enabled for clicks
        }
    });

    // Handle clicks with raycasting (for non-drag interactions)
    container.addEventListener("click", (event) => {
        // Don't process clicks if we were just dragging
        if (isDragging) return;

        const hit = raycastPet(event);
        if (!hit) return;

        const { hitPoint, hitObject, normalizedY } = hit;

        // Get full region info
        if (!petState.model) return;
        const box = new THREE.Box3().setFromObject(petState.model);
        const size = box.getSize(new THREE.Vector3());
        const min = box.min;

        const normalizedX = (hitPoint.x - min.x) / size.x;
        const normalizedZ = (hitPoint.z - min.z) / size.z;

        // Determine vertical region (top/middle/bottom)
        let verticalRegion;
        if (normalizedY > 0.66) {
            verticalRegion = "top"; // Head area
        } else if (normalizedY > 0.33) {
            verticalRegion = "middle"; // Torso area
        } else {
            verticalRegion = "bottom"; // Legs area
        }

        // Determine horizontal region (left/center/right)
        let horizontalRegion;
        if (normalizedX < 0.33) {
            horizontalRegion = "left";
        } else if (normalizedX > 0.66) {
            horizontalRegion = "right";
        } else {
            horizontalRegion = "center";
        }

        // Determine depth region (front/middle/back)
        let depthRegion;
        if (normalizedZ > 0.66) {
            depthRegion = "front";
        } else if (normalizedZ < 0.33) {
            depthRegion = "back";
        } else {
            depthRegion = "middle";
        }

        console.log("Pet clicked!", {
            region: {
                vertical: verticalRegion,
                horizontal: horizontalRegion,
                depth: depthRegion,
            },
            normalized: {
                x: normalizedX.toFixed(2),
                y: normalizedY.toFixed(2),
                z: normalizedZ.toFixed(2),
            },
            object: hitObject.name,
        });

        // TODO: Add your click handling logic here
        // Example:
        // if (verticalRegion === "top") {
        //     // Pet was clicked on head - play happy animation
        // } else if (verticalRegion === "bottom") {
        //     // Pet was clicked on feet - play jump animation
        // }
    });

    // ============================================================================
    // Animation Loop
    // ============================================================================

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        animationTimeAccumulator += delta;

        // Update animation mixer at target FPS
        if (
            petState.mixer &&
            animationTimeAccumulator >= ANIMATION_CONFIG.FRAME_TIME
        ) {
            petState.mixer.update(animationTimeAccumulator);
            animationTimeAccumulator = 0;
        }

        // Update rotation
        const rotationSpeed = isMouseWithinStopDistance
            ? PET_CONFIG.ROTATION_LERP_SPEED_CLOSE
            : PET_CONFIG.ROTATION_LERP_SPEED;

        petState.currentRotationY = lerpRotation(
            petState.currentRotationY,
            petState.targetRotationY,
            rotationSpeed,
        );

        if (petState.model) {
            petState.model.rotation.y = petState.currentRotationY;
        }

        threeRenderer.render(scene, camera);
    }

    animate();
})(); // End async IIFE
