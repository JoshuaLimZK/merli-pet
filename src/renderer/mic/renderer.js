// @ts-check
// ===================================
// Type Definitions
// ===================================

/**
 * @typedef {Object} APIKeys
 * @property {string} [openai] - OpenAI API key
 * @property {string} [openaiOrgId] - OpenAI organization ID
 * @property {string} [openaiProjectId] - OpenAI project ID
 * @property {string} [elevenlabs] - ElevenLabs API key
 */

/**
 * @typedef {Object} WindowAPI
 * @property {() => APIKeys} getAPIKeys
 * @property {((callback: (text: string) => void) => void)} [onSendMessage]
 * @property {((callback: () => void) => void)} [onToggleMic]
 * @property {((callback: () => void) => void)} [onInterrupt]
 * @property {((callback: () => void) => void)} [onStartMic]
 * @property {((callback: () => void) => void)} [onStopMic]
 * @property {((channel: string, data: any) => void)} [sendToMain]
 */

/**
 * @typedef {Object} MerliState
 * @property {boolean} isRecording - Whether microphone is recording
 * @property {boolean} isInitialized - Whether services are initialized
 * @property {boolean} openAIConnected - Whether OpenAI WebSocket is connected
 * @property {boolean} elevenLabsConnected - Whether ElevenLabs is available
 */

/**
 * @typedef {Object} MerliAPI
 * @property {() => boolean} toggleMicrophone - Toggle microphone recording
 * @property {(text: string) => boolean} sendTextMessage - Send text message to OpenAI
 * @property {() => Promise<void>} interrupt - Interrupt all processes
 * @property {() => Promise<void>} cleanup - Clean up all resources
 * @property {() => Promise<void>} initialize - Initialize services
 * @property {() => MerliState} getState - Get current state
 */

/** @type {Window & { api: WindowAPI; merli?: MerliAPI }} */
const _window = /** @type {any} */ (window);

// ===================================
// Configuration
// ===================================

/**
 * @typedef {Object} ElevenLabsConfig
 * @property {string} voiceId - ElevenLabs voice ID
 * @property {string} model - ElevenLabs model ID
 */

/** @type {ElevenLabsConfig} */
const ELEVENLABS_CONFIG = {
    voiceId: "Y7xQSS5ZtS4xv4VJotWd",
    model: "eleven_flash_v2_5",
};

// ===================================
// State
// ===================================
/** @type {boolean} */
let isRecording = false;
/** @type {boolean} */
let isInitialized = false;
/** @type {MediaStream | null} */
let mediaStream = null;
/** @type {AudioContext | null} */
let audioContext = null;
/** @type {AudioWorkletNode | null} */
let audioWorkletNode = null;

// WebSocket connections
/** @type {WebSocket | null} */
let openAIWs = null;
/** @type {WebSocket | null} */
let elevenLabsWs = null;

// ElevenLabs streaming
/** @type {AbortController | null} */
let currentStreamController = null;

// Audio playback
/** @type {AudioContext | null} */
let playbackAudioContext = null;
/** @type {AudioBufferSourceNode | null} */
let currentSource = null;

// Response tracking
/** @type {string} */
let currentResponse = "";

// Get API keys from preload
const apiKeys = _window.api.getAPIKeys();

// ===================================
// UI Elements
// ===================================
/** @type {HTMLButtonElement | null} */
const micBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById("micBtn")
);

// ===================================
// ElevenLabs HTTP Streaming
// ===================================

/**
 * Stream text-to-speech audio from ElevenLabs HTTP endpoint
 * @param {string} text - The text to convert to speech
 */
