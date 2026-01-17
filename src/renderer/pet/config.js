// @ts-check

/**
 * @typedef {Object} PetConfig
 * @property {number} MODEL_SIZE - Size of the 3D model
 * @property {number} ROTATION_LERP_SPEED - Speed of rotation interpolation
 * @property {number} ROTATION_LERP_SPEED_CLOSE - Speed of rotation when close to target
 */

/**
 * @typedef {Object} CameraConfig
 * @property {number} FOV - Field of view in degrees
 * @property {number} ASPECT - Aspect ratio
 * @property {number} NEAR - Near clipping plane
 * @property {number} FAR - Far clipping plane
 * @property {number} POSITION_Z - Camera Z position
 * @property {number} POSITION_Y - Camera Y position
 */

/**
 * @typedef {Object} AnimationConfig
 * @property {number} FPS - Target frames per second
 * @property {number} FRAME_TIME - Computed frame time (1/FPS)
 */

/**
 * @typedef {Object} LightingConfig
 * @property {number} AMBIENT_COLOR - Ambient light color
 * @property {number} AMBIENT_INTENSITY - Ambient light intensity
 * @property {number} DIRECTIONAL_COLOR - Directional light color
 * @property {number} DIRECTIONAL_INTENSITY - Directional light intensity
 * @property {{x: number, y: number, z: number}} DIRECTIONAL_POSITION - Directional light position
 */

/**
 * Pet 3D model configuration (immutable)
 * @type {PetConfig}
 */
export const PET_CONFIG = {
    MODEL_SIZE: 1.5,
    ROTATION_LERP_SPEED: 0.07,
    ROTATION_LERP_SPEED_CLOSE: 0.15,
};

/**
 * Camera configuration
 * @type {CameraConfig}
 */
export const CAMERA_CONFIG = {
    FOV: 50, // Narrower FOV for tighter framing (was 75)
    ASPECT: 1,
    NEAR: 0.1,
    FAR: 1000,
    POSITION_Z: 3, // Adjusted for new FOV
    POSITION_Y: 0.0,
};

/**
 * Animation configuration
 * @type {AnimationConfig}
 */
export const ANIMATION_CONFIG = {
    FPS: 30,
    get FRAME_TIME() {
        return 1 / this.FPS;
    },
};

/**
 * Lighting configuration
 * @type {LightingConfig}
 */
export const LIGHTING_CONFIG = {
    AMBIENT_COLOR: 0xffffff,
    AMBIENT_INTENSITY: 1,
    DIRECTIONAL_COLOR: 0xffffff,
    DIRECTIONAL_INTENSITY: 1,
    DIRECTIONAL_POSITION: { x: 5, y: 10, z: 7.5 },
};
