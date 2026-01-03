
import { SimulationParams, SoundConfig, GlobalToolConfig, GridConfig, SymmetryConfig, UITheme, BlendMode, SoundVolumeSource, Preset } from '../types';

export const DEFAULT_PARAMS: SimulationParams = {
  strokeWidth: 4, opacity: 1, color: '#574dff', blendMode: 'source-over', lineCap: 'round', glowStrength: 0, blurStrength: 0, seamlessPath: true, pathRounding: 0,
  drawPoints: false,
  smoothModulation: false,
  disableRoundingOnMod: true, // UPDATED: Default to true for cleaner modulated strokes
  closePath: false,
  closePathRadius: 50,
  hueShift: 0,
  segmentation: 10, smoothing: 0.5,
  mass: 1, friction: 0.9, viscosity: 0.0, elasticity: 0.01, tension: 0, maxDisplacement: 0, gravityX: 0, gravityY: 0,
  wiggleAmplitude: 0, wiggleFrequency: 0, waveSpeed: 0,
  neighborRadius: 150, repulsionForce: 0, attractionForce: 0, alignmentForce: 0, cohesionForce: 0, swarmCursorInfluence: 0,
  mouseInfluenceRadius: 150, mouseRepulsion: 0, mouseAttraction: 0, mouseFalloff: 1,
  autoLinkStart: false, autoLinkEnd: false, autoLinkRadius: 40, autoLinkStiffness: 0.2,
  autoLinkBreakingForce: 0, autoLinkBias: 0.5, autoLinkInfluence: 0, autoLinkFalloff: 1, autoLinkDecayEasing: 'linear',
  audioSensitivity: 1, audioToWidth: false, audioToColor: false, audioToWiggle: false,
  fill: { enabled: false, colorSource: 'stroke', customColor: '#574dff', opacity: 0.2, blur: 0, glow: false, rule: 'nonzero', type: 'solid', syncWithStroke: false, gradient: { enabled: false, colors: ['#574dff', '#ffffff'] }, blendMode: 'source-over' }, 
  gradient: { enabled: false, colors: ['#f472b6', '#60a5fa'] },
  strokeGradientType: 'linear',
  strokeGradientAngle: 45,
  strokeGradientMidpoint: 0.5,
  fillGradientAngle: 0,
  modulations: {}
};

export const DEFAULT_SOUND: SoundConfig = {
  enabled: true, bufferId: null, playbackMode: 'loop', volumeSource: 'manual',
  minVolume: 0.5, maxVolume: 0.5, minPitch: 1, maxPitch: 1, reverbSend: 0, grainSize: 0.1
};

export const DEFAULT_GLOBAL_TOOL: GlobalToolConfig = { 
  trigger: 'click', radius: 200, force: 1, falloff: 0.5, 
  connectionsVisible: true 
};

export const DEFAULT_GRID: GridConfig = { enabled: false, size: 40, snap: true, visible: true, color: '#cbd5e1', opacity: 0.9, snapFactor: 1 };
export const DEFAULT_SYMMETRY: SymmetryConfig = { enabled: false, type: 'horizontal', count: 6, visible: true };

export const DEFAULT_THEME: UITheme = {
  canvasBg: '#fdfcf8', 

  menuBg: '#ffffff',
  menuText: '#18284c',
  menuBorderColor: '#cbd4e1',
  menuBorderWidth: 1,
  menuBlur: 4,
  menuOpacity: 0.9,
  menuShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  
  buttonBg: '#ffffff',
  buttonText: '#18284c',
  buttonHoverBg: '#eff2fe',
  buttonHoverText: '#574dff',
  buttonActiveBg: '#eff2fe', 
  buttonActiveText: '#574dff',
  buttonBorderColor: '#c9d2fa',
  
  sectionHeaderActiveColor: '#574dff',
  
  separatorColor: '#cbd4e1',
  separatorWidth: 1,
  
  screenBorderColor: '#e2e8f0',
  screenBorderWidth: 0,
  
  fontFamily: 'Nunito, sans-serif',
  borderRadius: '9999px'
};

export const PARAMS_GROUPS = {
  physics: ['mass', 'friction', 'viscosity', 'elasticity', 'tension', 'maxDisplacement', 'gravityX', 'gravityY'],
  shape: ['segmentation', 'smoothing', 'wiggleAmplitude', 'wiggleFrequency', 'waveSpeed', 'closePath', 'closePathRadius'],
  social: ['neighborRadius', 'repulsionForce', 'attractionForce', 'alignmentForce', 'cohesionForce', 'mouseInfluenceRadius', 'mouseRepulsion', 'mouseAttraction', 'mouseFalloff', 'swarmCursorInfluence', 'autoLinkRadius', 'autoLinkStiffness', 'autoLinkBreakingForce', 'autoLinkBias', 'autoLinkInfluence', 'autoLinkFalloff'],
  visuals: ['strokeWidth', 'opacity', 'blendMode', 'lineCap', 'glowStrength', 'blurStrength', 'seamlessPath', 'pathRounding', 'drawPoints', 'smoothModulation', 'disableRoundingOnMod', 'hueShift', 'fill', 'gradient', 'strokeGradientType'], 
  audio: ['audioSensitivity', 'audioToWidth', 'audioToColor', 'audioToWiggle']
};

