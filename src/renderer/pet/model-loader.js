//@ts-check
import * as THREE from "three";
// @ts-expect-error - No types available
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const fbxLoader = new FBXLoader();

/**
 * Load an FBX file and return a promise
 * @param {string} path - Path to the FBX file
 * @returns {Promise<THREE.Group>}
 */
export function loadFBX(path) {
    return new Promise((resolve, reject) => {
        fbxLoader.load(
            path,
            /**
             * @param {THREE.Group} fbx
             */
            (fbx) => resolve(fbx),
            /**
             * @param {ProgressEvent<EventTarget>} xhr
             */
            undefined,
            /**
             * @param {ErrorEvent} error
             */
            (error) => reject(error),
        );
    });
}

/**
 * Center and scale a model to fit within a target size
 * @param {THREE.Object3D} model - The model to scale
 * @param {number} targetSize - The target size for the largest dimension
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
 * @returns {Promise<{model: THREE.Group, mixer: THREE.AnimationMixer, actions: Object}>}
 */
export async function loadPetModel(scene, modelSize) {
    // Load the idle model (contains the mesh)
    const idleModel = await loadFBX("../../assets/Maria@Idle.fbx");

    // Center and scale the model
    centerAndScaleModel(idleModel, modelSize);
    scene.add(idleModel);

    // Create animation mixer
    const mixer = new THREE.AnimationMixer(idleModel);
    const actions = {};

    // Add idle animation
    if (idleModel.animations && idleModel.animations.length > 0) {
        actions.idle = mixer.clipAction(idleModel.animations[0]);
    }

    // Load walk animation
    try {
        const walkModel = await loadFBX("../../assets/Maria@Walk.fbx");
        if (walkModel.animations && walkModel.animations.length > 0) {
            actions.walk = mixer.clipAction(walkModel.animations[0]);
        }
    } catch (error) {
        console.error("Error loading walk animation:", error);
    }

    try {
        const floatModel = await loadFBX("../../assets/Maria@Float.fbx");
        if (floatModel.animations && floatModel.animations.length > 0) {
            actions.float = mixer.clipAction(floatModel.animations[0]);
        }
    } catch (error) {
        console.error("Error loading float animation:", error);
    }

    return { model: idleModel, mixer, actions };
}
