// @ts-check

/**
 * Quote renderer - Displays random quotes received from main process
 */

/** @typedef {Object} ElectronAPI
 * @property {function(function(string): void): void} onRandomQuote
 * @property {function(function(number, number): void): void} onLocationUpdate
 */

/** @type {Window & typeof globalThis & { electronAPI: ElectronAPI }} */
const quoteWindow =
    /** @type {Window & typeof globalThis & { electronAPI: ElectronAPI }} */ (
        window
    );

// Listen for the random quote from the main process
quoteWindow.electronAPI.onRandomQuote((/** @type {string} */ quote) => {
    console.log("Received quote:", quote);
    /** @type {HTMLElement | null} */
    const quoteElement = document.getElementById("quote-display");
    if (quoteElement) {
        quoteElement.textContent = quote;
    }
});

// Listen for location updates from main process
quoteWindow.electronAPI.onLocationUpdate(
    (/** @type {number} */ x, /** @type {number} */ y) => {
        console.log("Received location update:", x, y);
        // Location updates should be handled in the main process
        // The window position is already being set by the main process
    },
);
