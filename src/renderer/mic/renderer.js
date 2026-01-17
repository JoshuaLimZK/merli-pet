// @ts-check

// ===================================
// Configuration & State
// ===================================
const ELEVENLABS_CONFIG = {
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    model: "eleven_flash_v2_5",
};

let isRecording = false;
let mediaStream = null;
let audioContext = null;
let audioWorkletNode = null;

// WebSocket connections
let openAIWs = null;
let elevenLabsWs = null;
let elevenLabsTextBuffer = "";

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
// ElevenLabs Setup
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

            // Send initial configuration
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
            console.log("ElevenLabs message received");
            console.log("ElevenLabs event:", event.data);
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

function streamTextToElevenLabs(textDelta) {
    if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) return;

    elevenLabsTextBuffer += textDelta;

    const MIN_CHUNK_SIZE = 50;
    const MAX_CHUNK_SIZE = 500;
    const BOUNDARIES = [". ", "! ", "? ", "\n\n", ", ", "; ", ": "];

    for (const boundary of BOUNDARIES) {
        const lastIndex = elevenLabsTextBuffer.lastIndexOf(boundary);
        if (lastIndex !== -1 && elevenLabsTextBuffer.length >= MIN_CHUNK_SIZE) {
            const chunk = elevenLabsTextBuffer.substring(
                0,
                lastIndex + boundary.length,
            );
            elevenLabsTextBuffer = elevenLabsTextBuffer.substring(
                lastIndex + boundary.length,
            );

            elevenLabsWs.send(
                JSON.stringify({
                    text: chunk,
                    try_trigger_generation: true,
                }),
            );
            return;
        }
    }

    if (elevenLabsTextBuffer.length >= MAX_CHUNK_SIZE) {
        elevenLabsWs.send(
            JSON.stringify({
                text: elevenLabsTextBuffer,
                try_trigger_generation: true,
            }),
        );
        elevenLabsTextBuffer = "";
    }
}

function flushElevenLabsBuffer() {
    if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) return;

    if (elevenLabsTextBuffer.length > 0) {
        elevenLabsWs.send(
            JSON.stringify({
                text: elevenLabsTextBuffer,
                try_trigger_generation: true,
            }),
        );
        elevenLabsTextBuffer = "";
    }

    elevenLabsWs.send(JSON.stringify({ text: "" }));
}

// ===================================
// Audio Playback
// ===================================
let playbackAudioContext = null;
let audioQueue = [];
let isPlaying = false;

async function playAudioChunk(base64Audio) {
    if (!playbackAudioContext) {
        playbackAudioContext = new (
            window.AudioContext || window.webkitAudioContext
        )();
    }

    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    try {
        const audioBuffer = await playbackAudioContext.decodeAudioData(
            bytes.buffer,
        );
        audioQueue.push(audioBuffer);

        if (!isPlaying) {
            playNextInQueue();
        }
    } catch (error) {
        console.error("Error decoding audio:", error);
    }
}

function playNextInQueue() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        return;
    }

    isPlaying = true;
    const audioBuffer = audioQueue.shift();

    const source = playbackAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackAudioContext.destination);

    source.onended = () => {
        playNextInQueue();
    };

    source.start(0);
}

