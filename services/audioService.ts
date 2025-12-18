
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  
  // Input
  private globalAnalyser: AnalyserNode | null = null;
  private globalSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  
  // Stroke specific audio
  private buffers: Map<string, AudioBuffer> = new Map(); // bufferId -> AudioBuffer
  
  // Continuous Loop Sources
  private activeLoops: Map<string, { source: AudioBufferSourceNode, gain: GainNode, analyser: AnalyserNode }> = new Map(); 
  
  // Granular State (for Timeline mode)
  // We don't keep persistent sources, we schedule grains
  private lastGrainTime: Map<string, number> = new Map();

  public isEngineReady: boolean = false;
  public isMicActive: boolean = false;

  // Initialize the Audio Context (Required for any playback)
  async initAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    if (this.isEngineReady) return;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    // Simple Reverb Impulse (Synthetic)
    this.reverbNode = this.audioContext.createConvolver();
    const rate = this.audioContext.sampleRate;
    const length = rate * 2; // 2 seconds tail
    const impulse = this.audioContext.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
       const channelData = impulse.getChannelData(channel);
       for (let i = 0; i < length; i++) {
          // Exponential decay noise
          channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
       }
    }
    this.reverbNode.buffer = impulse;
    this.reverbNode.connect(this.masterGain);

    this.isEngineReady = true;
  }

  // Toggle Microphone Input (Separate from playback)
  async toggleMic(active: boolean): Promise<void> {
    if (!this.audioContext) await this.initAudioContext();
    if (!this.audioContext) return;

    if (active) {
       try {
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         this.micStream = stream;
         this.globalAnalyser = this.audioContext.createAnalyser();
         this.globalAnalyser.fftSize = 256;
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

  // --- RECORDING ---
  async recordAudio(duration: number = 3000): Promise<AudioBuffer | null> {
    if (!this.audioContext) await this.initAudioContext();
    if (!this.audioContext) return null;

    try {
       // We need a temporary stream for recording if mic is not already active
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
    this.buffers.set(id, buffer);
  }

  getBuffer(id: string) {
    return this.buffers.get(id);
  }

  setMasterVolume(val: number) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(val, this.audioContext?.currentTime || 0, 0.1);
    }
  }

  // --- CORE PLAYBACK LOGIC ---
  updateStrokeSound(
    strokeId: string, 
    bufferId: string | null, 
    config: { 
       playbackMode: 'loop' | 'timeline-scrub',
       volumeSource: 'manual' | 'velocity' | 'displacement-dist' | 'displacement-x' | 'displacement-y' | 'proximity',
       minVolume: number, maxVolume: number,
       minPitch: number, maxPitch: number,
       reverb: number,
       grainSize: number
    }, 
    metrics: {
      cursorDist: number, 
      physicsSpeed: number, // velocity
      displacement: { dist: number, x: number, y: number },
      timelinePos: number // 0 to 1 (cursor projection on path)
    }
  ) {
    if (!this.audioContext || !bufferId) return;
    const buffer = this.buffers.get(bufferId);
    if (!buffer) return;

    // 1. Calculate Volume Drive based on source
    let drive = 0;
    
    switch (config.volumeSource) {
      case 'manual': 
        drive = 1; 
        break;
      case 'velocity':
        drive = Math.min(1, metrics.physicsSpeed / 10); // 10 is arbitrary max speed
        break;
      case 'proximity':
        drive = Math.max(0, 1 - (metrics.cursorDist / 300));
        drive = Math.pow(drive, 2);
        break;
      case 'displacement-dist':
        drive = Math.min(1, metrics.displacement.dist / 200);
        break;
      case 'displacement-x':
        drive = Math.min(1, Math.abs(metrics.displacement.x) / 100);
        break;
      case 'displacement-y':
        drive = Math.min(1, Math.abs(metrics.displacement.y) / 100);
        break;
    }

    if (!Number.isFinite(drive)) drive = 0;
    
    const targetVolume = config.minVolume + (config.maxVolume - config.minVolume) * drive;
    const targetPitch = config.minPitch + (config.maxPitch - config.minPitch) * drive; // Simple pitch follow for now

    // 2. Playback Strategy
    if (config.playbackMode === 'timeline-scrub') {
       this.handleGranularPlayback(strokeId, buffer, targetVolume, targetPitch, metrics.timelinePos, config.reverb, config.grainSize);
    } else {
       this.handleLoopPlayback(strokeId, buffer, targetVolume, targetPitch, config.reverb);
    }
  }

  private handleLoopPlayback(id: string, buffer: AudioBuffer, volume: number, pitch: number, reverb: number) {
    // If we were doing granular before, we don't have a loop.
    // If loop exists, update it. If not, create it.
    
    let active = this.activeLoops.get(id);

    if (!active) {
       if (volume <= 0.001) return; // Don't start silent loops

       const source = this.audioContext!.createBufferSource();
       source.buffer = buffer;
       source.loop = true;
       
       const gain = this.audioContext!.createGain();
       const analyser = this.audioContext!.createAnalyser();
       analyser.fftSize = 64;

       source.connect(gain);
       gain.connect(analyser);
       gain.connect(this.masterGain!);
       
       if (this.reverbNode && reverb > 0) {
          const reverbGain = this.audioContext!.createGain();
          reverbGain.gain.value = reverb;
          gain.connect(reverbGain);
          reverbGain.connect(this.reverbNode);
       }

       source.start();
       active = { source, gain, analyser };
       this.activeLoops.set(id, active);
    }

    // Update
    if (active) {
       const safeVolume = Number.isFinite(volume) ? Math.max(0, volume) : 0;
       const safePitch = Number.isFinite(pitch) ? Math.max(0.01, pitch) : 1;
       
       active.gain.gain.setTargetAtTime(safeVolume, this.audioContext!.currentTime, 0.1);
       active.source.playbackRate.setTargetAtTime(safePitch, this.audioContext!.currentTime, 0.1);
    }
  }

  private handleGranularPlayback(id: string, buffer: AudioBuffer, volume: number, pitch: number, position: number, reverb: number, grainSize: number) {
    // Kill loop if it exists (switching modes)
    if (this.activeLoops.has(id)) {
      this.activeLoops.get(id)?.source.stop();
      this.activeLoops.delete(id);
    }

    if (volume < 0.01) return;

    const now = this.audioContext!.currentTime;
    const lastTime = this.lastGrainTime.get(id) || 0;
    const safeGrainSize = Number.isFinite(grainSize) && grainSize > 0.01 ? grainSize : 0.1;
    const interval = safeGrainSize * 0.5; // 50% overlap

    if (now - lastTime > interval) {
       this.playGrain(buffer, volume, pitch, position, reverb, safeGrainSize);
       this.lastGrainTime.set(id, now);
    }
  }

  private playGrain(buffer: AudioBuffer, volume: number, pitch: number, position: number, reverb: number, duration: number) {
    if (!this.audioContext) return;
    
    // Sanitize inputs to prevent AudioParam errors (AudioParam.linearRampToValueAtTime: Argument 1 is not a finite floating-point value)
    if (!Number.isFinite(volume) || !Number.isFinite(pitch) || !Number.isFinite(duration) || duration <= 0) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Calculate offset in seconds based on timeline position (0-1)
    const safePosition = Number.isFinite(position) ? Math.max(0, Math.min(1, position)) : 0;
    const offset = safePosition * buffer.duration;
    
    const gain = this.audioContext.createGain();
    const safeVolume = Math.max(0, volume);
    
    // Envelope for grain to prevent clicks
    const now = this.audioContext.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(safeVolume, now + duration * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.playbackRate.value = Math.max(0.01, pitch);
    
    source.connect(gain);
    gain.connect(this.masterGain!);

    if (this.reverbNode && reverb > 0) {
      const reverbGain = this.audioContext.createGain();
      reverbGain.gain.value = reverb;
      gain.connect(reverbGain);
      reverbGain.connect(this.reverbNode);
    }

    source.start(now, offset, duration);
    source.stop(now + duration + 0.1);
  }

  // --- ANALYSIS ---
  getGlobalAudioData(): { average: number, low: number, mid: number, high: number } {
    if (!this.globalAnalyser) return { average: 0, low: 0, mid: 0, high: 0 };
    return this.analyzeNode(this.globalAnalyser);
  }

  getStrokeAmplitude(strokeId: string): number {
    const active = this.activeLoops.get(strokeId);
    if (!active) return 0; // Granular doesn't support visual feedback yet for performance
    const data = this.analyzeNode(active.analyser);
    return data.average / 255;
  }

  private analyzeNode(analyser: AnalyserNode) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    let lowSum = 0;
    const lowBound = Math.floor(dataArray.length * 0.2);

    for (let i = 0; i < dataArray.length; i++) {
      const val = dataArray[i];
      sum += val;
      if (i < lowBound) lowSum += val;
    }

    return {
      average: sum / dataArray.length,
      low: lowSum / lowBound || 0,
      mid: 0,
      high: 0
    };
  }

  stopAll() {
    this.activeLoops.forEach(s => s.source.stop());
    this.activeLoops.clear();
    this.lastGrainTime.clear();
  }
}

export const audioManager = new AudioManager();
