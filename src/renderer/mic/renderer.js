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
let elevenLabsWs = null;

// Audio playback
let playbackAudioContext = null;
let audioChunks = [];
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
// ElevenLabs WebSocket
// ===================================
async function initializeElevenLabs() {
    if (!apiKeys.elevenlabs) {
        console.warn("No ElevenLabs API key provided");
        return false;
    }

    return new Promise((resolve, reject) => {
        const uri = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_CONFIG.voiceId}/stream-input?model_id=${ELEVENLABS_CONFIG.model}&inactivity_timeout=180`;

        elevenLabsWs = new WebSocket(uri);

        elevenLabsWs.onopen = () => {
            console.log("✅ ElevenLabs connected");
            elevenLabsWs.send(
                JSON.stringify({
                    text: " ",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.8,
                        use_speaker_boost: false,
                    },
                    generation_config: {
                        chunk_length_schedule: [120, 160, 250, 290],
                    },
                    "xi-api-key": apiKeys.elevenlabs,
                }),
            );
            resolve(true);
        };

        elevenLabsWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.audio) {
                audioChunks.push(data.audio);
                console.log(`📦 Audio chunk ${audioChunks.length} received`);
            }
            if (data.isFinal) {
                console.log("🏁 ElevenLabs finished generating audio");
                playAllAudio();
            }
        };

        elevenLabsWs.onerror = (error) => {
            console.error("❌ ElevenLabs error:", error);
            reject(error);
        };

        elevenLabsWs.onclose = () => {
            console.log("ElevenLabs disconnected");
        };
    });
}

function closeElevenLabs() {
    if (elevenLabsWs) {
        elevenLabsWs.close();
        elevenLabsWs = null;
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
        const uri = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
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
                        modalities: ["text", "audio"],
                        instructions:
                            "You are a helpful assistant named Merli.",
                        input_audio_transcription: { model: "whisper-1" },
                        turn_detection: {
                            type: "server_vad",
                            threshold: 0.5,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 500,
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

        case "response.audio_transcript.delta":
            currentResponse += event.delta;
            if (responseDiv) {
                responseDiv.textContent = currentResponse;
            }
            break;

        case "response.audio_transcript.done":
            console.log("✅ Response complete:", currentResponse);
            if (
                currentResponse.length > 0 &&
                elevenLabsWs?.readyState === WebSocket.OPEN
            ) {
                elevenLabsWs.send(
                    JSON.stringify({
                        text: currentResponse + " ",
                        try_trigger_generation: true,
                    }),
                );
                elevenLabsWs.send(JSON.stringify({ text: "" }));
            }
            currentResponse = "";
            break;

        case "error":
            console.error("OpenAI error:", event.error);
            break;

        default:
            // Ignore other events
            break;
    }
}

// ===================================
// Audio Playback
// ===================================
async function playAllAudio() {
    if (audioChunks.length === 0) {
        console.log("No audio to play");
        return;
    }

    console.log(`🔊 Playing ${audioChunks.length} accumulated chunks...`);

    if (!playbackAudioContext) {
        playbackAudioContext = new (
            window.AudioContext || window.webkitAudioContext
        )();
    }

    if (playbackAudioContext.state === "suspended") {
        await playbackAudioContext.resume();
    }

    // Combine all chunks into one ArrayBuffer
    let totalLength = 0;
    const decodedChunks = [];

    for (const base64Audio of audioChunks) {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        decodedChunks.push(bytes);
        totalLength += bytes.length;
    }

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of decodedChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }

    try {
        const audioBuffer = await playbackAudioContext.decodeAudioData(
            combined.buffer.slice(0),
        );
        console.log(`🎵 Total audio duration: ${audioBuffer.duration}s`);

        currentSource = playbackAudioContext.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.connect(playbackAudioContext.destination);
        currentSource.start(0);

        currentSource.onended = () => {
            console.log("✅ All audio finished playing");
            currentSource = null;
        };
    } catch (error) {
        console.error("Error decoding combined audio:", error);
    }

    audioChunks = [];
}

function stopAudioPlayback() {
    if (currentSource) {
        currentSource.stop();
        currentSource = null;
    }
    audioChunks = [];
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
    closeElevenLabs();

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

    try {
        await initializeElevenLabs();
        console.log("✅ ElevenLabs initialized");
    } catch (error) {
        console.warn("⚠️ Continuing without TTS:", error);
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
