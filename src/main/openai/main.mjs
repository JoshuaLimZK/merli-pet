//@ts-check
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import {
    initializeElevenLabsSession,
    streamTextToElevenLabs,
    flushElevenLabsBuffer,
    closeElevenLabsSession,
} from "../elevenlabs/main.mjs";

// Get __dirname equivalent in ES modules
// @ts-expect-error - import.meta.url is available in ES modules but TypeScript may not recognize it in .mjs files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @type {RealtimeSession<unknown> | null}
 */
let websocketSession = null;
let isConnected = false;
/**
 * @type {{
 *   onTranscription: ((text: string) => void) | null;
 *   onResponseDelta: ((delta: string) => void) | null;
 *   onResponseComplete: ((text: string) => void) | null;
 * }}
 */
let eventCallbacks = {
    onTranscription: null,
    onResponseDelta: null,
    onResponseComplete: null,
};

/**
 * Register event callbacks
 * @param {Object} callbacks
 * @param {(text: string) => void} [callbacks.onTranscription]
 * @param {(delta: string) => void} [callbacks.onResponseDelta]
 * @param {(text: string) => void} [callbacks.onResponseComplete]
 */
export function registerEventCallbacks(callbacks) {
    eventCallbacks = { ...eventCallbacks, ...callbacks };
}

/**
 * Read a file as a string
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readFileAsString(filePath) {
    return await readFile(filePath, "utf8");
}

/**
 * Initialize OpenAI Realtime session with optional ElevenLabs integration
 * @param {string} apiKey - OpenAI API key
 * @param {string} [elevenLabsApiKey] - Optional ElevenLabs API key for TTS
 * @returns {Promise<void>}
 */
export async function initializeOpenAIRealtimeSession(
    apiKey,
    elevenLabsApiKey,
) {
    if (isConnected) return;

    // Initialize ElevenLabs if API key is provided
    if (elevenLabsApiKey) {
        console.log(
            "Attempting to initialize ElevenLabs with provided API key...",
        );
        try {
            await initializeElevenLabsSession(elevenLabsApiKey);
            console.log("✅ ElevenLabs TTS initialized successfully");
        } catch (error) {
            console.error("❌ Failed to initialize ElevenLabs:", error);
            console.log("Continuing without TTS...");
        }
    } else {
        console.log("⚠️ No ElevenLabs API key provided, TTS disabled");
    }

    // Read Merli agent instructions
    const instructionsPath = path.join(
        __dirname,
        "../../assets/merli-agent-instructions.txt",
    );
    const instructions = await readFileAsString(instructionsPath);

    try {
        const merliAgent = new RealtimeAgent({
            name: "Merli Pet Agent",
            instructions: instructions,
            tools: [],
        });

        websocketSession = new RealtimeSession(merliAgent, {
            transport: "websocket",
            model: "gpt-4o-realtime-preview-2024-12-17",
            config: {
                outputModalities: ["audio"], // Need audio input
                voice: "alloy",
                audio: {
                    input: {
                        format: {
                            type: "audio/pcm",
                            rate: 24000,
                        },
                        transcription: {
                            language: "en",
                            model: "gpt-4o-transcribe",
                        },
                        turnDetection: {
                            type: "server_vad",
                            threshold: 0.5,
                            prefixPaddingMs: 300,
                            silenceDurationMs: 500,
                        },
                    },
                    output: {
                        format: {
                            type: "audio/pcm",
                            rate: 24000,
                        },
                    },
                },
            },
        });

        await websocketSession.connect({ apiKey });
        isConnected = true;
        console.log("OpenAI Realtime session connected.");

        // Listen for transcription events
        websocketSession.transport.on(
            "conversation.item.input_audio_transcription.completed",
            (event) => {
                const transcription = event.transcript;
                console.log("📝 Transcription:", transcription);
                if (eventCallbacks.onTranscription) {
                    eventCallbacks.onTranscription(transcription);
                }
            },
        );

        // Listen for response text deltas
        websocketSession.transport.on("response.text.delta", (event) => {
            const delta = event.delta;
            console.log("💬 Response delta:", delta);
            if (eventCallbacks.onResponseDelta) {
                eventCallbacks.onResponseDelta(delta);
            }

            // Also stream to ElevenLabs if available
            try {
                streamTextToElevenLabs(delta);
            } catch {
                // Silently fail if ElevenLabs not initialized
            }
        });

        // Listen for response completion
        websocketSession.transport.on("response.text.done", (event) => {
            const text = event.text;
            console.log("✅ Response complete:", text);
            if (eventCallbacks.onResponseComplete) {
                eventCallbacks.onResponseComplete(text);
            }

            // Flush ElevenLabs buffer
            try {
                flushElevenLabsBuffer();
            } catch {
                // Silently fail if ElevenLabs not initialized
            }
        });

        websocketSession.transport.on("*", (event) => {
            switch (event.type) {
                case "error":
                    console.error("WebSocket error:", event.error);
                    break;
                case "session.created":
                    console.log("WebSocket session created:", event);
                    break;
                case "session.updates":
                    console.log("WebSocket session updates:", event);
                    break;
                default:
                    console.log("WebSocket event:", event);
            }
        });
    } catch (error) {
        console.error("Failed to connect OpenAI Realtime session:", error);
        isConnected = false;
        throw error;
    }
}

