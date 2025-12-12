
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas, CanvasHandle } from './components/Canvas';
import { IconButton, Slider, Select, Toggle, SectionHeader, SoundRecorder } from './components/IconButtons';
import { SimulationParams, BlendMode, ModulationConfig, SoundConfig, GlobalForceType, GlobalToolConfig } from './types';
import { audioManager } from './services/audioService';
import { 
  Play, Pause, Mic, MicOff, RefreshCw, 
  Trash2, Settings, Edit3, Users, Zap,
  Undo, Redo, PenTool, MousePointer2,
  Download, Upload, Save, Folder, FolderOpen, X, Battery, Check, Anchor, Music,
  Magnet, Move, Tornado, Globe
} from 'lucide-react';

const DEFAULT_PARAMS: SimulationParams = {
  // Visuals
  strokeWidth: 4,
  opacity: 1, 
  color: '#2a9d8f',
  blendMode: 'source-over',
  glowStrength: 0,
  blurStrength: 0,
  seamlessPath: true,
  
  // Shape
  segmentation: 10,
  smoothing: 0.5,
  
  // Physics
  mass: 1,
  friction: 0.9,
  viscosity: 0.0,
  elasticity: 0.0,
  tension: 0,
  gravityX: 0,
  gravityY: 0,
  
  // Alive
  wiggleAmplitude: 0, 
  wiggleFrequency: 0,
  waveSpeed: 0,
  breathingAmp: 0,
  breathingFreq: 0.05,
  
  // Social
  neighborRadius: 150,
  repulsionForce: 0,
  attractionForce: 0,
  alignmentForce: 0,
  cohesionForce: 0,
  
  // Interaction
  mouseInfluenceRadius: 150,
  mouseRepulsion: 0,
  mouseAttraction: 0,
  mouseFalloff: 1,
  
  // Audio
  audioSensitivity: 1,
  audioToWidth: false,
  audioToColor: false,
  audioToWiggle: false,

  // Modulation Map
  modulations: {}
};

const DEFAULT_SOUND: SoundConfig = {
  bufferId: null,
  baseVolume: 0.5,
  pitch: 1,
  reverbSend: 0,
  loop: true,
  motionSensitivity: 0
};

const DEFAULT_GLOBAL_TOOL: GlobalToolConfig = {
  trigger: 'click',
  radius: 200,
  force: 1
};

const PARAMS_GROUPS = {
  physics: ['mass', 'friction', 'viscosity', 'elasticity', 'tension', 'gravityX', 'gravityY'],
  shape: ['segmentation', 'smoothing', 'wiggleAmplitude', 'wiggleFrequency', 'waveSpeed', 'breathingAmp', 'breathingFreq'],
  social: ['neighborRadius', 'repulsionForce', 'attractionForce', 'alignmentForce', 'cohesionForce', 'mouseInfluenceRadius', 'mouseRepulsion', 'mouseAttraction', 'mouseFalloff'],
  visuals: ['strokeWidth', 'opacity', 'blendMode', 'glowStrength', 'blurStrength', 'seamlessPath'],
  audio: ['audioSensitivity', 'audioToWidth', 'audioToColor', 'audioToWiggle']
};

// Safe ranges for randomization to prevent broken values
const PARAM_RANGES: Record<string, {min: number, max: number}> = {
  mass: {min: 0.5, max: 3},
  friction: {min: 0.8, max: 0.98},
  viscosity: {min: 0, max: 0.2},
  elasticity: {min: 0.01, max: 0.1},
  tension: {min: 0, max: 2},
  gravityX: {min: -0.1, max: 0.1},
  gravityY: {min: -0.1, max: 0.1},
  segmentation: {min: 5, max: 20},
  wiggleAmplitude: {min: 0, max: 10},
  wiggleFrequency: {min: 0.05, max: 0.3},
  waveSpeed: {min: 0, max: 0.1},
  neighborRadius: {min: 50, max: 200},
  repulsionForce: {min: 0, max: 0.2},
  attractionForce: {min: 0, max: 0.2},
  mouseInfluenceRadius: {min: 100, max: 300},
  mouseRepulsion: {min: 0, max: 5},
  mouseAttraction: {min: 0, max: 5},
  mouseFalloff: {min: 1, max: 4},
  strokeWidth: {min: 2, max: 15},
  opacity: {min: 0.5, max: 1},
  glowStrength: {min: 0, max: 20},
  blurStrength: {min: 0, max: 5},
};