async function streamElevenLabsAudio(text) {
    if (!apiKeys.elevenlabs) {
        console.warn("No ElevenLabs API key provided");
        return;
    }

    if (!text || text.trim().length === 0) {
        console.warn("No text to speak");
        return;
    }

    console.log("🔊 Starting ElevenLabs stream for:", text);

    // Create abort controller for cancellation
    currentStreamController = new AbortController();

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_CONFIG.voiceId}/stream`,
            {
                method: "POST",
                headers: {
                    "xi-api-key": apiKeys.elevenlabs,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text,
                    model_id: ELEVENLABS_CONFIG.model,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.8,
                        use_speaker_boost: false,
                    },
                }),
                signal: currentStreamController.signal,
            },
        );

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }
        if (!response.body) {
            throw new Error("ElevenLabs response has no body");
        }
        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            console.log(`📦 Received chunk: ${value.length} bytes`);
        }

        // Combine all chunks into one buffer
        const totalLength = chunks.reduce(
            (acc, chunk) => acc + chunk.length,
            0,
        );
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }

        // Play the audio
        await playAudioBuffer(combined.buffer);
        console.log("✅ ElevenLabs stream complete");
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            console.log("🛑 ElevenLabs stream cancelled");
        } else {
            console.error("❌ ElevenLabs stream error:", error);
        }
    } finally {
        currentStreamController = null;
    }
}

/**
 * Cancel any ongoing ElevenLabs stream
 * @returns {void}
 */
function cancelElevenLabsStream() {
    if (currentStreamController) {
        currentStreamController.abort();
        currentStreamController = null;
    }
}

// ===================================
// OpenAI WebSocket
// ===================================

/**
 * Initialize OpenAI Realtime WebSocket connection
 * @returns {Promise<boolean>} Resolves when connected
 * @throws {Error} If no API key provided or connection fails
 */
async function initializeOpenAI() {
    if (!apiKeys.openai) {
        throw new Error("No OpenAI API key provided");
    }

    // Read instruction file BEFORE creating WebSocket
    let instructions =
        "You are a helpful assistant named Merli. Please speak in english. If the user asks for anything related to bus timings, attempt to prompt for bus stop description";
    try {
        const instructionResponse = await fetch("merli-agent-instructions.txt");
        if (instructionResponse.ok) {
            instructions = await instructionResponse.text();
            console.log("📄 Loaded instructions from file");
        }
    } catch (error) {
        console.warn(
            "⚠️ Could not load instructions file, using default instructions:",
            error,
        );
    }

    return new Promise((resolve, reject) => {
        const uri = `wss://api.openai.com/v1/realtime?model=gpt-realtime`;
        const protocols = [
            "realtime",
            `openai-insecure-api-key.${apiKeys.openai}`,
        ];

        if (apiKeys.openaiOrgId) {
            protocols.push(`openai-organization.${apiKeys.openaiOrgId}`);
        }
        if (apiKeys.openaiProjectId) {
            protocols.push(`openai-project.${apiKeys.openaiProjectId}`);
        }

        openAIWs = new WebSocket(uri, protocols);

        openAIWs.onopen = () => {
            console.log("✅ OpenAI connected");
            if (!openAIWs) return;
            openAIWs.send(
                JSON.stringify({
                    type: "session.update",
                    session: {
                        type: "realtime",
                        output_modalities: ["audio"],
                        instructions,
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
                                turn_detection: null,
                            },
                        },
                        // tool_choice: "auto",
                        // tools: [
                        //     {
                        //         type: "function",
                        //         description:
                        //             "Get an object with all bus stop codes",
                        //         name: "getBusStopCode",
                        //         parameters: null,
                        //     },
                        //     {
                        //         type: "function",
                        //         description:
                        //             "Get the bus arrival time for a given bus stop and bus number",
                        //         name: "getBusTiming",
                        //         parameters: {
                        //             type: "object",
                        //             properties: {
                        //                 busStop: {
                        //                     type: "string",
                        //                     description: "The bus stop code",
                        //                 },
                        //                 busNumber: {
                        //                     type: "string",
                        //                     description: "The bus number",
                        //                 },
                        //             },
                        //             required: ["busStop", "busNumber"],
                        //         },
                        // },
                        // ],
                    },
                }),
            );
            resolve(true);
        };

        openAIWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleOpenAIEvent(data);
        };

        openAIWs.onerror = (error) => {
            console.error("❌ OpenAI error:", error);
            reject(error);
        };

        openAIWs.onclose = () => {
            console.log("OpenAI disconnected");
        };
    });
}

/**
 * Close the OpenAI WebSocket connection
 * @returns {void}
 */
function closeOpenAI() {
    if (openAIWs) {
        openAIWs.close();
        openAIWs = null;
    }
}

/**
 * Handle incoming OpenAI WebSocket events
 * @param {Object} event - The parsed WebSocket message event
 * @param {string} event.type - Event type
 * @param {string} [event.transcript] - Transcription text (for transcription events)
 * @param {string} [event.delta] - Delta text (for streaming events)
 * @param {Object} [event.error] - Error object (for error events)
 * @returns {void}
 */
