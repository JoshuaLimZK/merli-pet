const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    onBeginFlagRaising: (callback) => {
        ipcRenderer.on("begin-flag-raising", () => callback());
    },
    onEndedFlagRaising: () => {
        ipcRenderer.send("ended-flag-raising");
    },
});