// ===================================
// OpenAI Realtime Setup
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

        // Add optional org and project IDs if provided
        if (apiKeys.openaiOrgId) {
            protocols.push(`openai-organization.${apiKeys.openaiOrgId}`);
        }
        if (apiKeys.openaiProjectId) {
            protocols.push(`openai-project.${apiKeys.openaiProjectId}`);
        }

        openAIWs = new WebSocket(uri, protocols);

        openAIWs.onopen = () => {
            console.log("✅ OpenAI connected");

            // Send session configuration
            openAIWs.send(
                JSON.stringify({
                    type: "session.update",
                    session: {
                        type: "realtime",
                        output_modalities: ["audio"],
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
                                turn_detection: {
                                    type: "server_vad",
                                    create_response: true,
                                    interrupt_response: true,
                                    prefix_padding_ms: 300,
                                    threshold: 0.5,
                                },
                            },
                            output: {
                                voice: "marin",
                                format: {
                                    type: "audio/pcm",
                                    rate: 24000,
                                },
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

let currentResponse = "";

function handleOpenAIEvent(event) {
    console.log("OpenAI event:", event.type);

    switch (event.type) {
        case "conversation.item.input_audio_transcription.completed":
            const transcription = event.transcript;
            console.log("📝 Transcription:", transcription);
            if (transcriptionDiv) {
                transcriptionDiv.textContent = transcription;
            }
            break;

        case "response.output_audio_transcript.delta":
            const delta = event.delta;
            console.log("💬 Response delta:", delta);
            currentResponse += delta;
            if (responseDiv) {
                responseDiv.textContent = currentResponse;
            }
            streamTextToElevenLabs(delta);
            break;

        case "response.output_audio_transcript.completed":
            console.log("✅ Response complete:", event.text);
            flushElevenLabsBuffer();
            currentResponse = "";
            break;
        case "error":
            console.error("WebSocket error:", event.error);
            break;
        default:
            console.log("Unhandled OpenAI event type:", event.type);
            break;
    }
}

function sendAudioToOpenAI(pcm16Data) {
    if (!openAIWs || openAIWs.readyState !== WebSocket.OPEN) return;

    const base64Audio = btoa(
        String.fromCharCode.apply(null, new Uint8Array(pcm16Data.buffer)),
    );

    openAIWs.send(
        JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64Audio,
        }),
    );
}

function commitAudioBuffer() {
    if (!openAIWs || openAIWs.readyState !== WebSocket.OPEN) return;

    openAIWs.send(
        JSON.stringify({
            type: "input_audio_buffer.commit",
        }),
    );
}

// ===================================
// Microphone Handling
// ===================================
async function startMicrophone() {
    try {
        // Request microphone permission
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 24000,
            },
        });

        console.log("Using microphone:", mediaStream.getAudioTracks()[0].label);

        statusDiv.textContent = "🎤 Listening...";
        statusDiv.classList.add("listening");
        startBtn.disabled = true;
        stopBtn.disabled = false;

        // Clear previous content
        transcriptionDiv.textContent = "";
        responseDiv.textContent = "";
        currentResponse = "";

        // Create audio context with AudioWorklet
        audioContext = new AudioContext({ sampleRate: 24000 });

        // Load the audio worklet module
        await audioContext.audioWorklet.addModule("audio-processor.js");

        // Create audio worklet node
        audioWorkletNode = new AudioWorkletNode(
            audioContext,
            "audio-capture-processor",
        );

        // Listen for audio data from worklet
        audioWorkletNode.port.onmessage = (event) => {
            if (isRecording) {
                const pcm16 = event.data;
                sendAudioToOpenAI(pcm16);
            }
        };

        // Connect audio source to worklet
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(audioWorkletNode);
        audioWorkletNode.connect(audioContext.destination);

        isRecording = true;
        console.log("🎤 Started recording");
    } catch (error) {
        console.error("Error starting microphone:", error);
        statusDiv.textContent = "❌ Error: " + error.message;
        statusDiv.classList.remove("listening");
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

async function stopMicrophone() {
    isRecording = false;

    // Disconnect and clean up audio processing
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
    commitAudioBuffer();

    statusDiv.textContent = "Processing...";
    statusDiv.classList.remove("listening");
    startBtn.disabled = false;
    stopBtn.disabled = true;

    console.log("🛑 Stopped recording");

    // Reset status after a delay
    setTimeout(() => {
        statusDiv.textContent = "Click 'Start' to begin";
    }, 2000);
}

// ===================================
// Event Listeners
// ===================================
startBtn.addEventListener("click", startMicrophone);
stopBtn.addEventListener("click", stopMicrophone);

// ===================================
// Initialize on Load
// ===================================
window.addEventListener("DOMContentLoaded", async () => {
    try {
        statusDiv.textContent = "Initializing...";

        // Initialize ElevenLabs first
        try {
            await initializeElevenLabs();
            console.log("✅ ElevenLabs initialized");
        } catch (error) {
            console.warn("⚠️ Continuing without TTS:", error);
        }

        // Then initialize OpenAI
        await initializeOpenAI();
        console.log("✅ OpenAI initialized");

        statusDiv.textContent = "Ready! Click 'Start' to begin";
        startBtn.disabled = false;
    } catch (error) {
        console.error("Initialization error:", error);
        statusDiv.textContent = "❌ Failed to initialize: " + error.message;
    }
});