const PARAM_DESCRIPTIONS: Record<string, string> = {
  mass: "Determines how heavy the stroke feels.",
  friction: "Resistance to motion. Low = slippery; High = stops quickly.",
  viscosity: "Thick fluid resistance. Makes movement sluggish.",
  elasticity: "Force returning the stroke to its original shape.",
  tension: "Internal nervous energy/jitter.",
  gravityX: "Horizontal gravitational pull.",
  gravityY: "Vertical gravitational pull.",
  
  segmentation: "Distance between points. Lower = smoother/heavier.",
  wiggleAmplitude: "Size of the sine-wave distortion.",
  wiggleFrequency: "Number of waves along the stroke.",
  waveSpeed: "Speed of wave travel.",
  breathingAmp: "Rhythmic expansion/contraction width.",
  breathingFreq: "Speed of the breathing rhythm.",
  
  neighborRadius: "Distance for social interactions.",
  repulsionForce: "Force pushing strokes apart.",
  attractionForce: "Force pulling strokes together.",
  alignmentForce: "Force making strokes match direction (Boids).",
  cohesionForce: "Force keeping strokes clustered (Boids).",
  mouseInfluenceRadius: "Distance of cursor effect.",
  mouseRepulsion: "Strokes run away from cursor.",
  mouseAttraction: "Strokes pulled to cursor.",
  mouseFalloff: "How quickly influence drops. 1=Linear, 4=Sharp.",

  strokeWidth: "Base line thickness.",
  opacity: "Transparency level.",
  blendMode: "Color mixing mode.",
  glowStrength: "Luminous shadow intensity.",
  blurStrength: "Gaussian blur amount.",
  seamlessPath: "Continuous vector path (smoother) vs segments.",
  
  audioSensitivity: "Audio reactivity multiplier.",
  audioToWidth: "Bass affects width.",
  audioToColor: "Bass affects brightness.",
  audioToWiggle: "Bass increases wiggle.",
};

const DEFAULT_PRESETS: {name: string, params: SimulationParams}[] = [
  { name: "Default Pen", params: { ...DEFAULT_PARAMS } },
  { name: "Sketchy Pencil", params: { ...DEFAULT_PARAMS, opacity: 0.8, seamlessPath: false, strokeWidth: 2, friction: 0.85, modulations: { strokeWidth: { source: 'velocity', min: 1, max: 4 } } } },
  { name: "Nervous Energy", params: { ...DEFAULT_PARAMS, tension: 2, wiggleAmplitude: 3, wiggleFrequency: 0.2, opacity: 0.9 } },
  { name: "Sea Anemone", params: { ...DEFAULT_PARAMS, seamlessPath: false, strokeWidth: 10, elasticity: 0.05, friction: 0.9, mouseRepulsion: 0, modulations: { elasticity: { source: 'path', min: 0.2, max: 0.005 }, mouseRepulsion: { source: 'path', min: 0, max: 50 }, strokeWidth: { source: 'path', min: 15, max: 2 } } } },
  { name: "Cursor Shy", params: { ...DEFAULT_PARAMS, opacity: 0.2, modulations: { opacity: { source: 'cursor', min: 0, max: 1 } } } },
];

const PALETTE = [
  '#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', 
  '#cdb4db', '#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff', 
  '#222222', '#eeeeee'
];

const BLEND_MODES: BlendMode[] = [
  'source-over', 'multiply', 'screen', 'overlay', 'lighter', 'difference', 'exclusion'
];