export const PARAM_RANGES: Record<string, {min: number, max: number}> = {
  mass: {min: 0.5, max: 3}, friction: {min: 0.8, max: 0.98}, viscosity: {min: 0, max: 0.2}, elasticity: {min: 0.01, max: 0.5},
  tension: {min: 0, max: 2}, maxDisplacement: {min: 0, max: 1000}, gravityX: {min: -0.1, max: 0.1}, gravityY: {min: -0.1, max: 0.1},
  segmentation: {min: 5, max: 20}, wiggleAmplitude: {min: 0, max: 10}, wiggleFrequency: {min: 0.05, max: 0.3}, waveSpeed: {min: 0, max: 0.1},
  neighborRadius: {min: 50, max: 200}, repulsionForce: {min: 0, max: 0.2}, attractionForce: {min: 0, max: 0.2},
  mouseInfluenceRadius: {min: 100, max: 300}, mouseRepulsion: {min: 0, max: 5}, mouseAttraction: {min: 0, max: 5}, mouseFalloff: {min: 1, max: 4},
  strokeWidth: {min: 0, max: 30}, opacity: {min: 0.5, max: 1}, glowStrength: {min: 0, max: 20}, blurStrength: {min: 0, max: 20},
  alignmentForce: {min: 0, max: 0.5}, cohesionForce: {min: 0, max: 0.5}, swarmCursorInfluence: { min: 0, max: 1 },
  pathRounding: {min: 0, max: 2}, hueShift: { min: 0, max: 360 },
  strokeGradientAngle: {min: 0, max: 360},
  strokeGradientMidpoint: {min: 0, max: 1},
  fillGradientAngle: {min: 0, max: 360},
  closePathRadius: {min: 10, max: 200},
  snapFactor: { min: 0.5, max: 10 },
  autoLinkRadius: { min: 5, max: 300 },
  autoLinkStiffness: { min: 0.01, max: 1 },
  autoLinkBreakingForce: { min: 0, max: 200 },
  autoLinkBias: { min: 0, max: 1 },
  autoLinkInfluence: { min: 0, max: 20 },
  autoLinkFalloff: { min: 0, max: 1 }
};

export const PARAM_DESCRIPTIONS: Record<string, string> = {
  mass: "Determines how heavy the stroke feels.", friction: "Resistance to motion. Low = slippery; High = stops quickly.",
  viscosity: "Thick fluid resistance.", elasticity: "Force returning the stroke to its original shape.",
  tension: "Internal nervous energy/jitter.", maxDisplacement: "Limit how far points can move from their anchor point. Prevents physics blow-outs.", gravityX: "Horizontal pull.", gravityY: "Vertical pull.",
  segmentation: "Distance between points.", wiggleAmplitude: "Size of distortion.", wiggleFrequency: "Number of waves.",
  waveSpeed: "Speed of wave travel.", neighborRadius: "Distance for interactions.", repulsionForce: "Pushing strokes apart.",
  attractionForce: "Pulling strokes together.", mouseInfluenceRadius: "Cursor effect size.", mouseRepulsion: "Run from cursor.",
  mouseAttraction: "Pull to cursor.", strokeWidth: "Thickness.", opacity: "Transparency.", blendMode: "Mixing mode.",
  alignmentForce: "Match direction.", cohesionForce: "Stay together.",
  hueShift: "Shifts the color hue. Use modulation (random, time) to create rainbows or variations.",
  audioSensitivity: "Amplifies how much the microphone volume affects visual elements.",
  audioToWidth: "If enabled, loud sounds will make lines thicker.",
  audioToColor: "If enabled, sound intensity shifts colors.",
  audioToWiggle: "If enabled, bass frequencies cause chaotic vibration.",
  drawPoints: "Draw circles at each point of the line. Useful for visualizing structure or creating dot patterns.",
  smoothModulation: "When enabled, properties like color and size are interpolated smoothly between points instead of per segment.",
  disableRoundingOnMod: "If enabled, Roundness is forced to 0 when Width, Opacity or Hue are modulated. Prevents artifacts and improves performance.",
  closePath: "Automatically connects the last point to the first point if close enough.",
  closePathRadius: "Maximum distance to trigger the automatic closing of the path.",
  lineCap: "Shape of the stroke ends: Round, Butt (flat), or Square.",
  swarmCursorInfluence: "Controls when swarm logic applies. 0 = Always active. 1 = Only applies when cursor is near.",
  strokeGradientType: "Linear: Gradient is applied across the bounding box. Path: Gradient follows the curvature of the stroke.",
  pathRounding: "Corner roundness. 0 = Sharp, 1 = Half-way, 2 = Full Node-to-Node Arc.",
  autoLinkStart: "Automatically stick the beginning of the stroke to the nearest neighbor.",
  autoLinkEnd: "Automatically stick the end of the stroke to the nearest neighbor.",
  autoLinkRadius: "How close a neighbor must be to trigger auto-sticking.",
  autoLinkStiffness: "Strength of the glue. 1 = Rigid, 0.01 = Very springy.",
  autoLinkBreakingForce: "Threshold to snap the link if stretched too far. 0 = Unbreakable.",
  autoLinkBias: "Who pulls more? 0 = Neighbor pulls new stroke, 1 = New stroke pulls neighbor, 0.5 = Equal.",
  autoLinkInfluence: "Propagation radius. Affects adjacent points on the stroke.",
  autoLinkFalloff: "Sharpness of the force decay along the propagation radius."
};

