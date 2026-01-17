// @ts-check
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    // API Keys
    getAPIKeys: () => ({
        openai: process.env.OPENAI_API_KEY || "",
        elevenlabs: process.env.ELEVENLABS_API_KEY || "",
        openaiOrgId: process.env.OPENAI_ORG_ID || "",
        openaiProjectId: process.env.OPENAI_PROJECT_ID || "",
    }),

    // IPC listeners for main process commands
    onSendMessage: (callback) =>
        ipcRenderer.on("send-message", (_, text) => callback(text)),
    onToggleMic: (callback) => ipcRenderer.on("toggle-mic", () => callback()),
    onInterrupt: (callback) => ipcRenderer.on("interrupt", () => callback()),

    // Send events back to main
    sendToMain: (channel, data) => ipcRenderer.send(channel, data),
});
