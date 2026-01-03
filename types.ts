
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
export type LineCapMode = 'butt' | 'round' | 'square';

export type ModulationSource = 
  | 'none' 
  | 'random' 
  | 'index' // Based on stroke index
  | 'selection-index' // NEW: Based on index within selection
  | 'time' // Linear loop 0 -> 1 based on time
  | 'time-sine' // Legacy: Automatic sine wave
  | 'time-pulse' // NEW: Hold at peaks
  | 'time-step'  // NEW: Discrete jumps
  | 'velocity' 
  | 'pressure' 
  | 'cursor' 
  | 'path' 
  | 'path-mirror' 
  | 'path-mirror-inv' 
  | 'audio-live' // Legacy generic
  | 'audio-average' // NEW: Average level
  | 'audio-sub'      // NEW: 20-60Hz
  | 'audio-bass'     // NEW: 60-250Hz
  | 'audio-low-mid'  // NEW: 250-500Hz
  | 'audio-mid'      // NEW: 500-2000Hz
  | 'audio-high-mid' // NEW: 2000-4000Hz
  | 'audio-treble'   // NEW: 4000Hz+
  | 'audio-sample';

export type EasingMode = 
  | 'linear' 
  | 'easeInQuad' 
  | 'easeOutQuad' 
  | 'easeInOutQuad' 
  | 'step' 
  | 'triangle'      // 0 -> 1 -> 0 (Linear)
  | 'triangle-inv'  // 1 -> 0 -> 1 (Linear)
  | 'sine'          // 0 -> 1 -> 0 (Smooth/Curved)
  | 'random'       // Noise
  | 'custom-bezier'; // NEW: Cubic Bezier (x1, y1, x2, y2)

export type ModulationScope = 'stroke' | 'point';

export type GlobalForceType = 'none' | 'repulse' | 'attract' | 'vortex' | 'connect' | 'cursor';

export type GlobalToolTrigger = 'click' | 'hover';

export interface GlobalToolConfig {
  trigger: GlobalToolTrigger;
  radius: number;
  force: number;
  falloff: number; // 0 to 1 (Soft to Sharp)
  connectionsVisible: boolean;
}

export interface ModulationConfig {
  source: ModulationSource;
  scope: ModulationScope; // Apply per stroke or per point
  min: number;
  max: number;
  speed?: number; // Speed multiplier or Duration in seconds
  speedStrategy?: 'frequency' | 'duration'; // NEW: Hz vs Seconds
  easing?: EasingMode;
  
  // NEW: Input Control
  inputMin?: number; // 0 to 1. Default 0.
  inputMax?: number; // 0 to 1. Default 1.
  invertDirection?: boolean; // NEW: Invert time flow

  // NEW: Generic Params for Curves (Bezier) or Time (Pause/Duration)
  paramA?: number; // Control Point 1 X
  paramB?: number; // Control Point 1 Y
  paramC?: number; // Control Point 2 X
  paramD?: number; // Control Point 2 Y
  paramE?: number; // Start Value Y (0 to 1)
  paramF?: number; // End Value Y (0 to 1)
}

// --- CONNECTIONS ---
export interface PointReference {
  strokeId: string;
  pointIndex: number;
}

export interface Connection {
  id: string;
  from: PointReference;
  to: PointReference;
  stiffness: number; 
  length: number;    
  breakingForce: number; // Persisted per connection
  bias: number; // Persisted per connection
  influence: number; // Persisted propagation radius
  falloff: number; // Persisted decay factor
  decayEasing: EasingMode; // NEW: Persisted decay curve
}

// --- GUIDES & SYMMETRY ---

export interface GridConfig {
  enabled: boolean;
  size: number;      // Grid cell size
  snapFactor: number; // NEW: Multiplier for snapping logic (e.g. 2 = snap every 2 cells)
  snap: boolean;     // Snap drawing to grid
  visible: boolean;  // Show grid lines
  color: string;
  opacity: number;
}

export interface SymmetryConfig {
  enabled: boolean;
  type: 'horizontal' | 'vertical' | 'quad' | 'radial';
  count: number;     // For radial (min 2)
  visible: boolean;  // Show symmetry lines
}

// --- FILL & GRADIENT CONFIG ---

export interface GradientConfig {
  enabled: boolean;
  colors: string[]; // Supports multiple colors now
}

export interface FillConfig {
  enabled: boolean;
  type: 'solid' | 'gradient'; 
  syncWithStroke: boolean; // NEW: Inherit properties from stroke
  gradient: GradientConfig;   
  blendMode: BlendMode;       
  colorSource: 'stroke' | 'custom'; 
  customColor: string;
  opacity: number;
  blur: number; // Independent Blur
  glow: boolean; // NEW: Apply glow to fill
  rule: 'nonzero' | 'evenodd'; 
}

// --- NEW AUDIO TYPES ---

export type SoundVolumeSource = 'manual' | 'velocity' | 'displacement-dist' | 'displacement-x' | 'displacement-y' | 'proximity';
export type SoundPlaybackMode = 'loop' | 'timeline-scrub'; 

export interface SoundConfig {
  enabled: boolean;
  bufferId: string | null; 
  
