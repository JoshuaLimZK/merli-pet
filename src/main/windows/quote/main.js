// @ts-check
import { app, BrowserWindow } from "electron";
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
    quoteWindow = new BrowserWindow({
        width: 300,
        height: 100,
        frame: false,
        transparent: false,
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

    quoteWindow.loadFile(
        path.join(__dirname, "../../../renderer/quote/index.html"),
    );

    // open dev tools if not packaged
    if (!app.isPackaged) {
        quoteWindow.webContents.openDevTools({ mode: "detach" });
    }

    return quoteWindow;
}

export { createQuoteWindow };