function handleOpenAIEvent(event) {
    // let functionCalled = "";

    switch (event.type) {
        case "conversation.item.input_audio_transcription.completed":
            console.log("📝 Transcription:", event.transcript);
            if (transcriptionDiv && event.transcript) {
                transcriptionDiv.textContent = event.transcript;
            }
            break;

        case "response.output_audio_transcript.delta":
            currentResponse += event.delta;
            if (responseDiv) {
                responseDiv.textContent = currentResponse;
            }
            break;

        case "response.output_audio_transcript.done":
            console.log("✅ Response complete:", currentResponse);
            if (currentResponse.length > 0) {
                // Use HTTP streaming instead of WebSocket
                if (
                    currentResponse.startsWith("{") &&
                    currentResponse.endsWith("}")
                ) {
                    // Extract bus stop code and bus number
                    const content = currentResponse.slice(1, -1);
                    const [busStopCode, busNumber] = content
                        .split(",")
                        .map((s) => s.trim());
                    getBusTiming(busStopCode, busNumber).then((timing) => {
                        console.log("busTimingIs");
                        sendTextMessage(
                            `The bus ${busNumber} at stop ${busStopCode} is arriving in ${timing}.`,
                        );
                    });
                    // Request bus timing from main process
                } else {
                    streamElevenLabsAudio(currentResponse);
                    // Show the response text in a quote bubble
                    // Estimate duration: ~80ms per character for TTS speech + 1s buffer
                    const estimatedDuration = Math.max(
                        3000,
                        currentResponse.length * 80 + 1000,
                    );
                    if (_window.api.sendToMain) {
                        _window.api.sendToMain("show-quote", {
                            text: currentResponse,
                            duration: estimatedDuration,
                        });
                    }
                }
            }
            currentResponse = "";
            break;

        // case "response.function_call_arguments.done":
        //     if (event.function_name === "getBusStopCode") {
        //         getBusStopCode().then((busStops) => {
        //             if (openAIWs?.readyState === WebSocket.OPEN) {
        //                 openAIWs.send(
        //                     JSON.stringify({
        //                         type: "response.function_call_arguments.result",
        //                         function_name: "getBusStopCode",
        //                         arguments: {
        //                             busStops,
        //                         },
        //                     }),
        //                 );
        //             }
        //         });
        //     } else if (event.function_name === "getBusTiming") {
        //         const { busStop, busNumber } = event.arguments;
        //         getBusTiming(busStop, busNumber).then((timing) => {
        //             if (openAIWs?.readyState === WebSocket.OPEN) {
        //                 openAIWs.send(
        //                     JSON.stringify({
        //                         type: "response.function_call_arguments.result",
        //                         function_name: "getBusTiming",
        //                         arguments: {
        //                             timing,
        //                         },
        //                     }),
        //                 );
        //             }
        //         });
        //     }
        //     break;

        case "error":
            console.error("OpenAI error:", event.error);
            break;

        default:
            console.log("OpenAI event:", event);
            break;
    }
}

// ===================================
// Audio Playback
// ===================================

/**
 * Play audio from an ArrayBuffer
 * @param {ArrayBuffer} arrayBuffer - The audio data to play
 */
async function playAudioBuffer(arrayBuffer) {
    if (!playbackAudioContext) {
        playbackAudioContext = new (
            window.AudioContext ||
            /** @type {any} */ (window).webkitAudioContext
        )();
    }

    if (playbackAudioContext.state === "suspended") {
        await playbackAudioContext.resume();
    }

    try {
        const audioBuffer = await playbackAudioContext.decodeAudioData(
            arrayBuffer.slice(0),
        );

        console.log(`🎵 Playing audio: ${audioBuffer.duration.toFixed(2)}s`);

        currentSource = playbackAudioContext.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.connect(playbackAudioContext.destination);

        currentSource.onended = () => {
            console.log("✅ Audio playback complete");
            currentSource = null;
        };

        currentSource.start(0);
    } catch (error) {
        console.error("Error playing audio:", error);
    }
}

/**
 * Stop audio playback and cleanup playback resources
 * @returns {void}
 */
