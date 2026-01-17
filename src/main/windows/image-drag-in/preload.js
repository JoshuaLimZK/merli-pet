
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
    onImageUrl: (callback) =>
        ipcRenderer.on("image-url", (_event, url) => {callback(url);console.log("Received image URL:", url);}),
});