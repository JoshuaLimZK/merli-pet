// @ts-check

const container = document.getElementById("container");

// Configuration
const SPAWN_DURATION = 8000; // 8 seconds of spawning
const CROSSING_TIME = 10000; // Time for an otter to cross the screen (ms)
const SPAWN_INTERVAL = 400; // Spawn a new otter every 400ms
const OTTER_IMAGES = [
    "../../assets/otter1.png",
    "../../assets/otter2.png",
    "../../assets/otter3.png",
    "../../assets/otter4.png",
    "../../assets/otter5.png",
];

let activeOtters = 0;
let spawnTimer = null;
let isSpawning = false;

// Audio elements for otter sounds
const otterSound1 = new Audio("../../assets/otterSounds1.mp3");
const otterSound2 = new Audio("../../assets/otterSounds2.mp3");

/**
 * Play otter sounds simultaneously
 */
function playOtterSounds() {
    otterSound1.loop = true;
    otterSound2.loop = true;
    otterSound1.volume = 0.6;
    otterSound2.volume = 0.6;

    otterSound1
        .play()
        .catch((err) => console.warn("Could not play otterSound1:", err));
    otterSound2
        .play()
        .catch((err) => console.warn("Could not play otterSound2:", err));
}

/**
 * Stop otter sounds
 */
function stopOtterSounds() {
    otterSound1.pause();
    otterSound2.pause();
    otterSound1.currentTime = 0;
    otterSound2.currentTime = 0;
}

/**
 * Create an otter and animate it across the screen
 */
function createOtter() {
    const otter = document.createElement("img");

    // Random otter image
    const randomImage =
        OTTER_IMAGES[Math.floor(Math.random() * OTTER_IMAGES.length)];
    otter.src = randomImage;
    otter.className = "otter";

    // Random size (80-150px for variety/depth effect)
    const size = 80 + Math.random() * 70;
    otter.style.height = `${size}px`;
    otter.style.width = "auto";

    // Random waddle timing for variety
    const waddleSpeed = 0.3 + Math.random() * 0.2;
    otter.style.animationDuration = `${waddleSpeed}s`;
    otter.style.animationDelay = `${Math.random() * 0.3}s`;

    // Random Y position (within container bounds)
    const maxY = (container?.clientHeight || 200) - size;
    otter.style.top = `${Math.random() * Math.max(maxY, 50)}px`;

    // Start off-screen left
    otter.style.left = `-${size + 20}px`;

    // Slight speed variation for natural look
    const duration = CROSSING_TIME + (Math.random() - 0.5) * 1000;
    otter.style.transition = `left ${duration}ms linear`;

    container?.appendChild(otter);
    activeOtters++;

    // Start movement after brief delay (allows transition to kick in)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Move to off-screen right
            otter.style.left = `calc(100vw + ${size}px)`;
        });
    });

    // Remove after crossing completes
    setTimeout(() => {
        otter.remove();
        activeOtters--;
        checkComplete();
    }, duration + 100);
}

/**
 * Check if all otters have crossed and signal completion
 */
function checkComplete() {
    if (activeOtters <= 0 && !isSpawning) {
        console.log("🦦 All otters crossed!");
        // Stop the sounds
        stopOtterSounds();
        setTimeout(() => {
            if (window.electronAPI && window.electronAPI.endOtterCrossing) {
                window.electronAPI.endOtterCrossing();
            }
        }, 500);
    }
}

/**
 * Start continuous waves of otters
 */
function startCrossing() {
    console.log("🦦 Starting otter crossing!");
    isSpawning = true;

    // Play otter sounds
    playOtterSounds();

    // Spawn first otter immediately
    createOtter();

    // Continue spawning in waves
    spawnTimer = setInterval(() => {
        createOtter();

        // Occasionally spawn 2-3 otters together for wave effect
        if (Math.random() > 0.6) {
            setTimeout(() => createOtter(), 100);
        }
        if (Math.random() > 0.8) {
            setTimeout(() => createOtter(), 200);
        }
    }, SPAWN_INTERVAL);

    // Stop spawning after SPAWN_DURATION
    setTimeout(() => {
        if (spawnTimer) {
            clearInterval(spawnTimer);
            spawnTimer = null;
        }
        isSpawning = false;
        console.log("🦦 Stopped spawning, waiting for remaining otters...");
    }, SPAWN_DURATION);
}

// Listen for start signal from main process
if (window.electronAPI && window.electronAPI.onStartCrossing) {
    window.electronAPI.onStartCrossing(() => {
        startCrossing();
    });
}
