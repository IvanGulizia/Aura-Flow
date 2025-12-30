
export interface AudioSpectralData {
  average: number;
  sub: number;      // 20-60 Hz
  bass: number;     // 60-250 Hz
  lowMid: number;   // 250-500 Hz
  mid: number;      // 500-2000 Hz
  highMid: number;  // 2000-4000 Hz
  treble: number;   // 4000 Hz+
}

// Internal class to handle individual stroke audio state
class StrokeAudioPlayer {
  private ctx: AudioContext;
  private buffer: AudioBuffer;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode;
  private analyser: AnalyserNode;
  private panner: StereoPannerNode; 
  private isPlaying: boolean = false;
  private lastScrubTime: number = 0;
  
  // Smoothing for amplitude analysis
  private lastAmplitude: number = 0;

  constructor(ctx: AudioContext, buffer: AudioBuffer, destination: AudioNode) {
    this.ctx = ctx;
    this.buffer = buffer;
    
    // Graph: Source -> Analyser (Pre-Fader) -> Gain -> Panner -> Destination
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512; // Larger window for better RMS stability
    this.analyser.smoothingTimeConstant = 0.3;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0; // Controlled by updateVolume

    this.panner = ctx.createStereoPanner();

    // Connect the chain (Source will be connected in start/play)
    this.analyser.connect(this.gain);
    this.gain.connect(this.panner);
    this.panner.connect(destination);
  }

  // Continuous Loop Mode
  public startLoop(playbackRate: number = 1) {
    // If playing, just check if we need to update rate
    if (this.isPlaying && this.source) {
       try {
         this.source.playbackRate.setTargetAtTime(Math.max(0.01, playbackRate), this.ctx.currentTime, 0.1);
       } catch (e) {
         // Source might have stopped unexpectedly
         this.isPlaying = false;
       }
    }

    if (!this.isPlaying) {
      this.source = this.ctx.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.loop = true;
      this.source.playbackRate.value = Math.max(0.01, playbackRate);
      
      this.source.connect(this.analyser);
      this.source.start();
      this.isPlaying = true;
    }
  }

  // Timeline Scrub Mode
  public scrub(position01: number, playbackRate: number = 1, grainSize: number = 0.1) {
    // Stop continuous loop if it was running
    if (this.source && this.source.loop) {
        this.stop();
    }

    const now = this.ctx.currentTime;
    if (now - this.lastScrubTime < grainSize * 0.5) return; // Limit density

    const offset = Math.max(0, Math.min(1, position01)) * this.buffer.duration;
    
    const grain = this.ctx.createBufferSource();
    grain.buffer = this.buffer;
    grain.playbackRate.value = playbackRate;
    
    // Envelope to avoid clicks
    const envGain = this.ctx.createGain();
    envGain.gain.setValueAtTime(0, now);
    envGain.gain.linearRampToValueAtTime(1, now + 0.01);
    envGain.gain.exponentialRampToValueAtTime(0.001, now + grainSize);

    grain.connect(envGain);
    envGain.connect(this.analyser); // Connect to main chain for analysis
    
    grain.start(now, offset);
    // grain.stop is handled by garbage collection after playback, but we can be explicit
    grain.stop(now + grainSize + 0.2);
    
    this.lastScrubTime = now;
  }

