const { contextBridge, ipcRenderer } = require("electron");

/**
 * @typedef {Object} MouseMoveData
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} BehaviorStateData
 * @property {string} state
 */

/**
 * @typedef {Object} MoveData
 * @property {boolean} stopped
 * @property {number} angle
 */

/**
 * @typedef {Object} DragOffset
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} PetConfig
 */

/**
 * @typedef {(data: MouseMoveData) => void} MouseMoveCallback
 */

/**
 * @typedef {(data: BehaviorStateData) => void} BehaviorStateCallback
 */

/**
 * @typedef {(data: MoveData) => void} MoveCallback
 */

/**
 * @typedef {Object} ElectronAPI
 * @property {(callback: MouseMoveCallback) => void} onMouseMove
 * @property {(callback: BehaviorStateCallback) => void} onBehaviorStateChange
 * @property {(callback: MoveCallback) => void} onMove
 * @property {() => Promise<PetConfig>} getPetConfig
 * @property {(ignore: boolean) => void} setIgnoreMouseEvents
 * @property {(offset: DragOffset) => void} startDrag
 * @property {() => void} stopDrag
 */

contextBridge.exposeInMainWorld("electronAPI", {
    onMouseMove: (/** @type {MouseMoveCallback} */ callback) =>
        ipcRenderer.on("mouse-move", (_event, data) => callback(data)),
    onBehaviorStateChange: (/** @type {BehaviorStateCallback} */ callback) =>
        ipcRenderer.on("behavior-state-change", (_event, data) =>
            callback(data),
        ),
    onMove: (/** @type {MoveCallback} */ callback) =>
        ipcRenderer.on("on-move", (_event, data) => callback(data)),
    getPetConfig: () => ipcRenderer.invoke("get-pet-config"),
    setIgnoreMouseEvents: (/** @type {boolean} */ ignore) =>
        ipcRenderer.send("set-ignore-mouse-events", ignore),
    startDrag: (/** @type {DragOffset} */ offset) =>
        ipcRenderer.send("start-drag", offset),
    stopDrag: () => ipcRenderer.send("stop-drag"),
});
