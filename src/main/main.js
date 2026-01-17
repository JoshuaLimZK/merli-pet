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
    pickWanderTarget,
} from "./state/petBehavior.js";
import { createImageDragWindow } from "./windows/image-drag-in/main.js";
import { transitionToState } from "./state/petBehavior.js";
import path from "path";
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

    const moving = petMoveTo(
        petWindow,
        mousePositionX,
        mousePositionY,
        PET_WINDOW.FOLLOW_SPEED,
    );
    if (moving === false) {
        return;
    }
}
function onWander(petWindow) {
    if (!petBehavior.wanderTarget) {
        petBehavior.wanderTarget = pickWanderTarget();
    }

    let targetX = petBehavior.wanderTarget.x;
    let targetY = petBehavior.wanderTarget.y;

    const moving = petMoveTo(
        petWindow,
        targetX,
        targetY,
        PET_WINDOW.FOLLOW_SPEED,
    );
    if (moving === false) {
        return;
    }
}

// ======================
// Update Loop
// ======================
function startPetUpdateLoop() {
    const mainLoop = setInterval(
        () => {
            const petWindow = getPetWindow();
            if (!petWindow) return;

            const didTransition = checkStateTransition();

            if (didTransition && Math.random() < 0.075) {
                transitionToState("imageDragIn", false, 10000);
                console.log("Dragging in random image due to state transition");
                dragInRandomImage(petWindow, createImageDragWindow(), mainLoop);
            }

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

function dragInRandomImage(petWindow, imageDragWindow, mainLoop) {
    if (!petWindow || petWindow.isDestroyed()) return;
    clearInterval(mainLoop);

    const targetX = screen.getPrimaryDisplay().workAreaSize.width;
    const targetY = screen.getPrimaryDisplay().workAreaSize.height / 2;

    const dragInImageLoop = setInterval(() => {
        const { x: petWindowCurrentX, y: petWindowCurrentY } = getPetPosition();
        let moved = petMoveTo(petWindow, targetX, targetY, 3);
        if (!moved) {
            slideInFromRight(imageDragWindow, 400, 400, 3);
            const pullOutLoop = setInterval(() => {
                const { x: petWindowCurrentX, y: petWindowCurrentY } =
                    getPetPosition();
                let movedBack = petMoveTo(
                    petWindow,
                    screen.getPrimaryDisplay().workAreaSize.width - 400,
                    screen.getPrimaryDisplay().workAreaSize.height / 2,
                    3,
                );
                if (!movedBack) {
                    clearInterval(pullOutLoop);
                    transitionToState("idle", false, 5000);
                    startPetUpdateLoop();
                }
            }, 10);
            clearInterval(dragInImageLoop);
        }
    }, 10);
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
    const petWindow = createPetWindow(!app.isPackaged);
    petWindow.once("ready-to-show", () => {
        startPetUpdateLoop();
    });
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
        const petWindow = createPetWindow(!app.isPackaged);
        petWindow.once("ready-to-show", () => {
            startPetUpdateLoop();
        });
    }
});