export const DEFAULT_PRESETS: Preset[] = [
  { name: "Default Pen", description: "Standard digital ink. Responsive to speed and pressure.", params: { ...DEFAULT_PARAMS } },
  { name: "Sketchy Pencil", description: "Textured, low-opacity strokes that build up like graphite.", params: { ...DEFAULT_PARAMS, opacity: 0.8, seamlessPath: false, strokeWidth: 2, friction: 0.85, modulations: { strokeWidth: { source: 'velocity', scope: 'point', min: 1, max: 4 } } } },
  { name: "Nervous Energy", description: "High tension and jitter. Lines vibrate with chaotic energy.", params: { ...DEFAULT_PARAMS, tension: 2, wiggleAmplitude: 3, wiggleFrequency: 0.2, opacity: 0.9 } },
  { name: "Neon City", description: "Glowing, additive strokes. Best on dark backgrounds.", params: { ...DEFAULT_PARAMS, color: '#00ffcc', glowStrength: 15, strokeWidth: 6, blendMode: 'screen', gradient: { enabled: true, colors: ['#00ffcc', '#ff00ff'] }, strokeGradientAngle: 90 } },
  { name: "Architecture", description: "Clean, straight lines perfect for structural sketches.", params: { ...DEFAULT_PARAMS, strokeWidth: 2, friction: 0.6, segmentation: 20, seamlessPath: false, color: '#334155' } },
  { name: "Bioluminescence", description: "Organic, floating light. Soft interactions and transparency.", params: { ...DEFAULT_PARAMS, color: '#4ade80', opacity: 0.4, glowStrength: 20, blurStrength: 2, wiggleAmplitude: 2, wiggleFrequency: 0.1, waveSpeed: 0.05, blendMode: 'lighter' } },
  { name: "Calligraphy", description: "Variable width based on velocity. Elegant and expressive.", params: { ...DEFAULT_PARAMS, strokeWidth: 12, friction: 0.92, modulations: { strokeWidth: { source: 'velocity', scope: 'point', min: 2, max: 12, easing: 'easeOutQuad' } } } },
  { name: "Chaos Theory", description: "Physics-driven particles that repel the mouse cursor.", params: { ...DEFAULT_PARAMS, tension: 1.5, elasticity: 0.05, friction: 0.99, mouseRepulsion: 3, neighborRadius: 100, repulsionForce: 0.05 } },
  { name: "Silk Ribbon", description: "Flowing, filled shapes that twist and turn like fabric.", params: { ...DEFAULT_PARAMS, strokeWidth: 20, opacity: 0.6, seamlessPath: true, fill: { enabled: true, colorSource: 'stroke', customColor: '', opacity: 0.2, blur: 0, glow: false, rule: 'nonzero', type: 'solid', syncWithStroke: false, gradient: { enabled: false, colors: ['#000000', '#ffffff'] }, blendMode: 'source-over' }, modulations: { strokeWidth: { source: 'time', scope: 'stroke', min: 5, max: 25, speed: 0.5, easing: 'sine' } } } },
  { name: "Jellyfish", description: "Underwater physics with floating tentacles and soft gravity.", params: { ...DEFAULT_PARAMS, strokeWidth: 2, gravityY: -0.02, friction: 0.96, wiggleAmplitude: 5, wiggleFrequency: 0.15, waveSpeed: 0.03, fill: { enabled: true, opacity: 0.1, colorSource: 'custom', customColor: '#ffc8dd', blur: 0, glow: false, rule: 'nonzero', type: 'solid', syncWithStroke: false, gradient: { enabled: false, colors: ['#000000', '#ffffff'] }, blendMode: 'source-over' } } },
];

export const DEFAULT_PALETTE = ['#574dff', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#cdb4db', '#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff', '#222222', '#eeeeee'];
export const BLEND_MODES: BlendMode[] = ['source-over', 'multiply', 'screen', 'overlay', 'lighter', 'difference', 'exclusion'];
export const SOUND_VOLUME_SOURCES: SoundVolumeSource[] = ['manual', 'velocity', 'proximity', 'displacement-dist', 'displacement-x', 'displacement-y'];
