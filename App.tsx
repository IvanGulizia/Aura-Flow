
import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { Canvas, CanvasHandle } from './components/Canvas';
import { IconButton, PanelButton, Slider, Select, Toggle, SectionHeader, SoundRecorder } from './components/IconButtons';
import { SaveModal } from './components/SaveModal';
import { SimulationParams, BlendMode, ModulationConfig, SoundConfig, GlobalForceType, GlobalToolConfig, SoundVolumeSource, SoundPlaybackMode, UITheme, GridConfig, SymmetryConfig, ProjectData, LineCapMode, EasingMode } from './types';
import { audioManager } from './services/audioService';
import { 
  Play, Pause, Mic, MicOff, RefreshCw, 
  Trash2, Settings, Edit3, Users, Zap,
  Undo, Redo, PenTool, MousePointer2,
  Download, Upload, Save, Folder, FolderOpen, X, Battery, Check, Anchor, Music,
  Magnet, Move, Tornado, Globe, Volume2, VolumeX, Speaker, FileJson, GripHorizontal,
  Type, Monitor, Layers, Circle, Minus, List, Grid3X3, SplitSquareHorizontal, PaintBucket, Palette, Spline, ArrowUpRight, Link2, Link2Off, Loader2,
  Edit2, Info, Filter, Network, Eye, EyeOff, Unplug, Spline as SplineIcon, Plus, MinusCircle
} from 'lucide-react';

