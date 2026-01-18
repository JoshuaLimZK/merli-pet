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
 * @param {string} [mode]
 * @returns {BrowserWindow}
 */
function createPomodoroWindow(durationMinutes, mode) {
    if (pomodoroWindow && !pomodoroWindow.isDestroyed()) {
        pomodoroWindow.show();
        pomodoroWindow.focus();
        pomodoroWindow.webContents.send("pomodoro-start", {
            duration: durationMinutes,
            mode,
        });
        return pomodoroWindow;
    }

    pomodoroWindow = new BrowserWindow({
        width: 320,
        height: 440,
        resizable: false,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        movable: true,
        titleBarStyle: "hidden",
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
        pomodoroWindow?.webContents.send("pomodoro-start", {
            duration: durationMinutes,
            mode,
        });
    });

    pomodoroWindow.on("closed", () => {
        pomodoroWindow = null;
    });

    return pomodoroWindow;
}

export { createPomodoroWindow };
