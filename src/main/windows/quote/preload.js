const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
    onRandomQuote: (callback) =>
        ipcRenderer.on("random-quote", (_event, quote) => callback(quote)),
    onLocationUpdate: (callback) =>
        ipcRenderer.on("update-quote-location", (_event, x, y) => callback(quote)),
});