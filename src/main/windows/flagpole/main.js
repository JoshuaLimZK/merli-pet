import { PET_WINDOW } from "../pet/config.js";
import { petMoveTo } from "../../movement/main.js";
import { screen, BrowserWindow, ipcMain } from "electron";
import path from "path/win32";
import { fileURLToPath } from "url";
import { getPetPosition } from "../pet/window.js";
import { transitionToState } from "../../state/petBehavior.js";

// Get __dirname equivalent in ES modules
// @ts-expect-error - import.meta.url is available in ES modules but TypeScript may not recognize it in .mjs files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {import('electron').BrowserWindow} PetWindow
 */

/**
 * Move pet to flagpole position at bottom right of screen
 * @param {PetWindow} petWindow - The pet window instance
 */
export function flagPoleAnimation(petWindow) {
    // Move to the bottom left
    const screenHeight = screen.getPrimaryDisplay().workAreaSize.height;
    const targetX = 0 + PET_WINDOW.SIZE / 2 + 90;
    const targetY = screenHeight - PET_WINDOW.SIZE / 2 + 30;
    const speed = 30; // TODO: default is 5

    const movingInterval = setInterval(() => {
        const isMoving = petMoveTo(petWindow, targetX, targetY, speed);
        if (!isMoving) {
            clearInterval(movingInterval);
            createFlagPoleWindowAnimation(petWindow);
        }
    }, 16); // Approx. 60 FPS
}

function createFlagPoleWindowAnimation(petWindow) {
    const screenHeight = screen.getPrimaryDisplay().workAreaSize.height;
    const flagPoleWindow = createFlagPoleWindow({
        x: 5,
        y: Math.floor(screenHeight / 2),
        width: Math.floor(screenHeight / 2),
        height: Math.floor(screenHeight / 2),
    });

    pushFlagPoleAnimation(flagPoleWindow, petWindow);
}

function pushFlagPoleAnimation(flagPoleWindow, petWindow) {
    // Trigger the armsOut additive animation on the pet
    petWindow.webContents.send("set-rotation", { angle: Math.PI / 2 });
    petWindow.webContents.send("toggle-animation", {
        animation: "armsOut",
        enabled: true,
    });

    // move to the center of the screen
    const screenWidth = screen.getPrimaryDisplay().workAreaSize.width;
    const screenHeight = screen.getPrimaryDisplay().workAreaSize.height;
    const targetX = Math.floor(screenWidth / 2);
    const targetY = screenHeight - PET_WINDOW.SIZE / 2 + 30;
    const speed = 1.5; // TODO: default is 5

    setTimeout(() => {
        const oldPetPosX = petWindow.getBounds().x;
        const movingInterval = setInterval(() => {
            const isMoving = petMoveTo(petWindow, targetX, targetY, speed);
            const newPetPosX = petWindow.getBounds().x;
            const distMoved = Math.abs(newPetPosX - oldPetPosX);
            flagPoleWindow.setBounds({
                x: 5 + distMoved,
                y: Math.floor(screenHeight / 2),
                width: Math.floor(screenHeight / 2),
                height: Math.floor(screenHeight / 2),
            });
            if (!isMoving) {
                clearInterval(movingInterval);
                // Disable armsOut and close the flagpole window after a delay
                petWindow.webContents.send("set-rotation", {
                    angle: Math.PI / 2,
                });
                setTimeout(() => {
                    flagPoleWindow.webContents.send("begin-flag-raising");
                }, 100);

                // Listen for end of flag raising to clean up and restart
                ipcMain.once("ended-flag-raising", () => {
                    console.log("Flag raising ended, cleaning up");
                    // Disable armsOut animation
                    petWindow.webContents.send("toggle-animation", {
                        animation: "armsOut",
                        enabled: false,
                    });
                    // Close the flagpole window
                    if (!flagPoleWindow.isDestroyed()) {
                        flagPoleWindow.close();
                    }
                    // Restart the normal behavior cycle
                    transitionToState("idle", false, 5000);
                });
            }
        }, 16); // Approx. 60 FPS
    }, 500); // Delay before moving
}

/**
 * @typedef {Object} WindowBounds
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @param {WindowBounds} [bounds]
 */
function createFlagPoleWindow(bounds) {
    const screenHeight = screen.getPrimaryDisplay().workAreaSize.height;
    const defaultSize = Math.floor(screenHeight / 2);

    const flagPoleWindow = new BrowserWindow({
        width: bounds?.width ?? defaultSize,
        height: bounds?.height ?? defaultSize,
        x: bounds?.x,
        y: bounds?.y,
        frame: false,
        transparent: true,
        show: false,
        backgroundColor: "#00000000",
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    flagPoleWindow.loadFile(
        path.join(__dirname, "../../../renderer/flagpole/index.html"),
    );

    // Show window once content is ready
    flagPoleWindow.once("ready-to-show", () => {
        console.log("Showing flagpole window");
        flagPoleWindow.show();
    });

    flagPoleWindow.webContents.openDevTools({ mode: "detach" });

    return flagPoleWindow;
}
