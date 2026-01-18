// @ts-check
import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Get __dirname equivalent in ES modules
// @ts-expect-error - import.meta.url is available in ES modules but TypeScript may not recognize it in .mjs files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {BrowserWindow | null} */
let micWindow = null;

/**
 * @returns {BrowserWindow | null}
 */
export function getMicWindow() {
    return micWindow;
}

/**
 * Creates and returns the microphone window
 * @param {boolean} isDevelopment
 * @returns {BrowserWindow}
 */
export function createMicWindow(isDevelopment) {
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;

    const windowSize = 64;
    const margin = 20;

    micWindow = new BrowserWindow({
        width: windowSize,
        height: windowSize,
        x: screenWidth - windowSize - margin,
        y: screenHeight - windowSize - margin,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    micWindow.loadFile(
        path.join(__dirname, "../../../renderer/mic/index.html"),
    );

    micWindow.on("closed", () => {
        micWindow = null;
    });

    return micWindow;
}

/**
 * Close the microphone window
 */
export function closeMicWindow() {
    if (micWindow) {
        micWindow.close();
        micWindow = null;
    }
}
