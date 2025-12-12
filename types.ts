
export interface Point {
  x: number;
  y: number;
  vx: number; // Velocity X
  vy: number; // Velocity Y
  baseX: number; // Anchor for elasticity
  baseY: number;
  pressure: number; // 0 to 1 based on drawing speed
}

export type BlendMode = 'source-over' | 'lighter' | 'multiply' | 'screen' | 'overlay' | 'difference' | 'exclusion';

export type ModulationSource = 'none' | 'random' | 'velocity' | 'cursor' | 'pressure' | 'path' | 'path-mirror' | 'path-mirror-inv' | 'audio-live' | 'audio-sample';

export type GlobalForceType = 'none' | 'repulse' | 'attract' | 'vortex';

export type GlobalToolTrigger = 'click' | 'hover';

export interface GlobalToolConfig {
  trigger: GlobalToolTrigger;
  radius: number;
  force: number;
}

export interface ModulationConfig {
  source: ModulationSource;
  min: number;
  max: number;
}

export interface SoundConfig {
  bufferId: string | null; 
  baseVolume: number;
  pitch: number;
  reverbSend: number; // 0 to 1
  loop: boolean;
  motionSensitivity: number; // 0 to 10: How much physics velocity affects volume/pitch
}

export interface SimulationParams {
  // --- VISUALS ---
  strokeWidth: number;
  opacity: number;
  color: string;
  blendMode: BlendMode;
  glowStrength: number;
  blurStrength: number;
  seamlessPath: boolean;
  
  // --- SHAPE & DRAWING ---
  segmentation: number; // Distance between points
  smoothing: number; // Input smoothing
  
  // --- PHYSICS (Matter) ---
  mass: number; // Inertia
  friction: number; // Damping
  viscosity: number; // Drag
  elasticity: number; // Return to shape
  tension: number; // Internal jitter/stiffness
  gravityX: number;
  gravityY: number;

  // --- ALIVE (Motion) ---
  wiggleAmplitude: number;
  wiggleFrequency: number;
  waveSpeed: number;
  breathingAmp: number;
  breathingFreq: number;
  
  // --- SOCIAL (Swarm/Boids) ---
  neighborRadius: number;
  repulsionForce: number; // Separation
  attractionForce: number; // Pull
  alignmentForce: number; // Match velocity (Boids)
  cohesionForce: number; // Stay together (Boids)
  
  // --- INTERACTION (Mouse) ---
  mouseInfluenceRadius: number;
  mouseRepulsion: number;
  mouseAttraction: number;
  mouseFalloff: number; // 1 = Linear, 2 = Quadratic (Sharper), etc.
  
  // --- AUDIO REACTIVITY ---
  audioSensitivity: number;
  audioToWidth: boolean;
  audioToColor: boolean;
  audioToWiggle: boolean;

  // --- GENERIC MODULATION ---
  // Stores modulation config for any parameter key
  modulations: Partial<Record<keyof SimulationParams, ModulationConfig>>;
}

export interface Stroke {
  id: string;
  points: Point[];
  center: { x: number, y: number };
  velocity: { x: number, y: number }; // Average velocity of the stroke
  params: SimulationParams;
  sound: SoundConfig;
  createdAt: number;
  phaseOffset: number;
  randomSeed: number; // Stable random value (0-1) for 'random' modulation
}