function stopAudioPlayback() {
    // Cancel any ongoing stream
    cancelElevenLabsStream();

    if (currentSource) {
        try {
            currentSource.stop();
        } catch {
            // Ignore errors on stopping
        }
        currentSource = null;
    }

    // Close audio context
    if (playbackAudioContext) {
        playbackAudioContext.close();
        playbackAudioContext = null;
    }
}

// ===================================
// Microphone Control
// ===================================

/**
 * Start microphone capture and send audio to OpenAI
 * @returns {Promise<void>}
 */
async function startMicrophone() {
    if (isRecording) return;

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, sampleRate: 24000 },
        });

        console.log("Using microphone:", mediaStream.getAudioTracks()[0].label);

        audioContext = new AudioContext({ sampleRate: 24000 });
        await audioContext.audioWorklet.addModule("audio-processor.js");

        audioWorkletNode = new AudioWorkletNode(
            audioContext,
            "audio-capture-processor",
        );
        audioWorkletNode.port.onmessage = (event) => {
            if (isRecording && openAIWs?.readyState === WebSocket.OPEN) {
                const pcm16 = event.data;
                const base64Audio = btoa(
                    String.fromCharCode.apply(
                        null,
                        Array.from(new Uint8Array(pcm16.buffer)),
                    ),
                );
                openAIWs.send(
                    JSON.stringify({
                        type: "input_audio_buffer.append",
                        audio: base64Audio,
                    }),
                );
            }
        };

        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(audioWorkletNode);
        audioWorkletNode.connect(audioContext.destination);

        isRecording = true;
        updateUI("recording");
        console.log("🎤 Started recording");
    } catch (error) {
        console.error("Error starting microphone:", error);
        updateUI(
            "error",
            error instanceof Error ? error.message : String(error),
        );
    }
}

/**
 * Stop microphone capture and commit audio buffer to OpenAI
 * @returns {Promise<void>}
 */
async function stopMicrophone() {
    if (!isRecording) return;

    isRecording = false;

    if (audioWorkletNode) {
        audioWorkletNode.disconnect();
        audioWorkletNode.port.close();
        audioWorkletNode = null;
    }

    if (audioContext) {
        await audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
    }

    // Commit audio buffer to trigger response
    if (openAIWs?.readyState === WebSocket.OPEN) {
        openAIWs.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        openAIWs.send(JSON.stringify({ type: "response.create" }));
    }

    updateUI("processing");
    console.log("🛑 Stopped recording");

    setTimeout(() => updateUI("ready"), 2000);
}

/**
 * Toggle microphone recording state
 * @returns {boolean} New recording state after toggle
 */
function toggleMicrophone() {
    if (isRecording) {
        stopMicrophone();
    } else {
        startMicrophone();
    }
    return isRecording;
}

// ===================================
// Send Text Message (from main process)
// ===================================

/**
 * Send a text message to OpenAI for processing
 * @param {string} text - The text message to send
 * @returns {boolean} Whether the message was sent successfully
 */
function sendTextMessage(text) {
    if (!openAIWs || openAIWs.readyState !== WebSocket.OPEN) {
        console.error("OpenAI WebSocket not connected");
        return false;
    }

    console.log("📤 Sending text message:", text);

    openAIWs.send(
        JSON.stringify({
            type: "conversation.item.create",
            item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text }],
            },
        }),
    );

    openAIWs.send(JSON.stringify({ type: "response.create" }));

    return true;
}

// ===================================
// Interrupt - Stop Everything
// ===================================

/**
 * Interrupt all ongoing processes (recording, playback, OpenAI response)
 * @returns {Promise<void>}
 */
async function interrupt() {
    console.log("🛑 Interrupting all processes...");

    // Stop recording
    if (isRecording) {
        await stopMicrophone();
    }

    // Stop audio playback
    stopAudioPlayback();

    // Clear response buffer
    currentResponse = "";

    // Cancel any ongoing OpenAI response
    if (openAIWs?.readyState === WebSocket.OPEN) {
        openAIWs.send(JSON.stringify({ type: "response.cancel" }));
    }

    updateUI("ready");
    console.log("✅ All processes interrupted");
}

// ===================================
// Cleanup - Close All Connections
// ===================================

/**
 * Clean up all resources and close connections
 * @returns {Promise<void>}
 */
