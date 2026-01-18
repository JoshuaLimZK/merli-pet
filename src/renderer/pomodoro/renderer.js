// @ts-check

/** @type {number | null} */
let timerId = null;
/** @type {boolean} */
let isRunning = false;
/** @type {{ type: "focus" | "break"; seconds: number }[]} */
let phasePlan = [];
/** @type {number} */
let phaseIndex = 0;
/** @type {number} */
let phaseRemainingSeconds = 25 * 60;
/** @type {number} */
let phaseTotalSeconds = 25 * 60;
/** @type {"pomodoro" | "timer"} */
let currentMode = "pomodoro";

const timeEl = document.getElementById("time");
const statusEl = document.getElementById("status");
const ringProgress = document.getElementById("ringProgress");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const skipBtn = document.getElementById("skipBtn");
const resetBtn = document.getElementById("resetBtn");

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

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
    timeEl.textContent = formatTime(phaseRemainingSeconds);

    const currentPhase = phasePlan[phaseIndex]?.type ?? "focus";
    if (currentMode === "timer") {
        statusEl.textContent = "Timer";
        document.body.dataset.phase = "focus";
    } else {
        statusEl.textContent = currentPhase === "break" ? "Break" : "Focus";
        document.body.dataset.phase = currentPhase;
    }

    if (ringProgress) {
        const progress =
            phaseTotalSeconds > 0
                ? phaseRemainingSeconds / phaseTotalSeconds
                : 0;
        const offset = RING_CIRCUMFERENCE * (1 - progress);
        ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
        ringProgress.style.strokeDashoffset = `${offset}`;
    }

    if (startBtn && pauseBtn && resetBtn) {
        startBtn.disabled = isRunning;
        pauseBtn.disabled = !isRunning;
        resetBtn.disabled =
            !isRunning && phaseRemainingSeconds === phaseTotalSeconds;
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
    phaseRemainingSeconds -= 1;
    if (phaseRemainingSeconds <= 0) {
        advancePhase();
    }
    render();
}

/**
 * @param {number} minutes
 */
function buildPhasePlan(minutes) {
    const totalMinutes = Math.max(1, Math.floor(minutes));
    let remaining = totalMinutes;
    /** @type {{ type: "focus" | "break"; seconds: number }[]} */
    const plan = [];

    while (remaining > 0) {
        const focus = Math.min(25, remaining);
        plan.push({ type: "focus", seconds: focus * 60 });
        remaining -= focus;
        if (remaining <= 0) break;
        const rest = Math.min(5, remaining);
        plan.push({ type: "break", seconds: rest * 60 });
        remaining -= rest;
    }

    return plan.length > 0 ? plan : [{ type: "focus", seconds: 25 * 60 }];
}

function applyPhase(index) {
    phaseIndex = index % phasePlan.length;
    const phase = phasePlan[phaseIndex];
    phaseTotalSeconds = phase.seconds;
    phaseRemainingSeconds = phase.seconds;
    render();
}

function advancePhase() {
    if (phasePlan.length === 0) return;
    applyPhase((phaseIndex + 1) % phasePlan.length);
}

function skipToBreak() {
    if (currentMode === "timer") {
        return;
    }
    if (phasePlan.length === 0) return;
    const currentPhase = phasePlan[phaseIndex]?.type ?? "focus";
    if (currentPhase === "break") {
        advancePhase();
        return;
    }
    const nextIndex = (phaseIndex + 1) % phasePlan.length;
    if (phasePlan[nextIndex]?.type === "break") {
        applyPhase(nextIndex);
    } else {
        advancePhase();
    }
}

/**
 * @param {number} minutes
 */
function startPomodoro(minutes, mode = "pomodoro") {
    currentMode = mode === "timer" ? "timer" : "pomodoro";
    if (currentMode === "timer") {
        phasePlan = [
            { type: "focus", seconds: Math.max(1, Math.floor(minutes)) * 60 },
        ];
    } else {
        phasePlan = buildPhasePlan(minutes);
    }
    applyPhase(0);
    stopTimer();
    isRunning = true;
    render();
    timerId = window.setInterval(tick, 1000);
}

function resume() {
    if (phasePlan.length === 0) return;
    if (phaseRemainingSeconds <= 0) {
        applyPhase(phaseIndex);
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
    if (phasePlan.length > 0) {
        applyPhase(0);
    }
    render();
}

if (startBtn) {
    startBtn.addEventListener("click", () => resume());
}
if (pauseBtn) {
    pauseBtn.addEventListener("click", () => pause());
}
if (skipBtn) {
    skipBtn.addEventListener("click", () => {
        skipToBreak();
        render();
    });
}
if (resetBtn) {
    resetBtn.addEventListener("click", () => reset());
}

// Listen for start events from main
// @ts-expect-error - injected by preload
if (window.pomodoroAPI?.onStart) {
    // @ts-expect-error - injected by preload
    window.pomodoroAPI.onStart((payload) => {
        if (typeof payload === "number") {
            startPomodoro(payload);
            return;
        }
        if (payload && typeof payload === "object") {
            startPomodoro(payload.duration, payload.mode);
        }
    });
}

phasePlan = buildPhasePlan(25);
applyPhase(0);
render();
