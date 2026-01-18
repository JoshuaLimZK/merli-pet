// @ts-check
import { BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

// @ts-expect-error - ESM does not provide __dirname; create it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {BrowserWindow | null} */
let pomodoroWindow = null;

/**
 * Create or focus the pomodoro window
 * @param {number} durationMinutes
 * @returns {BrowserWindow}
 */
function createPomodoroWindow(durationMinutes) {
    if (pomodoroWindow && !pomodoroWindow.isDestroyed()) {
        pomodoroWindow.show();
        pomodoroWindow.focus();
        pomodoroWindow.webContents.send("pomodoro-start", durationMinutes);
        return pomodoroWindow;
    }

    pomodoroWindow = new BrowserWindow({
        width: 360,
        height: 240,
        resizable: false,
        alwaysOnTop: true,
        title: "Pomodoro",
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    pomodoroWindow.loadFile(
        path.join(__dirname, "../../../renderer/pomodoro/index.html"),
    );

    pomodoroWindow.once("ready-to-show", () => {
        pomodoroWindow?.show();
        pomodoroWindow?.webContents.send("pomodoro-start", durationMinutes);
    });

    pomodoroWindow.on("closed", () => {
        pomodoroWindow = null;
    });

    return pomodoroWindow;
}

export { createPomodoroWindow };
