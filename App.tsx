
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas, CanvasHandle } from './components/Canvas';
import { IconButton } from './components/IconButtons';
import { DebugMenu } from './components/panels/DebugMenu';
import { SaveModal } from './components/SaveModal';
import { SettingsPanel } from './components/panels/SettingsPanel';
import { Palette } from './components/panels/Palette';
import { SimulationParams, ModulationConfig, SoundConfig, GlobalForceType, GlobalToolConfig, UITheme, GridConfig, SymmetryConfig, Preset, Connection } from './types';
import { audioManager } from './services/audioService';
import { hexToRgba } from './utils/colorUtils';
import { DEFAULT_PARAMS, DEFAULT_SOUND, DEFAULT_GLOBAL_TOOL, DEFAULT_GRID, DEFAULT_SYMMETRY, DEFAULT_THEME, PARAMS_GROUPS, PARAM_RANGES, DEFAULT_PALETTE, BLEND_MODES } from './constants/defaults';
import { DEFAULT_PRESETS } from './constants/presets';
import { Play, Pause, Mic, MicOff, Trash2, Settings, Undo, Redo, PenTool, MousePointer2, Volume2, VolumeX, Speaker, Loader2, Link as LinkIcon, Shuffle, AlertCircle, RotateCcw } from 'lucide-react';

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

  const [uiTheme, setUiTheme] = useState<UITheme>(DEFAULT_THEME);
  const [showDebug, setShowDebug] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  const [embedMode, setEmbedMode] = useState(false);
  const [embedFit, setEmbedFit] = useState<'cover' | 'contain' | null>(null);
  const [embedZoom, setEmbedZoom] = useState<number>(1); 
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [brushParams, setBrushParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [brushSound, setBrushSound] = useState<SoundConfig>(DEFAULT_SOUND);
  
  const [gridConfig, setGridConfig] = useState<GridConfig>(DEFAULT_GRID);
  const [symmetryConfig, setSymmetryConfig] = useState<SymmetryConfig>(DEFAULT_SYMMETRY);

  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set());
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null); 
  const [selectedStrokeParams, setSelectedStrokeParams] = useState<SimulationParams | null>(null);
  const [selectedStrokeSound, setSelectedStrokeSound] = useState<SoundConfig | null>(null);
  
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  const [selectedConnectionParams, setSelectedConnectionParams] = useState<Connection | null>(null);

  const [lockedParams, setLockedParams] = useState<Set<string>>(new Set());

  const [isPlaying, setIsPlaying] = useState(true);
  const [isSoundEngineEnabled, setIsSoundEngineEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [ecoMode, setEcoMode] = useState(true); 
  
  const [interactionMode, setInteractionMode] = useState<'draw' | 'select'>('draw');
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'links'>('all'); 
  const [globalForceTool, setGlobalForceTool] = useState<GlobalForceType>('none');
  const [globalToolConfig, setGlobalToolConfig] = useState<GlobalToolConfig>(DEFAULT_GLOBAL_TOOL);

  const [clearTrigger, setClearTrigger] = useState(0);
  const [deleteSelectedTrigger, setDeleteSelectedTrigger] = useState(0);
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [redoTrigger, setRedoTrigger] = useState(0);
  const [resetPosTrigger, setResetPosTrigger] = useState(0);
  const [deleteAllLinksTrigger, setDeleteAllLinksTrigger] = useState(0); 
  const [savePresetTrigger, setSavePresetTrigger] = useState(0); // Trigger for SettingsPanel to open naming UI
  const [selectAllTrigger, setSelectAllTrigger] = useState(0);

  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteColors, setPaletteColors] = useState(DEFAULT_PALETTE);
  
  const [tooltip, setTooltip] = useState<{ text: string, rect: DOMRect } | null>(null);

  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const saved = localStorage.getItem('aura-flow-presets');
      return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
    } catch (e) { return DEFAULT_PRESETS; }
  });
  const [activePresetName, setActivePresetName] = useState<string | null>(DEFAULT_PRESETS[0].name);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEmbed = params.get('mode') === 'embed' || params.get('embed') === 'true';
    const fitMode = params.get('fit');
    const zoomVal = parseFloat(params.get('zoom') || '1');

    if (isEmbed) {
      setEmbedMode(true);
      setGridConfig(prev => ({...prev, visible: false})); 
      if (fitMode === 'cover' || fitMode === 'contain') {
          setEmbedFit(fitMode);
      }
      if (!isNaN(zoomVal) && zoomVal > 0) {
          setEmbedZoom(zoomVal);
      }
    }

    const dataUrl = params.get('url') || params.get('data');
    if (dataUrl) {
      loadProjectFromUrl(dataUrl);
    }
  }, []);

  // NEW: Intelligent Auto-Pause when window loses focus (if Eco Mode is active)
  useEffect(() => {
    const handleBlur = () => {
      if (ecoMode) setIsPlaying(false);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [ecoMode]);

  const loadProjectFromUrl = (url: string) => {
      setIsLoadingData(true);
      setLoadingError(null);
      
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("text/html")) {
              throw new Error("Invalid URL: Link points to a webpage, not Raw JSON. Use 'Raw' button on Gist.");
          }
          return res.json();
        })
        .then(data => {
          if (canvasRef.current) {
            canvasRef.current.importData(data);
          } else {
             setTimeout(() => {
                 if (canvasRef.current) canvasRef.current.importData(data);
             }, 500);
          }
        })
        .catch(err => {
          console.error("Error loading project:", err);
          setLoadingError(err.message || "Failed to load project data");
        })
        .finally(() => {
          setIsLoadingData(false);
        });
  };

  useEffect(() => {
    localStorage.setItem('aura-flow-presets', JSON.stringify(presets));
  }, [presets]);

  const cyclePreset = (dir: 1 | -1) => {
      const currentIdx = presets.findIndex(p => p.name === activePresetName);
      if (currentIdx === -1 && presets.length > 0) {
          loadPreset(presets[0].params, presets[0].name);
          return;
      }
      let nextIdx = (currentIdx + dir) % presets.length;
      if (nextIdx < 0) nextIdx = presets.length - 1;
      const nextPreset = presets[nextIdx];
      loadPreset(nextPreset.params, nextPreset.name);
  };

  const pickRandomPreset = () => {
      if (presets.length === 0) return;
      const randomIdx = Math.floor(Math.random() * presets.length);
      const p = presets[randomIdx];
      loadPreset(p.params, p.name);
  };

  const initiateSave = () => { if (canvasRef.current) setShowSaveModal(true); };
  
  const triggerImportProject = () => fileInputRef.current?.click();

  const exportSinglePreset = () => {
      try {
          const current = selectedStrokeId && selectedStrokeParams ? selectedStrokeParams : brushParams;
          const name = activePresetName || "custom-preset";
          const singlePreset = { name, description: "Exported single preset", params: current };
          const json = JSON.stringify([singlePreset], null, 2); 
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `${name.toLowerCase().replace(/\s+/g, '-')}.json`; 
          document.body.appendChild(a);
          setTimeout(() => { a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
      } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') { e.preventDefault(); setIsPlaying(p => !p); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); setUndoTrigger(t => t + 1); }
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) { e.preventDefault(); setRedoTrigger(t => t + 1); }
      if (e.key.toLowerCase() === 'h' && !embedMode) { setShowDebug(prev => !prev); }
      
      // --- SHORTCUTS ---
      if (e.key.toLowerCase() === 'a') {
          if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              setSelectAllTrigger(t => t + 1);
          } else {
              e.preventDefault(); 
              cyclePreset(-1); 
          }
      }
      if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); cyclePreset(1); }
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); initiateSave(); }
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); pickRandomPreset(); }
      if (e.key === '1') { e.preventDefault(); if(presets.length > 0) loadPreset(presets[0].params, presets[0].name); }
      
      // NEW SHORTCUTS
      if (e.key.toLowerCase() === 'i') { e.preventDefault(); triggerImportProject(); }
      if (e.key.toLowerCase() === 't') { e.preventDefault(); exportSinglePreset(); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); setShowSettings(true); setSavePresetTrigger(t => t + 1); }
      if (e.key.toLowerCase() === 'g') { e.preventDefault(); setGridConfig(p => ({...p, enabled: !p.enabled})); }

      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) { setResetPosTrigger(t => t + 1); }
      if (e.key === 'Delete' && !embedMode) {
          if (selectedStrokeId || selectedStrokeIds.size > 0 || selectedConnectionIds.size > 0) {
              setDeleteSelectedTrigger(t => t + 1);
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [embedMode, selectedStrokeId, selectedStrokeIds, selectedConnectionIds, presets, activePresetName]);

  // --- RIGHT CLICK TOGGLE ---
  const handleContextMenu = (e: React.MouseEvent) => {
    if (embedMode) return;
    e.preventDefault();
    setInteractionMode(prev => prev === 'draw' ? 'select' : 'draw');
    setGlobalForceTool('none');
  };

  const toggleLock = (key: string) => setLockedParams(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const toggleSoundEngine = async (forceState?: boolean) => {
    const targetState = forceState !== undefined ? forceState : !isSoundEngineEnabled;
    if (targetState) { 
        await audioManager.initAudioContext(); 
        audioManager.setMasterVolume(1); 
        setIsSoundEngineEnabled(true); 
    } else { 
        audioManager.setMasterVolume(0); 
        setIsSoundEngineEnabled(false); 
    }
  };

  const toggleMic = async () => {
    if (!isMicEnabled) { await audioManager.toggleMic(true); setIsMicEnabled(true); } 
    else { await audioManager.toggleMic(false); setIsMicEnabled(false); }
  };

  const updateParam = (key: keyof SimulationParams, value: any) => {
    if (selectedStrokeIds.size > 0 && selectedStrokeParams) {
        setSelectedStrokeParams({ ...selectedStrokeParams, [key]: value });
        canvasRef.current?.updateSelectedParams({ key, value });
    } else {
        setBrushParams({ ...brushParams, [key]: value });
    }
    setActivePresetName(null);
  };

  const updateConnectionParam = (key: keyof Connection, value: any) => {
      if (selectedConnectionParams) {
          setSelectedConnectionParams({ ...selectedConnectionParams, [key]: value });
          canvasRef.current?.updateSelectedConnectionParams({ [key]: value });
      }
  };

  const resetParam = (key: keyof SimulationParams) => {
      const defaultValue = (DEFAULT_PARAMS as any)[key];
      if (selectedStrokeIds.size > 0 && selectedStrokeParams) {
          const newMods = { ...selectedStrokeParams.modulations };
          delete newMods[key];
          setSelectedStrokeParams({ ...selectedStrokeParams, [key]: defaultValue, modulations: newMods });
          canvasRef.current?.updateSelectedParams({ key, value: undefined, modulation: true }); 
          canvasRef.current?.updateSelectedParams({ key, value: defaultValue }); 
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
    const target = (selectedStrokeIds.size > 0 && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newFill = { ...target.fill, ...updates };
    if (selectedStrokeIds.size > 0 && selectedStrokeParams) {
        setSelectedStrokeParams({ ...selectedStrokeParams, fill: newFill });
        canvasRef.current?.updateSelectedParams({ fill: newFill });
    } else {
        setBrushParams({ ...brushParams, fill: newFill });
    }
    setActivePresetName(null);
  };

  const updateFillGradient = (updates: Partial<SimulationParams['fill']['gradient']>) => {
    const target = (selectedStrokeIds.size > 0 && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newGrad = { ...target.fill.gradient, ...updates };
    const newFill = { ...target.fill, gradient: newGrad };
    if (selectedStrokeIds.size > 0 && selectedStrokeParams) {
        setSelectedStrokeParams({ ...selectedStrokeParams, fill: newFill });
        canvasRef.current?.updateSelectedParams({ fill: newFill });
    } else {
        setBrushParams({ ...brushParams, fill: newFill });
    }
    setActivePresetName(null);
  };

  const updateGradient = (updates: Partial<SimulationParams['gradient']>) => {
    const target = (selectedStrokeIds.size > 0 && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newGrad = { ...target.gradient, ...updates };
    if (selectedStrokeIds.size > 0 && selectedStrokeParams) {
        setSelectedStrokeParams({ ...selectedStrokeParams, gradient: newGrad });
        canvasRef.current?.updateSelectedParams({ gradient: newGrad });
    } else {
        setBrushParams({ ...brushParams, gradient: newGrad });
    }
    setActivePresetName(null);
  };

  const addGradientColor = () => {
    const target = (selectedStrokeIds.size > 0 && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newColors = [...target.gradient.colors, '#ffffff'];
    updateGradient({ colors: newColors });
  };

  const removeGradientColor = (index: number) => {
    const target = (selectedStrokeIds.size > 0 && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    if (target.gradient.colors.length <= 2) return;
    const newColors = target.gradient.colors.filter((_, i) => i !== index);
    updateGradient({ colors: newColors });
  };

  const updateGradientColor = (index: number, color: string) => {
    const target = (selectedStrokeIds.size > 0 && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newColors = [...target.gradient.colors];
    newColors[index] = color;
    updateGradient({ colors: newColors });
  };

  const updateSound = (key: keyof SoundConfig, value: any) => {
    if (selectedStrokeIds.size > 0 && selectedStrokeSound) {
        setSelectedStrokeSound({ ...selectedStrokeSound, [key]: value });
    } else {
        setBrushSound({ ...brushSound, [key]: value });
    }
  };

  const updateModulation = (key: keyof SimulationParams, config: ModulationConfig | undefined) => {
    const target = (selectedStrokeIds.size > 0 && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newMods = { ...target.modulations };
    if (config === undefined) delete newMods[key]; else newMods[key] = config;
    if (selectedStrokeIds.size > 0 && selectedStrokeParams) {
        setSelectedStrokeParams({ ...selectedStrokeParams, modulations: newMods });
        canvasRef.current?.updateSelectedParams({ key, value: config, modulation: true });
    } else {
        setBrushParams({ ...brushParams, modulations: newMods });
    }
    setActivePresetName(null);
  };

  const resetSection = (section: keyof typeof PARAMS_GROUPS) => {
    const keys = PARAMS_GROUPS[section];
    const newValues: any = {};
    keys.forEach(k => { newValues[k] = (DEFAULT_PARAMS as any)[k]; });
    
    // UPDATED: Clear modulations for keys in this section
    const targetParams = (selectedStrokeIds.size > 0 && selectedStrokeParams) ? selectedStrokeParams : brushParams;
    const newMods = { ...(targetParams.modulations || {}) };
    let modsModified = false;
    
    keys.forEach(k => {
        if (newMods[k as keyof SimulationParams]) {
            delete newMods[k as keyof SimulationParams];
            modsModified = true;
        }
    });

    if (selectedStrokeIds.size > 0 && selectedStrokeParams) { 
        const updated = { ...selectedStrokeParams }; 
        for (const k in newValues) { (updated as any)[k] = newValues[k]; }
        if (modsModified) updated.modulations = newMods;
        
        setSelectedStrokeParams(updated); 
        
        // Sync values
        canvasRef.current?.updateSelectedParams(newValues);
        // Sync cleared modulations if needed
        if (modsModified) {
            keys.forEach(k => {
                 canvasRef.current?.updateSelectedParams({ key: k, value: undefined, modulation: true });
            });
        }
    } else {
        setBrushParams(prev => ({ ...prev, ...newValues, modulations: modsModified ? newMods : prev.modulations }));
    }
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
    if (selectedStrokeIds.size > 0 && selectedStrokeParams) {
        setSelectedStrokeParams(prev => prev ? ({ ...prev, ...newValues }) : null);
        canvasRef.current?.updateSelectedParams(newValues);
    } else {
        setBrushParams(prev => ({ ...prev, ...newValues }));
    }
    setActivePresetName(null);
  };

  const syncSelected = () => {
      if (selectedStrokeParams) {
          canvasRef.current?.syncSelectedParams(selectedStrokeParams);
      }
  };

  const handleSelection = useCallback((
      strokeIds: string[] | string | null, 
      strokeParams: SimulationParams | null, 
      strokeSound: SoundConfig | null,
      connectionIds: string[] | string | null, 
      connectionParams: Connection | null
  ) => {
    if (embedMode) return;
    if (Array.isArray(strokeIds)) {
       setSelectedStrokeIds(new Set(strokeIds));
       if (strokeIds.length > 0) {
           setSelectedStrokeId(strokeIds[strokeIds.length - 1]);
           setSelectedStrokeParams(strokeParams);
           setSelectedStrokeSound(strokeSound);
       } else {
           setSelectedStrokeId(null);
           setSelectedStrokeParams(null);
           setSelectedStrokeSound(null);
       }
    } else if (strokeIds === null) {
       setSelectedStrokeIds(new Set());
       setSelectedStrokeId(null);
       setSelectedStrokeParams(null);
       setSelectedStrokeSound(null);
    } else {
       setSelectedStrokeIds(new Set([strokeIds]));
       setSelectedStrokeId(strokeIds);
       setSelectedStrokeParams(strokeParams);
       setSelectedStrokeSound(strokeSound);
    }
    if (Array.isArray(connectionIds)) {
        setSelectedConnectionIds(new Set(connectionIds));
        if (connectionIds.length > 0) {
            setSelectedConnectionParams(connectionParams);
        } else {
            setSelectedConnectionParams(null);
        }
    } else if (connectionIds === null) {
        setSelectedConnectionIds(new Set());
        setSelectedConnectionParams(null);
    } else {
        setSelectedConnectionIds(new Set([connectionIds]));
        setSelectedConnectionParams(connectionParams);
    }
    const hasSelection = (Array.isArray(strokeIds) ? strokeIds.length > 0 : !!strokeIds) || 
                         (Array.isArray(connectionIds) ? connectionIds.length > 0 : !!connectionIds);
    if (hasSelection) {
        setShowSettings(true);
    }
  }, [embedMode]);

  const handleSaveConfirm = (name: string) => {
    if (!canvasRef.current) return;
    const data = canvasRef.current.exportData(); 
    const json = JSON.stringify(data, null, 2); 
    const blob = new Blob([json], { type: 'application/json' }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); a.href = url; a.download = `${name}.json`; document.body.appendChild(a); 
    setTimeout(() => { a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  };

  const handleCopyJson = () => {
    if (!canvasRef.current) return;
    const data = canvasRef.current.exportData();
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).catch(err => console.error('Failed to copy json', err));
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); if (canvasRef.current) canvasRef.current.importData(data); } catch (err) { alert("Invalid JSON"); } }; reader.readAsText(file); e.target.value = ''; };
  
  const saveNewPreset = (name: string, desc: string) => { 
      if (!name.trim()) return; 
      const current = selectedStrokeId && selectedStrokeParams ? selectedStrokeParams : brushParams; 
      setPresets(prev => [...prev, { name: name.trim(), description: desc.trim(), params: { ...current } }]); 
  };
  const deletePreset = (index: number) => { if (confirm("Delete this preset?")) setPresets(prev => prev.filter((_, i) => i !== index)); };
  
  const loadPreset = (params: SimulationParams, name: string) => { 
      if (selectedStrokeIds.size > 0) {
          setSelectedStrokeParams({ ...params }); 
          canvasRef.current?.syncSelectedParams(params);
      } else { 
          setBrushParams({ ...params }); 
      }
      setActivePresetName(name);
  };
  
  const restoreDefaultPresets = () => {
      if (confirm("Reset default presets? \n\nThis will restore the original factory presets. Your custom presets (those with unique names) will be preserved.")) {
          const defaultNames = new Set(DEFAULT_PRESETS.map(p => p.name));
          const userPresets = presets.filter(p => !defaultNames.has(p.name));
          setPresets([...DEFAULT_PRESETS, ...userPresets]);
      }
  };
  
  const exportPresets = () => { 
    try {
        const json = JSON.stringify(presets, null, 2); 
        const blob = new Blob([json], { type: 'application/json' }); 
        const url = URL.createObjectURL(blob); 
        const a = document.createElement('a'); a.href = url; a.download = `aura-flow-presets.json`; document.body.appendChild(a);
        setTimeout(() => { a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    } catch (err) {}
  };

  const triggerImportPresets = () => presetFileInputRef.current?.click();
  const handleImportPresets = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); if (Array.isArray(data)) setPresets(prev => [...prev, ...data]); } catch (err) {} }; reader.readAsText(file); e.target.value = ''; };

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
          
          // Auto-enable sound engine if user uploads a sound
          toggleSoundEngine(true);

          if (!selectedStrokeId) { 
              setBrushSound(prev => ({...prev, bufferId, enabled: true})); 
          } else { 
              setSelectedStrokeSound(prev => prev ? ({...prev, bufferId, enabled: true}) : null); 
          } 
      }; 
      reader.readAsArrayBuffer(file); 
      e.target.value = ''; 
  };
  
  const handleBufferReady = (buffer: AudioBuffer) => { 
      const bufferId = `rec-${Date.now()}`; 
      audioManager.addBuffer(bufferId, buffer); 
      
      toggleSoundEngine(true);

      if (!selectedStrokeId) { 
          setBrushSound(prev => ({...prev, bufferId, enabled: true})); 
      } else { 
          setSelectedStrokeSound(prev => prev ? ({...prev, bufferId, enabled: true}) : null); 
      } 
  };
  
  const removeSound = () => { if (selectedStrokeId) { setSelectedStrokeSound(prev => prev ? ({...prev, bufferId: null, enabled: false}) : null); } else { setBrushSound(prev => ({...prev, bufferId: null, enabled: false})); } };

  const setForceTool = (tool: GlobalForceType) => { if (tool !== 'none') { setInteractionMode('draw'); } setGlobalForceTool(tool); };

  const currentParams = (selectedStrokeIds.size > 0 && selectedStrokeParams) ? selectedStrokeParams : brushParams;

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

  return (
    <div 
       className="relative w-full h-[100dvh] overflow-hidden text-slate-800 transition-all duration-300"
       onContextMenu={handleContextMenu}
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

      {loadingError && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-50/95 backdrop-blur-sm p-6 text-center">
              <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm border border-red-100">
                  <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
                  <h3 className="font-bold text-red-600 text-lg mb-2">Embed Error</h3>
                  <p className="text-slate-600 text-xs mb-4">{loadingError}</p>
                  <button 
                      onClick={() => window.location.reload()} 
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-2 mx-auto"
                  >
                      <RotateCcw size={12} /> Reload
                  </button>
              </div>
          </div>
      )}

      <Canvas 
        ref={canvasRef}
        brushParams={brushParams}
        brushSound={brushSound}
        gridConfig={gridConfig}
        symmetryConfig={symmetryConfig}
        selectedStrokeId={selectedStrokeId}
        selectedStrokeIds={selectedStrokeIds}
        selectedConnectionIds={selectedConnectionIds}
        isPlaying={isPlaying}
        isSoundEngineEnabled={isSoundEngineEnabled}
        isMicEnabled={isMicEnabled}
        interactionMode={interactionMode}
        selectionFilter={selectionFilter} 
        globalForceTool={globalForceTool}
        globalToolConfig={globalToolConfig}
        ecoMode={ecoMode}
        embedFit={embedFit} 
        embedZoom={embedZoom} 
        onStrokeSelect={handleSelection}
        clearTrigger={clearTrigger}
        deleteSelectedTrigger={deleteSelectedTrigger}
        undoTrigger={undoTrigger}
        redoTrigger={redoTrigger}
        resetPosTrigger={resetPosTrigger}
        deleteAllLinksTrigger={deleteAllLinksTrigger}
        selectAllTrigger={selectAllTrigger}
        onCanvasInteraction={() => setShowPalette(false)}
      />

      {!embedMode && (
        <>
          <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 w-auto z-20 flex justify-center pointer-events-none">
            <Palette 
              show={showPalette} 
              onClose={() => setShowPalette(false)} 
              colors={paletteColors} 
              activeColor={currentParams.color} 
              onSelectColor={(c) => updateParam('color', c)}
              onUpdateColor={updatePaletteColor}
              theme={uiTheme}
            />

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
              <div className="relative flex items-center">
                  <IconButton icon={<MousePointer2 size={18} />} onClick={() => { setInteractionMode('select'); setGlobalForceTool('none'); }} active={interactionMode === 'select' && globalForceTool === 'none'} label="Select" />
              </div>
              
              <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0" />
              <div className="relative shrink-0">
                <button onClick={() => setShowPalette(!showPalette)} className="w-10 h-10 rounded-full border border-slate-200 shadow-sm flex items-center justify-center transition-transform hover:scale-105 active:scale-95" style={{ backgroundColor: currentParams.color }}>
                    <div className="w-full h-full rounded-full ring-1 ring-inset ring-black/5" />
                </button>
              </div>
              <IconButton icon={<Settings size={20} />} onClick={() => setShowSettings(!showSettings)} active={showSettings} label="Settings" className={selectedStrokeId || selectedConnectionIds.size > 0 ? "ring-2 ring-indigo-500/50" : ""} />
              <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0" />
              <IconButton icon={isMicEnabled ? <Mic size={18} className="text-red-500 animate-pulse" /> : <MicOff size={18} />} onClick={toggleMic} active={isMicEnabled} label="Mic Reactivity" />
              <IconButton icon={isPlaying ? <Pause size={18} /> : <Play size={18} />} onClick={() => setIsPlaying(!isPlaying)} active={isPlaying} label={isPlaying ? "Pause" : "Play"} />
              <IconButton icon={isSoundEngineEnabled ? <Speaker size={18} /> : <VolumeX size={18} />} onClick={() => toggleSoundEngine()} active={isSoundEngineEnabled} label={isSoundEngineEnabled ? "Sound ON" : "Sound OFF"} />
              <div className="w-px h-6 bg-slate-300/50 mx-1 shrink-0 hidden md:block" />
              <IconButton icon={<Undo size={18} />} onClick={() => setUndoTrigger(t => t + 1)} label="Undo" className="hidden md:flex" />
              <IconButton icon={<Redo size={18} />} onClick={() => setRedoTrigger(t => t + 1)} label="Redo" className="hidden md:flex" />
              <IconButton icon={<Trash2 size={18} />} onClick={() => { setClearTrigger(c => c + 1); setSelectedStrokeIds(new Set()); setSelectedStrokeId(null); setSelectedConnectionIds(new Set()); }} label="Clear" />
            </div>
          </div>

          <SettingsPanel
            theme={uiTheme}
            setTheme={setUiTheme}
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            
            selectedStrokeId={selectedStrokeId}
            brushParams={brushParams}
            selectedStrokeParams={selectedStrokeParams}
            brushSound={brushSound}
            selectedStrokeSound={selectedStrokeSound}
            gridConfig={gridConfig}
            symmetryConfig={symmetryConfig}
            globalForceTool={globalForceTool}
            globalToolConfig={globalToolConfig}
            presets={presets}
            activePresetName={activePresetName}
            lockedParams={lockedParams}
            
            selectedConnectionIds={selectedConnectionIds}
            selectedConnectionParams={selectedConnectionParams}
            updateConnectionParam={updateConnectionParam}

            ecoMode={ecoMode}
            setEcoMode={setEcoMode}

            selectionFilter={selectionFilter}
            setSelectionFilter={setSelectionFilter}

            setSelectedStrokeId={(id) => { 
                if (id) {
                    setSelectedStrokeId(id);
                    setSelectedStrokeIds(new Set([id]));
                } else {
                    setSelectedStrokeId(null);
                    setSelectedStrokeIds(new Set());
                }
            }}
            setSelectedStrokeParams={setSelectedStrokeParams}
            updateParam={updateParam}
            resetParam={resetParam}
            updateFill={updateFill}
            updateFillGradient={updateFillGradient}
            updateGradient={updateGradient}
            addGradientColor={addGradientColor}
            removeGradientColor={removeGradientColor}
            updateGradientColor={updateGradientColor}
            updateSound={updateSound}
            updateModulation={updateModulation}
            
            setGridConfig={setGridConfig}
            setSymmetryConfig={setSymmetryConfig}
            setForceTool={setForceTool}
            setGlobalToolConfig={setGlobalToolConfig}
            
            resetSection={resetSection}
            randomizeSection={randomizeSection}
            toggleLock={toggleLock}
            
            initiateSave={initiateSave}
            onCopyJson={handleCopyJson} 
            triggerImportProject={triggerImportProject}
            setResetPosTrigger={setResetPosTrigger}
            setDeleteSelectedTrigger={setDeleteSelectedTrigger}
            setDeleteAllLinksTrigger={setDeleteAllLinksTrigger}
            savePresetTrigger={savePresetTrigger}

            loadPreset={loadPreset}
            deletePreset={deletePreset}
            saveNewPreset={saveNewPreset}
            exportPresets={exportPresets}
            exportSinglePreset={exportSinglePreset}
            triggerImportPresets={triggerImportPresets}
            restoreDefaultPresets={restoreDefaultPresets}

            handleSoundUpload={handleSoundUpload}
            handleBufferReady={handleBufferReady}
            removeSound={removeSound}
            
            onSyncSelected={syncSelected}
          />
        </>
      )}
    </div>
  );
}
