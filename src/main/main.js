// @ts-check
import { app, ipcMain, BrowserWindow, screen } from "electron";
import dotenv from "dotenv";
import { uIOhook, UiohookKey } from "uiohook-napi";
import { getWallpaper, setWallpaper } from "wallpaper";

// Load environment variables
dotenv.config();

// ======================
// Import Modules
// ======================
import { PET_WINDOW } from "./windows/pet/config.js";
import {
    createPetWindow,
    getPetWindow,
    getPetPosition,
    setPetPosition,
} from "./windows/pet/window.js";
import { createMicWindow } from "./windows/mic/window.js";
import {
    petBehavior,
    onStateChange,
    checkStateTransition,
    pickWanderTarget,
} from "./state/petBehavior.js";
import { createImageDragWindow } from "./windows/image-drag-in/main.js";
import { transitionToState } from "./state/petBehavior.js";

import * as quoteWindow from "./windows/quote/main.js";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createAdminWindow } from "./windows/admin/main.js";
import { flagPoleAnimation, interruptFlagPole } from "./windows/flagpole/main.js";
import { otterCrossingAnimation, interruptOtterCrossing } from "./windows/otter-crossing/main.js";
import { petMoveTo } from "./movement/main.js";

// @ts-expect-error - ESM does not provide __dirname; create it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Whether wallpaper operations are available on this system
let wallpaperAvailable = false;

/**
 * Check whether the `wallpaper` package can access the system wallpaper
 * @returns {Promise<boolean>}
 */
async function checkWallpaperAvailable() {
    try {
        await getWallpaper();
        return true;
    } catch (err) {
        console.warn(
            "Wallpaper support unavailable:",
            err && err.message ? err.message : err,
        );
        return false;
    }
}
// ======================
// OpenAI Module
// ======================

// ======================
// ElevenLabs Module
// ======================

// ======================
// Reference Variables
// e.g Windows, API Clients, etc.
// ======================
/** @type {BrowserWindow | null} */
let micWindow = null;

// ======================
// Push-to-Talk Setup
// ======================
/** @type {boolean} */
let isPushToTalkActive = false;
/** @type {number} */
const PUSH_TO_TALK_KEY = UiohookKey.AltRight; // Right Alt key

/**
 * Sets up global push-to-talk keyboard listener using uiohook
 * @returns {void}
 */
function setupPushToTalk() {
    uIOhook.on("keydown", (e) => {
        if (e.keycode === PUSH_TO_TALK_KEY && !isPushToTalkActive) {
            isPushToTalkActive = true;
            console.log("🎤 Push-to-talk: START");
            micWindow?.webContents.send("start-mic");
        }
    });

    uIOhook.on("keyup", (e) => {
        if (e.keycode === PUSH_TO_TALK_KEY && isPushToTalkActive) {
            isPushToTalkActive = false;
            console.log("🎤 Push-to-talk: STOP");
            micWindow?.webContents.send("stop-mic");
        }
    });

    uIOhook.start();
    console.log("✅ Push-to-talk initialized (Right Alt key)");
}

// ======================
// IPC Handlers
// ======================
ipcMain.handle("get-pet-config", () => {
    return PET_WINDOW;
});

