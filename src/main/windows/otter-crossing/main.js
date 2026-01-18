import { BrowserWindow, screen, ipcMain } from "electron";
import { PET_WINDOW } from "../pet/config.js";
import { petMoveTo } from "../../movement/main.js";
import { transitionToState } from "../../state/petBehavior.js";
import path from "path/win32";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
// @ts-expect-error - import.meta.url is available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track active state for interruption
/** @type {NodeJS.Timeout | null} */
let activeMovingInterval = null;
/** @type {BrowserWindow | null} */
let activeOtterWindow = null;

/**
 * Interrupt and clean up the otter crossing animation
 */
export function interruptOtterCrossing() {
    console.log("Interrupting otter crossing animation");
    
    // Clear any active movement interval
    if (activeMovingInterval) {
        clearInterval(activeMovingInterval);
        activeMovingInterval = null;
    }
    
    // Remove the IPC listener
    ipcMain.removeAllListeners("ended-otter-crossing");
    
    // Close the otter crossing window
    if (activeOtterWindow && !activeOtterWindow.isDestroyed()) {
        activeOtterWindow.close();
    }
    
    // Reset state
    activeOtterWindow = null;
    
    // Return to idle
    transitionToState("idle", false, 1000);
}

/**
 * Start the otter crossing animation sequence
 * @param {BrowserWindow} petWindow - The pet window instance
 */
export function otterCrossingAnimation(petWindow) {
    // Move pet to the center-bottom of screen
    const screenWidth = screen.getPrimaryDisplay().workAreaSize.width;
    const screenHeight = screen.getPrimaryDisplay().workAreaSize.height;
    const targetX = screenWidth / 2;
    const targetY = screenHeight / 2 - PET_WINDOW.SIZE / 2 + 30;
    const speed = 5;

    activeMovingInterval = setInterval(() => {
        const isMoving = petMoveTo(petWindow, targetX, targetY, speed);
        if (!isMoving) {
            clearInterval(activeMovingInterval);
            activeMovingInterval = null;
            startOtterCrossing(petWindow);
        }
    }, 16); // Approx. 60 FPS
}

/**
 * Create otter crossing window and start the animation
 * @param {BrowserWindow} petWindow - The pet window instance
 */
function startOtterCrossing(petWindow) {
    // Face the pet forward
    petWindow.webContents.send("set-rotation", { angle: 0 });

    // Create the otter crossing window
    const otterCrossingWindow = createOtterCrossingWindow();
    
    // Store for interruption
    activeOtterWindow = otterCrossingWindow;

    // Wait for window to be ready, then start crossing
    otterCrossingWindow.webContents.once("did-finish-load", () => {
        setTimeout(() => {
            otterCrossingWindow.webContents.send("start-crossing");
        }, 500);
    });

    // Listen for end of crossing to clean up
    ipcMain.once("ended-otter-crossing", () => {
        console.log("Otter crossing ended, cleaning up");
        if (!otterCrossingWindow.isDestroyed()) {
            otterCrossingWindow.close();
        }
        // Reset state
        activeOtterWindow = null;
        // Restart the normal behavior cycle
        transitionToState("idle", false, 5000);
    });
}

/**
 * Create the otter crossing browser window
 * @returns {BrowserWindow}
 */
function createOtterCrossingWindow() {
    const screenWidth = screen.getPrimaryDisplay().workAreaSize.width;
    const screenHeight = screen.getPrimaryDisplay().workAreaSize.height;

    const otterCrossingWindow = new BrowserWindow({
        width: screenWidth,
        height: screenHeight / 2,
        x: 0,
        y: Math.floor(screenHeight / 2) - screenHeight / 6,
        frame: false,
        transparent: true,
        movable: false,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    otterCrossingWindow.loadFile(
        path.join(__dirname, "../../../renderer/otter-crossing/index.html"),
    );

    // Uncomment for debugging
    // otterCrossingWindow.webContents.openDevTools({ mode: "detach" });

    return otterCrossingWindow;
}
