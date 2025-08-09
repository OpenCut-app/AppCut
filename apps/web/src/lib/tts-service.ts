export interface KokoroVoice {
  id: string;
  name: string;
  language: "American English" | "British English";
  gender: "Male" | "Female";
  traits: string;
  quality: string;
  grade: string;
}

export const KOKORO_VOICES: KokoroVoice[] = [
  // American English - Female
  {
    id: "af_heart",
    name: "Heart",
    language: "American English",
    gender: "Female",
    traits: "❤️",
    quality: "",
    grade: "A",
  },
  {
    id: "af_alloy",
    name: "Alloy",
    language: "American English",
    gender: "Female",
    traits: "",
    quality: "B",
    grade: "C",
  },
  {
    id: "af_aoede",
    name: "Aoede",
    language: "American English",
    gender: "Female",
    traits: "",
    quality: "B",
    grade: "C+",
  },
  {
    id: "af_bella",
    name: "Bella",
    language: "American English",
    gender: "Female",
    traits: "🔥",
    quality: "A",
    grade: "A-",
  },
  {
    id: "af_jessica",
    name: "Jessica",
    language: "American English",
    gender: "Female",
    traits: "",
    quality: "C",
    grade: "D",
  },
  {
    id: "af_kore",
    name: "Kore",
    language: "American English",
    gender: "Female",
    traits: "",
    quality: "B",
    grade: "C+",
  },
  {
    id: "af_nicole",
    name: "Nicole",
    language: "American English",
    gender: "Female",
    traits: "🎧",
    quality: "B",
    grade: "B-",
  },
  {
    id: "af_nova",
    name: "Nova",
    language: "American English",
    gender: "Female",
    traits: "",
    quality: "B",
    grade: "C",
  },
  {
    id: "af_river",
    name: "River",
    language: "American English",
    gender: "Female",
    traits: "",
    quality: "C",
    grade: "D",
  },
  {
    id: "af_sarah",
    name: "Sarah",
    language: "American English",
    gender: "Female",
    traits: "",
    quality: "B",
    grade: "C+",
  },
  {
    id: "af_sky",
    name: "Sky",
    language: "American English",
    gender: "Female",
    traits: "",
    quality: "B",
    grade: "C-",
  },

  // American English - Male
  {
    id: "am_adam",
    name: "Adam",
    language: "American English",
    gender: "Male",
    traits: "",
    quality: "D",
    grade: "F+",
  },
  {
    id: "am_echo",
    name: "Echo",
    language: "American English",
    gender: "Male",
    traits: "",
    quality: "C",
    grade: "D",
  },
  {
    id: "am_eric",
    name: "Eric",
    language: "American English",
    gender: "Male",
    traits: "",
    quality: "C",
    grade: "D",
  },
  {
    id: "am_fenrir",
    name: "Fenrir",
    language: "American English",
    gender: "Male",
    traits: "",
    quality: "B",
    grade: "C+",
  },
  {
    id: "am_liam",
    name: "Liam",
    language: "American English",
    gender: "Male",
    traits: "",
    quality: "C",
    grade: "D",
  },
  {
    id: "am_michael",
    name: "Michael",
    language: "American English",
    gender: "Male",
    traits: "",
    quality: "B",
    grade: "C+",
  },
  {
    id: "am_onyx",
    name: "Onyx",
    language: "American English",
    gender: "Male",
    traits: "",
    quality: "C",
    grade: "D",
  },
  {
    id: "am_puck",
    name: "Puck",
    language: "American English",
    gender: "Male",
    traits: "",
    quality: "B",
    grade: "C+",
  },
  {
    id: "am_santa",
    name: "Santa",
    language: "American English",
    gender: "Male",
    traits: "",
    quality: "C",
    grade: "D-",
  },

  // British English - Female
  {
    id: "bf_alice",
    name: "Alice",
    language: "British English",
    gender: "Female",
    traits: "",
    quality: "C",
    grade: "D",
  },
  {
    id: "bf_emma",
    name: "Emma",
    language: "British English",
    gender: "Female",
    traits: "",
    quality: "B",
    grade: "B-",
  },
  {
    id: "bf_isabella",
    name: "Isabella",
    language: "British English",
    gender: "Female",
    traits: "",
    quality: "B",
    grade: "C",
  },
  {
    id: "bf_lily",
    name: "Lily",
    language: "British English",
    gender: "Female",
    traits: "",
    quality: "C",
    grade: "D",
  },

  // British English - Male
  {
    id: "bm_daniel",
    name: "Daniel",
    language: "British English",
    gender: "Male",
    traits: "",
    quality: "C",
    grade: "D",
  },
  {
    id: "bm_fable",
    name: "Fable",
    language: "British English",
    gender: "Male",
    traits: "",
    quality: "B",
    grade: "C",
  },
  {
    id: "bm_george",
    name: "George",
    language: "British English",
    gender: "Male",
    traits: "",
    quality: "B",
    grade: "C",
  },
  {
    id: "bm_lewis",
    name: "Lewis",
    language: "British English",
    gender: "Male",
    traits: "",
    quality: "C",
    grade: "D+",
  },
];