// Handle mouse events ignore toggle from pet renderer
ipcMain.on("set-ignore-mouse-events", (_event, ignore) => {
    const petWindow = getPetWindow();
    if (petWindow) {
        petWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
});

/** @type {BrowserWindow | null} */
let adminWindow = null;

// Admin state control handler
ipcMain.on("admin-set-state", (_event, state) => {
    console.log("Admin requested state change:", state);

    if (state === "imageDragIn") {
        const petWindow = getPetWindow();
        if (petWindow) {
            transitionToState("imageDragIn", false, 10000);
            dragInRandomImage(petWindow, createImageDragWindow(), null);
        }
    } else if (state === "flagPole") {
        const petWindow = getPetWindow();
        if (petWindow) {
            transitionToState("flagPole", false, Infinity);
            flagPoleAnimation(petWindow);
        }
    } else if (state === "otterCrossing") {
        const petWindow = getPetWindow();
        if (petWindow) {
            transitionToState("otterCrossing", false, Infinity);
            otterCrossingAnimation(petWindow);
        }
    } else if (state === "getBusTimings") {
        transitionToState("getBusTimings", false, 2000);
    } else {
        transitionToState(state, false, 10000);
    }

    // Notify admin window of the state change
    if (adminWindow && !adminWindow.isDestroyed()) {
        adminWindow.webContents.send("admin-state-changed", state);
    }
});

// Admin quote trigger handler
ipcMain.on("admin-trigger-quote", () => {
    console.log("Admin triggered random quote");
    sendRandomQuote();
});

// Pet clicked handler
ipcMain.on("pet-clicked", (_event, region) => {
    console.log("Pet clicked:", region);
    // TODO: Add click handling logic here
});

// Interrupt special actions handler
ipcMain.on("interrupt-special-action", () => {
    console.log("Interrupting special actions");
    interruptFlagPole();
    interruptOtterCrossing();
});

// Show quote from mic renderer (AI response)
ipcMain.on("show-quote", (_event, { text, duration }) => {
    console.log("Showing quote from mic:", text, "duration:", duration);
    sendRandomQuote(text, duration);
});

/** @type {string[]} */
const quotes = [
    "Whoever controls the pantry must have that iron in him.",
    "Ms Ting, what are you doing?! Why you never reply my Telegram?",
    "We have a plan for the East Coast portion of our dinner menu.",
    "That really warms the cockles of my heart.",
    "Is it because I’m Chinese?!",
    "Mee Siam Mai Hum.",
    "You are nothing but a prostitute!",
    "4pm at Pioneer Mall, we settle.",
    "It's on auto-lock by the way.",
    "Even from my sick bed, if I feel the meeting is going wrong, I will get up.",
    "Drop like grapes.",
    "Running is like this!",
    "Ms Ting, what are you doing? Don't eat my fries!",
    "Whoever finishes the last of the coffee must have that iron in him.",
    "Pattern more than badminton.",
    "Own time, own target, own self check.",
    "This is not a game of cards. This is our group project.",
    "Ms Ting, what are you doing?! Why you never approve my leave?",
    "I look left, look right for my Grab rider.",
    "Small spaces are enough for things other than children.",
];

/**
 * Sends a random quote to the renderer process via a quote window
 * @param {string | null} [quote=null] - Optional specific quote to display, otherwise picks randomly
 * @param {number} [duration=5000] - Duration to display the quote in milliseconds
 * @returns {void}
 */
function sendRandomQuote(quote = null, duration = 5000) {
    let petWindow = getPetWindow();
    if (!petWindow) return;
    let quoteW = quoteWindow.createQuoteWindow(petWindow);
    let randomQuote;
    if (!quote) {
        randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    } else {
        randomQuote = quote;
    }
    console.log("Sending quote:", randomQuote);
    quoteW.on("ready-to-show", () => {
        quoteW.webContents.send("random-quote", randomQuote);
    });

    // Store original size to prevent drift
    const quoteWidth = 300;
    const quoteHeight = 300;

    let interval = setInterval(
        () => {
            if (quoteW.isDestroyed()) {
                clearInterval(interval);
                return;
            }
            quoteW.setBounds({
                x: petWindow.getBounds().x + petWindow.getBounds().width - 50,
                y: petWindow.getBounds().y - 50,
                width: quoteWidth,
                height: quoteHeight,
            });
        },
        Math.floor(1000 / PET_WINDOW.UPDATE_FPS),
    );
    setTimeout(() => {
        clearInterval(interval);
        if (quoteW.isDestroyed()) return;
        quoteW.close();
    }, duration);
}

/**
 * Handles the follow behavior - pet follows the mouse cursor
 * @param {Electron.BrowserWindow} petWindow - The pet window to move
 * @returns {void}
 */
function onFollow(petWindow) {
    const mousePosition = screen.getCursorScreenPoint();
    const mousePositionX = mousePosition.x;
    const mousePositionY = mousePosition.y;

    const moving = petMoveTo(
        petWindow,
        mousePositionX,
        mousePositionY,
        PET_WINDOW.FOLLOW_SPEED,
    );
    if (moving === false) {
        return;
    }
}

/**
 * Handles the wander behavior - pet moves to random targets
 * @param {Electron.BrowserWindow} petWindow - The pet window to move
 * @returns {void}
 */
function onWander(petWindow) {
    if (!petBehavior.wanderTarget) {
        petBehavior.wanderTarget = pickWanderTarget();
    }

    let targetX = petBehavior.wanderTarget.x;
    let targetY = petBehavior.wanderTarget.y;

    const moving = petMoveTo(
        petWindow,
        targetX,
        targetY,
        PET_WINDOW.FOLLOW_SPEED,
    );
    if (moving === false) {
        return;
    }
}
import { exec } from "child_process";

/**
 * Handles the idle behavior - pet stays in place
 * @param {Electron.BrowserWindow} petWindow - The pet window
 * @returns {void}
 */
function onIdle(petWindow) {
    const { x: petWindowCurrentX, y: petWindowCurrentY } = getPetPosition();

    petMoveTo(petWindow, petWindowCurrentX, petWindowCurrentY, 0);
}

function musicCheckMac() {
    const script = `
    tell application "Spotify"
        if player state is playing then
            return "playing"
        else
            return "paused"
        end if
    end tell
  `;
    return new Promise((resolve) => {
        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error checking music state: ${error.message}`);
                resolve(false);
                return;
            }
            if (stderr && stderr.trim()) {
                console.warn(`Music state warning: ${stderr.trim()}`);
            }
            resolve(stdout.trim() === "playing");
        });
    });
}

// ======================
// Update Loop
// ======================

/**
 * Starts the main pet update loop that handles behavior state transitions and movement
 * @returns {void}
 */
function startPetUpdateLoop() {
    let newIdleState = true;
    let idleMusicInterval = null;
    const mainLoop = setInterval(
        () => {
            const petWindow = getPetWindow();
            if (!petWindow) return;

            let didTransition = checkStateTransition();

            if (didTransition) {
                console.log(
                    `🐾 Pet transitioned to state: ${petBehavior.state}`,
                );
            }
            if (didTransition && Math.random() < 0.175) {
                sendRandomQuote();
                console.log("Sent random quote due to state transition");
            }
            if (didTransition && Math.random() < 0.015) {
                transitionToState("imageDragIn", false, 10000);
                console.log("Dragging in random image due to state transition");
                dragInRandomImage(petWindow, createImageDragWindow(), mainLoop);
            }

            if (petBehavior.state === "getBusTimings") {
                const busWindow = new BrowserWindow({
                    width: 200,
                    height: 150,
                });
                busWindow.loadFile(
                    path.join(__dirname, "../renderer/bus/index.html"),
                );
                transitionToState("idle", false, 1000);
            }
            if (didTransition && Math.random() < 0.05 && wallpaperAvailable) {
                (async () => {
                    try {
                        const currentWallpaper = await getWallpaper();
                        const newWallpaper = path.join(
                            __dirname,
                            "../assets/lky.jpg",
                        );
                        await setWallpaper(newWallpaper);
                        console.log("Wallpaper changed to:", newWallpaper);

                        setTimeout(async () => {
                            try {
                                await setWallpaper(currentWallpaper);
                                console.log("Wallpaper reverted to original.");
                            } catch (err) {
                                console.error(
                                    "Failed to revert wallpaper:",
                                    err,
                                );
                            }
                        }, 1000);
                    } catch (err) {
                        console.error("Wallpaper change failed:", err);
                        // mark unavailable to avoid repeated failures
                        wallpaperAvailable = false;
                    }
                })();
            }

            if (petBehavior.state !== "idle") {
                newIdleState = true;
                petWindow.webContents.send("stop-idle-music");
                if (idleMusicInterval) {
                    clearInterval(idleMusicInterval);
                    idleMusicInterval = null;
                }
            }

            switch (petBehavior.state) {
                case "follow":
                    onFollow(petWindow);
                    break;
                case "wander":
                    onWander(petWindow);
                    break;

                case "idle":
                    if (newIdleState) {
                        if (process.platform === "darwin") {
                            idleMusicInterval = setInterval(() => {
                                musicCheckMac().then((musicPlaying) => {
                                    console.log("Music playing:", musicPlaying);
                                    if (musicPlaying) {
                                        petWindow.webContents.send(
                                            "play-idle-music",
                                        );
                                    } else {
                                        petWindow.webContents.send(
                                            "stop-idle-music",
                                        );
                                    }
                                });
                            }, 1000);
                        }
                    }
                    newIdleState = false;
                    onIdle(petWindow);
                    break;
            }
        },
        Math.floor(1000 / PET_WINDOW.UPDATE_FPS),
    );
}
/**
 * Drags in a random image from the right side of the screen
 * @param {Electron.BrowserWindow} petWindow - The pet window
 * @param {Electron.BrowserWindow} imageDragWindow - The image drag window
 * @param {NodeJS.Timeout | null} mainLoop - The main update loop interval to pause (optional)
 * @returns {void}
 */
function dragInRandomImage(petWindow, imageDragWindow, mainLoop) {
    if (!petWindow || petWindow.isDestroyed()) return;
    if (mainLoop) clearInterval(mainLoop);
    // get random image from assets/mems
    const memsDir = path.join(__dirname, "../assets/mems");
    const memFiles = fs
        .readdirSync(memsDir)
        .filter((file) =>
            [".png", ".jpg", ".jpeg", ".gif", ".bmp"].includes(
                path.extname(file).toLowerCase(),
            ),
        );
    const randomMemFile = memFiles[Math.floor(Math.random() * memFiles.length)];
    const randomMemPath = path.join(memsDir, randomMemFile);
    console.log("Selected random image:", randomMemPath);

    console.log("Dragging in image:", randomMemPath);
    imageDragWindow.on("ready-to-show", () => {
        imageDragWindow.webContents.send(
            "image-url",
            `file://${randomMemPath}`,
        );
    });

    const targetX =
        screen.getPrimaryDisplay().workAreaSize.width -
        Math.floor(
            Math.random() * (screen.getPrimaryDisplay().workAreaSize.width / 2),
        );
    const targetY = Math.floor(
        Math.random() * screen.getPrimaryDisplay().workAreaSize.height,
    );

    const dragInImageLoop = setInterval(() => {
        let moved = petMoveTo(
            petWindow,
            screen.getPrimaryDisplay().workAreaSize.width,
            targetY,
            3,
        );
        if (!moved) {
            slideInFromRight(
                imageDragWindow,
                400,
                400,
                3,
                targetY - 200,
                targetX,
            );
            const pullOutLoop = setInterval(
                () => {
                    let movedBack = petMoveTo(petWindow, targetX, targetY, 3);
                    if (!movedBack) {
                        clearInterval(pullOutLoop);
                        transitionToState("idle", false, 5000);
                        startPetUpdateLoop();
                    }
                },
                Math.floor(1000 / PET_WINDOW.UPDATE_FPS),
            );
            clearInterval(dragInImageLoop);
        }
    }, 10);
}

