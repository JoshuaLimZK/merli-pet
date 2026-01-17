// @ts-check
const { BrowserWindow, screen } = require("electron");
const path = require("path");
const { PET_WINDOW } = require("./config");
const { transitionToState } = require("../../state/petBehavior");

/** @type {number} */
let petWindowCurrentX = 0;

/** @type {number} */
let petWindowCurrentY = 0;

/** @type {BrowserWindow | null} */
let petWindow = null;

/**
 * @returns {{x: number, y: number}}
 */
function getPetPosition() {
    return { x: petWindowCurrentX, y: petWindowCurrentY };
}

/**
 * @param {number} x
 * @param {number} y
 */
function setPetPosition(x, y) {
    petWindowCurrentX = x;
    petWindowCurrentY = y;
}

/**
 * @returns {BrowserWindow | null}
 */
function getPetWindow() {
    return petWindow;
}

/**
 * Creates and returns the pet window
 * @param {boolean} isDevelopment
 * @returns {BrowserWindow}
 */
function createPetWindow(isDevelopment) {
    const { width: screenWidth, height: screenHeight } =
        screen.getPrimaryDisplay().workAreaSize;

    petWindowCurrentX = Math.floor(screenWidth / 2);
    petWindowCurrentY = Math.floor(screenHeight / 2);

    petWindow = new BrowserWindow({
        width: PET_WINDOW.SIZE,
        height: PET_WINDOW.SIZE,
        x: petWindowCurrentX - PET_WINDOW.SIZE / 2,
        y: petWindowCurrentY - PET_WINDOW.SIZE / 2,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        movable: false,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    petWindow.setIgnoreMouseEvents(true, { forward: true });
    petWindow.loadFile(
        path.join(__dirname, "../../../renderer/pet/index.html"),
    );

    if (isDevelopment) {
        petWindow.webContents.openDevTools({ mode: "detach" });
    }

    petWindow.webContents.on("did-finish-load", () => {
        transitionToState("follow");
    });

    return petWindow;
}

module.exports = {
    createPetWindow,
    getPetWindow,
    getPetPosition,
    setPetPosition,
};
