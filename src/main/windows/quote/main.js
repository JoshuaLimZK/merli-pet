
import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

// ESM does not provide __dirname; create it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let quoteWindow = null;
function createQuoteWindow(petWindow) {
    quoteWindow = new BrowserWindow({
        width: 300,
        height: 100,
        frame: false,
        transparent: false,
        movable: false,
        alwaysOnTop: true,
        title: "quote-window",
        x: petWindow.getBounds().x,// + petWindow.getBounds().width,
        y: petWindow.getBounds().y,// + petWindow.getBounds().height,
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