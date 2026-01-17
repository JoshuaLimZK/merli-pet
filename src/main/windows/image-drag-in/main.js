// @ts-check
import { BrowserWindow, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";

// @ts-expect-error - ESM does not provide __dirname; create it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and returns the image drag window positioned off-screen to the right
 * @returns {BrowserWindow} The created image drag window
 */
export function createImageDragWindow() {
    const imageDragWindow = new BrowserWindow({
        width: 0,
        height: 400,
        frame: false,
        transparent: false,
        movable: true,
        title: "Meme",
        draggable: true,
        x: Math.floor(screen.getPrimaryDisplay().workAreaSize.width),
        y: Math.floor(
            (screen.getPrimaryDisplay().workAreaSize.height - 400) / 2,
        ),
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    imageDragWindow.loadFile(
        path.join(__dirname, "../../../renderer/image-drag-in/index.html"),
    );

    return imageDragWindow;
}
