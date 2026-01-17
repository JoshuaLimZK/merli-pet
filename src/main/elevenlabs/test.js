import * as dotenv from "dotenv";
import WebSocket from "ws";
import { spawn } from "node:child_process";

dotenv.config();

const ELEVENLABS_CONFIG = {
    apiKey: process.env.ELEVENLABS_API_KEY || "",
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    model: "eleven_flash_v2_5",
    uri() {
        return `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?model_id=${this.model}`;
    },
};

if (!ELEVENLABS_CONFIG.apiKey) {
    console.warn(
        "ELEVENLABS_API_KEY is not set. ElevenLabs TTS will not be initialized.",
    );
}

const elevenLabsWebSocket = new WebSocket(ELEVENLABS_CONFIG.uri(), {
    headers: {
        "xi-api-key": ELEVENLABS_CONFIG.apiKey,
    },
});

// Use ffplay to stream audio directly (make sure ffmpeg/ffplay is installed)
// On Windows: choco install ffmpeg
// On Mac: brew install ffmpeg
// On Linux: apt-get install ffmpeg
const ffplay = spawn("ffplay", [
    "-nodisp", // No video display
    "-autoexit", // Exit when playback finishes
    "-f",
    "mp3", // Input format
    "-", // Read from stdin
]);

ffplay.stderr.on("data", (data) => {
    // ffplay outputs to stderr, suppress unless there's an error
    if (data.toString().includes("Error")) {
        console.error("FFplay error:", data.toString());
    }
});

const text =
    "The twilight sun cast its warm golden hues upon the vast rolling fields, saturating the landscape with an ethereal glow. Silently, the meandering brook continued its ceaseless journey, whispering secrets only the trees seemed privy to.";

elevenLabsWebSocket.on("open", async () => {
    elevenLabsWebSocket.send(
        JSON.stringify({
            text: " ",
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.8,
                use_speaker_boost: false,
            },
            generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
        }),
    );

    elevenLabsWebSocket.send(JSON.stringify({ text: text }));

    // Send empty string to indicate the end of the text sequence which will close the websocket connection
    elevenLabsWebSocket.send(JSON.stringify({ text: "" }));
});

/**
 * @param {string} base64str
 */
function streamAudio(base64str) {
    const audioBuffer = Buffer.from(base64str, "base64");
    ffplay.stdin.write(audioBuffer);
}

// Listen to the incoming message from the websocket connection
elevenLabsWebSocket.on("message", function incoming(event) {
    const data = JSON.parse(event.toString());
    if (data["audio"]) {
        streamAudio(data["audio"]);
    }
});

// Close ffplay when the elevenLabsWebSocket connection closes
elevenLabsWebSocket.on("close", () => {
    ffplay.stdin.end();
});
