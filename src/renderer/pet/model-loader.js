//@ts-check
import * as THREE from "three";
// @ts-expect-error - No types available
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * @typedef {import('three/examples/jsm/loaders/GLTFLoader.js').GLTF} GLTF
 */

/**
 * @typedef {Object} PetActions
 * @property {THREE.AnimationAction} [idle] - Idle animation action
 * @property {THREE.AnimationAction} [walk] - Walk animation action
 * @property {THREE.AnimationAction} [float] - Float animation action
 * @property {THREE.AnimationAction} [dance] - Dance animation action
 * @property {THREE.AnimationAction} [blink] - Blinking animation action (additive)
 * @property {THREE.AnimationAction} [push] - Push up animation action
 * @property {THREE.AnimationAction} [armsOut] - Arms out animation action
 */

/**
 * @typedef {Object} PetModelResult
 * @property {THREE.Group} model - The loaded 3D model
 * @property {THREE.AnimationMixer} mixer - Animation mixer for the model
 * @property {PetActions} actions - Animation actions mapped by name
 */

/** @type {GLTFLoader} */
const gltfLoader = new GLTFLoader();

/**
 * Load a GLB/GLTF file and return a promise
 * @param {string} path - Path to the GLB file
 * @returns {Promise<GLTF>}
 */
export function loadGLB(path) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(
            path,
            /**
             *
             * @param {GLTF} gltf
             * @returns
             */
            (gltf) => resolve(gltf),
            undefined,
            /**
             *
             * @param {Error} error
             * @returns
             */
            (error) => reject(error),
        );
    });
}

/**
 * Center and scale a model to fit within a target size
 * @param {THREE.Object3D} model - The model to scale
 * @param {number} targetSize - The target size for the largest dimension
 * @returns {void}
 */
export function centerAndScaleModel(model, targetSize) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = targetSize / maxDim;

    model.scale.set(scale, scale, scale);
    model.position.x = -center.x * scale;
    model.position.y = -center.y * scale;
    model.position.z = -center.z * scale;
}

/**
 * Load the pet model with all animations
 * @param {THREE.Scene} scene - The scene to add the model to
 * @param {number} modelSize - Target size for the model
 * @returns {Promise<PetModelResult>}
 */
export async function loadPetModel(scene, modelSize) {
    // Load the Merli GLB model
    const gltf = await loadGLB("../../assets/Merli.glb");
    const model = gltf.scene;

    // Load the dance animation GLB (if available)
    let danceGltf = null;
    try {
        danceGltf = await loadGLB("../../assets/Merli_dance.glb");
    } catch (error) {
        console.warn("Failed to load dance animation:", error);
    }

    // Debug: Log model metadata
    debugModelMetadata(gltf);

    // Center and scale the model
    centerAndScaleModel(model, modelSize);
    scene.add(model);

    // Create animation mixer
    const mixer = new THREE.AnimationMixer(model);
    /** @type {PetActions} */
    const actions = {};

    // Find the walking animation and use it for all actions
    if (gltf.animations && gltf.animations.length > 0) {
        const walkingClip =
            gltf.animations.find(
                (clip) => clip.name.toLowerCase() === "walking",
            ) || gltf.animations[0];

        // Map the walking animation to all action types
        actions.idle = mixer.clipAction(walkingClip);
        actions.walk = mixer.clipAction(walkingClip);
        actions.float = mixer.clipAction(walkingClip);

        if (danceGltf && danceGltf.animations.length > 0) {
            const danceClip =
                danceGltf.animations.find((clip) =>
                    clip.name.toLowerCase().includes("dance"),
                ) || danceGltf.animations[0];
            actions.dance = mixer.clipAction(danceClip);
            actions.dance.setLoop(THREE.LoopRepeat, Infinity);
        }

        console.log(`Loaded animation "${walkingClip.name}" for all actions`);

        // Start with idle (which is walking)
        actions.idle.play();

        // Find and set up the blinking animation as additive
        const blinkClip = gltf.animations.find(
            (clip) => clip.name.toLowerCase() === "blink",
        );

        if (blinkClip) {
            const blinkAction = mixer.clipAction(blinkClip);
            blinkAction.setLoop(THREE.LoopOnce, 1);
            blinkAction.clampWhenFinished = true;
            blinkAction.weight = 1.0;
            actions.blink = blinkAction;
            blinkFunction();
        }

        // Add the heavy_push animation if it exists
        const pushClip = gltf.animations.find(
            (clip) => clip.name.toLowerCase() === "heavy_push",
        );
        if (pushClip) {
            const pushAction = mixer.clipAction(pushClip);
            actions.push = pushAction;
        }

        // const arms out (additive, toggleable)
        const armsOutClip = gltf.animations.find(
            (clip) => clip.name.toLowerCase() === "arms_out",
        );
        if (armsOutClip) {
            //THREE.AnimationUtils.makeClipAdditive(armsOutClip);
            const armsOutAction = mixer.clipAction(armsOutClip);
            armsOutAction.setLoop(THREE.LoopRepeat, Infinity);
            armsOutAction.weight = 1.0;
            actions.armsOut = armsOutAction;
        }
    }

    return { model, mixer, actions };

    function blinkFunction() {
        const delay = Math.random() * 5 + 2; // Random delay between 2 to 7 seconds
        setTimeout(() => {
            const blinkAction = actions.blink;
            if (blinkAction) {
                blinkAction.reset();
                blinkAction.play();
            }
            blinkFunction();
        }, delay * 1000);
    }
}

