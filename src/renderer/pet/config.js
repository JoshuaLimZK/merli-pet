/**
 * Pet 3D model configuration (immutable)
 */
export const PET_CONFIG = {
    MODEL_SIZE: 1.5,
    ROTATION_LERP_SPEED: 0.07,
    ROTATION_LERP_SPEED_CLOSE: 0.15,
};

/**
 * Camera configuration
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
 */
export const ANIMATION_CONFIG = {
    FPS: 30,
    get FRAME_TIME() {
        return 1 / this.FPS;
    },
};

/**
 * Lighting configuration
 */
export const LIGHTING_CONFIG = {
    AMBIENT_COLOR: 0xffffff,
    AMBIENT_INTENSITY: 1,
    DIRECTIONAL_COLOR: 0xffffff,
    DIRECTIONAL_INTENSITY: 1,
    DIRECTIONAL_POSITION: { x: 5, y: 10, z: 7.5 },
};
