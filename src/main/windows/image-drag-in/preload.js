const { contextBridge, ipcRenderer } = require("electron");

/**
 * @typedef {Object} ElectronAPI
 * @property {(callback: (url: string) => void) => void} onImageUrl
 */

contextBridge.exposeInMainWorld("electronAPI", {
    onImageUrl: (/** @type {(url: string) => void} */ callback) =>
        ipcRenderer.on("image-url", (_event, url) => {
            callback(url);
            console.log("Received image URL:", url);
        }),
});
