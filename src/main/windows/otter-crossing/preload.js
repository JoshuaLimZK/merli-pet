const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    onStartCrossing: (callback) => {
        ipcRenderer.on("start-crossing", () => callback());
    },
    endOtterCrossing: () => {
        ipcRenderer.send("ended-otter-crossing");
    },
});
