/// <reference lib="dom" />
class AudioCaptureProcessor extends AudioWorkletProcessor {
    /**
     * Process audio input and convert to PCM16
     * @param {Float32Array[][]} inputs - Input audio buffers [input][channel][sample]
     * @returns {boolean} Return true to keep processor alive
     */
    process(inputs) {
        const input = inputs[0];

        if (input.length > 0) {
            /** @type {Float32Array} */
            const channelData = input[0]; // Get first channel

            // Convert Float32Array to Int16Array (PCM16)
            /** @type {Int16Array} */
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
