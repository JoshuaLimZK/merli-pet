// @ts-check
import { BrowserWindow } from "electron";
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
    micWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: true,
        transparent: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    micWindow.loadFile(
        path.join(__dirname, "../../../renderer/mic/index.html"),
    );

    if (isDevelopment) {
        micWindow.webContents.openDevTools({ mode: "detach" });
    }

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
