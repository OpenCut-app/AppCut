import { create } from "zustand";
import { useTimelineStore } from "./timeline-store";
import { useMediaStore } from "./media-store";
import { createTranscriptFromWhisperOutput, transcriptToSRT } from "@/types/transcript";
import type { Transcript } from "@/types/transcript";
import type { TextElement } from "@/types/timeline";

interface DeviceCapabilities {
  hasWebGPU: boolean;
  hasWASM: boolean;
  recommendedBackend: 'webgpu' | 'wasm';
  warnings: string[];
}

// WebGPU and WASM detection functions
async function detectWebGPU(): Promise<boolean> {
  try {
    if (!(navigator as any).gpu) {
      return false;
    }

    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
      return false;
    }

    const device = await adapter.requestDevice();
    if (!device) {
      return false;
    }

    // Clean up
    device.destroy();
    return true;
  } catch (error) {
    console.warn('WebGPU detection failed:', error);
    return false;
  }
}

function detectWASM(): boolean {
  try {
    return typeof WebAssembly === 'object' && typeof WebAssembly.validate === 'function';
  } catch (error) {
    console.warn('WebAssembly detection failed:', error);
    return false;
  }
}

async function getDeviceCapabilities(): Promise<DeviceCapabilities> {
  const warnings: string[] = [];
  
  const hasWASM = detectWASM();
  const hasWebGPU = await detectWebGPU();

  let recommendedBackend: 'webgpu' | 'wasm' = 'wasm';

  if (hasWebGPU) {
    recommendedBackend = 'webgpu';
  } else if (!hasWASM) {
    warnings.push('Neither WebGPU nor WebAssembly is available. Speech-to-text may not work.');
  } else {
    warnings.push('WebGPU is not available. Using WebAssembly backend (slower performance).');
  }

  if (!hasWASM && !hasWebGPU) {
    warnings.push('Your browser does not support the required technologies for speech-to-text.');
  }

  return {
    hasWebGPU,
    hasWASM,
    recommendedBackend,
    warnings
  };
}

async function getOptimalBackend(): Promise<{
  device: 'webgpu' | 'wasm';
  dtype: 'fp32' | 'fp16' | 'q8' | 'q4';
}> {
  const capabilities = await getDeviceCapabilities();

  if (capabilities.hasWebGPU) {
    return {
      device: 'webgpu',
      dtype: 'fp16'
    };
  } else if (capabilities.hasWASM) {
    return {
      device: 'wasm',
      dtype: 'q8'
    };
  }

  throw new Error('Neither WebGPU nor WebAssembly is available. Speech-to-text requires browser support for at least WebAssembly.');
}

import { resampleAudio } from "@/lib/audio-extraction";

export interface TranscriptionResult {
  id: string;
  trackId: string;
  trackName: string;
  text: string;
  chunks: Array<{
    timestamp: [number, number];
    text: string;
  }>;
  createdAt: Date;
  transcript: Transcript;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  stage: 'loading' | 'initializing' | 'downloading' | 'transcribing' | 'ready' | 'terminated' | 'error';
  progress: number;
  error?: string;
}

export interface ModelConfig {
  device: 'webgpu' | 'wasm';
  dtype: 'fp32' | 'fp16' | 'q8' | 'q4';
  modelName: string;
}

interface SpeechToTextStore {
  // Worker management
  worker: Worker | null;
  isWorkerInitialized: boolean;
  initializationPromise: Promise<void> | null;
  
  // Device capabilities
  deviceCapabilities: DeviceCapabilities | null;
  
  // Model configuration
  availableModels: Array<{ name: string; size: string; description: string }>;
  selectedModel: string;
  modelConfig: ModelConfig | null;
  
  // Processing state
  processingStatus: ProcessingStatus;
  
  // Results
  results: TranscriptionResult[];
  
  // Actions
  initializeWorker: () => Promise<void>;
  terminateWorker: () => void;
  loadDeviceCapabilities: () => Promise<void>;
  setSelectedModel: (modelName: string) => void;
  processSelectedElement: () => Promise<void>;
  clearResults: () => void;
  resetState: () => void;
  removeResult: (resultId: string) => void;
  insertResultToTimeline: (resultId: string, mode?: 'sentences' | 'words') => void;
  downloadSRT: (resultId: string) => void;
  
