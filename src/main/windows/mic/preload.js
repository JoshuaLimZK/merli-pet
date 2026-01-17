// @ts-check
const { contextBridge, ipcRenderer } = require("electron");

/**
 * @typedef {Object} APIKeys
 * @property {string} openai - OpenAI API key
 * @property {string} elevenlabs - ElevenLabs API key
 * @property {string} openaiOrgId - OpenAI organization ID
 * @property {string} openaiProjectId - OpenAI project ID
 */

/**
 * @typedef {Object} MicAPI
 * @property {() => APIKeys} getAPIKeys - Get API keys from environment
 * @property {(callback: (text: string) => void) => void} onSendMessage - Listen for send message events
 * @property {(callback: () => void) => void} onToggleMic - Listen for toggle mic events
 * @property {(callback: () => void) => void} onInterrupt - Listen for interrupt events
 * @property {(callback: () => void) => void} onStartMic - Listen for start mic events (push-to-talk)
 * @property {(callback: () => void) => void} onStopMic - Listen for stop mic events (push-to-talk)
 * @property {(channel: string, data: any) => void} sendToMain - Send data to main process
 */

contextBridge.exposeInMainWorld("api", {
    /**
     * Get API keys from environment variables
     * @returns {APIKeys}
     */
    getAPIKeys: () => ({
        openai: process.env.OPENAI_API_KEY || "",
        elevenlabs: process.env.ELEVENLABS_API_KEY || "",
        openaiOrgId: process.env.OPENAI_ORG_ID || "",
        openaiProjectId: process.env.OPENAI_PROJECT_ID || "",
    }),

    /**
     * Listen for send message events from main process
     * @param {(text: string) => void} callback
     */
    onSendMessage: (callback) =>
        ipcRenderer.on("send-message", (_, text) => callback(text)),

    /**
     * Listen for toggle mic events from main process
     * @param {() => void} callback
     */
    onToggleMic: (callback) => ipcRenderer.on("toggle-mic", () => callback()),

    /**
     * Listen for interrupt events from main process
     * @param {() => void} callback
     */
    onInterrupt: (callback) => ipcRenderer.on("interrupt", () => callback()),

    /**
     * Listen for start mic events from main process (push-to-talk)
     * @param {() => void} callback
     */
    onStartMic: (callback) => ipcRenderer.on("start-mic", () => callback()),

    /**
     * Listen for stop mic events from main process (push-to-talk)
     * @param {() => void} callback
     */
    onStopMic: (callback) => ipcRenderer.on("stop-mic", () => callback()),

    /**
     * Send data to main process
     * @param {string} channel
     * @param {any} data
     */
    sendToMain: (channel, data) => ipcRenderer.send(channel, data),
});
