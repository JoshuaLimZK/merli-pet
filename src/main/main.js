// @ts-check
import { app, ipcMain, BrowserWindow, screen } from "electron";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// ======================
// Import Modules
// ======================
import { PET_WINDOW, PET_BEHAVIOR } from "./windows/pet/config.js";
import {
    createPetWindow,
    getPetWindow,
    getPetPosition,
    setPetPosition,
} from "./windows/pet/window.js";
import { createMicWindow, getMicWindow } from "./windows/mic/window.js";
import {
    petBehavior,
    onStateChange,
    checkStateTransition,
} = require("./state/petBehavior");
const { createImageDragWindow } = require("./windows/image-drag-in/main");
const { dragInRandomImage } = require("./systems/imageDragInSystem");
const path = require("path");
// ======================
// OpenAI Module
// ======================

// ======================
// ElevenLabs Module
// ======================

// ======================
// Reference Variables
// e.g Windows, API Clients, etc.
// ======================

// ======================
// IPC Handlers
// ======================
ipcMain.handle("get-pet-config", () => {
    return PET_WINDOW;
});
function onFollow(petWindow) {

    const mousePosition = screen.getCursorScreenPoint();
    const mousePositionX = mousePosition.x;
    const mousePositionY = mousePosition.y;

    const { x: petWindowCurrentX, y: petWindowCurrentY } =
        getPetPosition();

    let deltaXToTarget = mousePositionX - petWindowCurrentX;
    let deltaYToTarget = mousePositionY - petWindowCurrentY;
    let distanceMouseToWindow = Math.hypot(deltaXToTarget, deltaYToTarget);

    if (
        distanceMouseToWindow <
        PET_WINDOW.STOP_DISTANCE_FROM_MOUSE
    ) {
        return ;
    }
    petMoveTo(petWindow, mousePositionX, mousePositionY, PET_WINDOW.FOLLOW_SPEED);
    
    
}
function onWander(petWindow) {

    const {
        pickWanderTarget,
    } = require("./state/petBehavior");
    if (!petBehavior.wanderTarget) {
        petBehavior.wanderTarget = pickWanderTarget();
    }
    const { x: petWindowCurrentX, y: petWindowCurrentY } =
        getPetPosition();
    let targetX = petBehavior.wanderTarget.x;
    let targetY = petBehavior.wanderTarget.y;
    let deltaXToTarget = targetX - petWindowCurrentX;
    let deltaYToTarget = targetY - petWindowCurrentY;
    let distanceToTarget = Math.hypot(deltaXToTarget, deltaYToTarget);
    if (
        distanceToTarget <
        PET_BEHAVIOR.WANDER_TARGET_REACHED_DISTANCE
    ) {
        petBehavior.wanderTarget = pickWanderTarget();
        return;
    }
    petMoveTo(petWindow, targetX, targetY, PET_WINDOW.FOLLOW_SPEED);
    
    
}
function updatemodel(petWindow){

    const { x: petWindowCurrentX, y: petWindowCurrentY } =
        getPetPosition();
    const mousePosition = screen.getCursorScreenPoint();
    const mousePositionX = mousePosition.x;
    const mousePositionY = mousePosition.y;
    let deltaXMouseToWindow = mousePositionX - petWindowCurrentX;
    let deltaYMouseToWindow = mousePositionY - petWindowCurrentY;
    let angleToTarget
    switch (petBehavior.state) {
        case "follow":
            angleToTarget = Math.atan2(
                deltaXMouseToWindow,
                deltaYMouseToWindow,
            );
        case "wander":
            const {
                x: wanderTargetX,
                y: wanderTargetY,
            } = petBehavior.wanderTarget || {
                x: petWindowCurrentX,
                y: petWindowCurrentY,
            };
            let deltaXWanderToWindow =
                wanderTargetX - petWindowCurrentX;
            let deltaYWanderToWindow =
                wanderTargetY - petWindowCurrentY;
            angleToTarget = Math.atan2(
                deltaXWanderToWindow,
                deltaYWanderToWindow,
            );
    }
    let distanceMouseToWindow = Math.hypot(
        deltaXMouseToWindow,
        deltaYMouseToWindow,
    );
    petWindow.webContents.send("mouse-move", {
        mousePosition: { x: mousePositionX, y: mousePositionY },
        deltatMouseToWindow: {
            x: deltaXMouseToWindow,
            y: deltaYMouseToWindow,
        },
        angleMouseToWindow: Math.atan2(
            deltaXMouseToWindow,
            deltaYMouseToWindow,
        ),
        angleToTarget,
        distanceMouseToWindow,
        isWithinStopDistance:
            distanceMouseToWindow <=
            PET_WINDOW.STOP_DISTANCE_FROM_MOUSE,
        behaviorState: petBehavior.state,
    });
}
// ======================
// Update Loop
// ======================
function startPetUpdateLoop() {
    setInterval(
        () => {
            const petWindow = getPetWindow();
            if (!petWindow) return;

            const didTransition = checkStateTransition();



            updatemodel(petWindow);

            switch (petBehavior.state) {
                case "follow":
                    onFollow(petWindow);
                    break;
                case "wander":
                    onWander(petWindow);
                    break;

                case "idle":
                    break;
            }
        },
        Math.floor(1000 / PET_WINDOW.UPDATE_FPS),
    );
}