// --- HELPERS ---
const hexToRgba = (hex: string, alpha: number) => {
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// --- DEFAULT CONFIGS ---

const DEFAULT_PARAMS: SimulationParams = {
  strokeWidth: 4, opacity: 1, color: '#574dff', blendMode: 'source-over', lineCap: 'round', glowStrength: 0, blurStrength: 0, seamlessPath: true, pathRounding: 0,
  drawPoints: false,
  smoothModulation: false,
  closePath: false,
  closePathRadius: 50,
  hueShift: 0,
  segmentation: 10, smoothing: 0.5,
  mass: 1, friction: 0.9, viscosity: 0.0, elasticity: 0.01, tension: 0, maxDisplacement: 0, gravityX: 0, gravityY: 0,
  wiggleAmplitude: 0, wiggleFrequency: 0, waveSpeed: 0, breathingAmp: 0, breathingFreq: 0.05,
  neighborRadius: 150, repulsionForce: 0, attractionForce: 0, alignmentForce: 0, cohesionForce: 0, swarmCursorInfluence: 0,
  mouseInfluenceRadius: 150, mouseRepulsion: 0, mouseAttraction: 0, mouseFalloff: 1,
  audioSensitivity: 1, audioToWidth: false, audioToColor: false, audioToWiggle: false,
  fill: { enabled: false, colorSource: 'stroke', customColor: '#574dff', opacity: 0.2, blur: 0, glow: false, rule: 'nonzero', type: 'solid', syncWithStroke: false, gradient: { enabled: false, colors: ['#574dff', '#ffffff'] }, blendMode: 'source-over' }, 
  gradient: { enabled: false, colors: ['#f472b6', '#60a5fa'] },
  strokeGradientType: 'linear',
  strokeGradientAngle: 45,
  strokeGradientMidpoint: 0.5,
  fillGradientAngle: 0,
  modulations: {}
};

const DEFAULT_SOUND: SoundConfig = {
  enabled: true, bufferId: null, playbackMode: 'loop', volumeSource: 'manual',
  minVolume: 0.5, maxVolume: 0.5, minPitch: 1, maxPitch: 1, reverbSend: 0, grainSize: 0.1
};

const DEFAULT_GLOBAL_TOOL: GlobalToolConfig = { 
  trigger: 'click', radius: 200, force: 1, falloff: 0.5, 
  connectionStiffness: 0.5, 
  connectionBreakingForce: 0, 
  connectionBias: 0.5, 
  connectionInfluence: 0, 
  connectionFalloff: 1, 
  connectionDecayEasing: 'linear',
  connectionsVisible: true 
};

const DEFAULT_GRID: GridConfig = { enabled: false, size: 40, snap: true, visible: true, color: '#cbd5e1', opacity: 0.9 };
const DEFAULT_SYMMETRY: SymmetryConfig = { enabled: false, type: 'horizontal', count: 6, visible: true };

const DEFAULT_THEME: UITheme = {
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

const PARAMS_GROUPS = {
  physics: ['mass', 'friction', 'viscosity', 'elasticity', 'tension', 'maxDisplacement', 'gravityX', 'gravityY'],
  shape: ['segmentation', 'smoothing', 'wiggleAmplitude', 'wiggleFrequency', 'waveSpeed', 'breathingAmp', 'breathingFreq', 'closePath', 'closePathRadius'],
  social: ['neighborRadius', 'repulsionForce', 'attractionForce', 'alignmentForce', 'cohesionForce', 'mouseInfluenceRadius', 'mouseRepulsion', 'mouseAttraction', 'mouseFalloff', 'swarmCursorInfluence'],
  visuals: ['strokeWidth', 'opacity', 'blendMode', 'lineCap', 'glowStrength', 'blurStrength', 'seamlessPath', 'pathRounding', 'drawPoints', 'smoothModulation', 'hueShift', 'fill', 'gradient', 'strokeGradientType'], 
  audio: ['audioSensitivity', 'audioToWidth', 'audioToColor', 'audioToWiggle']
};

const PARAM_RANGES: Record<string, {min: number, max: number}> = {
  mass: {min: 0.5, max: 3}, friction: {min: 0.8, max: 0.98}, viscosity: {min: 0, max: 0.2}, elasticity: {min: 0.01, max: 0.5},
  tension: {min: 0, max: 2}, maxDisplacement: {min: 0, max: 1000}, gravityX: {min: -0.1, max: 0.1}, gravityY: {min: -0.1, max: 0.1},
  segmentation: {min: 5, max: 20}, wiggleAmplitude: {min: 0, max: 10}, wiggleFrequency: {min: 0.05, max: 0.3}, waveSpeed: {min: 0, max: 0.1},
  neighborRadius: {min: 50, max: 200}, repulsionForce: {min: 0, max: 0.2}, attractionForce: {min: 0, max: 0.2},
  mouseInfluenceRadius: {min: 100, max: 300}, mouseRepulsion: {min: 0, max: 5}, mouseAttraction: {min: 0, max: 5}, mouseFalloff: {min: 1, max: 4},
  strokeWidth: {min: 0, max: 30}, opacity: {min: 0.5, max: 1}, glowStrength: {min: 0, max: 20}, blurStrength: {min: 0, max: 5},
  breathingAmp: {min: 0, max: 10}, breathingFreq: {min: 0.01, max: 0.2}, alignmentForce: {min: 0, max: 0.5}, cohesionForce: {min: 0, max: 0.5}, swarmCursorInfluence: { min: 0, max: 1 },
  pathRounding: {min: 0, max: 1}, hueShift: { min: 0, max: 360 },
  strokeGradientAngle: {min: 0, max: 360},
  strokeGradientMidpoint: {min: 0, max: 1},
  fillGradientAngle: {min: 0, max: 360},
  closePathRadius: {min: 10, max: 200}
};

const PARAM_DESCRIPTIONS: Record<string, string> = {
  mass: "Determines how heavy the stroke feels.", friction: "Resistance to motion. Low = slippery; High = stops quickly.",
  viscosity: "Thick fluid resistance.", elasticity: "Force returning the stroke to its original shape.",
  tension: "Internal nervous energy/jitter.", maxDisplacement: "Limit how far points can move from their anchor point. Prevents physics blow-outs.", gravityX: "Horizontal pull.", gravityY: "Vertical pull.",
  segmentation: "Distance between points.", wiggleAmplitude: "Size of distortion.", wiggleFrequency: "Number of waves.",
  waveSpeed: "Speed of wave travel.", neighborRadius: "Distance for interactions.", repulsionForce: "Pushing strokes apart.",
  attractionForce: "Pulling strokes together.", mouseInfluenceRadius: "Cursor effect size.", mouseRepulsion: "Run from cursor.",
  mouseAttraction: "Pull to cursor.", strokeWidth: "Thickness.", opacity: "Transparency.", blendMode: "Mixing mode.",
  breathingAmp: "Pulsing width size.", breathingFreq: "Pulsing speed.", alignmentForce: "Match direction.", cohesionForce: "Stay together.",
  hueShift: "Shifts the color hue. Use modulation (random, time) to create rainbows or variations.",
  audioSensitivity: "Amplifies how much the microphone volume affects visual elements.",
  audioToWidth: "If enabled, loud sounds will make lines thicker.",
  audioToColor: "If enabled, sound intensity shifts colors.",
  audioToWiggle: "If enabled, bass frequencies cause chaotic vibration.",
  drawPoints: "Draw circles at each point of the line. Useful for visualizing structure or creating dot patterns.",
  smoothModulation: "When enabled, properties like color and size are interpolated smoothly between points instead of per segment.",
  closePath: "Automatically connects the last point to the first point if close enough.",
  closePathRadius: "Maximum distance to trigger the automatic closing of the path.",
  lineCap: "Shape of the stroke ends: Round, Butt (flat), or Square.",
  swarmCursorInfluence: "Controls when swarm logic applies. 0 = Always active. 1 = Only applies when cursor is near.",
  strokeGradientType: "Linear: Gradient is applied across the bounding box. Path: Gradient follows the curvature of the stroke."
};

interface Preset {
  name: string;
  description: string;
  params: SimulationParams;
}

const DEFAULT_PRESETS: Preset[] = [
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

const DEFAULT_PALETTE = ['#574dff', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#cdb4db', '#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff', '#222222', '#eeeeee'];
const BLEND_MODES: BlendMode[] = ['source-over', 'multiply', 'screen', 'overlay', 'lighter', 'difference', 'exclusion'];
const SOUND_VOLUME_SOURCES: SoundVolumeSource[] = ['manual', 'velocity', 'proximity', 'displacement-dist', 'displacement-x', 'displacement-y'];

// Standardized sub-components to fix TypeScript's recognition of standard React props like 'key'
const ColorInput: React.FC<{ label: string; val: string; onChange: (v: string) => void }> = ({ label, val, onChange }) => (
  <div className="flex justify-between items-center gap-2">
    <span className="opacity-60 text-[10px]">{label}</span>
    <div className="flex gap-2 items-center">
      <input type="color" value={val} onChange={(e) => onChange(e.target.value)} className="w-5 h-5 rounded overflow-hidden cursor-pointer border-none p-0 bg-transparent" />
    </div>
  </div>
);

const NumberInput: React.FC<{ label: string; val: number; min: number; max: number; step: number; onChange: (v: number) => void }> = ({ label, val, min, max, step, onChange }) => (
  <div className="flex flex-col gap-1">
     <div className="flex justify-between text-[10px]">
       <span className="opacity-60">{label}</span>
       <span className="font-mono opacity-80">{val}</span>
     </div>
     <input 
       type="range" 
       min={min} max={max} step={step} 
       value={val} 
       onChange={(e) => onChange(parseFloat(e.target.value))} 
       className="w-full accent-indigo-500 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" 
     />
  </div>
);

const DebugMenu = ({ theme, setTheme, onClose }: { theme: UITheme, setTheme: (t: UITheme) => void, onClose: () => void }) => {
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      }
    };
    const handleMouseUp = () => isDragging.current = false;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const exportTheme = () => {
    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-flow-theme.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="fixed z-50 w-72 bg-slate-800 text-white rounded-xl shadow-2xl border border-slate-600 overflow-hidden font-sans text-xs select-none"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        onMouseDown={handleMouseDown}
        className="bg-slate-700 p-2 cursor-grab active:cursor-grabbing flex justify-between items-center border-b border-slate-600"
      >
        <span className="font-bold flex items-center gap-2"><GripHorizontal size={14}/> Debug UI</span>
        <div className="flex gap-2">
            <button onClick={exportTheme} title="Export JSON" className="hover:text-indigo-400"><FileJson size={14} /></button>
            <button onClick={onClose} className="hover:text-red-400"><X size={14} /></button>
        </div>
      </div>
      
      <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
         <div className="space-y-2">
            <h4 className="font-bold text-indigo-400 flex items-center gap-1 uppercase tracking-wider text-[10px]"><Layers size={12}/> Menus & Panels</h4>
            <ColorInput label="Background" val={theme.menuBg} onChange={(v) => setTheme({...theme, menuBg: v})} />
            <ColorInput label="Text Color" val={theme.menuText} onChange={(v) => setTheme({...theme, menuText: v})} />
            <NumberInput label="Opacity (Alpha)" val={theme.menuOpacity} min={0} max={1} step={0.01} onChange={(v) => setTheme({...theme, menuOpacity: v})} />
            <NumberInput label="Blur (Backdrop)" val={theme.menuBlur} min={0} max={40} step={1} onChange={(v) => setTheme({...theme, menuBlur: v})} />
            <ColorInput label="Border Color" val={theme.menuBorderColor} onChange={(v) => setTheme({...theme, menuBorderColor: v})} />
            <NumberInput label="Border Width" val={theme.menuBorderWidth} min={0} max={10} step={1} onChange={(v) => setTheme({...theme, menuBorderWidth: v})} />
         </div>
         <div className="w-full -mx-4 my-2 h-px bg-slate-600/50" style={{ width: 'calc(100% + 2rem)' }} />
         <div className="space-y-2">
            <h4 className="font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-wider text-[10px]"><Circle size={12}/> Buttons</h4>
            <ColorInput label="Normal Bg" val={theme.buttonBg} onChange={(v) => setTheme({...theme, buttonBg: v})} />
            <ColorInput label="Normal Text" val={theme.buttonText} onChange={(v) => setTheme({...theme, buttonText: v})} />
            <div className="h-2" />
            <ColorInput label="Active Bg" val={theme.buttonActiveBg} onChange={(v) => setTheme({...theme, buttonActiveBg: v})} />
            <ColorInput label="Active Text" val={theme.buttonActiveText} onChange={(v) => setTheme({...theme, buttonActiveText: v})} />
         </div>
         <div className="w-full -mx-4 my-2 h-px bg-slate-600/50" style={{ width: 'calc(100% + 2rem)' }} />
         <div className="space-y-2">
            <h4 className="font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-wider text-[10px]"><Monitor size={12}/> Screen & Borders</h4>
            <ColorInput label="Screen Border Color" val={theme.screenBorderColor} onChange={(v) => setTheme({...theme, screenBorderColor: v})} />
            <ColorInput label="Canvas Background" val={theme.canvasBg} onChange={(v) => setTheme({...theme, canvasBg: v})} />
         </div>
      </div>
    </div>
  );
};

const SidebarSeparator = () => (
   <div className="w-[calc(100%+2.5rem)] -mx-5 my-1" style={{ height: 'var(--sep-width)', backgroundColor: 'var(--sep-color)' }} />
);

const FloatingTooltip = ({ text, rect }: { text: string, rect: DOMRect }) => {
  const style: React.CSSProperties = {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.right + 10}px`,
    zIndex: 9999,
  };
  
  if (window.innerWidth - rect.right < 200) {
      style.left = 'auto';
      style.right = `${window.innerWidth - rect.left + 10}px`;
  }

  return (
    <div className="pointer-events-none animate-fade-in" style={style}>
        <div className="w-48 p-3 bg-slate-900/95 backdrop-blur text-slate-100 text-[10px] rounded-xl shadow-2xl border border-slate-700/50 font-medium leading-relaxed">
            {text}
        </div>
    </div>
  );
};

export default function App() {
  const canvasRef = useRef<CanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presetFileInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  const [uiTheme, setUiTheme] = useState<UITheme>(DEFAULT_THEME);
  const [showDebug, setShowDebug] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  const [embedMode, setEmbedMode] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [brushParams, setBrushParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [brushSound, setBrushSound] = useState<SoundConfig>(DEFAULT_SOUND);
  
  const [gridConfig, setGridConfig] = useState<GridConfig>(DEFAULT_GRID);
  const [symmetryConfig, setSymmetryConfig] = useState<SymmetryConfig>(DEFAULT_SYMMETRY);

  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [selectedStrokeParams, setSelectedStrokeParams] = useState<SimulationParams | null>(null);
  const [selectedStrokeSound, setSelectedStrokeSound] = useState<SoundConfig | null>(null);
  const [lockedParams, setLockedParams] = useState<Set<string>>(new Set());

  const [isPlaying, setIsPlaying] = useState(true);
  const [isSoundEngineEnabled, setIsSoundEngineEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [ecoMode, setEcoMode] = useState(true); 
  
  const [interactionMode, setInteractionMode] = useState<'draw' | 'select'>('draw');
  const [globalForceTool, setGlobalForceTool] = useState<GlobalForceType>('none');
  const [globalToolConfig, setGlobalToolConfig] = useState<GlobalToolConfig>(DEFAULT_GLOBAL_TOOL);

  const [clearTrigger, setClearTrigger] = useState(0);
  const [deleteSelectedTrigger, setDeleteSelectedTrigger] = useState(0);
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [redoTrigger, setRedoTrigger] = useState(0);
  const [resetPosTrigger, setResetPosTrigger] = useState(0);
  const [deleteAllLinksTrigger, setDeleteAllLinksTrigger] = useState(0); 
  
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteColors, setPaletteColors] = useState(DEFAULT_PALETTE);
  
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [tooltip, setTooltip] = useState<{ text: string, rect: DOMRect } | null>(null);

  const [sections, setSections] = useState({
    project: false,
    guides: false, 
    presets: true, 
    physics: false, 
    visuals: false, 
    shape: false, 
    social: false, 
    audio: false, 
    soundDesign: false, 
    globalTools: false, 
  });

  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const saved = localStorage.getItem('aura-flow-presets');
      return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
    } catch (e) { return DEFAULT_PRESETS; }
  });
  const [isNamingPreset, setIsNamingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState(""); 
  const [activePresetName, setActivePresetName] = useState<string | null>(DEFAULT_PRESETS[0].name);

  const [panelSide, setPanelSide] = useState<'left' | 'right'>('right');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); 
  const [panelTop, setPanelTop] = useState(24); 
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEmbed = params.get('mode') === 'embed' || params.get('embed') === 'true';
    if (isEmbed) {
      setEmbedMode(true);
      setGridConfig(prev => ({...prev, visible: false})); 
    }

    const dataUrl = params.get('url') || params.get('data');
    if (dataUrl) {
      setIsLoadingData(true);
      fetch(dataUrl)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch data");
          return res.json();
        })
        .then(data => {
          if (canvasRef.current) {
            canvasRef.current.importData(data);
          }
        })
        .catch(err => {
          console.error("Error loading project from URL:", err);
        })
        .finally(() => {
          setIsLoadingData(false);
        });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPalette && paletteRef.current && !paletteRef.current.contains(event.target as Node)) {
        setShowPalette(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPalette]);

  useEffect(() => {
    localStorage.setItem('aura-flow-presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // SPACEBAR SHORTCUT: Exclusive toggle for Play/Pause
      if (e.code === 'Space') {
          e.preventDefault();
          setIsPlaying(p => !p);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); setUndoTrigger(t => t + 1); }
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) { e.preventDefault(); setRedoTrigger(t => t + 1); }
      if (e.key.toLowerCase() === 'h' && !embedMode) { setShowDebug(prev => !prev); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [embedMode]);

  const toggleSection = (key: keyof typeof sections) => setSections(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleLock = (key: string) => setLockedParams(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const toggleSoundEngine = async () => {
    if (!isSoundEngineEnabled) { await audioManager.initAudioContext(); audioManager.setMasterVolume(1); setIsSoundEngineEnabled(true); } 
    else { audioManager.setMasterVolume(0); setIsSoundEngineEnabled(false); }
  };

  const toggleMic = async () => {
    if (!isMicEnabled) { await audioManager.toggleMic(true); setIsMicEnabled(true); } 
    else { await audioManager.toggleMic(false); setIsMicEnabled(false); }
  };

  const updateParam = (key: keyof SimulationParams, value: any) => {
    if (selectedStrokeId && selectedStrokeParams) setSelectedStrokeParams({ ...selectedStrokeParams, [key]: value });
    else setBrushParams({ ...brushParams, [key]: value });
    setActivePresetName(null);
  };

  const resetParam = (key: keyof SimulationParams) => {
      const defaultValue = (DEFAULT_PARAMS as any)[key];
      if (selectedStrokeId && selectedStrokeParams) {
          const newMods = { ...selectedStrokeParams.modulations };
          delete newMods[key];
          setSelectedStrokeParams({ ...selectedStrokeParams, [key]: defaultValue, modulations: newMods });
      } else {
          const newMods = { ...brushParams.modulations };
          delete newMods[key];
          setBrushParams({ ...brushParams, [key]: defaultValue, modulations: newMods });
      }
      setActivePresetName(null);
  };

  const updatePaletteColor = (index: number, color: string) => {
    const newPalette = [...paletteColors];
    newPalette[index] = color;
    setPaletteColors(newPalette);
    updateParam('color', color); 
  };

  const updateFill = (updates: Partial<SimulationParams['fill']>) => {
    const target = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newFill = { ...target.fill, ...updates };
    if (selectedStrokeId && selectedStrokeParams) setSelectedStrokeParams({ ...selectedStrokeParams, fill: newFill });
    else setBrushParams({ ...brushParams, fill: newFill });
    setActivePresetName(null);
  };

  const updateFillGradient = (updates: Partial<SimulationParams['fill']['gradient']>) => {
    const target = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newGrad = { ...target.fill.gradient, ...updates };
    const newFill = { ...target.fill, gradient: newGrad };
    if (selectedStrokeId && selectedStrokeParams) setSelectedStrokeParams({ ...selectedStrokeParams, fill: newFill });
    else setBrushParams({ ...brushParams, fill: newFill });
    setActivePresetName(null);
  };

  const updateGradient = (updates: Partial<SimulationParams['gradient']>) => {
    const target = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newGrad = { ...target.gradient, ...updates };
    if (selectedStrokeId && selectedStrokeParams) setSelectedStrokeParams({ ...selectedStrokeParams, gradient: newGrad });
    else setBrushParams({ ...brushParams, gradient: newGrad });
    setActivePresetName(null);
  };

  const addGradientColor = () => {
    const target = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newColors = [...target.gradient.colors, '#ffffff'];
    updateGradient({ colors: newColors });
  };

  const removeGradientColor = (index: number) => {
    const target = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    if (target.gradient.colors.length <= 2) return;
    const newColors = target.gradient.colors.filter((_, i) => i !== index);
    updateGradient({ colors: newColors });
  };

  const updateGradientColor = (index: number, color: string) => {
    const target = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newColors = [...target.gradient.colors];
    newColors[index] = color;
    updateGradient({ colors: newColors });
  };

  const updateSound = (key: keyof SoundConfig, value: any) => {
    if (selectedStrokeId && selectedStrokeSound) setSelectedStrokeSound({ ...selectedStrokeSound, [key]: value });
    else setBrushSound({ ...brushSound, [key]: value });
  };

  const updateModulation = (key: keyof SimulationParams, config: ModulationConfig | undefined) => {
    const target = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newMods = { ...target.modulations };
    if (config === undefined) delete newMods[key]; else newMods[key] = config;
    if (selectedStrokeId && selectedStrokeParams) setSelectedStrokeParams({ ...selectedStrokeParams, modulations: newMods });
    else setBrushParams({ ...brushParams, modulations: newMods });
    setActivePresetName(null);
  };

  const resetSection = (section: keyof typeof PARAMS_GROUPS) => {
    const keys = PARAMS_GROUPS[section];
    const newValues: any = {};
    keys.forEach(k => { newValues[k] = (DEFAULT_PARAMS as any)[k]; });
    if (selectedStrokeId && selectedStrokeParams) { const updated = { ...selectedStrokeParams }; for (const k in newValues) { (updated as any)[k] = newValues[k]; } setSelectedStrokeParams(updated); }
    else setBrushParams(prev => ({ ...prev, ...newValues }));
    setActivePresetName(null);
  };

  const randomizeSection = (section: keyof typeof PARAMS_GROUPS) => {
    const keys = PARAMS_GROUPS[section];
    const newValues: any = {};
    keys.forEach(k => {
      if (lockedParams.has(k)) return; 
      if (k === 'blendMode') newValues[k] = BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)];
      else if (k === 'seamlessPath') newValues[k] = Math.random() > 0.5;
      else if (k === 'drawPoints') newValues[k] = Math.random() > 0.5;
      else if (k.startsWith('audioTo')) newValues[k] = Math.random() > 0.5;
      else { const range = PARAM_RANGES[k]; if (range) newValues[k] = range.min + Math.random() * (range.max - range.min); else newValues[k] = Math.random(); }
    });
    if (selectedStrokeId && selectedStrokeParams) setSelectedStrokeParams(prev => prev ? ({ ...prev, ...newValues }) : null);
    else setBrushParams(prev => ({ ...prev, ...newValues }));
    setActivePresetName(null);
  };

  const handleStrokeSelect = useCallback((id: string | null, params: SimulationParams | null, sound: SoundConfig | null) => {
    if (embedMode) return;
    setSelectedStrokeId(id); setSelectedStrokeParams(params); setSelectedStrokeSound(sound);
    if (id) setShowSettings(true);
  }, [embedMode]);

  const initiateSave = () => {
    if (!canvasRef.current) return;
    setShowSaveModal(true);
  };

  const handleSaveConfirm = (name: string) => {
    if (!canvasRef.current) return;
    const data = canvasRef.current.exportData(); 
    const json = JSON.stringify(data, null, 2); 
    const blob = new Blob([json], { type: 'application/json' }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `${name}.json`; 
    document.body.appendChild(a); 
    setTimeout(() => {
        a.click(); 
        document.body.removeChild(a);
        URL.revokeObjectURL(url); 
    }, 0);
  };

  const triggerImportProject = () => fileInputRef.current?.click();
  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); if (canvasRef.current) canvasRef.current.importData(data); } catch (err) { alert("Invalid JSON"); } }; reader.readAsText(file); e.target.value = ''; };
  
  const initSavePreset = () => { setIsNamingPreset(true); setNewPresetName(`Preset ${presets.length + 1}`); setNewPresetDesc(""); };
  const confirmSavePreset = () => { 
      if (!newPresetName.trim()) return; 
      const current = selectedStrokeId && selectedStrokeParams ? selectedStrokeParams : brushParams; 
      setPresets(prev => [...prev, { name: newPresetName.trim(), description: newPresetDesc.trim(), params: { ...current } }]); 
      setIsNamingPreset(false); setNewPresetName(""); setNewPresetDesc(""); 
  };
  const cancelSavePreset = () => { setIsNamingPreset(false); setNewPresetName(""); setNewPresetDesc(""); };
  const deletePreset = (index: number) => { 
      if (confirm("Delete this preset?")) {
          setPresets(prev => prev.filter((_, i) => i !== index)); 
      }
  };
  
  const loadPreset = (params: SimulationParams, name: string) => { 
      if (selectedStrokeId) setSelectedStrokeParams({ ...params }); 
      else setBrushParams({ ...params }); 
      setActivePresetName(name);
  };
  
  const exportPresets = () => { 
    try {
        const json = JSON.stringify(presets, null, 2); 
        const blob = new Blob([json], { type: 'application/json' }); 
        const url = URL.createObjectURL(blob); 
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `aura-flow-presets.json`; 
        document.body.appendChild(a);
        setTimeout(() => {
            a.click(); 
            document.body.removeChild(a);
            URL.revokeObjectURL(url); 
        }, 0);
    } catch (err) {}
  };

  const triggerImportPresets = () => presetFileInputRef.current?.click();
  const handleImportPresets = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); if (Array.isArray(data)) setPresets(prev => [...prev, ...data]); } catch (err) {} }; reader.readAsText(file); e.target.value = ''; };

  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (ev) => { const arrayBuffer = ev.target?.result as ArrayBuffer; const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const audioBuffer = await ctx.decodeAudioData(arrayBuffer); const bufferId = `upload-${Date.now()}`; audioManager.addBuffer(bufferId, audioBuffer); if (!selectedStrokeId) { setBrushSound(prev => ({...prev, bufferId, enabled: true})); } else { setSelectedStrokeSound(prev => prev ? ({...prev, bufferId, enabled: true}) : null); } }; reader.readAsArrayBuffer(file); e.target.value = ''; };
  const handleBufferReady = (buffer: AudioBuffer) => { const bufferId = `rec-${Date.now()}`; audioManager.addBuffer(bufferId, buffer); if (!selectedStrokeId) { setBrushSound(prev => ({...prev, bufferId, enabled: true})); } else { setSelectedStrokeSound(prev => prev ? ({...prev, bufferId, enabled: true}) : null); } };
  const removeSound = () => { if (selectedStrokeId) { setSelectedStrokeSound(prev => prev ? ({...prev, bufferId: null, enabled: false}) : null); } else { setBrushSound(prev => ({...prev, bufferId: null, enabled: false})); } };

  const setForceTool = (tool: GlobalForceType) => { if (tool !== 'none') { setInteractionMode('draw'); } setGlobalForceTool(tool); };

  const currentParams = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
  const currentSound = (selectedStrokeId && selectedStrokeSound) ? selectedStrokeSound : brushSound;
  const modeTitle = selectedStrokeId ? "Editing Selection" : "Settings";

  const getCommonProps = (key: keyof SimulationParams) => ({ 
      isLocked: lockedParams.has(key), 
      onToggleLock: () => toggleLock(key), 
      description: PARAM_DESCRIPTIONS[key], 
      modulation: currentParams.modulations?.[key], 
      onModulationChange: (cfg: ModulationConfig | undefined) => updateModulation(key, cfg),
      onReset: () => resetParam(key),
      isModified: shouldShow(key) 
  });

  const shouldShow = (key: keyof SimulationParams | 'fill' | 'gradient' | string, subValue?: any, subDefault?: any) => {
    if (!showModifiedOnly) return true;
    if (subValue !== undefined && subDefault !== undefined) {
         if (typeof subValue === 'number') return Math.abs(subValue - subDefault) > 0.001;
         return subValue !== subDefault;
    }
    const curr = currentParams[key as keyof SimulationParams];
    const def = DEFAULT_PARAMS[key as keyof SimulationParams];
    if (curr === undefined) return false; 
    if (key === 'fill') return currentParams.fill.enabled !== DEFAULT_PARAMS.fill.enabled || currentParams.fill.enabled; 
    if (key === 'gradient') return currentParams.gradient.enabled !== DEFAULT_PARAMS.gradient.enabled || currentParams.gradient.enabled;
    if (typeof curr === 'number') return Math.abs(curr - (def as number)) > 0.001;
    if (typeof curr === 'object') return JSON.stringify(curr) !== JSON.stringify(def);
    return curr !== def;
  };

  const isGroupModified = (groupKey: keyof typeof PARAMS_GROUPS) => {
      if (!showModifiedOnly) return true;
      const keys = PARAMS_GROUPS[groupKey];
      return keys.some(k => shouldShow(k));
  };

  useEffect(() => {
      if (showModifiedOnly) {
          setSections(prev => ({
              ...prev,
              physics: isGroupModified('physics'),
              shape: isGroupModified('shape'),
              visuals: isGroupModified('visuals'),
              social: isGroupModified('social'),
              audio: isGroupModified('audio'),
              project: prev.project,
              presets: true, 
              globalTools: prev.globalTools,
              guides: prev.guides
          }));
      }
  }, [showModifiedOnly]); 

  const themeStyles = {
    '--menu-bg': hexToRgba(uiTheme.menuBg, uiTheme.menuOpacity), 
    '--menu-text': uiTheme.menuText,
    '--menu-border': uiTheme.menuBorderColor,
    '--menu-border-w': `${uiTheme.menuBorderWidth}px`,
    '--menu-blur': `${uiTheme.menuBlur}px`,
    '--menu-shadow': uiTheme.menuShadow,
    '--btn-bg': uiTheme.buttonBg,
    '--btn-text': uiTheme.buttonText,
    '--btn-hover-bg': uiTheme.buttonHoverBg,
    '--btn-hover-text': uiTheme.buttonHoverText,
    '--btn-active-bg': uiTheme.buttonActiveBg,
    '--btn-active-text': uiTheme.buttonActiveText,
    '--btn-border': uiTheme.buttonBorderColor,
    '--header-active': uiTheme.sectionHeaderActiveColor,
    '--sep-color': uiTheme.separatorColor,
    '--sep-width': `${uiTheme.separatorWidth}px`,
    '--btn-radius': uiTheme.borderRadius,
    '--font-family': uiTheme.fontFamily,
    '--canvas-bg': uiTheme.canvasBg
  } as React.CSSProperties;

  const handlePanelPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) { setDragOffset({ x: rect.left, y: rect.top }); }
    const startX = e.clientX; const startY = e.clientY;
    const startLeft = rect ? rect.left : 0; const startTop = rect ? rect.top : 0;
    setIsDraggingPanel(true);
    const onPointerMove = (moveEvent: PointerEvent) => {
       const deltaX = moveEvent.clientX - startX; const deltaY = moveEvent.clientY - startY;
       const newY = startTop + deltaY; const clampedY = Math.max(16, Math.min(window.innerHeight - 100, newY));
       setDragOffset({ x: startLeft + deltaX, y: clampedY });
    };
    const onPointerUp = (upEvent: PointerEvent) => {
       window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp);
       setIsDraggingPanel(false);
       if (upEvent.clientX < window.innerWidth / 2) setPanelSide('left'); else setPanelSide('right');
       const dropY = startTop + (upEvent.clientY - startY);
       setPanelTop(Math.max(16, Math.min(window.innerHeight - 100, dropY)));
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleInfoEnter = (e: React.MouseEvent, text: string) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ text, rect });
  };
  const handleInfoLeave = () => { setTooltip(null); };

  const currentTop = isDraggingPanel ? dragOffset.y : panelTop;

  return (
    <div 
       className="relative w-full h-screen overflow-hidden text-slate-800 transition-all duration-300"
       style={{ 
         backgroundColor: 'var(--canvas-bg)',
         border: `${uiTheme.screenBorderWidth}px solid ${uiTheme.screenBorderColor}`,
         ...themeStyles
       }}
    >
      <input type="file" ref={fileInputRef} onChange={handleImportProject} className="hidden" accept=".json" />
      <input type="file" ref={presetFileInputRef} onChange={handleImportPresets} className="hidden" accept=".json" />
      <input type="file" ref={soundInputRef} onChange={handleSoundUpload} className="hidden" accept="audio/*" />

      {tooltip && <FloatingTooltip text={tooltip.text} rect={tooltip.rect} />}

      {showDebug && <DebugMenu theme={uiTheme} setTheme={setUiTheme} onClose={() => setShowDebug(false)} />}
      <SaveModal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} onConfirm={handleSaveConfirm} />

      {isLoadingData && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm">
           <Loader2 size={32} className="animate-spin text-indigo-600 mb-2" />
           <span className="text-xs font-bold text-indigo-800 uppercase tracking-widest">Loading Project...</span>
        </div>
      )}

      <Canvas 
        ref={canvasRef}
        brushParams={brushParams}
        brushSound={brushSound}
        gridConfig={gridConfig}
        symmetryConfig={symmetryConfig}
        selectedStrokeId={selectedStrokeId}
        selectedStrokeParams={selectedStrokeParams}
        isPlaying={isPlaying}
        isSoundEngineEnabled={isSoundEngineEnabled}
        isMicEnabled={isMicEnabled}
        interactionMode={interactionMode}
        globalForceTool={globalForceTool}
        globalToolConfig={globalToolConfig}
        ecoMode={ecoMode}
        onStrokeSelect={handleStrokeSelect}
        clearTrigger={clearTrigger}
        deleteSelectedTrigger={deleteSelectedTrigger}
        undoTrigger={undoTrigger}
        redoTrigger={redoTrigger}
        resetPosTrigger={resetPosTrigger}
        deleteAllLinksTrigger={deleteAllLinksTrigger}
        onCanvasInteraction={() => setShowPalette(false)}
      />

      {!embedMode && (
        <>
          <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 w-auto z-20 flex justify-center pointer-events-none">
            {showPalette && (
                <div 
                  ref={paletteRef}
                  className="absolute top-16 left-1/2 -translate-x-1/2 p-3 grid grid-cols-4 gap-2 w-48 animate-fade-in-up z-50 pointer-events-auto"
                  style={{ 
                    background: 'var(--menu-bg)', 
                    color: 'var(--menu-text)',
                    borderRadius: '1rem',
                    border: 'var(--menu-border-w) solid var(--menu-border)',
                    boxShadow: 'var(--menu-shadow)',
                    backdropFilter: 'blur(var(--menu-blur))',
                  }}
                >
                    {paletteColors.map((c, idx) => (
                      <div key={idx} className="relative group/color w-8 h-8">
                        <button
                          onClick={() => { updateParam('color', c); setShowPalette(false); }}
                          className={`w-full h-full rounded-full border-2 transition-all hover:scale-110 shadow-sm ${currentParams.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                        <label className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white rounded-full shadow-sm border border-slate-200 cursor-pointer flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity z-10 hover:scale-110">
                           <Edit2 size={8} className="text-slate-600" />
                           <input type="color" value={c} onChange={(e) => updatePaletteColor(idx, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        </label>
                      </div>
                    ))}
                </div>
            )}

            <div 
              className="p-2 flex items-center space-x-2 pointer-events-auto transition-all duration-300"
              style={{ 
                background: 'var(--menu-bg)',
                backdropFilter: 'blur(var(--menu-blur))',
                borderRadius: uiTheme.borderRadius,
                border: `${uiTheme.menuBorderWidth}px solid ${uiTheme.menuBorderColor}`,
                boxShadow: uiTheme.menuShadow,
                color: uiTheme.menuText
              }}
            >
              <IconButton icon={<PenTool size={18} />} onClick={() => { setInteractionMode('draw'); setGlobalForceTool('none'); }} active={interactionMode === 'draw' && globalForceTool === 'none'} label="Draw" />
              <IconButton icon={<MousePointer2 size={18} />} onClick={() => { setInteractionMode('select'); setGlobalForceTool('none'); }} active={interactionMode === 'select' && globalForceTool === 'none'} label="Select" />
              <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0" />
              <div className="relative shrink-0">
                <button onClick={() => setShowPalette(!showPalette)} className="w-10 h-10 rounded-full border border-slate-200 shadow-sm flex items-center justify-center transition-transform hover:scale-105 active:scale-95" style={{ backgroundColor: currentParams.color }}>
                    <div className="w-full h-full rounded-full ring-1 ring-inset ring-black/5" />
                </button>
              </div>
              <IconButton icon={<Settings size={20} />} onClick={() => setShowSettings(!showSettings)} active={showSettings} label="Settings" className={selectedStrokeId ? "ring-2 ring-indigo-500/50" : ""} />
              <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0" />
              <IconButton icon={isMicEnabled ? <Mic size={18} className="text-red-500 animate-pulse" /> : <MicOff size={18} />} onClick={toggleMic} active={isMicEnabled} label="Mic Reactivity" />
              <IconButton icon={isPlaying ? <Pause size={18} /> : <Play size={18} />} onClick={() => setIsPlaying(!isPlaying)} active={isPlaying} label={isPlaying ? "Pause" : "Play"} />
              <IconButton icon={isSoundEngineEnabled ? <Speaker size={18} /> : <VolumeX size={18} />} onClick={toggleSoundEngine} active={isSoundEngineEnabled} label={isSoundEngineEnabled ? "Sound ON" : "Sound OFF"} />
              <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0 hidden md:block" />
              <IconButton icon={<Undo size={18} />} onClick={() => setUndoTrigger(t => t + 1)} label="Undo" className="hidden md:flex" />
              <IconButton icon={<Redo size={18} />} onClick={() => setRedoTrigger(t => t + 1)} label="Redo" className="hidden md:flex" />
              <IconButton icon={<Trash2 size={18} />} onClick={() => { setClearTrigger(c => c + 1); setSelectedStrokeId(null); }} label="Clear" />
            </div>
          </div>

          {showSettings && (
            <div 
              ref={panelRef}
              className={`w-80 flex flex-col overflow-hidden ${!isDraggingPanel ? 'transition-all duration-500 ease-out' : ''}`}
              style={{ 
                background: 'var(--menu-bg)',
                backdropFilter: 'blur(var(--menu-blur))',
                borderRadius: '1.5rem',
                border: `${uiTheme.menuBorderWidth}px solid ${uiTheme.menuBorderColor}`,
                boxShadow: uiTheme.menuShadow,
                color: uiTheme.menuText,
                position: 'absolute',
                left: isDraggingPanel ? dragOffset.x : (panelSide === 'left' ? '2rem' : 'calc(100% - 20rem - 2rem)'),
                top: currentTop,
                maxHeight: `calc(100vh - ${currentTop}px - 2rem)`,
                zIndex: 40
              }}
            >
              <div className="flex-none px-6 py-4 border-b border-slate-100 flex justify-between items-center cursor-grab active:cursor-grabbing" onPointerDown={handlePanelPointerDown} title="Drag to snap Left/Right">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold flex items-center gap-2 text-sm tracking-wide pointer-events-none">
                        {selectedStrokeId ? <Edit3 size={15} className="text-indigo-600"/> : <Zap size={15} className="text-amber-500" />}
                        {modeTitle}
                    </h3>
                  </div>
                  {selectedStrokeId && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDeleteSelectedTrigger(t => t + 1)} className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                        <Trash2 size={14} />
                      </button>
                      <button onClick={() => { setSelectedStrokeId(null); setSelectedStrokeParams(null); }} className="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-full font-bold hover:bg-indigo-700 shadow-md transition-colors">
                        DONE
                      </button>
                    </div>
                  )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 custom-scrollbar scroll-smooth">
                  <SectionHeader title="Project Files" isOpen={sections.project} onToggle={() => toggleSection('project')} />
                  {sections.project && (
                      <div className="pb-4 space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <div className="flex gap-2">
                                <PanelButton onClick={initiateSave} label="SAVE PROJ" icon={<Save size={10} />} />
                                <PanelButton onClick={triggerImportProject} label="LOAD PROJ" icon={<FolderOpen size={10} />} />
                            </div>
                            <div className="flex gap-2 pt-2 border-t border-slate-200">
                                <PanelButton onClick={() => setResetPosTrigger(t => t+1)} label="RESET POSITIONS" icon={<Anchor size={10} />} className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100" />
                            </div>
                      </div>
                  )}
                  <SidebarSeparator />
                  <SectionHeader title="Guides & Symmetry" isOpen={sections.guides} onToggle={() => toggleSection('guides')} />
                  {sections.guides && (
                    <div className="pb-4 space-y-3">
                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"><Grid3X3 size={12} /> Modular Grid</div>
                            <Toggle label="" value={gridConfig.enabled} onChange={(v) => setGridConfig(p => ({...p, enabled: v}))} />
                          </div>
                          {gridConfig.enabled && (
                            <div className="animate-fade-in-up space-y-2">
                                <div className="flex gap-2 mb-2">
                                    <PanelButton onClick={() => setGridConfig(p => ({...p, visible: !p.visible}))} label={gridConfig.visible ? "HIDE POINTS" : "SHOW POINTS"} active={gridConfig.visible} />
                                    <PanelButton onClick={() => setGridConfig(p => ({...p, snap: !p.snap}))} label={gridConfig.snap ? "SNAP ON" : "SNAP OFF"} active={gridConfig.snap} />
                                </div>
                                {shouldShow('pathRounding') && <Slider label="Roundness" value={currentParams.pathRounding} min={0} max={1} step={0.01} onChange={(v) => updateParam('pathRounding', v)} {...getCommonProps('pathRounding')} />}
                                <Slider label="Cell Size" value={gridConfig.size} min={20} max={200} step={10} onChange={(v) => setGridConfig(p => ({...p, size: v}))} />
                                <Slider label="Opacity" value={gridConfig.opacity} min={0.1} max={1} step={0.1} onChange={(v) => setGridConfig(p => ({...p, opacity: v}))} />
                            </div>
                          )}
                        </div>
                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"><SplitSquareHorizontal size={12} /> Symmetry</div>
                            <Toggle label="" value={symmetryConfig.enabled} onChange={(v) => setSymmetryConfig(p => ({...p, enabled: v}))} />
                          </div>
                          {symmetryConfig.enabled && (
                              <div className="animate-fade-in-up space-y-2">
                                  <Select label="Type" value={symmetryConfig.type} options={['horizontal', 'vertical', 'quad', 'radial']} onChange={(v) => setSymmetryConfig(p => ({...p, type: v as any}))} />
                                  {symmetryConfig.type === 'radial' && ( <Slider label="Count" value={symmetryConfig.count} min={2} max={12} step={1} onChange={(v) => setSymmetryConfig(p => ({...p, count: v}))} /> )}
                                  <Toggle label="Show Guides" value={symmetryConfig.visible} onChange={(v) => setSymmetryConfig(p => ({...p, visible: v}))} />
                              </div>
                          )}
                        </div>
                    </div>
                  )}
                  <SidebarSeparator />
                  <SectionHeader title="Presets" isOpen={sections.presets} onToggle={() => toggleSection('presets')} />
                  {sections.presets && (
                    <div className="pb-4 mb-2">
                        <div className="flex justify-end mb-2">
                            <button onClick={(e) => { e.stopPropagation(); setShowModifiedOnly(!showModifiedOnly); }} className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider ${showModifiedOnly ? 'bg-indigo-100 text-indigo-600 shadow-sm border border-indigo-200' : 'hover:bg-slate-100 text-slate-400 border border-transparent'}`} title={showModifiedOnly ? "Show All Parameters" : "Show Modified Only"} >
                                <Filter size={10} strokeWidth={2.5} />
                                {showModifiedOnly ? "Modified Only" : "Filter"}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {presets.map((p, idx) => (
                            <div key={idx} className="group relative">
                              <button onClick={() => loadPreset(p.params, p.name)} className={`flex items-center gap-2 px-3 py-1.5 border text-[10px] font-bold uppercase rounded-lg transition-all shadow-sm ${activePresetName === p.name ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'}`} >
                                {p.name}
                                {p.description && (
                                  <div className="group/info relative flex items-center" onMouseEnter={(e) => handleInfoEnter(e, p.description)} onMouseLeave={handleInfoLeave} >
                                    <div className={`text-slate-400 hover:text-white transition-colors cursor-help ml-1 ${activePresetName === p.name ? 'text-indigo-200' : ''}`}><Info size={10} /></div>
                                  </div>
                                )}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deletePreset(idx); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-[8px] z-10" > <X size={8} /> </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mb-4">
                            <PanelButton onClick={exportPresets} label="EXPORT ALL" icon={<Save size={10} />} />
                            <PanelButton onClick={triggerImportPresets} label="IMPORT" icon={<FolderOpen size={10} />} />
                        </div>
                        {isNamingPreset ? (
                          <div className="flex flex-col gap-2 animate-fade-in-up bg-slate-50 p-2 rounded-lg border border-slate-200">
                              <input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Preset Name..." autoFocus />
                              <textarea value={newPresetDesc} onChange={(e) => setNewPresetDesc(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-16" placeholder="Description (optional)..." />
                              <div className="flex justify-end gap-2">
                                <button onClick={cancelSavePreset} className="bg-slate-200 text-slate-600 px-3 py-1 text-[10px] font-bold rounded hover:bg-slate-300">CANCEL</button>
                                <button onClick={confirmSavePreset} className="bg-indigo-600 text-white px-3 py-1 text-[10px] font-bold rounded hover:bg-indigo-700">SAVE</button>
                              </div>
                          </div>
                        ) : (
                          <PanelButton onClick={initSavePreset} label="SAVE CURRENT AS PRESET" icon={<Save size={10} />} />
                        )}
                    </div>
                  )}
                  <SidebarSeparator />
                  {(isGroupModified('physics') || !showModifiedOnly) && (
                    <>
                        <SectionHeader title="Physics" isOpen={sections.physics} onToggle={() => toggleSection('physics')} onReset={() => resetSection('physics')} onRandom={() => randomizeSection('physics')} />
                        {sections.physics && (
                            <div className="pb-4 space-y-1">
                            {shouldShow('mass') && <Slider label="Mass" value={currentParams.mass} min={0.1} max={5} step={0.1} onChange={(v) => updateParam('mass', v)} {...getCommonProps('mass')} />}
                            {shouldShow('friction') && <Slider label="Friction" value={currentParams.friction} min={0.5} max={0.99} step={0.01} onChange={(v) => updateParam('friction', v)} {...getCommonProps('friction')} />}
                            {shouldShow('elasticity') && <Slider label="Elasticity" value={currentParams.elasticity} min={0} max={0.5} step={0.001} onChange={(v) => updateParam('elasticity', v)} {...getCommonProps('elasticity')} />}
                            {shouldShow('maxDisplacement') && <Slider label="Max Displacement" value={currentParams.maxDisplacement} min={0} max={1000} step={1} onChange={(v) => updateParam('maxDisplacement', v)} {...getCommonProps('maxDisplacement')} />}
                            {shouldShow('viscosity') && <Slider label="Viscosity" value={currentParams.viscosity} min={0} max={1} step={0.01} onChange={(v) => updateParam('viscosity', v)} {...getCommonProps('viscosity')} />}
                            {shouldShow('tension') && <Slider label="Tension" value={currentParams.tension} min={0} max={5} step={0.1} onChange={(v) => updateParam('tension', v)} {...getCommonProps('tension')} />}
                            {shouldShow('gravityX') && <Slider label="Gravity X" value={currentParams.gravityX} min={-0.5} max={0.5} step={0.01} onChange={(v) => updateParam('gravityX', v)} {...getCommonProps('gravityX')} />}
                            {shouldShow('gravityY') && <Slider label="Gravity Y" value={currentParams.gravityY} min={-0.5} max={0.5} step={0.01} onChange={(v) => updateParam('gravityY', v)} {...getCommonProps('gravityY')} />}
                            </div>
                        )}
                        <SidebarSeparator />
                    </>
                  )}
                  {(isGroupModified('visuals') || !showModifiedOnly) && (
                    <>
                      <SectionHeader title="Visuals" isOpen={sections.visuals} onToggle={() => toggleSection('visuals')} onReset={() => resetSection('visuals')} onRandom={() => randomizeSection('visuals')} />
                      {sections.visuals && (
                        <div className="pb-4 space-y-2">
                        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                            {shouldShow('strokeWidth') && <Slider label="Width" value={currentParams.strokeWidth} min={0} max={30} step={0.5} onChange={(v) => updateParam('strokeWidth', v)} {...getCommonProps('strokeWidth')} />}
                            {shouldShow('opacity') && <Slider label="Opacity" value={currentParams.opacity} min={0} max={1} step={0.01} onChange={(v) => updateParam('opacity', v)} {...getCommonProps('opacity')} />}
                            {shouldShow('blendMode') && <Select label="Blend Mode" value={currentParams.blendMode} options={BLEND_MODES} onChange={(v) => updateParam('blendMode', v as BlendMode)} {...getCommonProps('blendMode')} />}
                            {shouldShow('lineCap') && <Select label="Line Cap" value={currentParams.lineCap || 'round'} options={['round', 'butt', 'square']} onChange={(v) => updateParam('lineCap', v as LineCapMode)} description="End style of the stroke" />}
                            {shouldShow('seamlessPath') && <Toggle label="Seamless Path" value={currentParams.seamlessPath} onChange={(v) => updateParam('seamlessPath', v)} />}
                            {shouldShow('smoothModulation') && <Toggle label="Smooth Modulation" description={PARAM_DESCRIPTIONS['smoothModulation']} value={currentParams.smoothModulation} onChange={(v) => updateParam('smoothModulation', v)} />}
                            {shouldShow('drawPoints') && <Toggle label="Draw Points" description={PARAM_DESCRIPTIONS['drawPoints']} value={currentParams.drawPoints} onChange={(v) => updateParam('drawPoints', v)} />}
                            {shouldShow('hueShift') && <Slider label="Hue Shift" value={currentParams.hueShift || 0} min={0} max={360} step={1} onChange={(v) => updateParam('hueShift', v)} {...getCommonProps('hueShift')} />}
                        </div>

                        {shouldShow('fill') && (
                            <div className="bg-pink-50/50 p-3 rounded-xl border border-pink-100/50">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-pink-500"><PaintBucket size={12} /> Fill Mode</div>
                                    <Toggle label="" value={currentParams.fill?.enabled || false} onChange={(v) => updateFill({ enabled: v })} />
                                </div>
                                {currentParams.fill?.enabled && (
                                    <div className="animate-fade-in-up space-y-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"> {currentParams.fill.syncWithStroke ? <Link2 size={10} /> : <Link2Off size={10} />} Sync Gradient </span>
                                            <Toggle label="" value={currentParams.fill.syncWithStroke} onChange={(v) => updateFill({ syncWithStroke: v })} />
                                        </div>
                                        {shouldShow('fill', currentParams.fill.blendMode, DEFAULT_PARAMS.fill.blendMode) && <Select label="Fill Blend Mode" value={currentParams.fill.blendMode || 'source-over'} options={BLEND_MODES} onChange={(v) => updateFill({ blendMode: v as BlendMode })} />}
                                        {shouldShow('fill', currentParams.fill.opacity, DEFAULT_PARAMS.fill.opacity) && <Slider label="Fill Opacity" value={currentParams.fill.opacity} min={0} max={1} step={0.01} onChange={(v) => updateFill({ opacity: v })} />}
                                        {shouldShow('fill', currentParams.fill.blur, DEFAULT_PARAMS.fill.blur) && <Slider label="Fill Blur" value={currentParams.fill.blur || 0} min={0} max={50} step={1} onChange={(v) => updateFill({ blur: v })} />}
                                        <Toggle label="Fill Glow" value={currentParams.fill.glow || false} onChange={(v) => updateFill({ glow: v })} description="Apply glow effect to the filled area" />
                                        {!currentParams.fill.syncWithStroke && (
                                            <>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Type</span>
                                                <div className="flex bg-slate-200 rounded p-0.5">
                                                <button onClick={() => updateFill({ type: 'solid' })} className={`px-2 py-0.5 rounded text-[9px] font-bold ${currentParams.fill.type !== 'gradient' ? 'bg-white shadow text-pink-600' : 'text-slate-500'}`}>Solid</button>
                                                <button onClick={() => updateFill({ type: 'gradient' })} className={`px-2 py-0.5 rounded text-[9px] font-bold ${currentParams.fill.type === 'gradient' ? 'bg-white shadow text-pink-600' : 'text-slate-500'}`}>Gradient</button>
                                                </div>
                                            </div>
                                            {currentParams.fill.type === 'gradient' ? (
                                                <div className="space-y-2 p-2 bg-white/50 rounded-lg border border-pink-200">
                                                    <div className="space-y-1">
                                                      {currentParams.fill.gradient.colors.map((c, i) => (
                                                        <ColorInput key={i} label={`Stop ${i+1}`} val={c} onChange={(v) => {
                                                            const newColors = [...currentParams.fill.gradient.colors];
                                                            newColors[i] = v;
                                                            updateFillGradient({ colors: newColors });
                                                        }} />
                                                      ))}
                                                    </div>
                                                    <Slider label="Angle" value={currentParams.fillGradientAngle} min={0} max={360} step={1} onChange={(v) => updateParam('fillGradientAngle', v)} {...getCommonProps('fillGradientAngle')} />
                                                </div>
                                            ) : (
                                                <>
                                                <Select label="Color Source" value={currentParams.fill.colorSource} options={['stroke', 'custom']} onChange={(v) => updateFill({ colorSource: v as any })} />
                                                {currentParams.fill.colorSource === 'custom' && ( <ColorInput label="Custom Color" val={currentParams.fill.customColor} onChange={(v) => updateFill({ customColor: v })} /> )}
                                                </>
                                            )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {shouldShow('gradient') && (
                            <div className="bg-sky-50/50 p-3 rounded-xl border border-sky-100/50">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-sky-500"><Palette size={12} /> Stroke Gradient</div>
                                    <Toggle label="" value={currentParams.gradient?.enabled || false} onChange={(v) => updateGradient({ enabled: v })} />
                                </div>
                                {currentParams.gradient?.enabled && (
                                    <div className="animate-fade-in-up space-y-2">
                                        <Select label="Gradient Type" value={currentParams.strokeGradientType || 'linear'} options={['linear', 'path']} onChange={(v) => updateParam('strokeGradientType', v as any)} description={PARAM_DESCRIPTIONS['strokeGradientType']} />
                                        <div className="space-y-1 bg-white/50 p-2 rounded-lg border border-sky-100">
                                            {currentParams.gradient.colors.map((c, i) => (
                                                <div key={i} className="flex items-center gap-1">
                                                    <div className="flex-1"><ColorInput label={`Color ${i+1}`} val={c} onChange={(v) => updateGradientColor(i, v)} /></div>
                                                    {currentParams.gradient.colors.length > 2 && (
                                                        <button onClick={() => removeGradientColor(i)} className="text-red-400 hover:text-red-600 transition-colors"><MinusCircle size={12} /></button>
                                                    )}
                                                </div>
                                            ))}
                                            <button onClick={addGradientColor} className="w-full flex items-center justify-center py-1 mt-1 bg-sky-100/50 hover:bg-sky-200/50 text-sky-600 rounded-md text-[8px] font-bold transition-all"><Plus size={10} /> ADD COLOR</button>
                                        </div>
                                        {currentParams.strokeGradientType === 'linear' && (
                                            <>
                                            <Slider label="Angle" value={currentParams.strokeGradientAngle} min={0} max={360} step={1} onChange={(v) => updateParam('strokeGradientAngle', v)} {...getCommonProps('strokeGradientAngle')} />
                                            <Slider label="Midpoint" value={currentParams.strokeGradientMidpoint || 0.5} min={0} max={1} step={0.01} onChange={(v) => updateParam('strokeGradientMidpoint', v)} {...getCommonProps('strokeGradientMidpoint')} />
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {shouldShow('glowStrength') && <Slider label="Glow Strength" value={currentParams.glowStrength} min={0} max={50} step={1} onChange={(v) => updateParam('glowStrength', v)} {...getCommonProps('glowStrength')} />}
                        {shouldShow('blurStrength') && <Slider label="Blur Strength" value={currentParams.blurStrength} min={0} max={20} step={0.1} onChange={(v) => updateParam('blurStrength', v)} {...getCommonProps('blurStrength')} />}
                        </div>
                      )}
                      <SidebarSeparator />
                    </>
                  )}
                  {(isGroupModified('shape') || !showModifiedOnly) && (
                    <>
                      <SectionHeader title="Shape & Motion" isOpen={sections.shape} onToggle={() => toggleSection('shape')} onReset={() => resetSection('shape')} onRandom={() => randomizeSection('shape')} />
                      {sections.shape && (
                        <div className="pb-4 space-y-1">
                        {shouldShow('segmentation') && <Slider label="Resolution" value={currentParams.segmentation} min={2} max={50} step={1} onChange={(v) => updateParam('segmentation', v)} {...getCommonProps('segmentation')} />}
                        {(!showModifiedOnly || [shouldShow('closePath'), shouldShow('closePathRadius')].some(Boolean)) && (
                            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 my-2">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"> <SplineIcon size={12} /> Auto Close </div>
                                    <Toggle label="" value={currentParams.closePath} onChange={(v) => updateParam('closePath', v)} />
                                </div>
                                {currentParams.closePath && ( <div className="animate-fade-in-up"> <Slider label="Snap Radius" value={currentParams.closePathRadius} min={10} max={200} step={10} onChange={(v) => updateParam('closePathRadius', v)} {...getCommonProps('closePathRadius')} /> </div> )}
                            </div>
                        )}
                        {(!showModifiedOnly || [shouldShow('wiggleAmplitude'), shouldShow('wiggleFrequency'), shouldShow('waveSpeed')].some(Boolean)) && (
                            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 my-2">
                                <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Wiggle</div>
                                {shouldShow('wiggleAmplitude') && <Slider label="Amplitude" value={currentParams.wiggleAmplitude} min={0} max={20} step={0.1} onChange={(v) => updateParam('wiggleAmplitude', v)} {...getCommonProps('wiggleAmplitude')} />}
                                {shouldShow('wiggleFrequency') && <Slider label="Frequency" value={currentParams.wiggleFrequency} min={0.01} max={0.5} step={0.01} onChange={(v) => updateParam('wiggleFrequency', v)} {...getCommonProps('wiggleFrequency')} />}
                                {shouldShow('waveSpeed') && <Slider label="Speed" value={currentParams.waveSpeed} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('waveSpeed', v)} {...getCommonProps('waveSpeed')} />}
                            </div>
                        )}
                        {(!showModifiedOnly || [shouldShow('breathingAmp'), shouldShow('breathingFreq')].some(Boolean)) && (
                            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Breathing</div>
                                {shouldShow('breathingAmp') && <Slider label="Amplitude" value={currentParams.breathingAmp} min={0} max={10} step={0.1} onChange={(v) => updateParam('breathingAmp', v)} {...getCommonProps('breathingAmp')} />}
                                {shouldShow('breathingFreq') && <Slider label="Frequency" value={currentParams.breathingFreq} min={0.01} max={0.2} step={0.01} onChange={(v) => updateParam('breathingFreq', v)} {...getCommonProps('breathingFreq')} />}
                            </div>
                        )}
                        </div>
                      )}
                      <SidebarSeparator />
                    </>
                  )}
                  {(isGroupModified('social') || !showModifiedOnly) && (
                    <>
                      <SectionHeader title="Interaction" isOpen={sections.social} onToggle={() => toggleSection('social')} onReset={() => resetSection('social')} onRandom={() => randomizeSection('social')} />
                      {sections.social && (
                        <div className="pb-4 space-y-3">
                        {(!showModifiedOnly || [shouldShow('neighborRadius'), shouldShow('repulsionForce'), shouldShow('attractionForce'), shouldShow('alignmentForce'), shouldShow('cohesionForce')].some(Boolean)) && (
                            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                                <div className="text-[9px] font-bold text-indigo-400 mb-3 flex items-center gap-1 uppercase tracking-widest"><Users size={10}/> Swarm Intelligence</div>
                                {shouldShow('neighborRadius') && <Slider label="Radius" value={currentParams.neighborRadius} min={10} max={300} step={10} onChange={(v) => updateParam('neighborRadius', v)} {...getCommonProps('neighborRadius')} />}
                                {shouldShow('repulsionForce') && <Slider label="Repulsion" value={currentParams.repulsionForce} min={0} max={0.2} step={0.005} onChange={(v) => updateParam('repulsionForce', v)} {...getCommonProps('repulsionForce')} />}
                                {shouldShow('attractionForce') && <Slider label="Attraction" value={currentParams.attractionForce} min={0} max={0.2} step={0.005} onChange={(v) => updateParam('attractionForce', v)} {...getCommonProps('attractionForce')} />}
                                {shouldShow('alignmentForce') && <Slider label="Alignment" value={currentParams.alignmentForce} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('alignmentForce', v)} {...getCommonProps('alignmentForce')} />}
                                {shouldShow('cohesionForce') && <Slider label="Cohesion" value={currentParams.cohesionForce} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('cohesionForce', v)} {...getCommonProps('cohesionForce')} />}
                                <Slider label="Cursor Influence" value={currentParams.swarmCursorInfluence || 0} min={0} max={1} step={0.1} onChange={(v) => updateParam('swarmCursorInfluence', v)} description="0 = Always Active, 1 = Only near cursor" />
                            </div>
                        )}
                        {(!showModifiedOnly || [shouldShow('mouseInfluenceRadius'), shouldShow('mouseRepulsion'), shouldShow('mouseAttraction'), shouldShow('mouseFalloff')].some(Boolean)) && (
                            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                                <div className="text-[9px] font-bold text-amber-500 mb-3 flex items-center gap-1 uppercase tracking-widest"><Zap size={10}/> Mouse Physics</div>
                                {shouldShow('mouseInfluenceRadius') && <Slider label="Influence Radius" value={currentParams.mouseInfluenceRadius || 150} min={50} max={500} step={10} onChange={(v) => updateParam('mouseInfluenceRadius', v)} {...getCommonProps('mouseInfluenceRadius')} />}
                                {shouldShow('mouseRepulsion') && <Slider label="Repulsion" value={currentParams.mouseRepulsion} min={0} max={20} step={0.1} onChange={(v) => updateParam('mouseRepulsion', v)} {...getCommonProps('mouseRepulsion')} />}
                                {shouldShow('mouseAttraction') && <Slider label="Attraction" value={currentParams.mouseAttraction} min={0} max={20} step={0.1} onChange={(v) => updateParam('mouseAttraction', v)} {...getCommonProps('mouseAttraction')} />}
                                {shouldShow('mouseFalloff') && <Slider label="Falloff (Sharpness)" value={currentParams.mouseFalloff || 1} min={1} max={4} step={0.1} onChange={(v) => updateParam('mouseFalloff', v)} {...getCommonProps('mouseFalloff')} />}
                            </div>
                        )}
                        </div>
                      )}
                      <SidebarSeparator />
                    </>
                  )}
                  {(isGroupModified('audio') || !showModifiedOnly) && (
                    <>
                      <SectionHeader title="Audio Reactivity" isOpen={sections.audio} onToggle={() => toggleSection('audio')} onReset={() => resetSection('audio')} onRandom={() => randomizeSection('audio')} />
                      {sections.audio && (
                        <div className="pb-4 space-y-1">
                        {shouldShow('audioSensitivity') && <Slider label="Sensitivity" value={currentParams.audioSensitivity} min={0} max={5} step={0.1} onChange={(v) => updateParam('audioSensitivity', v)} {...getCommonProps('audioSensitivity')} />}
                        {shouldShow('audioToWidth') && <Toggle label="Audio -> Width" description={PARAM_DESCRIPTIONS['audioToWidth']} value={currentParams.audioToWidth} onChange={(v) => updateParam('audioToWidth', v)} />}
                        {shouldShow('audioToColor') && <Toggle label="Audio -> Color" description={PARAM_DESCRIPTIONS['audioToColor']} value={currentParams.audioToColor} onChange={(v) => updateParam('audioToColor', v)} />}
                        {shouldShow('audioToWiggle') && <Toggle label="Audio -> Wiggle" description={PARAM_DESCRIPTIONS['audioToWiggle']} value={currentParams.audioToWiggle} onChange={(v) => updateParam('audioToWiggle', v)} />}
                        </div>
                      )}
                      <SidebarSeparator />
                    </>
                  )}
                  <SectionHeader title="Sound Design" isOpen={sections.soundDesign} onToggle={() => toggleSection('soundDesign')} />
                  {sections.soundDesign && (
                    <div className="pb-4 space-y-3 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/20">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Source</span>
                          <SoundRecorder onBufferReady={handleBufferReady} />
                          <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1 cursor-pointer hover:text-indigo-600 transition-colors">
                              <Upload size={10} /> Upload <input type="file" onChange={handleSoundUpload} className="hidden" accept="audio/*" />
                          </label>
                        </div>
                        {currentSound.bufferId ? (
                          <div className="text-[9px] text-green-600 font-mono bg-green-50 border border-green-200 px-2 py-1 rounded flex justify-between items-center">
                              <span>Active: {currentSound.bufferId.slice(0, 12)}...</span>
                              <button onClick={removeSound} className="text-red-500 hover:text-red-700"><Trash2 size={10} /></button>
                          </div>
                        ) : ( <div className="text-[9px] text-slate-400 font-mono italic">No audio buffer assigned.</div> )}
                        <Select label="Drive Volume With" value={currentSound.volumeSource} options={SOUND_VOLUME_SOURCES} onChange={(v) => updateSound('volumeSource', v as SoundVolumeSource)} />
                        <Select label="Playback Mode" value={currentSound.playbackMode} options={['loop', 'timeline-scrub']} onChange={(v) => updateSound('playbackMode', v as SoundPlaybackMode)} />
                        <Slider label="Min Vol" value={currentSound.minVolume} min={0} max={1} step={0.01} onChange={(v) => updateSound('minVolume', v)} />
                        <Slider label="Max Vol" value={currentSound.maxVolume} min={0} max={2} step={0.01} onChange={(v) => updateSound('maxVolume', v)} />
                        <Slider label="Base Pitch" value={currentSound.minPitch} min={0.1} max={4} step={0.01} onChange={(v) => updateSound('minPitch', v)} />
                        <Slider label="Reverb" value={currentSound.reverbSend} min={0} max={1} step={0.01} onChange={(v) => updateSound('reverbSend', v)} />
                        {currentSound.playbackMode === 'timeline-scrub' && ( <Slider label="Grain Size (s)" value={currentSound.grainSize} min={0.01} max={0.5} step={0.01} onChange={(v) => updateSound('grainSize', v)} /> )}
                    </div>
                  )}
                  <SidebarSeparator />
                  <SectionHeader title="Global Tools" isOpen={sections.globalTools} onToggle={() => toggleSection('globalTools')} />
                  {sections.globalTools && (
                    <div className="pb-4 space-y-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <div className="grid grid-cols-4 gap-2">
                          <PanelButton onClick={() => setForceTool('repulse')} label="PUSH" icon={<Move size={16} />} active={globalForceTool === 'repulse'} className="flex-col" />
                          <PanelButton onClick={() => setForceTool('attract')} label="PULL" icon={<Magnet size={16} />} active={globalForceTool === 'attract'} className="flex-col" />
                          <PanelButton onClick={() => setForceTool('vortex')} label="SWIRL" icon={<Tornado size={16} />} active={globalForceTool === 'vortex'} className="flex-col" />
                          <PanelButton onClick={() => setForceTool('connect')} label="LINK" icon={<Network size={16} />} active={globalForceTool === 'connect'} className="flex-col" />
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                          {globalForceTool === 'connect' ? (
                             <div className="animate-fade-in">
                                 <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Network size={10} /> Link Settings</span>
                                    <div className="flex gap-2">
                                      <button onClick={() => setGlobalToolConfig(prev => ({ ...prev, connectionsVisible: !prev.connectionsVisible }))} className="text-slate-400 hover:text-indigo-600 transition-colors" title={globalToolConfig.connectionsVisible ? "Hide Links" : "Show Links"} > {globalToolConfig.connectionsVisible ? <Eye size={14} /> : <EyeOff size={14} />} </button>
                                      <button onClick={() => setDeleteAllLinksTrigger(t => t+1)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete All Links" > <Unplug size={14} /> </button>
                                    </div>
                                 </div>
                                 <Slider label="Stiffness" value={globalToolConfig.connectionStiffness} min={0.01} max={1} step={0.01} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, connectionStiffness: v }))} />
                                 <Slider label="Breaking Force" value={globalToolConfig.connectionBreakingForce} min={0} max={200} step={1} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, connectionBreakingForce: v }))} />
                                 <Slider label="Influence (Bias)" value={globalToolConfig.connectionBias} min={0} max={1} step={0.1} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, connectionBias: v }))} />
                                 <Slider label="Propagation" value={globalToolConfig.connectionInfluence} min={0} max={20} step={1} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, connectionInfluence: v }))} />
                                 <Slider label="Decay" value={globalToolConfig.connectionFalloff} min={0} max={1} step={0.1} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, connectionFalloff: v }))} />
                                 <Select label="Decay Curve" value={globalToolConfig.connectionDecayEasing || 'linear'} options={['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'step']} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, connectionDecayEasing: v as EasingMode }))} />
                                 <div className="text-[9px] text-slate-500 italic p-2 bg-blue-50 border border-blue-100 rounded mt-2"> Drag between points to connect. Connect creates a spring physics constraint. </div>
                             </div>
                          ) : (
                             <div className="animate-fade-in">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Globe size={10} /> Tool Settings</span>
                                  <Toggle label="Hover Trigger" value={globalToolConfig.trigger === 'hover'} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, trigger: v ? 'hover' : 'click' }))} />
                                </div>
                                <Slider label="Radius" value={globalToolConfig.radius} min={50} max={500} step={10} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, radius: v }))} />
                                <Slider label="Force" value={globalToolConfig.force} min={0.1} max={5} step={0.1} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, force: v }))} />
                                <Slider label="Falloff" value={globalToolConfig.falloff} min={0} max={1} step={0.1} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, falloff: v }))} />
                             </div>
                          )}
                        </div>
                    </div>
                  )}
              </div>
              <div className="mt-auto pt-4 pb-2 border-t border-slate-100 text-[10px] text-slate-400 text-center font-medium tracking-wide"> vibe coded by <a href="http://www.ivangulizia.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 text-slate-500 transition-colors">Ivan Gulizia</a> </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