  // How is the sound played?
  playbackMode: SoundPlaybackMode; // Continuous Loop or Timeline Scrub
  
  // What drives the volume?
  volumeSource: SoundVolumeSource; 
  
  // Base Settings
  minVolume: number;
  maxVolume: number;
  minPitch: number;
  maxPitch: number;
  
  reverbSend: number; // 0 to 1
  grainSize: number; // For Granular Timeline (0.01 to 0.2s)
}

export interface SimulationParams {
  // --- VISUALS ---
  strokeWidth: number;
  opacity: number;
  color: string;
  blendMode: BlendMode;
  lineCap: LineCapMode; // NEW: Round, Butt, Square
  glowStrength: number;
  blurStrength: number;
  seamlessPath: boolean;
  pathRounding: number; // 0 to 1. Used when seamlessPath is false (e.g. Grid Mode). Now Modulatable.
  drawPoints: boolean; // Explicitly draw points as circles
  smoothModulation: boolean; // NEW: Smooth gradients between segments
  disableRoundingOnMod: boolean; // NEW: Force roundness to 0 if modulation is active (Performance/Aesthetic)
  
  // --- PATH CLOSING ---
  closePath: boolean; // NEW: Connect last point to first
  closePathRadius: number; // NEW: Snap distance to close loop

  // --- COLOR MODULATION ---
  hueShift: number; // 0 to 360. Added to base color Hue. Modulatable.

  // --- STYLING ---
  fill: FillConfig;
  gradient: GradientConfig; // Stroke Gradient Colors
  strokeGradientType: 'linear' | 'path'; // NEW: Directional vs Path-following
  strokeGradientAngle: number; // Modulatable Angle
  strokeGradientMidpoint: number; // 0 to 1 (0.5 default)
  fillGradientAngle: number;   // Modulatable Angle
  
  // --- SHAPE & DRAWING ---
  segmentation: number; // Distance between points
  smoothing: number; // Input smoothing
  
  // --- PHYSICS (Matter) ---
  mass: number; // Inertia
  friction: number; // Damping
  viscosity: number; // Drag
  elasticity: number; // Return to shape
  tension: number; // Internal jitter/stiffness
  maxDisplacement: number; // NEW: Physics limiter (0 = infinite)
  gravityX: number;
  gravityY: number;

  // --- ALIVE (Motion) ---
  wiggleAmplitude: number;
  wiggleFrequency: number;
  waveSpeed: number;
  
  // --- SOCIAL (Swarm/Boids) ---
  neighborRadius: number;
  repulsionForce: number; // Separation
  attractionForce: number; // Pull
  alignmentForce: number; // Match velocity (Boids)
  cohesionForce: number; // Stay together (Boids)
  swarmCursorInfluence: number; // NEW: 0 = Always active, 1 = Only near cursor
  
  // --- INTERACTION (Mouse) ---
  mouseInfluenceRadius: number;
  mouseRepulsion: number;
  mouseAttraction: number;
  mouseFalloff: number; // 1 = Linear, 2 = Quadratic (Sharper), etc.

  // --- MAGNETIC BONDING (Auto-stick) ---
  autoLinkStart: boolean;
  autoLinkEnd: boolean;
  autoLinkRadius: number;
  autoLinkStiffness: number;
  autoLinkBreakingForce: number;
  autoLinkBias: number;
  autoLinkInfluence: number;
  autoLinkFalloff: number;
  autoLinkDecayEasing: EasingMode;
  
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
  index: number; // Order in the stack
  selectionIndex?: number; // NEW: Persisted index relative to the selection group
  selectionTotal?: number; // NEW: Total size of the selection group when applied
  points: Point[];
  center: { x: number, y: number };
  originCenter: { x: number, y: number }; // Initial center position for displacement calculations
  velocity: { x: number, y: number }; // Average velocity of the stroke
  params: SimulationParams;
  sound: SoundConfig;
  createdAt: number;
  phaseOffset: number;
  randomSeed: number; // Stable random value (0-1) for 'random' modulation
}

// --- PROJECT FILE STRUCTURE (Updated for Connections) ---
export interface ProjectData {
  strokes: Stroke[];
  connections: Connection[];
  version: number;
}

// --- UI THEME SYSTEM ---
export interface UITheme {
  // Global
  canvasBg: string; 

  menuBg: string;
  menuText: string;
  menuBorderColor: string;
  menuBorderWidth: number;
  menuBlur: number;
  menuOpacity: number;
  menuShadow: string;
  
  // Buttons
  buttonBg: string;
  buttonText: string;
  buttonHoverBg: string;
  buttonHoverText: string; 
  buttonActiveBg: string;
  buttonActiveText: string; 
  buttonBorderColor: string;
  
  // Sections
  sectionHeaderActiveColor: string;
  
  // Separators
  separatorColor: string;
  separatorWidth: number;
  
  screenBorderColor: string;
  screenBorderWidth: number;
  
  fontFamily: string;
  borderRadius: string; // "50%" for round, "0px" for square
}

export interface Preset {
  name: string;
  description: string;
  params: SimulationParams;
}