// ======================
// Movement to x y Function
// ======================

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
 * @returns {void}
 */
function petMoveTo(petWindow, targetX, targetY, speed) {
    if (!petWindow || petWindow.isDestroyed()) return;
    /** @type {Point} */
    const { x: petWindowCurrentX, y: petWindowCurrentY } = getPetPosition();
    let deltaXToTarget = targetX - petWindowCurrentX;
    let deltaYToTarget = targetY - petWindowCurrentY;
    let distanceToTarget = Math.hypot(deltaXToTarget, deltaYToTarget);
    let angleToTarget = Math.atan2(deltaXToTarget, deltaYToTarget);

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

        petWindow.setPosition(petWindowX, petWindowY, false);
    }
}

// ======================
// Window slide in function from right
// ======================

/**
 * Animates a window sliding in from the right side of the screen.
 * @param {Electron.BrowserWindow} window - The window to animate
 * @param {number} width - The target width of the window in pixels
 * @param {number} height - The target height of the window in pixels
 * @param {number} [speed=2] - The animation speed in pixels per frame
 * @param {number} [y=Math.floor(screen.getPrimaryDisplay().workAreaSize.height / 2 - height / 2)] - The vertical position of the window in pixels
 * @returns {void}
 */

function slideInFromRight(
    window,
    width,
    height,
    speed = 2,
    y = Math.floor(
        screen.getPrimaryDisplay().workAreaSize.height / 2 - height / 2,
    ),
) {
    let x = screen.getPrimaryDisplay().workAreaSize.width;
    window.setSize(0, height);
    window.setPosition(x, y);
    window.setSize(width, height);
    window.show();
    const interval = setInterval(() => {
        if (x > screen.getPrimaryDisplay().workAreaSize.width - width) {
            x -= speed;
            window.setPosition(x, y);
        } else {
            clearInterval(interval);
        }
    }, 10);
}

// ======================
// App Handlers
// e.g, State Change, Event Management
// ======================
onStateChange((newState) => {
    const petWindow = getPetWindow();
    if (!petWindow) return;
    petWindow.webContents.send("behavior-state-change", {
        state: newState,
    });
});

// ======================
// App Lifecycle
// e.g, WhenReady, Activate, etc.
// ======================
app.whenReady().then(() => {
    createPetWindow(!app.isPackaged);
    let imageDragWindow = createImageDragWindow();
    slideInFromRight(imageDragWindow, 400, 400, 10);
    startPetUpdateLoop();
    // create bus window
    const busWindow = new BrowserWindow({
        width: 400,
        height: 300,
    });
    busWindow.loadFile(path.join(__dirname, "../../renderer/bus/index.html"));
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createPetWindow(!app.isPackaged);

        startPetUpdateLoop();
    }
});
