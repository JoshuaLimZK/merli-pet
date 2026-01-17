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

        console.log(`Loaded animation "${walkingClip.name}" for all actions`);

        // Start with idle (which is walking)
        actions.idle.play();
    }

    return { model, mixer, actions };
}