  public updateVolume(volume: number, pan: number = 0) {
    if (!Number.isFinite(volume)) return;
    this.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
    this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime, 0.1);
  }

  public stop() {
    if (this.source) {
      try { this.source.stop(); } catch(e) {}
      try { this.source.disconnect(); } catch(e) {}
      this.source = null;
    }
    this.isPlaying = false;
  }

  public destroy() {
    this.stop();
    this.gain.disconnect();
    this.analyser.disconnect();
    this.panner.disconnect();
  }

  // Returns amplitude 0-1 (Pre-Fader)
  public getAmplitude(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    
    let sum = 0;
    // RMS Calculation
    for(let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    
    // Boost signal for visual usability (RMS is typically low)
    const boosted = rms * 5.0; 
    
    this.lastAmplitude = this.lastAmplitude * 0.7 + boosted * 0.3;
    return Math.min(1, this.lastAmplitude);
  }
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  
  // Input (Mic)
  private globalAnalyser: AnalyserNode | null = null;
  private globalSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  
  // Analysis Config
  public smoothing: number = 0.8;
  public noiseFloor: number = 0.1;
  
  private lastSpectralData: AudioSpectralData = {
      average: 0, sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0
  };
  private lastAnalysisTime: number = 0;

  // Assets
  private buffers: Map<string, AudioBuffer> = new Map(); 
  
  // Active Players (Stroke ID -> Player)
  private players: Map<string, StrokeAudioPlayer> = new Map();

  public isEngineReady: boolean = false;
  public isMicActive: boolean = false;

  async initAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    if (this.isEngineReady) return;

    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtor({ latencyHint: 'interactive' });
    
    // Master Chain: Reverb -> Limiter -> MasterGain -> Dest
    this.masterGain = this.audioContext.createGain();
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -1; // Gentle compression
    this.limiter.ratio.value = 12;

    this.reverbNode = this.audioContext.createConvolver();
    await this.generateReverbImpulse();

    this.reverbNode.connect(this.limiter);
    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);

    this.isEngineReady = true;
  }

  private async generateReverbImpulse() {
    if (!this.audioContext || !this.reverbNode) return;
    const rate = this.audioContext.sampleRate;
    const length = rate * 2.0; // 2s tail
    const impulse = this.audioContext.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
       const channelData = impulse.getChannelData(channel);
       for (let i = 0; i < length; i++) {
          const decay = Math.pow(1 - i / length, 3);
          channelData[i] = (Math.random() * 2 - 1) * decay * 0.5;
       }
    }
    this.reverbNode.buffer = impulse;
  }

  async toggleMic(active: boolean): Promise<void> {
    if (!this.audioContext) await this.initAudioContext();
    if (!this.audioContext) return;

    if (active) {
       try {
         const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } });
         this.micStream = stream;
         this.globalAnalyser = this.audioContext.createAnalyser();
         this.globalAnalyser.fftSize = 2048; 
         this.globalAnalyser.smoothingTimeConstant = 0; 
         this.globalSource = this.audioContext.createMediaStreamSource(stream);
         this.globalSource.connect(this.globalAnalyser);
         this.isMicActive = true;
       } catch (err) {
         console.error("Mic access denied", err);
         this.isMicActive = false;
       }
    } else {
       if (this.globalSource) {
         this.globalSource.disconnect();
         this.globalSource = null;
       }
       if (this.micStream) {
         this.micStream.getTracks().forEach(track => track.stop());
         this.micStream = null;
       }
       this.globalAnalyser = null;
       this.isMicActive = false;
    }
  }

  async recordAudio(duration: number = 3000): Promise<AudioBuffer | null> {
    if (!this.audioContext) await this.initAudioContext();
    if (!this.audioContext) return null;

    try {
       let stream = this.micStream;
       let tempStream = false;
       if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tempStream = true;
       }

       const mediaRecorder = new MediaRecorder(stream!);
       const chunks: Blob[] = [];

       return new Promise((resolve) => {
          mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
          mediaRecorder.onstop = async () => {
             const blob = new Blob(chunks, { type: 'audio/webm' });
             const arrayBuffer = await blob.arrayBuffer();
             const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
             
             if (tempStream && stream) {
                stream.getTracks().forEach(t => t.stop());
             }
             resolve(audioBuffer);
          };
          mediaRecorder.start();
          setTimeout(() => mediaRecorder.stop(), duration);
       });
    } catch (e) {
      console.error("Recording failed", e);
      return null;
    }
  }

  addBuffer(id: string, buffer: AudioBuffer) {
    if (!buffer) return;
    this.buffers.set(id, buffer);
  }

  getBuffer(id: string) {
    return this.buffers.get(id);
  }

  setMasterVolume(val: number) {
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(val, this.audioContext.currentTime, 0.1);
    }
  }

  // --- PLAYBACK ---
  updateStrokeSound(
    strokeId: string, 
    bufferId: string | null, 
    config: { 
       playbackMode: 'loop' | 'timeline-scrub',
       volumeSource: 'manual' | 'velocity' | 'displacement-dist' | 'displacement-x' | 'displacement-y' | 'proximity',
       minVolume: number, maxVolume: number,
       minPitch: number, maxPitch: number,
       reverbSend: number,
       grainSize: number
    }, 
    metrics: {
      cursorDist: number, 
      physicsSpeed: number, 
      displacement: { dist: number, x: number, y: number },
      timelinePos: number
    }
  ) {
    if (!this.audioContext || !bufferId || !this.isEngineReady) return;
    
    // 1. Get or Create Player
    let player = this.players.get(strokeId);
    if (!player) {
        const buffer = this.buffers.get(bufferId);
        if (!buffer) return;
        
        const playerBus = this.audioContext.createGain();
        playerBus.connect(this.limiter!); // Dry path
        
        player = new StrokeAudioPlayer(this.audioContext, buffer, playerBus);
        
        // Reverb Send
        const reverbGain = this.audioContext.createGain();
        reverbGain.gain.value = config.reverbSend;
        playerBus.connect(reverbGain);
        reverbGain.connect(this.reverbNode!);

        this.players.set(strokeId, player);
    }

    // 2. Calculate Volume & Pitch
    let drive = 0;
    switch (config.volumeSource) {
      case 'manual': drive = 1; break;
      case 'velocity': drive = Math.min(1, metrics.physicsSpeed / 20); break;
      case 'proximity': drive = Math.max(0, 1 - (metrics.cursorDist / 300)); drive = Math.pow(drive, 2); break;
      case 'displacement-dist': drive = Math.min(1, metrics.displacement.dist / 200); break;
      case 'displacement-x': drive = Math.min(1, Math.abs(metrics.displacement.x) / 100); break;
      case 'displacement-y': drive = Math.min(1, Math.abs(metrics.displacement.y) / 100); break;
    }
    
    const targetVolume = config.minVolume + (config.maxVolume - config.minVolume) * drive;
    const targetPitch = config.minPitch + (config.maxPitch - config.minPitch) * drive;
    
    // Spatial Pan
    const pan = Math.max(-1, Math.min(1, (metrics.displacement.x / (window.innerWidth/2))));

    // 3. Update Player State
    player.updateVolume(targetVolume, pan);

    if (config.playbackMode === 'timeline-scrub') {
       player.scrub(metrics.timelinePos, targetPitch, config.grainSize);
    } else {
       player.startLoop(targetPitch);
    }
  }

  removeStroke(strokeId: string) {
      const player = this.players.get(strokeId);
      if (player) {
          player.destroy();
          this.players.delete(strokeId);
      }
  }

  stopAll() {
    this.players.forEach(p => p.destroy());
    this.players.clear();
  }

  // --- ANALYSIS ---

  getStrokeAmplitude(strokeId: string): number {
      const player = this.players.get(strokeId);
      return player ? player.getAmplitude() : 0;
  }

  getSpectralData(): AudioSpectralData {
    // Frame Limiter
    const now = performance.now();
    if (now - this.lastAnalysisTime < 16) return this.lastSpectralData;
    this.lastAnalysisTime = now;

    if (!this.globalAnalyser) return this.lastSpectralData;

    const bufferLength = this.globalAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.globalAnalyser.getByteFrequencyData(dataArray);

    const sampleRate = this.audioContext?.sampleRate || 44100;
    const nyquist = sampleRate / 2;
    
    const getEnergy = (minHz: number, maxHz: number) => {
        const startBin = Math.floor((minHz / nyquist) * bufferLength);
        const endBin = Math.floor((maxHz / nyquist) * bufferLength);
        let sum = 0;
        let count = 0;
        for (let i = startBin; i <= endBin; i++) {
            sum += dataArray[i];
            count++;
        }
        return count > 0 ? (sum / count) / 255 : 0;
    };

    const raw: AudioSpectralData = {
        sub: getEnergy(20, 60),
        bass: getEnergy(60, 250),
        lowMid: getEnergy(250, 500),
        mid: getEnergy(500, 2000),
        highMid: getEnergy(2000, 4000),
        treble: getEnergy(4000, 16000),
        average: 0
    };
    raw.average = (raw.sub + raw.bass + raw.lowMid + raw.mid + raw.highMid + raw.treble) / 6;

    Object.keys(raw).forEach(key => {
        const k = key as keyof AudioSpectralData;
        if (raw[k] < this.noiseFloor) raw[k] = 0;
        else raw[k] = (raw[k] - this.noiseFloor) / (1 - this.noiseFloor);
        raw[k] = this.lastSpectralData[k] * this.smoothing + raw[k] * (1 - this.smoothing);
    });

    this.lastSpectralData = raw;
    return raw;
  }
}

export const audioManager = new AudioManager();