export default function App() {
  const canvasRef = useRef<CanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presetFileInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);

  const [brushParams, setBrushParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [brushSound, setBrushSound] = useState<SoundConfig>(DEFAULT_SOUND);

  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [selectedStrokeParams, setSelectedStrokeParams] = useState<SimulationParams | null>(null);
  const [selectedStrokeSound, setSelectedStrokeSound] = useState<SoundConfig | null>(null);

  const [lockedParams, setLockedParams] = useState<Set<string>>(new Set());

  const [isPlaying, setIsPlaying] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [ecoMode, setEcoMode] = useState(true); 
  
  const [interactionMode, setInteractionMode] = useState<'draw' | 'select'>('draw');
  const [globalForceTool, setGlobalForceTool] = useState<GlobalForceType>('none');
  const [globalToolConfig, setGlobalToolConfig] = useState<GlobalToolConfig>(DEFAULT_GLOBAL_TOOL);

  const [clearTrigger, setClearTrigger] = useState(0);
  const [deleteSelectedTrigger, setDeleteSelectedTrigger] = useState(0);
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [redoTrigger, setRedoTrigger] = useState(0);
  const [resetPosTrigger, setResetPosTrigger] = useState(0);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  const [presets, setPresets] = useState<{name: string, params: SimulationParams}[]>(() => {
    try {
      const saved = localStorage.getItem('aura-flow-presets');
      return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
    } catch (e) {
      return DEFAULT_PRESETS;
    }
  });
  const [isNamingPreset, setIsNamingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const [sections, setSections] = useState({
    presets: true,
    physics: true,
    shape: false,
    visuals: false,
    social: false,
    interaction: false,
    soundDesign: false,
    audio: false,
    globalTools: false
  });

  useEffect(() => {
    localStorage.setItem('aura-flow-presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        setUndoTrigger(t => t + 1);
      }
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        setRedoTrigger(t => t + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleLock = (key: string) => {
    setLockedParams(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAudio = async () => {
    if (!isAudioEnabled) {
      await audioManager.start();
      setIsAudioEnabled(true);
    } else {
      audioManager.stop();
      setIsAudioEnabled(false);
    }
  };

  const updateParam = (key: keyof SimulationParams, value: any) => {
    if (selectedStrokeId && selectedStrokeParams) {
      setSelectedStrokeParams({ ...selectedStrokeParams, [key]: value });
    } else {
      setBrushParams({ ...brushParams, [key]: value });
    }
  };

  const updateSound = (key: keyof SoundConfig, value: any) => {
    if (selectedStrokeId && selectedStrokeSound) {
      setSelectedStrokeSound({ ...selectedStrokeSound, [key]: value });
    } else {
      setBrushSound({ ...brushSound, [key]: value });
    }
  };

  const updateModulation = (key: keyof SimulationParams, config: ModulationConfig | undefined) => {
    const target = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newMods = { ...target.modulations };
    
    if (config === undefined) {
      delete newMods[key];
    } else {
      newMods[key] = config;
    }

    if (selectedStrokeId && selectedStrokeParams) {
      setSelectedStrokeParams({ ...selectedStrokeParams, modulations: newMods });
    } else {
      setBrushParams({ ...brushParams, modulations: newMods });
    }
  };

  const resetSection = (section: keyof typeof PARAMS_GROUPS) => {
    const keys = PARAMS_GROUPS[section];
    const newValues: any = {};
    keys.forEach(k => { newValues[k] = (DEFAULT_PARAMS as any)[k]; });

    if (selectedStrokeId && selectedStrokeParams) {
      const updated = { ...selectedStrokeParams };
      for (const k in newValues) { (updated as any)[k] = newValues[k]; }
      setSelectedStrokeParams(updated);
    } else {
      setBrushParams(prev => ({ ...prev, ...newValues }));
    }
  };

  const randomizeSection = (section: keyof typeof PARAMS_GROUPS) => {
    const keys = PARAMS_GROUPS[section];
    const newValues: any = {};
    
    keys.forEach(k => {
      if (lockedParams.has(k)) return; 
      
      if (k === 'blendMode') {
        newValues[k] = BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)];
      } else if (k === 'seamlessPath') {
        newValues[k] = Math.random() > 0.5;
      } else if (k.startsWith('audioTo')) {
         newValues[k] = Math.random() > 0.5;
      } else {
        const range = PARAM_RANGES[k];
        if (range) {
          newValues[k] = range.min + Math.random() * (range.max - range.min);
        } else {
          newValues[k] = Math.random();
        }
      }
    });

    if (selectedStrokeId && selectedStrokeParams) {
      setSelectedStrokeParams(prev => prev ? ({ ...prev, ...newValues }) : null);
    } else {
      setBrushParams(prev => ({ ...prev, ...newValues }));
    }
  };

  const handleStrokeSelect = useCallback((id: string | null, params: SimulationParams | null, sound: SoundConfig | null) => {
    setSelectedStrokeId(id);
    setSelectedStrokeParams(params);
    setSelectedStrokeSound(sound);
    if (id) {
        setShowSettings(true);
    }
  }, []);

  const exportProject = () => {
    if (!canvasRef.current) return;
    const name = prompt("Project Name:", "aura-flow-project");
    if (!name) return;
    
    const data = canvasRef.current.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerImportProject = () => fileInputRef.current?.click();
  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (canvasRef.current) canvasRef.current.importData(data);
      } catch (err) { alert("Invalid JSON"); }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const initSavePreset = () => { setIsNamingPreset(true); setNewPresetName(`Preset ${presets.length + 1}`); };
  const confirmSavePreset = () => {
    if (!newPresetName.trim()) return;
    const current = selectedStrokeId && selectedStrokeParams ? selectedStrokeParams : brushParams;
    setPresets(prev => [...prev, { name: newPresetName.trim(), params: { ...current } }]);
    setIsNamingPreset(false);
    setNewPresetName("");
  };
  const cancelSavePreset = () => { setIsNamingPreset(false); setNewPresetName(""); };
  const deletePreset = (index: number) => { if (confirm("Delete?")) setPresets(prev => prev.filter((_, i) => i !== index)); };
  const loadPreset = (params: SimulationParams) => {
    if (selectedStrokeId) setSelectedStrokeParams({ ...params });
    else setBrushParams({ ...params });
  };
  const exportPresets = () => {
    const json = JSON.stringify(presets, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-flow-presets.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const triggerImportPresets = () => presetFileInputRef.current?.click();
  const handleImportPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) setPresets(prev => [...prev, ...data]);
      } catch (err) {}
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Sound Handlers
  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
       const arrayBuffer = ev.target?.result as ArrayBuffer;
       const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
       const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
       const bufferId = `upload-${Date.now()}`;
       audioManager.addBuffer(bufferId, audioBuffer);
       
       alert("Sound uploaded! Applied to brush.");
       if (!selectedStrokeId) {
          setBrushSound(prev => ({...prev, bufferId}));
       }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };
  
  const handleBufferReady = (buffer: AudioBuffer) => {
    const bufferId = `rec-${Date.now()}`;
    audioManager.addBuffer(bufferId, buffer);
    alert("Recorded! Applied to brush.");
    setBrushSound(prev => ({...prev, bufferId}));
  };

  const setForceTool = (tool: GlobalForceType) => {
    if (tool !== 'none') {
       // Reset interaction modes to neutral if selecting a physics tool
       setInteractionMode('draw'); 
    }
    setGlobalForceTool(tool);
  };

  const currentParams = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
  const currentSound = (selectedStrokeId && selectedStrokeSound) ? selectedStrokeSound : brushSound;
  const modeTitle = selectedStrokeId ? "Editing Selection" : "Brush Settings";

  const getCommonProps = (key: keyof SimulationParams) => ({
    isLocked: lockedParams.has(key),
    onToggleLock: () => toggleLock(key),
    description: PARAM_DESCRIPTIONS[key],
    modulation: currentParams.modulations?.[key],
    onModulationChange: (cfg: ModulationConfig | undefined) => updateModulation(key, cfg)
  });

  return (
    <div className="relative w-full h-screen bg-[#fdfcf8] overflow-hidden text-slate-800">
      <input type="file" ref={fileInputRef} onChange={handleImportProject} className="hidden" accept=".json" />
      <input type="file" ref={presetFileInputRef} onChange={handleImportPresets} className="hidden" accept=".json" />
      <input type="file" ref={soundInputRef} onChange={handleSoundUpload} className="hidden" accept="audio/*" />

      <Canvas 
        ref={canvasRef}
        brushParams={brushParams}
        brushSound={brushSound}
        selectedStrokeId={selectedStrokeId}
        selectedStrokeParams={selectedStrokeParams}
        isPlaying={isPlaying}
        isAudioEnabled={isAudioEnabled}
        interactionMode={interactionMode}
        globalForceTool={globalForceTool}
        globalToolConfig={globalToolConfig}
        ecoMode={ecoMode}
        onClear={() => { setClearTrigger(c => c + 1); setSelectedStrokeId(null); }}
        clearTrigger={clearTrigger}
        deleteSelectedTrigger={deleteSelectedTrigger}
        undoTrigger={undoTrigger}
        redoTrigger={redoTrigger}
        resetPosTrigger={resetPosTrigger}
        onStrokeSelect={handleStrokeSelect}
      />

      {/* --- Top Bar --- */}
      <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20 flex justify-center pointer-events-none">
        
        {showPalette && (
             <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-2xl rounded-2xl p-3 shadow-2xl border border-white/50 grid grid-cols-4 gap-2 w-48 animate-fade-in-up z-50 pointer-events-auto">
                 {PALETTE.map(c => (
                   <button
                     key={c}
                     onClick={() => { updateParam('color', c); setShowPalette(false); }}
                     className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 shadow-sm ${currentParams.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                     style={{ backgroundColor: c }}
                   />
                 ))}
             </div>
        )}

        <div className="bg-white/80 backdrop-blur-xl rounded-full shadow-xl shadow-slate-200/40 p-1.5 flex items-center space-x-1 md:space-x-2 border border-white/60 pointer-events-auto overflow-x-auto max-w-full no-scrollbar">
          <IconButton icon={<PenTool size={18} />} onClick={() => { setInteractionMode('draw'); setGlobalForceTool('none'); }} active={interactionMode === 'draw' && globalForceTool === 'none'} label="Draw" />
          <IconButton icon={<MousePointer2 size={18} />} onClick={() => { setInteractionMode('select'); setGlobalForceTool('none'); }} active={interactionMode === 'select' && globalForceTool === 'none'} label="Select" />
          
          <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0" />
          
          <IconButton icon={<Move size={18} />} onClick={() => setForceTool('repulse')} active={globalForceTool === 'repulse'} label="Push" />
          <IconButton icon={<Magnet size={18} />} onClick={() => setForceTool('attract')} active={globalForceTool === 'attract'} label="Pull" />
          <IconButton icon={<Tornado size={18} />} onClick={() => setForceTool('vortex')} active={globalForceTool === 'vortex'} label="Swirl" />

          <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0" />

          <div className="relative shrink-0">
             <button onClick={() => setShowPalette(!showPalette)} className="w-10 h-10 rounded-full border border-white/50 shadow-sm flex items-center justify-center transition-transform hover:scale-105 active:scale-95" style={{ backgroundColor: currentParams.color }}>
                <div className="w-full h-full rounded-full ring-1 ring-inset ring-black/5" />
             </button>
          </div>
          <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0" />
          <IconButton icon={<Settings size={20} />} onClick={() => setShowSettings(!showSettings)} active={showSettings} label="Settings" className={selectedStrokeId ? "ring-2 ring-indigo-500/50" : ""} />
          <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0" />
          <IconButton icon={isPlaying ? <Pause size={18} /> : <Play size={18} />} onClick={() => setIsPlaying(!isPlaying)} active={isPlaying} label={isPlaying ? "Pause" : "Play"} />
          <IconButton icon={<Anchor size={18} />} onClick={() => setResetPosTrigger(t => t+1)} label="Reset Pos" />
          <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0 hidden md:block" />
          <IconButton icon={<Undo size={18} />} onClick={() => setUndoTrigger(t => t + 1)} label="Undo" className="hidden md:flex" />
          <IconButton icon={<Redo size={18} />} onClick={() => setRedoTrigger(t => t + 1)} label="Redo" className="hidden md:flex" />
          <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0 hidden md:block" />
          <IconButton icon={<Download size={18} />} onClick={exportProject} label="Save" className="hidden md:flex" />
          <IconButton icon={<Upload size={18} />} onClick={triggerImportProject} label="Load" className="hidden md:flex" />
          <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0" />
          <IconButton icon={<Trash2 size={18} />} onClick={() => { setClearTrigger(c => c + 1); setSelectedStrokeId(null); }} label="Clear" />
        </div>
      </div>

      {/* --- Settings Panel --- */}
      {showSettings && (
        <div className="absolute right-4 md:right-8 top-24 bottom-8 z-20 w-80 bg-slate-900/5 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] border border-white/20 flex flex-col animate-fade-in-up text-slate-800 overflow-hidden ring-1 ring-white/30">
           
           <div className="flex-none px-6 py-4 border-b border-white/20 flex justify-between items-center bg-white/5">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm tracking-wide">
                {selectedStrokeId ? <Edit3 size={15} className="text-indigo-600"/> : <Zap size={15} className="text-amber-500" />}
                {modeTitle}
              </h3>
              {selectedStrokeId && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setDeleteSelectedTrigger(t => t + 1)} className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-sm backdrop-blur-sm">
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => { setSelectedStrokeId(null); setSelectedStrokeParams(null); }} className="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-full font-bold hover:bg-indigo-700 shadow-md transition-colors">
                    DONE
                  </button>
                </div>
              )}
           </div>

           <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 custom-scrollbar scroll-smooth">
              
              <SectionHeader title="Presets" isOpen={sections.presets} onToggle={() => toggleSection('presets')} />
              {sections.presets && (
                 <div className="pb-4 mb-2">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {presets.map((p, idx) => (
                        <div key={idx} className="group relative">
                          <button onClick={() => loadPreset(p.params)} className="px-3 py-1.5 bg-white/40 hover:bg-white/70 border border-white/30 text-[10px] font-bold uppercase rounded-lg transition-all text-slate-700 shadow-sm backdrop-blur-md">
                            {p.name}
                          </button>
                          <button onClick={() => deletePreset(idx)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-[8px]">
                            <X size={8} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {isNamingPreset ? (
                       <div className="flex gap-2 items-center animate-fade-in-up bg-white/20 p-2 rounded-lg border border-white/20">
                           <input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="flex-1 bg-white/60 border border-white/40 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500" placeholder="Preset Name..." autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmSavePreset()} />
                           <button onClick={confirmSavePreset} className="bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded hover:bg-indigo-700 shadow-sm"><Check size={14} /></button>
                           <button onClick={cancelSavePreset} className="bg-slate-500 text-white w-7 h-7 flex items-center justify-center rounded hover:bg-slate-600 shadow-sm"><X size={14} /></button>
                       </div>
                    ) : (
                       <div className="flex gap-2">
                          <button onClick={initSavePreset} className="flex-1 flex justify-center items-center gap-1 text-[9px] bg-indigo-50/50 text-indigo-700 py-2 rounded-lg hover:bg-indigo-100/50 font-bold border border-indigo-100/50 transition-colors"><Save size={10} /> SAVE</button>
                          <button onClick={exportPresets} className="flex-1 flex justify-center items-center gap-1 text-[9px] bg-white/40 text-slate-600 py-2 rounded-lg hover:bg-white/60 font-bold border border-white/30 transition-colors"><Folder size={10} /> EXPORT</button>
                          <button onClick={triggerImportPresets} className="flex-1 flex justify-center items-center gap-1 text-[9px] bg-white/40 text-slate-600 py-2 rounded-lg hover:bg-white/60 font-bold border border-white/30 transition-colors"><FolderOpen size={10} /> IMPORT</button>
                       </div>
                    )}
                 </div>
              )}

              {/* --- SOUND DESIGN SECTION --- */}
              <SectionHeader title="Sound Design" isOpen={sections.soundDesign} onToggle={() => toggleSection('soundDesign')} />
              {sections.soundDesign && (
                  <div className="pb-4 space-y-3 bg-indigo-50/20 p-3 rounded-xl border border-indigo-100/20">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1"><Music size={12}/> {selectedStrokeId ? "Stroke Sound" : "Brush Sound"}</span>
                        <div className="flex gap-2">
                            <SoundRecorder onBufferReady={handleBufferReady} />
                            <button onClick={() => soundInputRef.current?.click()} className="w-8 h-8 rounded-full bg-white/40 hover:bg-white border border-white/20 flex items-center justify-center text-slate-600" title="Upload Audio">
                              <Upload size={14} />
                            </button>
                        </div>
                      </div>
                      <Slider label="Motion Sensitivity" value={currentSound.motionSensitivity} min={0} max={10} step={0.5} onChange={(v) => updateSound('motionSensitivity', v)} description="How much stroke velocity (swirl/push) adds to volume and pitch." />
                      <Slider label="Volume" value={currentSound.baseVolume} min={0} max={2} step={0.1} onChange={(v) => updateSound('baseVolume', v)} description="Base volume level." />
                      <Slider label="Pitch" value={currentSound.pitch} min={0.5} max={2} step={0.1} onChange={(v) => updateSound('pitch', v)} description="Playback speed/pitch." />
                      <Slider label="Reverb" value={currentSound.reverbSend} min={0} max={1} step={0.05} onChange={(v) => updateSound('reverbSend', v)} description="Amount of reverb effect." />
                  </div>
              )}
              
              {/* --- GLOBAL TOOLS SECTION (New) --- */}
              <SectionHeader title="Global Tools" isOpen={sections.globalTools} onToggle={() => toggleSection('globalTools')} />
              {sections.globalTools && (
                 <div className="pb-4 space-y-2 bg-slate-50/20 p-3 rounded-xl border border-slate-100/20">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Globe size={10} /> Config</span>
                       <Toggle label="Hover Trigger" value={globalToolConfig.trigger === 'hover'} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, trigger: v ? 'hover' : 'click' }))} />
                    </div>
                    <Slider label="Tool Radius" value={globalToolConfig.radius} min={50} max={500} step={10} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, radius: v }))} description="Size of the global push/pull/swirl tool." />
                    <Slider label="Tool Force" value={globalToolConfig.force} min={0.1} max={5} step={0.1} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, force: v }))} description="Strength of the global effect." />
                 </div>
              )}

              <SectionHeader title="Physics" isOpen={sections.physics} onToggle={() => toggleSection('physics')} onReset={() => resetSection('physics')} onRandom={() => randomizeSection('physics')} />
              {sections.physics && (
                <div className="pb-4 space-y-1">
                   <Slider label="Mass" value={currentParams.mass} min={0.1} max={5} step={0.1} onChange={(v) => updateParam('mass', v)} {...getCommonProps('mass')} />
                   <Slider label="Friction" value={currentParams.friction} min={0.5} max={0.99} step={0.01} onChange={(v) => updateParam('friction', v)} {...getCommonProps('friction')} />
                   <Slider label="Elasticity" value={currentParams.elasticity} min={0} max={0.2} step={0.001} onChange={(v) => updateParam('elasticity', v)} {...getCommonProps('elasticity')} />
                   <Slider label="Viscosity" value={currentParams.viscosity} min={0} max={1} step={0.01} onChange={(v) => updateParam('viscosity', v)} {...getCommonProps('viscosity')} />
                   <Slider label="Tension" value={currentParams.tension} min={0} max={5} step={0.1} onChange={(v) => updateParam('tension', v)} {...getCommonProps('tension')} />
                   <Slider label="Gravity X" value={currentParams.gravityX} min={-0.5} max={0.5} step={0.01} onChange={(v) => updateParam('gravityX', v)} {...getCommonProps('gravityX')} />
                   <Slider label="Gravity Y" value={currentParams.gravityY} min={-0.5} max={0.5} step={0.01} onChange={(v) => updateParam('gravityY', v)} {...getCommonProps('gravityY')} />
                </div>
              )}

              <SectionHeader title="Shape & Motion" isOpen={sections.shape} onToggle={() => toggleSection('shape')} onReset={() => resetSection('shape')} onRandom={() => randomizeSection('shape')} />
              {sections.shape && (
                <div className="pb-4 space-y-1">
                   <Slider label="Resolution" value={currentParams.segmentation} min={2} max={50} step={1} onChange={(v) => updateParam('segmentation', v)} {...getCommonProps('segmentation')} />
                   <div className="bg-white/20 p-3 rounded-xl border border-white/20 my-2">
                     <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Wiggle</div>
                     <Slider label="Amplitude" value={currentParams.wiggleAmplitude} min={0} max={20} step={0.1} onChange={(v) => updateParam('wiggleAmplitude', v)} {...getCommonProps('wiggleAmplitude')} />
                     <Slider label="Frequency" value={currentParams.wiggleFrequency} min={0.01} max={0.5} step={0.01} onChange={(v) => updateParam('wiggleFrequency', v)} {...getCommonProps('wiggleFrequency')} />
                     <Slider label="Speed" value={currentParams.waveSpeed} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('waveSpeed', v)} {...getCommonProps('waveSpeed')} />
                   </div>
                   <div className="bg-white/20 p-3 rounded-xl border border-white/20">
                     <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Breathing</div>
                     <Slider label="Amplitude" value={currentParams.breathingAmp} min={0} max={10} step={0.1} onChange={(v) => updateParam('breathingAmp', v)} {...getCommonProps('breathingAmp')} />
                     <Slider label="Frequency" value={currentParams.breathingFreq} min={0.01} max={0.2} step={0.01} onChange={(v) => updateParam('breathingFreq', v)} {...getCommonProps('breathingFreq')} />
                   </div>
                </div>
              )}

              <SectionHeader title="Interaction" isOpen={sections.social} onToggle={() => toggleSection('social')} onReset={() => resetSection('social')} onRandom={() => randomizeSection('social')} />
              {sections.social && (
                <div className="pb-4 space-y-3">
                   <div className="bg-indigo-50/10 p-3 rounded-xl border border-indigo-100/10">
                     <div className="text-[9px] font-bold text-indigo-400 mb-3 flex items-center gap-1 uppercase tracking-widest"><Users size={10}/> Swarm Intelligence</div>
                     <Slider label="Radius" value={currentParams.neighborRadius} min={10} max={300} step={10} onChange={(v) => updateParam('neighborRadius', v)} {...getCommonProps('neighborRadius')} />
                     <Slider label="Repulsion" value={currentParams.repulsionForce} min={0} max={0.2} step={0.005} onChange={(v) => updateParam('repulsionForce', v)} {...getCommonProps('repulsionForce')} />
                     <Slider label="Attraction" value={currentParams.attractionForce} min={0} max={0.2} step={0.005} onChange={(v) => updateParam('attractionForce', v)} {...getCommonProps('attractionForce')} />
                     <Slider label="Alignment" value={currentParams.alignmentForce} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('alignmentForce', v)} {...getCommonProps('alignmentForce')} />
                     <Slider label="Cohesion" value={currentParams.cohesionForce} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('cohesionForce', v)} {...getCommonProps('cohesionForce')} />
                   </div>
                   <div className="bg-amber-50/10 p-3 rounded-xl border border-amber-100/10">
                      <div className="text-[9px] font-bold text-amber-500 mb-3 flex items-center gap-1 uppercase tracking-widest"><Zap size={10}/> Mouse Physics</div>
                      <Slider label="Influence Radius" value={currentParams.mouseInfluenceRadius || 150} min={50} max={500} step={10} onChange={(v) => updateParam('mouseInfluenceRadius', v)} {...getCommonProps('mouseInfluenceRadius')} />
                      <Slider label="Repulsion" value={currentParams.mouseRepulsion} min={0} max={20} step={0.1} onChange={(v) => updateParam('mouseRepulsion', v)} {...getCommonProps('mouseRepulsion')} />
                      <Slider label="Attraction" value={currentParams.mouseAttraction} min={0} max={20} step={0.1} onChange={(v) => updateParam('mouseAttraction', v)} {...getCommonProps('mouseAttraction')} />
                      <Slider label="Falloff (Sharpness)" value={currentParams.mouseFalloff || 1} min={1} max={4} step={0.1} onChange={(v) => updateParam('mouseFalloff', v)} {...getCommonProps('mouseFalloff')} />
                   </div>
                </div>
              )}

              <SectionHeader title="Visuals" isOpen={sections.visuals} onToggle={() => toggleSection('visuals')} onReset={() => resetSection('visuals')} onRandom={() => randomizeSection('visuals')} />
              {sections.visuals && (
                <div className="pb-4 space-y-2">
                   <div className="bg-green-50/10 p-3 rounded-xl border border-green-100/10 mb-3">
                      <div className="text-[9px] font-bold text-green-600 mb-2 flex items-center gap-1 uppercase tracking-widest"><Battery size={10}/> Battery Saver</div>
                      <Toggle label="Eco Mode (30 FPS)" value={ecoMode} onChange={setEcoMode} />
                   </div>
                   <Slider label="Width" value={currentParams.strokeWidth} min={1} max={50} step={1} onChange={(v) => updateParam('strokeWidth', v)} {...getCommonProps('strokeWidth')} />
                   <Slider label="Opacity" value={currentParams.opacity} min={0.1} max={1} step={0.01} onChange={(v) => updateParam('opacity', v)} {...getCommonProps('opacity')} />
                   <Select label="Blend Mode" value={currentParams.blendMode} options={BLEND_MODES} onChange={(v) => updateParam('blendMode', v)} {...getCommonProps('blendMode')} />
                   <div className="border-t border-white/20 pt-3 space-y-2 mt-2">
                     <Slider label="Glow" value={currentParams.glowStrength} min={0} max={50} step={1} onChange={(v) => updateParam('glowStrength', v)} {...getCommonProps('glowStrength')} />
                     <Slider label="Blur" value={currentParams.blurStrength} min={0} max={20} step={0.5} onChange={(v) => updateParam('blurStrength', v)} {...getCommonProps('blurStrength')} />
                     <Toggle label="Seamless" value={currentParams.seamlessPath} onChange={(v) => updateParam('seamlessPath', v)} {...getCommonProps('seamlessPath')} />
                   </div>
                </div>
              )}

              <SectionHeader title="Audio" isOpen={sections.audio} onToggle={() => toggleSection('audio')} onReset={() => resetSection('audio')} onRandom={() => randomizeSection('audio')} />
              {sections.audio && (
                <div className="pb-4">
                   <IconButton icon={isAudioEnabled ? <Mic size={18} /> : <MicOff size={18} />} onClick={toggleAudio} active={isAudioEnabled} label={isAudioEnabled ? "ON" : "OFF"} className="w-full h-9 mb-3" />
                   <div className={`space-y-3 transition-opacity duration-300 ${!isAudioEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                      <Slider label="Sensitivity" value={currentParams.audioSensitivity} min={0} max={5} step={0.1} onChange={(v) => updateParam('audioSensitivity', v)} {...getCommonProps('audioSensitivity')} />
                      <Toggle label="Bass -> Width" value={currentParams.audioToWidth} onChange={(v) => updateParam('audioToWidth', v)} {...getCommonProps('audioToWidth')} />
                      <Toggle label="Bass -> Wiggle" value={currentParams.audioToWiggle} onChange={(v) => updateParam('audioToWiggle', v)} {...getCommonProps('audioToWiggle')} />
                   </div>
                </div>
              )}
           </div>
        </div>
      )}

      <div className="absolute bottom-4 left-6 text-slate-400/50 text-[9px] font-mono pointer-events-none select-none tracking-widest uppercase">
        Aura Flow v9.2 • {interactionMode}
      </div>
    </div>
  );
}