async function cleanup() {
    console.log("🧹 Cleaning up...");

    await interrupt();
    closeOpenAI();
    cancelElevenLabsStream();

    if (playbackAudioContext) {
        await playbackAudioContext.close();
        playbackAudioContext = null;
    }

    isInitialized = false;
    console.log("✅ Cleanup complete");
}

// ===================================
// UI Updates
// ===================================

/**
 * Update UI elements based on current state
 * @param {'initializing' | 'ready' | 'recording' | 'processing' | 'error'} state - Current state
 * @param {string} [errorMsg=''] - Error message (for 'error' state)
 * @returns {void}
 */
function updateUI(state, errorMsg = "") {
    if (!micBtn) return;

    switch (state) {
        case "initializing":
            micBtn.disabled = true;
            micBtn.classList.remove("recording");
            break;
        case "ready":
            micBtn.disabled = false;
            micBtn.classList.remove("recording");
            break;
        case "recording":
            micBtn.disabled = false;
            micBtn.classList.add("recording");
            break;
        case "processing":
            micBtn.disabled = false;
            micBtn.classList.remove("recording");
            break;
        case "error":
            console.error("Mic error:", errorMsg);
            micBtn.disabled = false;
            micBtn.classList.remove("recording");
            break;
    }
}

// ===================================
// Initialize
// ===================================

/**
 * Initialize audio services (OpenAI and ElevenLabs)
 * @returns {Promise<void>}
 */
async function initialize() {
    if (isInitialized) return;

    updateUI("initializing");

    // ElevenLabs uses HTTP streaming now - no initialization needed
    if (apiKeys.elevenlabs) {
        console.log("✅ ElevenLabs API key found (using HTTP streaming)");
    } else {
        console.warn("⚠️ No ElevenLabs API key - TTS disabled");
    }

    try {
        await initializeOpenAI();
        console.log("✅ OpenAI initialized");
        isInitialized = true;
        updateUI("ready");
    } catch (error) {
        console.error("Initialization error:", error);
        updateUI(
            "error",
            error instanceof Error ? error.message : String(error),
        );
    }
}

// ===================================
// Event Listeners
// ===================================
if (micBtn) {
    micBtn.addEventListener("click", () => {
        toggleMicrophone();
    });
}

// Listen for IPC messages from main process
if (_window.api.onSendMessage) {
    _window.api.onSendMessage((text) => sendTextMessage(text));
}
if (_window.api.onToggleMic) {
    _window.api.onToggleMic(() => toggleMicrophone());
}
if (_window.api.onInterrupt) {
    _window.api.onInterrupt(() => interrupt());
}

// Push-to-talk listeners
if (_window.api.onStartMic) {
    _window.api.onStartMic(() => {
        if (!isRecording) {
            console.log("🎤 Push-to-talk: Starting mic");
            startMicrophone();
        }
    });
}
if (_window.api.onStopMic) {
    _window.api.onStopMic(() => {
        if (isRecording) {
            console.log("🎤 Push-to-talk: Stopping mic");
            stopMicrophone();
        }
    });
}

// ===================================
// Expose API to window (for debugging and IPC)
// ===================================

/** @type {MerliAPI} */
_window.merli = {
    toggleMicrophone,
    sendTextMessage,
    interrupt,
    cleanup,
    initialize,
    getState: () => ({
        isRecording,
        isInitialized,
        openAIConnected: openAIWs?.readyState === WebSocket.OPEN,
        elevenLabsConnected: elevenLabsWs?.readyState === WebSocket.OPEN,
    }),
};

// ===================================
// Initialize on Load
// ===================================
window.addEventListener("DOMContentLoaded", initialize);

// ===================================
// Bus Tooling
// ===================================

function getBusStopCode() {
    return fetch("../../assets/bus_stops.json").then((res) => res.json());
}

async function getBusTiming(busStop, busNumber) {
    const response = await fetch(
        `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${busStop}&ServiceNo=${busNumber}`,
        {
            method: "GET",
            headers: {
                AccountKey: "kMLW3vYRTY2aN47TljPPBA==",
            },
        },
    );
    const data = await response.json();
    const nextBus = data?.Services?.[0]?.NextBus;
    const estimatedArrival = nextBus?.EstimatedArrival;
    if (!estimatedArrival) {
        return "No Arrival Info";
    }

    const minutes =
        Math.ceil((Date.parse(estimatedArrival) - Date.now()) / 60000) +
        " Mins";
    return minutes;
}
