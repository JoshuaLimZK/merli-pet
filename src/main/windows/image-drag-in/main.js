import { BrowserWindow, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createImageDragWindow() {
    const imageDragWindow = new BrowserWindow({
        width: 0,
        height: 400,
        frame: true,
        transparent: false,
        movable: true,
        title: "Meme",
        x: Math.floor(screen.getPrimaryDisplay().workAreaSize.width),
        y: Math.floor(
            (screen.getPrimaryDisplay().workAreaSize.height - 400) / 2,
        ),
    });

    imageDragWindow.loadFile(
        path.join(__dirname, "../../../renderer/image-drag-in/index.html"),
    );

    return imageDragWindow;
}
