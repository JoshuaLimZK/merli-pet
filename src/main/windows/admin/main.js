// @ts-check
import { BrowserWindow, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";

// @ts-expect-error - ESM does not provide __dirname; create it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates the admin window
 * @returns {BrowserWindow} The created admin window
 */
export function createAdminWindow() {
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth } = display.workAreaSize;

    const windowWidth = 400;
    const windowHeight = 600;
    const margin = 20;

    const adminWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: screenWidth - windowWidth - margin,
        y: margin,
        frame: false,
        // Hide the native title bar so we can provide a custom draggable header
        titleBarStyle: "hidden",
        transparent: true,
        movable: true,
        title: "Admin",
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });
    adminWindow.loadFile(
        path.join(__dirname, "../../../renderer/admin/index.html"),
    );
    return adminWindow;
}
