// @ts-check
const { contextBridge, ipcRenderer } = require("electron");

/**
 * @typedef {Object} PomodoroAPI
 * @property {(callback: (duration: number) => void) => void} onStart
 */

contextBridge.exposeInMainWorld("pomodoroAPI", {
    /**
     * Listen for start events from main process
     * @param {(duration: number) => void} callback
     */
    onStart: (callback) =>
        ipcRenderer.on("pomodoro-start", (_event, duration) =>
            callback(duration),
        ),
});