/**
 * Send a message to the Merli agent with optional TTS
 * @param {string} message
 * @param {(delta: string) => void} onDelta
 * @param {(fullText: string) => void} onComplete
 * @param {boolean} [enableTTS=true] - Enable text-to-speech via ElevenLabs
 * @returns {Promise<void>}
 */
export async function sendMessageToMerliAgent(
    message,
    onDelta,
    onComplete,
    enableTTS = true,
) {
    if (!isConnected || !websocketSession) {
        throw new Error("WebSocket session is not connected.");
    }

    let fullResponse = "";

    // Setting up listeners for response deltas and completion

    // Set up one-time listeners for this message
    /**
     * @typedef {Object} TextDeltaEvent
     * @property {string} response_id
     * @property {string} item_id
     * @property {number} output_index
     * @property {number} content_index
     * @property {string} delta
     */

    /** @param {TextDeltaEvent} event */
    const deltaHandler = (event) => {
        if (onDelta) {
            onDelta(event.delta);
        }
        fullResponse += event.delta;

        // Stream text to ElevenLabs if TTS is enabled
        if (enableTTS) {
            try {
                streamTextToElevenLabs(event.delta);
            } catch (error) {
                console.error("Error streaming to ElevenLabs:", error);
            }
        }
    };

    /**
     * @typedef {Object} TextDoneEvent
     * @property {string} response_id
     * @property {string} item_id
     * @property {number} output_index
     * @property {number} content_index
     * @property {string} [text]
     */

    /** @param {TextDoneEvent} event */
    const doneHandler = (event) => {
        // Flush remaining text to ElevenLabs if TTS is enabled
        if (enableTTS) {
            try {
                flushElevenLabsBuffer();
            } catch (error) {
                console.error("Error flushing ElevenLabs buffer:", error);
            }
        }

        if (onComplete) {
            onComplete(event.text || fullResponse);
        }
        // Clean up listeners
        if (websocketSession) {
            websocketSession.transport.off(
                "response.output_text.delta",
                deltaHandler,
            );
            websocketSession.transport.off(
                "response.output_text.done",
                doneHandler,
            );
        }
    };

    websocketSession.transport.on("response.output_text.delta", deltaHandler);
    websocketSession.transport.on("response.output_text.done", doneHandler);

    await websocketSession.sendMessage(message);
}

/**
 * Close the OpenAI Realtime session and ElevenLabs session
 */
export async function closeOpenAIRealtimeSession() {
    // Close ElevenLabs session first
    try {
        closeElevenLabsSession();
    } catch (error) {
        console.error("Error closing ElevenLabs session:", error);
    }

    // Close OpenAI session
    if (websocketSession) {
        websocketSession.close();
        websocketSession = null;
        isConnected = false;
        console.log("OpenAI Realtime session closed.");
    }
}

/**
 * Send audio data to OpenAI Realtime API
 * @param {Buffer | Uint8Array} audioData - PCM16 audio data
 */

export function sendAudioInput(audioData) {
    if (!websocketSession || !isConnected) {
        throw new Error("WebSocket session is not connected.");
    }

    // Convert to ArrayBuffer
    const arrayBuffer =
        audioData instanceof Buffer
            ? audioData.buffer.slice(
                  audioData.byteOffset,
                  audioData.byteOffset + audioData.byteLength,
              )
            : audioData.buffer;

    if (arrayBuffer.byteLength === 0) {
        console.warn("Warning: Attempted to send empty audio data.");
        return;
    }

    websocketSession.sendAudio(arrayBuffer);
}

/**
 * Start listening for voice input
 */
export function startListening() {
    if (!websocketSession || !isConnected) {
        throw new Error("WebSocket session is not connected.");
    }
    console.log("🎤 Started listening for voice input");
}

/**
 * Stop listening for voice input
 */
export function stopListening() {
    if (!websocketSession || !isConnected) {
        return;
    }

    // Commit the audio buffer to trigger response
    websocketSession.sendAudio(new ArrayBuffer(0), { commit: true });

    console.log("🛑 Stopped listening");
}