/**
 * Debug function to log all metadata from a GLB/GLTF model
 * @param {GLTF} gltf - The loaded GLTF object
 * @returns {void}
 */
export function debugModelMetadata(gltf) {
    console.group("🔍 Model Metadata Debug");

    // Animations
    console.group("📽️ Animations (" + gltf.animations.length + ")");
    gltf.animations.forEach((clip, i) => {
        console.log(
            `  [${i}] "${clip.name}" - Duration: ${clip.duration.toFixed(4)}s, Tracks: ${clip.tracks.length}, Type: ${clip.tracks[0]?.ValueTypeName || "N/A"}, Parent: ${clip.tracks[0]?.name.split(".")[0] || "N/A"}`,
        );
        clip.tracks.forEach((track) => {
            console.log(`      └─ ${track.name} (${track.constructor.name})`);
        });
    });
    console.groupEnd();

    // Scene hierarchy
    console.group("🌳 Scene Hierarchy");
    /**
     * @param {THREE.Object3D} obj
     * @param {number} depth
     */
    function traverseHierarchy(obj, depth = 0) {
        const indent = "  ".repeat(depth);
        const type = obj.type;
        const info = [];

        if (obj instanceof THREE.Mesh) {
            const geo = obj.geometry;
            info.push(`vertices: ${geo.attributes.position?.count || 0}`);
        }
        if (obj instanceof THREE.SkinnedMesh) {
            info.push(`skinned`);
        }
        if (obj instanceof THREE.Bone) {
            info.push(`bone`);
        }

        console.log(
            `${indent}${obj.name || "(unnamed)"} [${type}]${info.length ? " - " + info.join(", ") : ""}`,
        );

        obj.children.forEach((child) => traverseHierarchy(child, depth + 1));
    }
    traverseHierarchy(gltf.scene);
    console.groupEnd();

    // Materials
    console.group("🎨 Materials");
    /** @type {Set<THREE.Material>} */
    const materials = new Set();
    gltf.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach((m) => materials.add(m));
            } else {
                materials.add(obj.material);
            }
        }
    });
    materials.forEach((mat) => {
        console.log(`  "${mat.name || "(unnamed)"}" - ${mat.type}`);
    });
    console.groupEnd();

    // Bounding box
    console.group("📦 Bounding Box");
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    console.log(
        `  Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`,
    );
    console.log(
        `  Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`,
    );
    console.groupEnd();

    console.groupEnd();
}