// ======================
// Window slide in function from right
// ======================

/**
 * Animates a window sliding in from the right side of the screen.
 * @param {Electron.BrowserWindow} window - The window to animate
 * @param {number} width - The target width of the window in pixels
 * @param {number} height - The target height of the window in pixels
 * @param {number} [speed=2] - The animation speed in pixels per frame
 * @param {number} [y=Math.floor(screen.getPrimaryDisplay().workAreaSize.height / 2 - height / 2)] - The vertical position of the window in pixels
 * @returns {void}
 */

function slideInFromRight(
    window,
    width,
    height,
    speed = 3,
    y = Math.floor(
        screen.getPrimaryDisplay().workAreaSize.height / 2 - height / 2,
    ),
    x = 0,
) {
    window.setBounds({
        x: screen.getPrimaryDisplay().workAreaSize.width,
        y,
        width: 0,
        height,
    });
    window.setBounds({
        x: screen.getPrimaryDisplay().workAreaSize.width,
        y,
        width,
        height,
    });
    window.show();
    const interval = setInterval(
        () => {
            const bounds = window.getBounds();
            const targetX = x;
            if (bounds.x > targetX) {
                const nextX = Math.max(bounds.x - speed, targetX);
                window.setBounds({ x: nextX, y: bounds.y, width, height });
            } else {
                clearInterval(interval);
            }
        },
        Math.floor(1000 / PET_WINDOW.UPDATE_FPS),
    );
}

// ======================
// App Handlers
// e.g, State Change, Event Management
// ======================
onStateChange((newState) => {
    const petWindow = getPetWindow();
    if (!petWindow) return;
    petWindow.webContents.send("behavior-state-change", {
        state: newState,
    });

    // Also notify admin window
    if (adminWindow && !adminWindow.isDestroyed()) {
        adminWindow.webContents.send("admin-state-changed", newState);
    }
});

// ======================
// App Lifecycle
// e.g, WhenReady, Activate, etc.
// ======================
app.whenReady().then(() => {
    micWindow = createMicWindow(true);
    setupPushToTalk();
    // determine at startup whether wallpaper operations work on this host
    const petWindow = createPetWindow(!app.isPackaged);
    petWindow.once("ready-to-show", () => {
        startPetUpdateLoop();
    });
    adminWindow = createAdminWindow();
});

app.on("will-quit", () => {
    uIOhook.stop();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        const petWindow = createPetWindow(!app.isPackaged);
        petWindow.once("ready-to-show", () => {
            startPetUpdateLoop();
        });
    }
});
