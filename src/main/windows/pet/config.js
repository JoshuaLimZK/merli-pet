// @ts-check

/**
 * Pet window configuration constants
 * @constant
 */
const PET_WINDOW = {
    SIZE: 256,
    STOP_DISTANCE_FROM_MOUSE: 128,
    FOLLOW_SPEED: 3,
    UPDATE_FPS: 60,
};

/**
 * Pet behavior configuration
 * @constant
 */
const PET_BEHAVIOR = {
    // How long each state lasts (in ms)
    WANDER_DURATION_MIN: 5000,
    WANDER_DURATION_MAX: 10000,
    FOLLOW_DURATION_MIN: 8000,
    FOLLOW_DURATION_MAX: 15000,
    IDLE_DURATION_MIN: 2000,
    IDLE_DURATION_MAX: 5000,

    // Wander settings
    WANDER_SPEED: 1.5,
    WANDER_TARGET_REACHED_DISTANCE: 20,
    WANDER_MARGIN: 100, // Stay this far from screen edges

    // Dragging settings
    DRAG_HOLD_TIME: 300, // ms to hold before drag starts
};

export { PET_WINDOW, PET_BEHAVIOR };
