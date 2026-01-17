/**
 * Crossfade between two animation actions
 * @param {Object.<string, any>} actions - Object containing animation actions
 * @param {string} currentState - Current animation state name
 * @param {string} newState - New animation state name
 * @param {number} duration - Crossfade duration in seconds
 * @returns {string} The new state name
 */
export function crossFadeToAction(
    actions,
    currentState,
    newState,
    duration = 0.3
) {
    const previousAction = actions[currentState];
    const newAction = actions[newState];

    if (!newAction) return currentState;
    if (previousAction === newAction) return currentState;

    if (previousAction) {
        previousAction.fadeOut(duration);
    }

    newAction.reset();
    newAction.fadeIn(duration);
    newAction.play();

    return newState;
}

/**
 * Normalize an angle difference to the range [-PI, PI]
 * @param {number} diff - The angle difference
 * @returns {number} Normalized angle difference
 */
export function normalizeAngleDiff(diff) {
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
}

/**
 * Lerp rotation towards target with normalization
 * @param {number} current - Current rotation
 * @param {number} target - Target rotation
 * @param {number} speed - Lerp speed (0-1)
 * @returns {number} New rotation value
 */
export function lerpRotation(current, target, speed) {
    const diff = normalizeAngleDiff(target - current);
    return current + diff * speed;
}
