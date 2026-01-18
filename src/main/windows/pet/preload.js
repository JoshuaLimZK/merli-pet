// @ts-check
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
 * @typedef {Object} RotationData
 * @property {number} angle
 */

/**
 * @typedef {(data: RotationData) => void} RotationCallback
 */

/**
 * @typedef {Object} AnimationData
 * @property {string} animation - Animation name to play
 * @property {number} [duration] - Optional duration override
 */

/**
 * @typedef {(data: AnimationData) => void} AnimationCallback
 */

/**
 * @typedef {Object} ToggleAnimationData
 * @property {string} animation - Animation name to toggle
 * @property {boolean} enabled - Whether to enable or disable
 */

/**
 * @typedef {(data: ToggleAnimationData) => void} ToggleAnimationCallback
 */

/**
 * @typedef {Object} ElectronAPI
 * @property {(callback: MouseMoveCallback) => void} onMouseMove
 * @property {(callback: BehaviorStateCallback) => void} onBehaviorStateChange
 * @property {(callback: MoveCallback) => void} onMove
 * @property {(callback: RotationCallback) => void} onSetRotation
 * @property {(callback: AnimationCallback) => void} onPlayAnimation
 * @property {(callback: ToggleAnimationCallback) => void} onToggleAnimation
 * @property {() => Promise<PetConfig>} getPetConfig
 * @property {(ignore: boolean) => void} setIgnoreMouseEvents
 * @property {(offset: DragOffset) => void} startDrag
 * @property {() => void} stopDrag
 * @property {(region: { vertical: string, horizontal: string, depth: string }) => void} petClicked
 */

contextBridge.exposeInMainWorld("electronAPI", {
    onBehaviorStateChange: (/** @type {BehaviorStateCallback} */ callback) =>
        ipcRenderer.on("behavior-state-change", (_event, data) =>
            callback(data),
        ),
    onMove: (/** @type {MoveCallback} */ callback) =>
        ipcRenderer.on("on-move", (_event, data) => callback(data)),
    onSetRotation: (/** @type {RotationCallback} */ callback) =>
        ipcRenderer.on("set-rotation", (_event, data) => callback(data)),
    onPlayAnimation: (/** @type {AnimationCallback} */ callback) =>
        ipcRenderer.on("play-animation", (_event, data) => callback(data)),
    onToggleAnimation: (/** @type {ToggleAnimationCallback} */ callback) =>
        ipcRenderer.on("toggle-animation", (_event, data) => callback(data)),
    onMusicIdlePlay: (/** @type {() => void} */ callback) =>
        ipcRenderer.on("play-idle-music", () => callback()),
    onMusicIdleStop: (/** @type {() => void} */ callback) =>
        ipcRenderer.on("stop-idle-music", () => callback()),
    onMouseMove: (/** @type {MouseMoveCallback} */ callback) =>
        ipcRenderer.on("mouse-move", (_event, data) => callback(data)),
    getPetConfig: () => ipcRenderer.invoke("get-pet-config"),
    setIgnoreMouseEvents: (/** @type {boolean} */ ignore) =>
        ipcRenderer.send("set-ignore-mouse-events", ignore),
    startDrag: (/** @type {DragOffset} */ offset) =>
        ipcRenderer.send("start-drag", offset),
    stopDrag: () => ipcRenderer.send("stop-drag"),
    petClicked: (
        /** @type {{ vertical: string, horizontal: string, depth: string }} */ region,
    ) => ipcRenderer.send("pet-clicked", region),
});
