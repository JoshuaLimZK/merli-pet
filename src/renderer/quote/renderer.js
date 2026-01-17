// Request a random quote
// Listen for the random quote from the main process
window.electronAPI.onRandomQuote((quote) => {
    console.log("Received quote:", quote);
    const quoteElement = document.getElementById("quote-display");
    quoteElement.textContent = quote;
});
window.electronAPI.onLocationUpdate((x, y) => {
    const quoteWindow = require("electron").remote.getCurrentWindow();
    quoteWindow.setBounds({ x: x, y: y });
});