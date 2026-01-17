// Audio Worklet Processor for capturing microphone input
class AudioCaptureProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];

        if (input.length > 0) {
            const channelData = input[0]; // Get first channel

            // Convert Float32Array to Int16Array (PCM16)
            const pcm16 = new Int16Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
                const s = Math.max(-1, Math.min(1, channelData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            // Send audio data to main thread
            this.port.postMessage(pcm16);
        }

        return true; // Keep processor alive
    }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
