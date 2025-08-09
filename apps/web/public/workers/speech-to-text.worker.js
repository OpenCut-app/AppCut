// Speech-to-Text Worker
// This worker loads @huggingface/transformers from CDN using ESM

let pipeline, WhisperTextStreamer;

// Load transformers from CDN using ESM
const initTransformers = async () => {
  try {
    const transformers = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1/+esm');
    pipeline = transformers.pipeline;
    WhisperTextStreamer = transformers.WhisperTextStreamer;
  } catch (error) {
    console.error('Failed to import transformers:', error);
    // Send error back to main thread
    self.postMessage({
      status: "error",
      data: { message: "Failed to load AI model dependencies" }
    });
    throw error;
  }
};

class ASRPipelineFactory {
  static instance = null;
  static currentModel = null;

  static async getInstance(model, progressCallback) {
    if (this.instance === null || this.currentModel !== model) {
      if (this.instance) {
        try {
          await this.instance.dispose();
        } catch (error) {
          console.warn('Failed to dispose previous model instance:', error);
        }
        this.instance = null;
      }

      this.currentModel = model;
      this.instance = await pipeline("automatic-speech-recognition", model, {
        dtype: {
          encoder_model: model === "onnx-community/whisper-large-v3-turbo" ? "fp16" : "fp32",
          decoder_model_merged: "q4",
        },
        device: "webgpu",
        progress_callback: progressCallback,
      });
    }
    return this.instance;
  }

  static dispose() {
    if (this.instance) {
      try {
        this.instance.dispose();
      } catch (error) {
        console.warn('Failed to dispose model instance:', error);
      }
      this.instance = null;
      this.currentModel = null;
    }
  }
}

// Handle incoming messages
self.addEventListener("message", async (event) => {
  const message = event.data;
  
  // Handle test connectivity message
  if (message.test) {
    self.postMessage({
      status: "update",
      data: { stage: "ready", progress: 100 }
    });
    return;
  }
  
  try {
    // Initialize transformers if not already done
    if (!pipeline || !WhisperTextStreamer) {
      await initTransformers();
    }
    
    const transcript = await transcribe(message);
    if (transcript === null) {
      self.postMessage({
        status: "error",
        data: { message: "Transcription returned null result" },
      });
      return;
    }

    self.postMessage({
      status: "complete",
      data: transcript,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown transcription error';
    self.postMessage({
      status: "error",
      data: { message: errorMessage },
    });
  }
});

const transcribe = async ({ audio, model, subtask, language }) => {
  if (!audio || audio.length === 0) {
    throw new Error('No audio data provided');
  }

  if (!model) {
    throw new Error('No model specified');
  }

  const isDistilWhisper = model.startsWith("distil-whisper/");
  const isEnglishOnly = model.includes('.en');

  try {
    // Load transcriber model with progress tracking
    const transcriber = await ASRPipelineFactory.getInstance(model, (data) => {
      // Forward progress updates to main thread
      if (data.status === 'downloading' || data.status === 'loading') {
        self.postMessage({
          status: "update",
          data: {
            stage: data.status,
            progress: data.progress || 0,
            file: data.file,
          },
        });
      }
    });

    if (!transcriber?.processor?.feature_extractor?.config) {
      throw new Error('Invalid transcriber configuration - missing feature extractor');
    }

    if (!transcriber.model?.config?.max_source_positions) {
      throw new Error('Invalid transcriber configuration - missing model config');
    }

    const time_precision = 
      transcriber.processor.feature_extractor.config.chunk_length /
      transcriber.model.config.max_source_positions;

    // Initialize transcription state
    const chunks = [];
    const chunk_length_s = isDistilWhisper ? 20 : 30;
    const stride_length_s = isDistilWhisper ? 3 : 5;

    let chunk_count = 0;
    let start_time = null;
    let num_tokens = 0;
    let tps;

    const streamer = new WhisperTextStreamer(transcriber.tokenizer, {
      time_precision,
      on_chunk_start: (x) => {
        const offset = (chunk_length_s - stride_length_s) * chunk_count;
        chunks.push({
          text: "",
          timestamp: [offset + x, null],
          finalised: false,
          offset,
        });
      },
      token_callback_function: () => {
        start_time ??= performance.now();
        if (num_tokens++ > 0) {
          tps = (num_tokens / (performance.now() - start_time)) * 1000;
        }
      },
      callback_function: (text) => {
        if (chunks.length === 0) return;
        
        const lastChunk = chunks[chunks.length - 1];
        if (lastChunk) {
          lastChunk.text += text;
          
          // Calculate progress based on processed chunks
          const estimatedProgress = Math.min(95, (chunk_count * 15) + (chunks.length * 5));
          
          self.postMessage({
            status: "update",
            data: {
              stage: "transcribing",
              progress: estimatedProgress,
              chunks: chunks.filter(c => c.finalised),
              currentText: lastChunk.text,
              tps,
            },
          });
        }
      },
      on_chunk_end: (x) => {
        const current = chunks[chunks.length - 1];
        if (current) {
          current.timestamp[1] = x + current.offset;
          current.finalised = true;
        }
      },
      on_finalize: () => {
        start_time = null;
        num_tokens = 0;
        ++chunk_count;
      },
    });

    // Configure transcription options
    const transcriptionOptions = {
      top_k: 0,
      do_sample: false,
      chunk_length_s,
      stride_length_s,
      return_timestamps: true,
      force_full_sequences: false,
      streamer,
    };

    // Add language and task for multilingual models
    if (!isEnglishOnly) {
      transcriptionOptions.language = language;
      transcriptionOptions.task = subtask;
    }

    // Run transcription
    const output = await transcriber(audio, transcriptionOptions);
    
    if (!output) {
      throw new Error('Transcription returned no output');
    }

    // Format and validate chunks
    const formattedChunks = chunks
      .filter(chunk => chunk.finalised && chunk.text.trim())
      .map(chunk => {
        const startTime = chunk.timestamp[0];
        const endTime = chunk.timestamp[1] || startTime;
        return {
          text: chunk.text.trim(),
          timestamp: [startTime, endTime]
        };
      });

    return {
      tps,
      text: output.text || '',
      chunks: formattedChunks,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
    throw new Error(`Transcription error: ${errorMessage}`);
  }
};