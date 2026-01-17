// @ts-check
const { app, ipcMain, BrowserWindow, screen } = require("electron");

// ======================
// Import Modules
// ======================
const { PET_WINDOW, PET_BEHAVIOR } = require("./windows/pet/config");
const {
    createPetWindow,
    getPetWindow,
    getPetPosition,
    setPetPosition,
} = require("./windows/pet/window");
const { petBehavior, onStateChange } = require("./state/petBehavior");

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

// ======================
// IPC Handlers
// ======================
ipcMain.handle("get-pet-config", () => {
    return PET_WINDOW;
});

// ======================
// Update Loop
// ======================
function startPetUpdateLoop() {
    setInterval(
        () => {
            const petWindow = getPetWindow();
            if (!petWindow) return;

            const mousePosition = screen.getCursorScreenPoint();
            const mousePositionX = mousePosition.x;
            const mousePositionY = mousePosition.y;

            const { x: petWindowCurrentX, y: petWindowCurrentY } =
                getPetPosition();
            const deltaXMouseToWindow = mousePositionX - petWindowCurrentX;
            const deltaYMouseToWindow = mousePositionY - petWindowCurrentY;
            const distanceMouseToWindow = Math.hypot(
                deltaXMouseToWindow,
                deltaYMouseToWindow,
            );

            let targetX, targetY, angleToTarget, distanceToTarget;

            if (petBehavior.state === "wander" && petBehavior.wanderTarget) {
                targetX = petBehavior.wanderTarget.x;
                targetY = petBehavior.wanderTarget.y;
            } else {
                targetX = mousePositionX;
                targetY = mousePositionY;
            }

            let deltaXToTarget = targetX - petWindowCurrentX;
            let deltaYToTarget = targetY - petWindowCurrentY;
            distanceToTarget = Math.hypot(deltaXToTarget, deltaYToTarget);
            angleToTarget = Math.atan2(deltaYToTarget, deltaXToTarget);

            petWindow.webContents.send("mouse-move", {
                mousePosition: { x: mousePositionX, y: mousePositionY },
                deltatMouseToWindow: {
                    x: deltaXMouseToWindow,
                    y: deltaYMouseToWindow,
                },
                angleMouseToWindow: Math.atan2(
                    deltaYMouseToWindow,
                    deltaXMouseToWindow,
                ),
                angleToTarget,
                distanceMouseToWindow,
                isWithinStopDistance:
                    distanceMouseToWindow <=
                    PET_WINDOW.STOP_DISTANCE_FROM_MOUSE,
                behaviorState: petBehavior.state,
            });

            let shouldMove = false;
            let speed = 0;

            switch (petBehavior.state) {
                case "follow":
                    if (
                        distanceMouseToWindow >
                        PET_WINDOW.STOP_DISTANCE_FROM_MOUSE
                    ) {
                        shouldMove = true;
                        speed = PET_WINDOW.FOLLOW_SPEED;
                    }
                    break;
                case "wander":
                    if (
                        distanceToTarget >
                        PET_BEHAVIOR.WANDER_TARGET_REACHED_DISTANCE
                    ) {
                        shouldMove = true;
                        speed = PET_BEHAVIOR.WANDER_SPEED;
                    } else {
                        const {
                            pickWanderTarget,
                        } = require("./state/petBehavior");
                        petBehavior.wanderTarget = pickWanderTarget();
                    }
                    break;

                case "idle":
                    shouldMove = false;
                    break;
            }

            if (shouldMove && distanceToTarget > 0) {
                const directionX = deltaXToTarget / distanceToTarget;
                const directionY = deltaYToTarget / distanceToTarget;

                let moveX = directionX * speed;
                let moveY = directionY * speed;
                const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);

                if (moveDistance > distanceToTarget) {
                    moveX = deltaXToTarget;
                    moveY = deltaYToTarget;
                }

                const newX = petWindowCurrentX + moveX;
                const newY = petWindowCurrentY + moveY;
                setPetPosition(newX, newY);

                const petWindowX = Math.round(newX - PET_WINDOW.SIZE / 2);
                const petWindowY = Math.round(newY - PET_WINDOW.SIZE / 2);

                petWindow.setPosition(petWindowX, petWindowY, false);
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
});

// ======================
// App Lifecycle
// e.g, WhenReady, Activate, etc.
// ======================
app.whenReady().then(() => {
    createPetWindow(!app.isPackaged);

    startPetUpdateLoop();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createPetWindow(!app.isPackaged);

        startPetUpdateLoop();
    }
});
