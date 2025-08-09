// Import Kokoro TTS from CDN using ESM
import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";

// WebGPU detection utility
async function detectWebGPU() {
  if (!navigator.gpu) {
    return false;
  }
  
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return false;
    }
    
    const device = await adapter.requestDevice();
    return !!device;
  } catch (error) {
    console.warn('WebGPU detection failed:', error);
    return false;
  }
}

// Device detection
const device = (await detectWebGPU()) ? "webgpu" : "wasm";
self.postMessage({ status: "device", device });

// Load the model
const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";
const tts = await KokoroTTS.from_pretrained(model_id, {
  dtype: device === "wasm" ? "q8" : "fp32",
  device,
}).catch((e) => {
  self.postMessage({ status: "error", error: e.message });
  throw e;
});

self.postMessage({ status: "ready", voices: tts.voices, device });

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { text, voice } = e.data;
  
  try {
    // Generate speech
    const audio = await tts.generate(text, { voice });
    
    // Send the audio file back to the main thread
    const blob = audio.toBlob();
    self.postMessage({ 
      status: "complete", 
      audio: URL.createObjectURL(blob), 
      text,
      audioData: audio.audio // Also send raw audio data for timeline
    });
  } catch (error) {
    self.postMessage({ 
      status: "error", 
      error: error.message 
    });
  }
});