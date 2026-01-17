// @ts-check

/**
 * Quote renderer - Displays random quotes received from main process
 */

/** @typedef {Object} ElectronAPI
 * @property {function(function(string): void): void} onRandomQuote
 * @property {function(function(number, number): void): void} onLocationUpdate
 * @property {function(number, number): void} resizeWindow
 */

/** @type {Window & typeof globalThis & { electronAPI: ElectronAPI }} */
const quoteWindow =
    /** @type {Window & typeof globalThis & { electronAPI: ElectronAPI }} */ (
        window
    );

/**
 * Resize window to fit content
 */
function resizeWindowToContent() {
    // Use requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(() => {
        const container = document.getElementById("quote-container");
        if (container) {
            // Get the content dimensions
            const contentWidth = container.offsetWidth;
            const contentHeight = container.offsetHeight;
            
            // Add space for the tail (60px height)
            const tailHeight = 60;
            const padding = 20; // Extra padding for margins
            
            const width = Math.max(contentWidth + padding, 250);
            const height = contentHeight + tailHeight + padding;
            
            console.log(`Resizing window to ${width}x${height}`);
            window.electronAPI.resizeWindow(width, height);
        }
    });
}

// Listen for the random quote from the main process
quoteWindow.electronAPI.onRandomQuote((/** @type {string} */ quote) => {
    console.log("Received quote:", quote);
    /** @type {HTMLElement | null} */
    const quoteElement = document.getElementById("quote-display");
    if (quoteElement) {
        quoteElement.textContent = quote;
        // Resize window after content is set
        resizeWindowToContent();
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
