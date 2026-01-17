// @ts-check

/**
 * @typedef {Object} PetWindowConfig
 * @property {number} SIZE - Window size in pixels
 * @property {number} STOP_DISTANCE_FROM_MOUSE - Distance at which pet stops following mouse
 * @property {number} FOLLOW_SPEED - Speed of pet movement when following
 * @property {number} UPDATE_FPS - Frames per second for update loop
 */

/**
 * @typedef {Object} PetBehaviorConfig
 * @property {number} WANDER_DURATION_MIN - Minimum wander duration in ms
 * @property {number} WANDER_DURATION_MAX - Maximum wander duration in ms
 * @property {number} FOLLOW_DURATION_MIN - Minimum follow duration in ms
 * @property {number} FOLLOW_DURATION_MAX - Maximum follow duration in ms
 * @property {number} IDLE_DURATION_MIN - Minimum idle duration in ms
 * @property {number} IDLE_DURATION_MAX - Maximum idle duration in ms
 * @property {number} WANDER_SPEED - Speed of pet movement when wandering
 * @property {number} WANDER_TARGET_REACHED_DISTANCE - Distance to consider target reached
 * @property {number} WANDER_MARGIN - Margin from screen edges
 * @property {number} DRAG_HOLD_TIME - Time to hold before drag starts in ms
 */

/**
 * Pet window configuration constants
 * @type {PetWindowConfig}
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
 * @type {PetBehaviorConfig}
 * @constant
 */
const PET_BEHAVIOR = {
    // How long each state lasts (in ms)
    WANDER_DURATION_MIN: 1000,
    WANDER_DURATION_MAX: 3000,
    FOLLOW_DURATION_MIN: 3000,
    FOLLOW_DURATION_MAX: 5000,
    IDLE_DURATION_MIN: 7000,
    IDLE_DURATION_MAX: 15000,

    // Wander settings
    WANDER_SPEED: 1.5,
    WANDER_TARGET_REACHED_DISTANCE: 20,
    WANDER_MARGIN: 100, // Stay this far from screen edges

    // Dragging settings
    DRAG_HOLD_TIME: 300, // ms to hold before drag starts
};

export { PET_WINDOW, PET_BEHAVIOR };
