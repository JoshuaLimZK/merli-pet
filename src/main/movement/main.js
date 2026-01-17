// ======================
// Movement to x y Function
// ======================

import { PET_WINDOW } from "../windows/pet/config.js";
import { getPetPosition, setPetPosition } from "../windows/pet/window.js";

/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * Moves the pet window toward a target position at a given speed.
 * @param {Electron.BrowserWindow} petWindow
 * @param {number} targetX
 * @param {number} targetY
 * @param {number} speed
 * @returns {boolean} - Returns true if the pet is still moving, false if it has reached the target.
 */
export function petMoveTo(petWindow, targetX, targetY, speed) {
    if (!petWindow || petWindow.isDestroyed()) return false;
    /** @type {Point} */
    const { x: petWindowCurrentX, y: petWindowCurrentY } = getPetPosition();
    let deltaXToTarget = targetX - petWindowCurrentX;
    let deltaYToTarget = targetY - petWindowCurrentY;
    let distanceToTarget = Math.hypot(deltaXToTarget, deltaYToTarget);

    if (distanceToTarget > 0) {
        const directionX = deltaXToTarget / distanceToTarget;
        const directionY = deltaYToTarget / distanceToTarget;

        let moveX = directionX * speed;
        let moveY = directionY * speed;
        const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);

        if (moveDistance > distanceToTarget) {
            moveX = deltaXToTarget;
            moveY = deltaYToTarget;
        }

        const newX = petWindowCurrentX + moveX;
        const newY = petWindowCurrentY + moveY;
        setPetPosition(newX, newY);

        const petWindowX = Math.round(newX - PET_WINDOW.SIZE / 2);
        const petWindowY = Math.round(newY - PET_WINDOW.SIZE / 2);

        // Use setBounds instead of setPosition to prevent window size drift on Windows
        petWindow.setBounds({
            x: petWindowX,
            y: petWindowY,
            width: PET_WINDOW.SIZE,
            height: PET_WINDOW.SIZE,
        });
        petWindow.webContents.send("on-move", {
            stopped: false,
            angle: Math.atan2(deltaXToTarget, deltaYToTarget),
        });
        return true;
    } else {
        petWindow.webContents.send("on-move", { stopped: true, angle: 0 });
        return false;
    }
}
