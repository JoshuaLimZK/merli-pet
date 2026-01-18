// @ts-check

/** @type {number} */
let totalSeconds = 25 * 60;
/** @type {number | null} */
let remainingSeconds = totalSeconds;
/** @type {number | null} */
let timerId = null;
/** @type {boolean} */
let isRunning = false;

const timeEl = document.getElementById("time");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

/**
 * @param {number} seconds
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function render() {
    if (!timeEl || !statusEl) return;
    const display = remainingSeconds ?? totalSeconds;
    timeEl.textContent = formatTime(display);
    statusEl.textContent = isRunning ? "Running" : "Paused";

    if (startBtn && pauseBtn && resetBtn) {
        startBtn.disabled = isRunning;
        pauseBtn.disabled = !isRunning;
        resetBtn.disabled = remainingSeconds === totalSeconds && !isRunning;
    }
}

function stopTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
    isRunning = false;
}

function tick() {
    if (remainingSeconds === null) return;
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        stopTimer();
        if (statusEl) statusEl.textContent = "Done";
    }
    render();
}

/**
 * @param {number} minutes
 */
function startPomodoro(minutes) {
    const nextTotal = Math.max(1, Math.floor(minutes)) * 60;
    totalSeconds = nextTotal;
    remainingSeconds = nextTotal;
    stopTimer();
    isRunning = true;
    render();
    timerId = window.setInterval(tick, 1000);
}

function resume() {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
        remainingSeconds = totalSeconds;
    }
    stopTimer();
    isRunning = true;
    render();
    timerId = window.setInterval(tick, 1000);
}

function pause() {
    stopTimer();
    render();
}

function reset() {
    stopTimer();
    remainingSeconds = totalSeconds;
    render();
}

if (startBtn) {
    startBtn.addEventListener("click", () => resume());
}
if (pauseBtn) {
    pauseBtn.addEventListener("click", () => pause());
}
if (resetBtn) {
    resetBtn.addEventListener("click", () => reset());
}

// Listen for start events from main
// @ts-expect-error - injected by preload
if (window.pomodoroAPI?.onStart) {
    // @ts-expect-error - injected by preload
    window.pomodoroAPI.onStart((duration) => {
        startPomodoro(duration);
    });
}

render();