export class KokoroTTSService {
  private worker: Worker | null = null;
  private initialized = false;
  private isInitializing = false;
  private voices: any[] = [];
  private device: string = "";
  private onStatusChange: ((status: string, data?: any) => void) | null = null;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker('/workers/tts.worker.js', { type: 'module' });
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = (error) => {
        console.error('TTS Worker error:', error);
        if (this.onStatusChange) {
          this.onStatusChange('error', { error: 'Worker failed to initialize' });
        }
      };
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { status, device, voices, audio, text, audioData, error } = event.data;
    
    switch (status) {
      case 'device':
        this.device = device;
        if (this.onStatusChange) {
          this.onStatusChange('device', { device });
        }
        break;
        
      case 'ready':
        this.initialized = true;
        this.isInitializing = false;
        this.voices = voices;
        if (this.onStatusChange) {
          this.onStatusChange('ready', { voices, device });
        }
        break;
        
      case 'complete':
        if (this.onStatusChange) {
          // Create audio object with save method for compatibility
          const audioObject = {
            audio: audioData,
            url: audio,
            save: (filename: string) => {
              const a = document.createElement('a');
              a.href = audio;
              a.download = filename;
              a.click();
            }
          };
          this.onStatusChange('complete', { audio: audioObject, text });
        }
        break;
        
      case 'error':
        this.isInitializing = false;
        if (this.onStatusChange) {
          this.onStatusChange('error', { error });
        }
        break;
    }
  }

  async initialize(statusCallback?: (status: string, data?: any) => void): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    if (this.isInitializing) {
      return new Promise((resolve) => {
        const checkReady = () => {
          if (this.initialized) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }

    this.isInitializing = true;
    this.onStatusChange = statusCallback || null;

    return new Promise((resolve, reject) => {
      const originalCallback = this.onStatusChange;
      this.onStatusChange = (status, data) => {
        if (originalCallback) {
          originalCallback(status, data);
        }
        
        if (status === 'ready') {
          resolve();
        } else if (status === 'error') {
          reject(new Error(data?.error || 'Initialization failed'));
        }
      };
    });
  }

  async generateSpeech(text: string, voiceId = "af_heart"): Promise<any> {
    if (!this.initialized) {
      throw new Error("TTS service not initialized");
    }

    if (!this.worker) {
      throw new Error("Worker not available");
    }

    return new Promise((resolve, reject) => {
      const originalCallback = this.onStatusChange;
      this.onStatusChange = (status, data) => {
        if (originalCallback) {
          originalCallback(status, data);
        }
        
        if (status === 'complete') {
          this.onStatusChange = originalCallback;
          resolve(data.audio);
        } else if (status === 'error') {
          this.onStatusChange = originalCallback;
          reject(new Error(data?.error || 'Generation failed'));
        }
      };

      // Send generation request
      this.worker?.postMessage({ text, voice: voiceId });
    });
  }

  getVoices(): KokoroVoice[] {
    // If we have voices from the worker, use them, otherwise fallback to static list
    if (this.voices.length > 0) {
      return this.voices.map(voice => ({
        id: voice,
        name: this.getVoiceDisplayName(voice),
        language: this.getVoiceLanguage(voice),
        gender: this.getVoiceGender(voice),
        traits: "",
        quality: "",
        grade: ""
      }));
    }
    return KOKORO_VOICES;
  }

  private getVoiceDisplayName(voiceId: string): string {
    const voice = KOKORO_VOICES.find(v => v.id === voiceId);
    return voice?.name || voiceId.split('_')[1] || voiceId;
  }

  private getVoiceLanguage(voiceId: string): "American English" | "British English" {
    if (voiceId.startsWith('b')) return "British English";
    return "American English";
  }

  private getVoiceGender(voiceId: string): "Male" | "Female" {
    if (voiceId.includes('m_')) return "Male";
    return "Female";
  }

  getVoiceById(id: string): KokoroVoice | undefined {
    return this.getVoices().find((voice) => voice.id === id);
  }

  isReady(): boolean {
    return this.initialized;
  }

  getDevice(): string {
    return this.device;
  }

  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.initialized = false;
    this.isInitializing = false;
  }
}

export const kokoroTTSService = new KokoroTTSService();
