const { contextBridge, ipcRenderer } = require("electron");

/**
 * @typedef {Object} AdminAPI
 * @property {(state: string) => void} setState - Set the pet behavior state
 * @property {(callback: (state: string) => void) => void} onStateChange - Listen for state changes
 * @property {() => void} triggerQuote - Trigger a random quote
 */

contextBridge.exposeInMainWorld("electronAPI", {
    setState: (/** @type {string} */ state) =>
        ipcRenderer.send("admin-set-state", state),
    onStateChange: (/** @type {(state: string) => void} */ callback) =>
        ipcRenderer.on("admin-state-changed", (_event, state) =>
            callback(state),
        ),
    triggerQuote: () => ipcRenderer.send("admin-trigger-quote"),
});
