// @ts-check

/**
 * @typedef {Object} AdminAPI
 * @property {(state: string) => void} setState
 * @property {(callback: (state: string) => void) => void} onStateChange
 * @property {() => void} triggerQuote
 * @property {() => void} interruptAction
 */

/** @type {Window & { electronAPI: AdminAPI }} */
const win = /** @type {any} */ (window);

// Get DOM elements
const currentStateEl = document.getElementById("currentState");
const buttons = document.querySelectorAll("[data-state]");
const quoteBtn = document.getElementById("quoteBtn");

// Handle state button clicks
buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const state = btn.getAttribute("data-state");
        if (state) {
            win.electronAPI.setState(state);
        }
    });
});

// Handle quote button click
if (quoteBtn) {
    quoteBtn.addEventListener("click", () => {
        win.electronAPI.triggerQuote();
    });
}

// Handle interrupt button click
const interruptBtn = document.getElementById("interruptBtn");
if (interruptBtn) {
    interruptBtn.addEventListener("click", () => {
        win.electronAPI.interruptAction();
    });
}

// Listen for state changes
win.electronAPI.onStateChange((state) => {
    if (currentStateEl) {
        currentStateEl.textContent = state;
    }
});
