import WebSocket from "ws";
import { spawn } from "node:child_process";

/**
 * ElevenLabs Configuration
 */
const ELEVENLABS_CONFIG = {
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    model: "eleven_flash_v2_5",
    stability: 0.5,
    similarityBoost: 0.8,
    useSpeakerBoost: false,
};

/**
 * @typedef {Object} ElevenLabsSession
 * @property {WebSocket} ws
 * @property {import('child_process').ChildProcess} ffplay
 * @property {string} textBuffer
 * @property {boolean} isConnected
 * @property {boolean} isInitialized
 */

/**
 * @type {ElevenLabsSession | null}
 */
let session = null;

/**
 * Get ElevenLabs WebSocket URI
 * @param {string} voiceId
 * @param {string} model
 * @returns {string}
 */
function getElevenLabsUri(voiceId, model) {
    return `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}`;
}

/**
 * Initialize ElevenLabs TTS session
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
export async function initializeElevenLabsSession(apiKey) {
    if (session?.isConnected) {
        console.log("ElevenLabs session already connected");
        return;
    }

    return new Promise((resolve, reject) => {
        try {
            // Initialize ffplay for audio streaming
            const ffplay = spawn("ffplay", [
                "-nodisp",
                "-autoexit",
                "-f",
                "mp3",
                "-",
            ]);

            ffplay.stderr.on("data", (data) => {
                if (data.toString().includes("Error")) {
                    console.error("FFplay error:", data.toString());
                }
            });

            // Create WebSocket connection
            const ws = new WebSocket(
                getElevenLabsUri(
                    ELEVENLABS_CONFIG.voiceId,
                    ELEVENLABS_CONFIG.model,
                ),
                {
                    headers: {
                        "xi-api-key": apiKey,
                    },
                },
            );

            session = {
                ws,
                ffplay,
                textBuffer: "",
                isConnected: false,
                isInitialized: false,
            };

            ws.on("open", () => {
                console.log("ElevenLabs WebSocket connected");
                if (!session) return;
                session.isConnected = true;

                // Send initial configuration
                ws.send(
                    JSON.stringify({
                        text: " ",
                        voice_settings: {
                            stability: ELEVENLABS_CONFIG.stability,
                            similarity_boost: ELEVENLABS_CONFIG.similarityBoost,
                            use_speaker_boost:
                                ELEVENLABS_CONFIG.useSpeakerBoost,
                        },
                        generation_config: {
                            chunk_length_schedule: [120, 160, 250, 290],
                        },
                    }),
                );

                session.isInitialized = true;
                resolve();
            });

            ws.on("message", (data) => {
                const response = JSON.parse(data.toString());

                if (response.audio) {
                    // Stream audio to ffplay
                    const audioBuffer = Buffer.from(response.audio, "base64");
                    if (!session || !session.ffplay || !session.ffplay.stdin)
                        return;
                    session.ffplay.stdin.write(audioBuffer);
                }

                if (response.isFinal) {
                    console.log("ElevenLabs audio generation complete");
                }
            });

            ws.on("error", (error) => {
                console.error("ElevenLabs WebSocket error:", error);
                reject(error);
            });

            ws.on("close", () => {
                console.log("ElevenLabs WebSocket closed");
                if (session) {
                    session.isConnected = false;
                    session.isInitialized = false;
                }
            });
        } catch (error) {
            console.error("Failed to initialize ElevenLabs session:", error);
            reject(error);
        }
    });
}

/**
 * Handle streaming text from OpenAI and send to ElevenLabs
 * Uses intelligent chunking to send text at natural boundaries
 * @param {string} textDelta
 */
export function streamTextToElevenLabs(textDelta) {
    if (!session?.isConnected || !session?.isInitialized) {
        throw new Error("ElevenLabs session is not initialized");
    }

    session.textBuffer += textDelta;

    // Configuration for text chunking
    const MIN_CHUNK_SIZE = 50;
    const MAX_CHUNK_SIZE = 500;
    const BOUNDARIES = [". ", "! ", "? ", "\n\n", ", ", "; ", ": "];

    // Check for natural boundaries
    for (const boundary of BOUNDARIES) {
        const lastIndex = session.textBuffer.lastIndexOf(boundary);

        if (lastIndex !== -1 && session.textBuffer.length >= MIN_CHUNK_SIZE) {
            const chunk = session.textBuffer.substring(
                0,
                lastIndex + boundary.length,
            );
            session.textBuffer = session.textBuffer.substring(
                lastIndex + boundary.length,
            );

            // Send chunk to ElevenLabs
            session.ws.send(
                JSON.stringify({
                    text: chunk,
                    try_trigger_generation: true,
                }),
            );

            console.log(
                `Sent chunk to ElevenLabs: ${chunk.substring(0, 50)}...`,
            );
            return;
        }
    }

    // Force send if buffer is too large
    if (session.textBuffer.length >= MAX_CHUNK_SIZE) {
        const chunk = session.textBuffer;
        session.textBuffer = "";

        session.ws.send(
            JSON.stringify({
                text: chunk,
                try_trigger_generation: true,
            }),
        );

        console.log(
            `Sent large chunk to ElevenLabs: ${chunk.substring(0, 50)}...`,
        );
    }
}

/**
 * Flush any remaining text in the buffer and signal end of stream
 */
export function flushElevenLabsBuffer() {
    if (!session?.isConnected) {
        return;
    }

    // Send any remaining text
    if (session.textBuffer.length > 0) {
        session.ws.send(
            JSON.stringify({
                text: session.textBuffer,
                try_trigger_generation: true,
            }),
        );
        console.log(
            `Flushed remaining text: ${session.textBuffer.substring(0, 50)}...`,
        );
        session.textBuffer = "";
    }

    // Signal end of stream
    session.ws.send(JSON.stringify({ text: "" }));
    console.log("Signaled end of stream to ElevenLabs");
}

/**
 * Close the ElevenLabs session and cleanup resources
 */
export function closeElevenLabsSession() {
    if (!session) {
        return;
    }

    try {
        // Close WebSocket
        if (session.ws && session.isConnected) {
            session.ws.close();
        }

        // Close ffplay
        if (session.ffplay && session.ffplay.stdin) {
            session.ffplay.stdin.end();
            session.ffplay.kill();
        }

        console.log("ElevenLabs session closed");
    } catch (error) {
        console.error("Error closing ElevenLabs session:", error);
    } finally {
        session = null;
    }
}
