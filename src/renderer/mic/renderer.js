// @ts-check
// ===================================
// Configuration
// ===================================
const ELEVENLABS_CONFIG = {
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    model: "eleven_flash_v2_5",
};

// ===================================
// State
// ===================================
let isRecording = false;
let isInitialized = false;
let mediaStream = null;
let audioContext = null;
let audioWorkletNode = null;

// WebSocket connections
let openAIWs = null;

// ElevenLabs streaming
let currentStreamController = null;

// Audio playback
let playbackAudioContext = null;
let currentSource = null;

// Response tracking
let currentResponse = "";

// Get API keys from preload
const apiKeys = window.api.getAPIKeys();

// ===================================
// UI Elements
// ===================================
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDiv = document.getElementById("status");
const transcriptionDiv = document.getElementById("transcription");
const responseDiv = document.getElementById("response");

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
        if (error.name === "AbortError") {
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
async function initializeOpenAI() {
    if (!apiKeys.openai) {
        throw new Error("No OpenAI API key provided");
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
            openAIWs.send(
                JSON.stringify({
                    type: "session.update",
                    session: {
                        type: "realtime",
                        output_modalities: ["audio"],
                        instructions:
                            "You are a helpful assistant named Merli. Please speak in english",
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

function closeOpenAI() {
    if (openAIWs) {
        openAIWs.close();
        openAIWs = null;
    }
}

function handleOpenAIEvent(event) {
    switch (event.type) {
        case "conversation.item.input_audio_transcription.completed":
            console.log("📝 Transcription:", event.transcript);
            if (transcriptionDiv) {
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
                streamElevenLabsAudio(currentResponse);
            }
            currentResponse = "";
            break;

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
            window.AudioContext || window.webkitAudioContext
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

function stopAudioPlayback() {
    // Cancel any ongoing stream
    cancelElevenLabsStream();

    if (currentSource) {
        try {
            currentSource.stop();
        } catch (e) {
            // Source may have already stopped
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
                        new Uint8Array(pcm16.buffer),
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
        updateUI("error", error.message);
    }
}

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
function updateUI(state, errorMsg = "") {
    switch (state) {
        case "initializing":
            if (statusDiv) statusDiv.textContent = "Initializing...";
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = true;
            break;
        case "ready":
            if (statusDiv) {
                statusDiv.textContent = "Ready! Click 'Start' to begin";
                statusDiv.classList.remove("listening");
            }
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            break;
        case "recording":
            if (statusDiv) {
                statusDiv.textContent = "🎤 Listening...";
                statusDiv.classList.add("listening");
            }
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;
            if (transcriptionDiv) transcriptionDiv.textContent = "";
            if (responseDiv) responseDiv.textContent = "";
            break;
        case "processing":
            if (statusDiv) {
                statusDiv.textContent = "Processing...";
                statusDiv.classList.remove("listening");
            }
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            break;
        case "error":
            if (statusDiv) {
                statusDiv.textContent = `❌ Error: ${errorMsg}`;
                statusDiv.classList.remove("listening");
            }
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            break;
    }
}

// ===================================
// Initialize
// ===================================
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
        updateUI("error", error.message);
    }
}

// ===================================
// Event Listeners
// ===================================
if (startBtn) startBtn.addEventListener("click", startMicrophone);
if (stopBtn) stopBtn.addEventListener("click", stopMicrophone);

// Listen for IPC messages from main process
if (window.api.onSendMessage) {
    window.api.onSendMessage((text) => sendTextMessage(text));
}
if (window.api.onToggleMic) {
    window.api.onToggleMic(() => toggleMicrophone());
}
if (window.api.onInterrupt) {
    window.api.onInterrupt(() => interrupt());
}

// Push-to-talk listeners
if (window.api.onStartMic) {
    window.api.onStartMic(() => {
        if (!isRecording) {
            console.log("🎤 Push-to-talk: Starting mic");
            startMicrophone();
        }
    });
}
if (window.api.onStopMic) {
    window.api.onStopMic(() => {
        if (isRecording) {
            console.log("🎤 Push-to-talk: Stopping mic");
            stopMicrophone();
        }
    });
}

// ===================================
// Expose API to window (for debugging and IPC)
// ===================================
window.merli = {
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
