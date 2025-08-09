/**
 * Audio extraction utilities for speech-to-text processing
 */

import type { TimelineTrack } from "@/types/timeline";
import type { MediaItem } from "@/stores/media-store";

export interface AudioSegment {
  audioBuffer: AudioBuffer;
  startTime: number;
  duration: number;
}

export interface ExtractedAudio {
  audioData: Float32Array;
  sampleRate: number;
  duration: number;
  timelineOffset: number; // The start time of the first audio segment in the timeline
}

/**
 * Extract and concatenate audio from all media elements in a track
 */
export async function extractAudioFromTrack(
  track: TimelineTrack,
  mediaItems: MediaItem[]
): Promise<ExtractedAudio> {
  // Get all media elements that have audio
  const audioElements = track.elements
    .filter(element => element.type === 'media')
    .map(element => {
      const mediaItem = mediaItems.find(item => item.id === element.mediaId);
      return { element, mediaItem };
    })
    .filter(({ mediaItem }) => 
      mediaItem && (mediaItem.type === 'audio' || mediaItem.type === 'video')
    )
    .sort((a, b) => a.element.startTime - b.element.startTime);

  if (audioElements.length === 0) {
    throw new Error('No audio elements found in track');
  }

  // Calculate the total duration of the track
  const trackEndTime = Math.max(
    ...audioElements.map(({ element }) => 
      element.startTime + element.duration - element.trimStart - element.trimEnd
    )
  );

  // Process each audio element
  const audioSegments: AudioSegment[] = [];
  
  for (const { element, mediaItem } of audioElements) {
    if (!mediaItem?.file) continue;

    try {
      const audioBuffer = await loadAudioFile(mediaItem.file);
      
      // Calculate the effective duration after trimming
      const effectiveDuration = element.duration - element.trimStart - element.trimEnd;
      
      // Only process if there's audio content after trimming
      if (effectiveDuration > 0) {
        const trimmedBuffer = trimAudioBuffer(
          audioBuffer,
          element.trimStart,
          effectiveDuration
        );

        audioSegments.push({
          audioBuffer: trimmedBuffer,
          startTime: element.startTime,
          duration: effectiveDuration
        });
      }
    } catch (error) {
      console.warn(`Failed to process audio element ${element.id}:`, error);
    }
  }

  if (audioSegments.length === 0) {
    throw new Error('No audio segments could be processed');
  }

  // Concatenate all segments into a single audio stream
  const concatenatedAudio = concatenateAudioSegments(audioSegments, trackEndTime);
  
  // Calculate the timeline offset (start time of the first audio segment)
  const timelineOffset = audioSegments.length > 0 ? audioSegments[0].startTime : 0;
  
  return {
    ...concatenatedAudio,
    timelineOffset
  };
}

/**
 * Load an audio file and decode it to an AudioBuffer
 */
async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioContext.close(); // Clean up
    return audioBuffer;
  } catch (error) {
    audioContext.close(); // Clean up on error
    throw new Error(`Failed to decode audio file: ${error}`);
  }
}

/**
 * Trim an audio buffer to a specific start time and duration
 */
function trimAudioBuffer(
  audioBuffer: AudioBuffer,
  startSeconds: number,
  durationSeconds: number
): AudioBuffer {
  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(startSeconds * sampleRate);
  const durationSamples = Math.floor(durationSeconds * sampleRate);
  
  // Ensure we don't exceed buffer bounds
  const actualStartSample = Math.max(0, Math.min(startSample, audioBuffer.length - 1));
  const actualDurationSamples = Math.min(
    durationSamples,
    audioBuffer.length - actualStartSample
  );

  if (actualDurationSamples <= 0) {
    // Return silent buffer if no valid audio range
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();    const silentBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      1,
      sampleRate
    );
    audioContext.close();
    return silentBuffer;
  }

  // Create new buffer with trimmed audio
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const trimmedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    actualDurationSamples,
    sampleRate
  );

  // Copy audio data
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const sourceData = audioBuffer.getChannelData(channel);
    const targetData = trimmedBuffer.getChannelData(channel);
    
    for (let i = 0; i < actualDurationSamples; i++) {
      targetData[i] = sourceData[actualStartSample + i];
    }
  }

  audioContext.close();
  return trimmedBuffer;
}

/**
 * Concatenate multiple audio segments into a single continuous stream
 */
function concatenateAudioSegments(
  segments: AudioSegment[],
  totalDuration: number
): Omit<ExtractedAudio, 'timelineOffset'> {
  if (segments.length === 0) {
    throw new Error('No audio segments to concatenate');
  }

  // Use the sample rate from the first segment (assume all are compatible)
  const sampleRate = segments[0].audioBuffer.sampleRate;
  const totalSamples = Math.floor(totalDuration * sampleRate);
  
  // Create output buffer (mono for speech recognition)
  const outputData = new Float32Array(totalSamples);
  
  // Process each segment
  for (const segment of segments) {
    const startSample = Math.floor(segment.startTime * sampleRate);
    const segmentData = segment.audioBuffer.getChannelData(0); // Use first channel
    
    // Copy segment data to the appropriate position in output
    const copyLength = Math.min(
      segmentData.length,
      outputData.length - startSample
    );
    
    if (copyLength > 0) {
      for (let i = 0; i < copyLength; i++) {
        const outputIndex = startSample + i;
        if (outputIndex < outputData.length) {
          // Mix if there's already audio at this position
          outputData[outputIndex] += segmentData[i];
        }
      }
    }
  }

  // Normalize the audio to prevent clipping
  normalizeAudio(outputData);

  return {
    audioData: outputData,
    sampleRate,
    duration: totalDuration
  };
}

/**
 * Normalize audio data to prevent clipping
 */
function normalizeAudio(audioData: Float32Array): void {
  let maxAmplitude = 0;
  
  // Find maximum amplitude
  for (let i = 0; i < audioData.length; i++) {
    maxAmplitude = Math.max(maxAmplitude, Math.abs(audioData[i]));
  }
  
  // Normalize if needed
  if (maxAmplitude > 1.0) {
    const normalizationFactor = 0.95 / maxAmplitude;
    for (let i = 0; i < audioData.length; i++) {
      audioData[i] *= normalizationFactor;
    }
  }
}

/**
 * Resample audio to a target sample rate (for speech recognition models)
 */
export function resampleAudio(
  inputData: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (inputSampleRate === targetSampleRate) {
    return inputData;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.floor(inputData.length / ratio);
  const outputData = new Float32Array(outputLength);

  // Simple linear interpolation resampling
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio;
    const index = Math.floor(sourceIndex);
    const fraction = sourceIndex - index;

    if (index + 1 < inputData.length) {
      // Linear interpolation between two samples
      outputData[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
    } else if (index < inputData.length) {
      // Use last sample if we're at the end
      outputData[i] = inputData[index];
    }
  }

  return outputData;
}