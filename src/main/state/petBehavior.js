// @ts-check
import { screen } from "electron";
import { PET_BEHAVIOR, PET_WINDOW } from "../windows/pet/config.js";
/**
 * @typedef {'follow' | 'wander' | 'idle' | 'dragging' | 'talking' | "imageDragIn" | "flagPole"} PetBehaviorState
 */

/**
 * Get a random number between min and max
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get screen bounds for wandering
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
function getScreenBounds() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    return {
        minX: PET_BEHAVIOR.WANDER_MARGIN,
        maxX: width - PET_BEHAVIOR.WANDER_MARGIN,
        minY: PET_BEHAVIOR.WANDER_MARGIN,
        maxY: height - PET_BEHAVIOR.WANDER_MARGIN,
    };
}

/**
 * Pick a random wander target within screen bounds
 * @returns {{ x: number, y: number }}
 */
function pickWanderTarget() {
    const bounds = getScreenBounds();
    const boundsMinX = bounds.minX + PET_WINDOW.SIZE / 1.5;
    const boundsMaxX = bounds.maxX - PET_WINDOW.SIZE / 1.5;
    const boundsMinY = bounds.minY + PET_WINDOW.SIZE / 1.5;
    const boundsMaxY = bounds.maxY - PET_WINDOW.SIZE / 1.5;
    return {
        x: randomBetween(boundsMinX, boundsMaxX),
        y: randomBetween(boundsMinY, boundsMaxY),
    };
}

/** @type {{ state: PetBehaviorState, stateEndTime: number, wanderTarget: {x: number, y: number} | null, previousState: PetBehaviorState | null, dragOffset: {x: number, y: number} | null }} */
const petBehavior = {
    state: "follow",
    stateEndTime: 0,
    wanderTarget: null,
    previousState: null,
    dragOffset: null,
};

/**
 * Pick the next state (can be customized with weights, conditions, etc.)
 * @returns {PetBehaviorState}
 */
function pickNextState() {
    const states = ["follow", "wander", "idle"];
    const weights = [0.45, 0.45, 0.1];

    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < states.length; i++) {
        cumulative += weights[i];
        if (random < cumulative) {
            return /** @type {PetBehaviorState} */ (states[i]);
        }
    }

    return "follow";
}

/**
 * @callback StateChangeCallback
 * @param {PetBehaviorState} newState
 * @param {number} duration
 * @returns {void}
 */

/** @type {StateChangeCallback | null} */
let onStateChangeCallback = null;

/**
 * Register callback for state changes
 * @param {StateChangeCallback} callback
 */
function onStateChange(callback) {
    onStateChangeCallback = callback;
}

/**
 * Transition to a new behavior state
 * @param {PetBehaviorState} newState
 * @param {boolean} [savePrevious=false]
 * @param {number} [duration=Infinity]
 */
function transitionToState(
    newState,
    savePrevious = false,
    duration = Infinity,
) {
    if (savePrevious && newState in ["dragging"]) {
        petBehavior.previousState = petBehavior.state;
    }

    petBehavior.state = newState;

    switch (newState) {
        case "follow":
            duration = randomBetween(
                PET_BEHAVIOR.FOLLOW_DURATION_MIN,
                PET_BEHAVIOR.FOLLOW_DURATION_MAX,
            );
            break;
        case "wander":
            duration = randomBetween(
                PET_BEHAVIOR.WANDER_DURATION_MIN,
                PET_BEHAVIOR.WANDER_DURATION_MAX,
            );
            petBehavior.wanderTarget = pickWanderTarget();
            break;
        case "idle":
            duration = randomBetween(
                PET_BEHAVIOR.IDLE_DURATION_MIN,
                PET_BEHAVIOR.IDLE_DURATION_MAX,
            );
            break;
        case "dragging":
            duration = Infinity;
            break;
        case "talking":
            break;
        case "imageDragIn":
            break;
        case "flagPole":
            break;
    }

    petBehavior.stateEndTime = Date.now() + duration;

    if (onStateChangeCallback) {
        onStateChangeCallback(newState, duration);
    }

    console.log(`Pet state: ${newState} (for ${duration}ms)`);
}

/**
 * Check if state should transition
 * @returns {boolean} True if transitioned
 */
function checkStateTransition() {
    if (Date.now() >= petBehavior.stateEndTime) {
        transitionToState(pickNextState());
        return true;
    }
    return false;
}

export {
    petBehavior,
    transitionToState,
    checkStateTransition,
    pickNextState,
    randomBetween,
    onStateChange,
    pickWanderTarget,
};
