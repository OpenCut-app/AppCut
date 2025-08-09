/**
 * Transcript types for speech-to-text functionality
 */

export interface TranscriptWord {
  text: string;
  startTime: number; // in milliseconds
  endTime: number; // in milliseconds
}

export interface TranscriptChunk {
  words: TranscriptWord[];
  startTime: number; // in milliseconds
  endTime: number; // in milliseconds
  text: string;
}

export interface Transcript {
  id: string;
  chunks: TranscriptChunk[];
  language: string;
  totalDuration: number; // in milliseconds
}

export interface SRTSegment {
  index: number;
  startTime: string; // SRT format: "00:00:01,000"
  endTime: string; // SRT format: "00:00:02,000"
  text: string;
}

/**
 * Convert milliseconds to SRT time format (HH:MM:SS,mmm)
 */
export function millisecondsToSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds
    .toString()
    .padStart(3, '0')}`;
}

/**
 * Generate SRT content from transcript
 */
export function transcriptToSRT(transcript: Transcript): string {
  const segments: SRTSegment[] = transcript.chunks.map((chunk, index) => ({
    index: index + 1,
    startTime: millisecondsToSRTTime(chunk.startTime),
    endTime: millisecondsToSRTTime(chunk.endTime),
    text: chunk.text.trim()
  }));

  return segments
    .map(segment => 
      `${segment.index}\n${segment.startTime} --> ${segment.endTime}\n${segment.text}\n`
    )
    .join('\n');
}

/**
 * Create a transcript from HuggingFace Whisper output
 */
export function createTranscriptFromWhisperOutput(
  whisperOutput: {
    text: string;
    chunks: Array<{
      timestamp: [number, number];
      text: string;
      words?: Array<{
        text: string;
        timestamp: [number, number];
      }>;
    }>;
    words?: Array<{
      text: string;
      timestamp: [number, number];
    }>;
  }
): Transcript {
  // Safety check for chunks
  const chunks: TranscriptChunk[] = (whisperOutput.chunks || []).map(chunk => {
    const startTime = chunk.timestamp[0] * 1000; // Convert to milliseconds
    const endTime = chunk.timestamp[1] * 1000;
    
    let transcriptWords: TranscriptWord[];
    
    // Check if we have word-level timestamps
    if (chunk.words && chunk.words.length > 0) {
      transcriptWords = chunk.words.map(word => ({
        text: word.text,
        startTime: word.timestamp[0] * 1000,
        endTime: word.timestamp[1] * 1000
      }));
    } else if (whisperOutput.words && whisperOutput.words.length > 0) {
      // Filter words that belong to this chunk by time range
      transcriptWords = whisperOutput.words
        .filter(word => {
          const wordStart = word.timestamp[0] * 1000;
          return wordStart >= startTime && wordStart <= endTime;
        })
        .map(word => ({
          text: word.text,
          startTime: word.timestamp[0] * 1000,
          endTime: word.timestamp[1] * 1000
        }));
    } else {
      // Fallback: Split text into words and estimate timing
      const words = chunk.text.trim().split(/\s+/);
      const wordDuration = (endTime - startTime) / words.length;
      
      transcriptWords = words.map((word, index) => ({
        text: word,
        startTime: startTime + (index * wordDuration),
        endTime: startTime + ((index + 1) * wordDuration)
      }));
    }

    return {
      words: transcriptWords,
      startTime,
      endTime,
      text: chunk.text.trim()
    };
  });

  const totalDuration = chunks.length > 0 
    ? Math.max(...chunks.map(chunk => chunk.endTime))
    : 0;

  return {
    id: crypto.randomUUID(),
    chunks,
    language: 'en', // Default to English for now
    totalDuration
  };
}