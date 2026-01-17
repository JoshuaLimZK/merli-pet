// @ts-check
const { contextBridge, ipcRenderer } = require("electron");

/**
 * @typedef {Object} QuoteElectronAPI
 * @property {(callback: (quote: string) => void) => void} onRandomQuote - Listen for random quote events
 * @property {(callback: (x: number, y: number) => void) => void} onLocationUpdate - Listen for location update events
 * @property {(width: number, height: number) => void} resizeWindow - Request window resize
 */

contextBridge.exposeInMainWorld("electronAPI", {
    /**
     * @param {(quote: string) => void} callback
     */
    onRandomQuote: (callback) =>
        ipcRenderer.on("random-quote", (_event, quote) => callback(quote)),
    /**
     * @param {(x: number, y: number) => void} callback
     */
    onLocationUpdate: (callback) =>
        ipcRenderer.on("update-quote-location", (_event, x, y) =>
            callback(x, y),
        ),
    /**
     * @param {number} width
     * @param {number} height
     */
    resizeWindow: (width, height) =>
        ipcRenderer.send("resize-quote-window", width, height),
});
