window.electronAPI.onBeginFlagRaising(() => {
    console.log("Flag raising begun!");
    playNationalAnthem();
});

const flagElement = document.getElementById("flag-image");
const flutteringFlagElement = document.getElementById("fluttering-flag-image");

function playNationalAnthem() {
    const audio = new Audio("../../assets/anthem.mp3");
    audio.play();
    audio.addEventListener("ended", () => {
        console.log("National anthem finished playing");
    });
    audio.addEventListener("timeupdate", () => {
        // flag goes from -3% bottom to 60% bottom over the duration of the anthem
        if (flagElement) {
            const progress = audio.currentTime / audio.duration;
            const bottomPercent = -3 + 63 * progress;
            flagElement.style.bottom = `${bottomPercent}%`;
            // goes from 10% to 70% bottom percent
            const flutteringBottomPercent = 10 + 60 * progress;
            if (flutteringFlagElement) {
                flutteringFlagElement.style.bottom = `${flutteringBottomPercent}%`;
            }

            // inverse the opacity of the flags
            const opacity = 1 - progress;
            flagElement.style.opacity = `${opacity}`;
            if (flutteringFlagElement) {
                flutteringFlagElement.style.opacity = `${1 - opacity}`;
            }
        }
    });
    audio.addEventListener("ended", () => {
        // call event to main process to close the window
        window.electronAPI.onEndedFlagRaising();
    });
}