  // Helper methods
  getSelectedElementInfo: () => { element: any; mediaItem: any; track: any } | null;
  extractAudioFromElement: (element: any, mediaItem: any) => Promise<{ audioData: Float32Array; sampleRate: number }>;
}

export const useSpeechToTextStore = create<SpeechToTextStore>((set, get) => ({
  // Worker state
  worker: null,
  isWorkerInitialized: false,
  initializationPromise: null,
  deviceCapabilities: null,
  availableModels: [
    { name: 'Xenova/whisper-tiny.en', size: '39MB', description: 'Fastest, English only' },
    { name: 'Xenova/whisper-base.en', size: '74MB', description: 'Good balance, English only' },
    { name: 'Xenova/whisper-small.en', size: '244MB', description: 'Better accuracy, English only' },
  ],
  selectedModel: 'Xenova/whisper-tiny.en',
  modelConfig: null,
  processingStatus: {
    isProcessing: false,
    stage: 'ready',
    progress: 0,
  },
  results: [],

  loadDeviceCapabilities: async () => {
    try {
      const capabilities = await getDeviceCapabilities();
      set({ deviceCapabilities: capabilities });
    } catch (error) {
      console.error('Failed to load device capabilities:', error);
      set({
        deviceCapabilities: {
          hasWebGPU: false,
          hasWASM: true,
          recommendedBackend: 'wasm',
          warnings: ['Failed to detect device capabilities']
        }
      });
    }
  },

  initializeWorker: async () => {
    const state = get();
    
    // Return existing initialization promise if already in progress
    if (state.initializationPromise) {
      return state.initializationPromise;
    }
    
    // Create and store the initialization promise
    const initPromise = (async () => {
      // Terminate existing worker
      if (state.worker) {
        state.terminateWorker();
      }

      try {
        // Create new worker from public directory
        const worker = new Worker('/workers/speech-to-text.worker.js', {
          type: 'module'
        });

        // Track worker readiness
        let workerReady = false;
        let initializationAborted = false;
        
        const workerReadyPromise = new Promise<void>((resolve, reject) => {
          // Setup cleanup function
          const cleanup = () => {
            initializationAborted = true;
          };

          worker.onmessage = (event: MessageEvent) => {
            if (initializationAborted) return;
            
            const message = event.data;
            
            // Handle the documented worker format
            switch (message.status) {
              case 'update':
                const updateData = message.data;
                set({
                  processingStatus: {
                    isProcessing: true,
                    stage: updateData.stage || 'initializing',
                    progress: updateData.progress || 0,
                  }
                });
                
                // Worker is ready when transformers are loaded (first meaningful update)
                if (!workerReady && (updateData.stage === 'ready' || updateData.progress > 0)) {
                  workerReady = true;
                  resolve();
                }
                break;
                
              case 'complete':
                const result = message.data;
                
                const elementInfo = get().getSelectedElementInfo();
                
                if (elementInfo) {
                  // Convert to our internal format and create Transcript object
                  const transcript = createTranscriptFromWhisperOutput(result);
                  
                  const transcriptionResult: TranscriptionResult = {
                    id: crypto.randomUUID(),
                    trackId: elementInfo.track.id,
                    trackName: `${elementInfo.track.name} - ${elementInfo.element.name || 'Element'}`,
                    text: result.text,
                    chunks: result.chunks,
                    createdAt: new Date(),
                    transcript,
                  };              
                  
                  // Dispatch custom event for toast notification
                  window.dispatchEvent(new CustomEvent('transcription-complete', {
                    detail: { 
                      segmentCount: result.chunks.length,
                      duration: result.chunks.length > 0 ? result.chunks[result.chunks.length - 1]?.timestamp[1] : 0
                    }
                  }));
                  
                  set((state) => ({
                    results: [...state.results, transcriptionResult],
                    processingStatus: { isProcessing: false, stage: 'ready', progress: 100 }
                  }));
                }
                break;
                
              case 'error':
                const errorMsg = message.data?.message || 'Transcription error';
                console.error('Worker reported error:', errorMsg);
                
                // Dispatch error event for UI toast notifications
                window.dispatchEvent(new CustomEvent('transcription-error', {
                  detail: { message: errorMsg }
                }));
                
                set({
                  processingStatus: {
                    isProcessing: false,
                    stage: 'error',
                    progress: 0,
                    error: errorMsg
                  }
                });
                
                // If this happens during initialization, reject the promise
                if (!workerReady) {
                  reject(new Error(errorMsg));
                }
                break;
            }
          };

          worker.onerror = (error) => {
            if (initializationAborted) return;
            
            console.error('Worker onerror event:', error);
            cleanup();
            
            const errorMsg = `Worker initialization failed: ${error.message || 'Unknown worker error'}`;
            
            // Dispatch error event for UI toast notifications
            window.dispatchEvent(new CustomEvent('worker-error', {
              detail: { message: errorMsg }
            }));
            
            set({
              processingStatus: {
                isProcessing: false,
                stage: 'error',
                progress: 0,
                error: errorMsg
              }
            });
            
            reject(new Error(errorMsg));
          };

          // Handle worker script loading errors
          worker.addEventListener('error', (error) => {
            if (initializationAborted) return;
            
            console.error('Worker addEventListener error:', error);
            cleanup();
            
            const errorMsg = `Worker script loading failed: ${error.message || 'Failed to load worker script'}`;
            
            // Dispatch error event for UI toast notifications
            window.dispatchEvent(new CustomEvent('worker-script-error', {
              detail: { message: errorMsg }
            }));
            
            set({
              processingStatus: {
                isProcessing: false,
                stage: 'error',
                progress: 0,
                error: errorMsg
              }
            });
            
            reject(new Error(errorMsg));
          });

          // Test worker connectivity by sending a minimal message
          // The worker will respond with either success or error
          try {
            worker.postMessage({ test: true });
          } catch (error) {
            cleanup();
            const errorMsg = `Failed to communicate with worker: ${error instanceof Error ? error.message : 'Unknown error'}`;
            
            window.dispatchEvent(new CustomEvent('worker-communication-error', {
              detail: { message: errorMsg }
            }));
            
            set({
              processingStatus: {
                isProcessing: false,
                stage: 'error',
                progress: 0,
                error: errorMsg
              }
            });
            
            reject(new Error(errorMsg));
          }
        });

        // Set worker in state immediately but not as initialized yet
        set({ worker });

        // Wait for worker to be ready (first message received)
        await workerReadyPromise;

        // Get optimal backend configuration
        const backendConfig = await getOptimalBackend();
        const modelConfig: ModelConfig = {
          ...backendConfig,
          modelName: state.selectedModel
        };

        // Mark as fully initialized
        set({ 
          isWorkerInitialized: true,
          modelConfig,
          processingStatus: { isProcessing: false, stage: 'ready', progress: 100 },
          initializationPromise: null
        });

      } catch (error) {
        console.error('Failed to initialize worker:', error);
        set({
          worker: null,
          isWorkerInitialized: false,
          initializationPromise: null,
          processingStatus: {
            isProcessing: false,
            stage: 'error',
            progress: 0,
            error: error instanceof Error ? error.message : 'Failed to initialize speech-to-text worker'
          }
        });
        throw error;
      }
    })();

    // Store the promise in state
    set({ initializationPromise: initPromise });
    
    return initPromise;
  },

  terminateWorker: () => {
    const state = get();
    if (state.worker) {
      state.worker.terminate();
      set({ 
        worker: null, 
        isWorkerInitialized: false,
        initializationPromise: null,
        processingStatus: { isProcessing: false, stage: 'terminated', progress: 0 }
      });
    }
  },

  setSelectedModel: (modelName: string) => {
    set({ selectedModel: modelName });
    // Re-initialize worker with new model if already initialized
    const state = get();
    if (state.isWorkerInitialized) {
      state.initializeWorker();
    }
  },

  processSelectedElement: async () => {
    const state = get();
    
    // Ensure worker is initialized
    if (!state.isWorkerInitialized) {
      await state.initializeWorker();
    }

    const elementInfo = state.getSelectedElementInfo();
    
    if (!elementInfo) {
      throw new Error('No audio/video element selected in timeline');
    }

    if (!state.worker) {
      throw new Error('Worker not available');
    }

    try {
      set({
        processingStatus: { isProcessing: true, stage: 'loading', progress: 0 }
      });
      
      // Extract audio from the selected element
      const audioData = await state.extractAudioFromElement(elementInfo.element, elementInfo.mediaItem);
      
      // Send to worker for processing using documented format
      const processMessage = {
        audio: audioData.audioData,
        model: state.selectedModel,
        subtask: 'transcribe',
        language: 'en'
      };

      state.worker.postMessage(processMessage);

    } catch (error) {
      set({
        processingStatus: {
          isProcessing: false,
          stage: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Failed to process element'
        }
      });
      throw error;
    }
  },

  clearResults: () => {
    set({ results: [] });
  },

  resetState: () => {
    const state = get();
    
    // Terminate worker if it exists
    if (state.worker) {
      state.terminateWorker();
    }
    
    // Reset all state except device capabilities and models
    set({
      worker: null,
      isWorkerInitialized: false,
      initializationPromise: null,
      modelConfig: null,
      processingStatus: { isProcessing: false, stage: 'ready', progress: 0 },
      results: []
    });
  },

  removeResult: (resultId: string) => {
    set((state) => ({
      results: state.results.filter(result => result.id !== resultId)
    }));
  },

  insertResultToTimeline: (resultId: string, mode: 'sentences' | 'words' = 'sentences') => {
    const state = get();
    const result = state.results.find(r => r.id === resultId);
    
    if (!result) {
      return;
    }

    const timelineStore = useTimelineStore.getState();
    const elementInfo = state.getSelectedElementInfo();
    
    if (!elementInfo) {
      console.warn('No element selected - cannot determine timeline position');
      return;
    }

    // Calculate timing offset based on the element's position in the timeline
    const element = elementInfo.element;
    
    // IMPORTANT: The timestamps from transcription are relative to the EXTRACTED audio
    // which starts from trimStart, not from the beginning of the original file
    // So we need to add: element.startTime (timeline position)
    // Note: We DON'T add trimStart because the transcription timestamps are already relative to the extracted portion
    const timelineOffset = element.startTime;
    
    // Prepare all text elements in advance
    const textElements: TextElement[] = [];
    
    if (mode === 'words') {
      // Insert individual words as text elements
      let wordCount = 0;
      result.transcript.chunks.forEach((chunk) => {
        chunk.words.forEach((word) => {
          const startTime = timelineOffset + (word.startTime / 1000); // Convert from ms to seconds
          const duration = (word.endTime - word.startTime) / 1000; // Convert from ms to seconds
          
          const textElement: TextElement = {
            id: crypto.randomUUID(),
            type: 'text',
            name: `Word ${wordCount + 1}: ${word.text}`,
            content: word.text,
            duration: Math.max(duration, 0.5), // Minimum 0.5 second duration for words
            startTime: startTime,
            trimStart: 0,
            trimEnd: 0,
            fontSize: 36,
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            textAlign: 'center' as const,
            fontWeight: 'bold' as const,
            fontStyle: 'normal' as const,
            textDecoration: 'none' as const,
            x: 0,
            y: 200,
            rotation: 0,
            opacity: 1
          };

          textElements.push(textElement);
          wordCount++;
        });
      });

    } else {
      // Insert sentence chunks as text elements
      result.chunks.forEach((chunk, index) => {
        const duration = chunk.timestamp[1] - chunk.timestamp[0];
        // Add the timeline offset to get the absolute position
        const startTime = timelineOffset + chunk.timestamp[0];
        
        // Create a more descriptive name for the text element
        const words = chunk.text.trim().split(/\s+/);
        const shortText = words.length > 3 
          ? words.slice(0, 3).join(' ') + '...'
          : chunk.text;

        const textElement: TextElement = {
          id: crypto.randomUUID(),
          type: 'text',
          name: `Subtitle ${index + 1}: ${shortText}`,
          content: chunk.text.trim(),
          duration: Math.max(duration, 1), // Ensure minimum 1 second duration
          startTime: startTime,
          trimStart: 0,
          trimEnd: 0,
          fontSize: 36,
          fontFamily: 'Arial',
          color: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0.7)', // Semi-transparent background for readability
          textAlign: 'center' as const,
          fontWeight: 'bold' as const,
          fontStyle: 'normal' as const,
          textDecoration: 'none' as const,
          x: 0, // Center horizontally
          y: 200, // Position at bottom (positive y moves down from center)
          rotation: 0,
          opacity: 1
        };
        
        textElements.push(textElement);
      });
    }
    
    // Resolve overlaps - cut end time of previous to start time of next
    const resolvedElements: TextElement[] = [];
    let overlapCount = 0;
    
    // Sort elements by start time to ensure proper overlap detection
    const sortedElements = [...textElements].sort((a, b) => a.startTime - b.startTime);
    
    for (let i = 0; i < sortedElements.length; i++) {
      const current = { ...sortedElements[i] };
      const next = sortedElements[i + 1];
      
      // Check if current element's end time overlaps with next element's start time
      if (next) {
        const currentEndTime = current.startTime + current.duration;
        const nextStartTime = next.startTime;
        
        if (currentEndTime > nextStartTime) {
          // Trim current element's duration to end exactly when next starts
          current.duration = nextStartTime - current.startTime;
          overlapCount++;
        }
      }
      
      resolvedElements.push(current);
    }
    
    // Show warning if overlaps were resolved
    if (overlapCount > 0) {
      console.warn(`Resolved ${overlapCount} overlapping subtitle(s) by trimming duration`);
    }
    
    // Create a new track and add elements
    const trackId = timelineStore.addTrack('text');
    
    // Add each element to the track
    resolvedElements.forEach(element => {
      timelineStore.addElementToTrack(trackId, element);
    });
    
    // Update the result to reflect what was actually added to timeline
    set((state) => ({
      results: state.results.map(r => 
        r.id === resultId 
          ? { 
              ...r, 
              chunks: resolvedElements.map(el => ({
                text: el.content,
                timestamp: [el.startTime, el.startTime + el.duration] as [number, number]
              }))
            }
          : r
      )
    }));
    
    // Dispatch event for toast notification
    window.dispatchEvent(new CustomEvent('text-elements-added', {
      detail: { count: resolvedElements.length, mode: mode }
    }));
  },

  downloadSRT: (resultId: string) => {
    const state = get();
    const result = state.results.find(r => r.id === resultId);
    
    if (!result) return;

    // Generate SRT content
    const srtContent = transcriptToSRT(result.transcript);
    const srtBlob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });

    // Create download link
    const url = URL.createObjectURL(srtBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.trackName}_subtitles.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  getSelectedElementInfo: () => {
    const timelineStore = useTimelineStore.getState();
    const mediaStore = useMediaStore.getState();
    
    // Get the first selected element
    if (timelineStore.selectedElements.length === 0) return null;
    
    const { trackId, elementId } = timelineStore.selectedElements[0];
    const track = timelineStore.tracks.find(t => t.id === trackId);
    if (!track) return null;
    
    const element = track.elements.find(e => e.id === elementId);
    if (!element || element.type !== 'media') return null;
    
    const mediaItem = mediaStore.mediaItems.find(item => item.id === (element as any).mediaId);
    if (!mediaItem || (mediaItem.type !== 'audio' && mediaItem.type !== 'video')) return null;

    return {
      element,
      mediaItem,
      track
    };
  },

  extractAudioFromElement: async (element: any, mediaItem: any): Promise<{ audioData: Float32Array; sampleRate: number }> => {
    if (!mediaItem?.file) {
      throw new Error('No media file found for selected element');
    }

    try {
      // Load the audio file
      const arrayBuffer = await mediaItem.file.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Calculate the effective audio section to extract based on element timing
      const startSeconds = element.trimStart || 0;
      const durationSeconds = (element.duration || audioBuffer.duration) - (element.trimStart || 0) - (element.trimEnd || 0);
      
      if (durationSeconds <= 0) {
        throw new Error('Invalid audio duration after trimming');
      }
      
      // Extract the trimmed portion
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(startSeconds * sampleRate);
      const durationSamples = Math.floor(durationSeconds * sampleRate);
      
      // Ensure we don't exceed buffer bounds
      const actualStartSample = Math.max(0, Math.min(startSample, audioBuffer.length - 1));
      const actualDurationSamples = Math.min(durationSamples, audioBuffer.length - actualStartSample);
      
      if (actualDurationSamples <= 0) {
        throw new Error('No audio samples to extract - check trim values');
      }
      
      // Extract audio data (use first channel)
      const sourceData = audioBuffer.getChannelData(0);
      const extractedData = new Float32Array(actualDurationSamples);
      
      for (let i = 0; i < actualDurationSamples; i++) {
        extractedData[i] = sourceData[actualStartSample + i];
      }
      
      // Resample to 16kHz for speech recognition
      const targetSampleRate = 16000;
      let resampledData: Float32Array = extractedData;
      
      if (sampleRate !== targetSampleRate) {
        resampledData = resampleAudio(extractedData, sampleRate, targetSampleRate);
      }
      
      audioContext.close();
      
      return {
        audioData: resampledData,
        sampleRate: targetSampleRate
      };
    } catch (error) {
      throw new Error(`Failed to extract audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

}));