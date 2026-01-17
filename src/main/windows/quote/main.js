// @ts-check
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";

// @ts-expect-error - ESM does not provide __dirname; create it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {BrowserWindow | null} */
let quoteWindow = null;

/**
 * Creates and returns the quote window positioned relative to the pet window
 * @param {BrowserWindow} petWindow - The pet window to position the quote relative to
 * @returns {BrowserWindow} The created quote window
 */
function createQuoteWindow(petWindow) {
    // Destroy existing quote window if it exists
    if (quoteWindow && !quoteWindow.isDestroyed()) {
        quoteWindow.close();
        quoteWindow = null;
    }

    quoteWindow = new BrowserWindow({
        width: 300,
        height: 100,
        frame: false,
        transparent: true,
        movable: false,
        alwaysOnTop: true,
        title: "quote-window",
        x: petWindow.getBounds().x, // + petWindow.getBounds().width,
        y: petWindow.getBounds().y, // + petWindow.getBounds().height,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    // Listen for resize requests from the renderer
    ipcMain.on("resize-quote-window", (event, width, height) => {
        if (quoteWindow) {
            quoteWindow.setSize(width, height);
        }
    });

    quoteWindow.loadFile(
        path.join(__dirname, "../../../renderer/quote/index.html"),
    );

    return quoteWindow;
}

export { createQuoteWindow };
