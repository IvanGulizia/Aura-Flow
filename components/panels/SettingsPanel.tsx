import React, { useState, useRef, useEffect } from 'react';
import { 
  Edit3, Zap, Trash2, Save, FolderOpen, Anchor, Grid3X3, SplitSquareHorizontal, 
  Filter, Info, X, Users, PaintBucket, Link2, Link2Off, MinusCircle, Plus, 
  Palette, Spline as SplineIcon, Move, Magnet, Tornado, Network, Eye, EyeOff, 
  Unplug, Globe, Upload, Check, RefreshCw, Shuffle
} from 'lucide-react';
import { 
  SimulationParams, SoundConfig, GridConfig, SymmetryConfig, GlobalForceType, 
  GlobalToolConfig, Preset, UITheme, ModulationConfig, BlendMode, 
  LineCapMode, SoundVolumeSource, SoundPlaybackMode, EasingMode 
} from '../../types';
import { 
  DEFAULT_PARAMS, DEFAULT_SOUND, PARAMS_GROUPS, PARAM_RANGES, PARAM_DESCRIPTIONS, 
  DEFAULT_PRESETS, BLEND_MODES, SOUND_VOLUME_SOURCES 
} from '../../constants/defaults';
import { PanelButton, SoundRecorder } from '../IconButtons';
import { Slider, Select, Toggle, SectionHeader, ColorInput } from '../ui/Controls';

interface SettingsPanelProps {
  theme: UITheme;
  isOpen: boolean;
  onClose?: () => void;
  
  // State
  selectedStrokeId: string | null;
  brushParams: SimulationParams;
  selectedStrokeParams: SimulationParams | null;
  brushSound: SoundConfig;
  selectedStrokeSound: SoundConfig | null;
  gridConfig: GridConfig;
  symmetryConfig: SymmetryConfig;
  globalForceTool: GlobalForceType;
  globalToolConfig: GlobalToolConfig;
  presets: Preset[];
  activePresetName: string | null;
  lockedParams: Set<string>;

  // Setters / Actions
  setSelectedStrokeId: (id: string | null) => void;
  setSelectedStrokeParams: (params: SimulationParams | null) => void;
  updateParam: (key: keyof SimulationParams, value: any) => void;
  resetParam: (key: keyof SimulationParams) => void;
  updateFill: (updates: Partial<SimulationParams['fill']>) => void;
  updateFillGradient: (updates: Partial<SimulationParams['fill']['gradient']>) => void;
  updateGradient: (updates: Partial<SimulationParams['gradient']>) => void;
  addGradientColor: () => void;
  removeGradientColor: (index: number) => void;
  updateGradientColor: (index: number, color: string) => void;
  updateSound: (key: keyof SoundConfig, value: any) => void;
  updateModulation: (key: keyof SimulationParams, config: ModulationConfig | undefined) => void;
  
  setGridConfig: React.Dispatch<React.SetStateAction<GridConfig>>;
  setSymmetryConfig: React.Dispatch<React.SetStateAction<SymmetryConfig>>;
  setForceTool: (tool: GlobalForceType) => void;
  setGlobalToolConfig: React.Dispatch<React.SetStateAction<GlobalToolConfig>>;
  
  resetSection: (section: keyof typeof PARAMS_GROUPS) => void;
  randomizeSection: (section: keyof typeof PARAMS_GROUPS) => void;
  toggleLock: (key: string) => void;
  
  // Project Actions
  initiateSave: () => void;
  triggerImportProject: () => void;
  setResetPosTrigger: React.Dispatch<React.SetStateAction<number>>;
  setDeleteSelectedTrigger: React.Dispatch<React.SetStateAction<number>>;
  setDeleteAllLinksTrigger: React.Dispatch<React.SetStateAction<number>>;
  
  // Presets
  loadPreset: (params: SimulationParams, name: string) => void;
  deletePreset: (index: number) => void;
  saveNewPreset: (name: string, desc: string) => void;
  exportPresets: () => void;
  triggerImportPresets: () => void;

  // Sound
  handleSoundUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBufferReady: (buffer: AudioBuffer) => void;
  removeSound: () => void;
}

const SidebarSeparator = ({ theme }: { theme: UITheme }) => (
   <div className="w-[calc(100%+2.5rem)] -mx-5 my-1" style={{ height: `${theme.separatorWidth}px`, backgroundColor: theme.separatorColor }} />
);

export const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
  const { theme, isOpen, selectedStrokeId, selectedStrokeParams, brushParams, presets, activePresetName } = props;
  
  // Internal State for Panel UI
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSide, setPanelSide] = useState<'left' | 'right'>('right');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panelTop, setPanelTop] = useState(24);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  
  // Sections State
  const [sections, setSections] = useState({
    project: false, guides: false, presets: true, physics: false, visuals: false, 
    shape: false, social: false, audio: false, soundDesign: false, globalTools: false, 
  });
  
  // Preset Naming State
  const [isNamingPreset, setIsNamingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");

  // Derived Values
  const currentParams = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
  const currentSound = (selectedStrokeId && props.selectedStrokeSound) ? props.selectedStrokeSound : props.brushSound;
  const modeTitle = selectedStrokeId ? "Editing Selection" : "Settings";

  // --- HELPERS ---
  const toggleSection = (key: keyof typeof sections) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

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

  const getCommonProps = (key: keyof SimulationParams) => ({ 
      isLocked: props.lockedParams.has(key), 
      onToggleLock: () => props.toggleLock(key), 
      description: PARAM_DESCRIPTIONS[key], 
      modulation: currentParams.modulations?.[key], 
      onModulationChange: (cfg: ModulationConfig | undefined) => props.updateModulation(key, cfg),
      onReset: () => props.resetParam(key),
      isModified: shouldShow(key) 
  });

  // --- DRAG LOGIC ---
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

  // Auto-expand modified sections
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
  }, [showModifiedOnly, currentParams]); 

  if (!isOpen) return null;

  const currentTop = isDraggingPanel ? dragOffset.y : panelTop;

  return (
    <div 
      ref={panelRef}
      className={`w-80 flex flex-col overflow-hidden ${!isDraggingPanel ? 'transition-all duration-500 ease-out' : ''}`}
      style={{ 
        background: `rgba(${parseInt(theme.menuBg.slice(1,3),16)}, ${parseInt(theme.menuBg.slice(3,5),16)}, ${parseInt(theme.menuBg.slice(5,7),16)}, ${theme.menuOpacity})`,
        backdropFilter: `blur(${theme.menuBlur}px)`,
        borderRadius: '1.5rem',
        border: `${theme.menuBorderWidth}px solid ${theme.menuBorderColor}`,
        boxShadow: theme.menuShadow,
        color: theme.menuText,
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
              <button onClick={() => props.setDeleteSelectedTrigger(t => t + 1)} className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                <Trash2 size={14} />
              </button>
              <button onClick={() => { props.setSelectedStrokeId(null); props.setSelectedStrokeParams(null); }} className="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-full font-bold hover:bg-indigo-700 shadow-md transition-colors">
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
                        <PanelButton onClick={props.initiateSave} label="SAVE PROJ" icon={<Save size={10} />} />
                        <PanelButton onClick={props.triggerImportProject} label="LOAD PROJ" icon={<FolderOpen size={10} />} />
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <PanelButton onClick={() => props.setResetPosTrigger(t => t+1)} label="RESET POSITIONS" icon={<Anchor size={10} />} className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100" />
                    </div>
              </div>
          )}
          <SidebarSeparator theme={theme} />
          
          <SectionHeader title="Guides & Symmetry" isOpen={sections.guides} onToggle={() => toggleSection('guides')} />
          {sections.guides && (
            <div className="pb-4 space-y-3">
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"><Grid3X3 size={12} /> Modular Grid</div>
                    <Toggle label="" value={props.gridConfig.enabled} onChange={(v) => props.setGridConfig(p => ({...p, enabled: v}))} />
                  </div>
                  {props.gridConfig.enabled && (
                    <div className="animate-fade-in-up space-y-2">
                        <div className="flex gap-2 mb-2">
                            <PanelButton onClick={() => props.setGridConfig(p => ({...p, visible: !p.visible}))} label={props.gridConfig.visible ? "HIDE POINTS" : "SHOW POINTS"} active={props.gridConfig.visible} />
                            <PanelButton onClick={() => props.setGridConfig(p => ({...p, snap: !p.snap}))} label={props.gridConfig.snap ? "SNAP ON" : "SNAP OFF"} active={props.gridConfig.snap} />
                        </div>
                        {shouldShow('pathRounding') && <Slider label="Roundness" value={currentParams.pathRounding} min={0} max={1} step={0.01} onChange={(v) => props.updateParam('pathRounding', v)} {...getCommonProps('pathRounding')} />}
                        <Slider label="Cell Size" value={props.gridConfig.size} min={20} max={200} step={10} onChange={(v) => props.setGridConfig(p => ({...p, size: v}))} />
                        <Slider label="Opacity" value={props.gridConfig.opacity} min={0.1} max={1} step={0.1} onChange={(v) => props.setGridConfig(p => ({...p, opacity: v}))} />
                    </div>
                  )}
                </div>
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"><SplitSquareHorizontal size={12} /> Symmetry</div>
                    <Toggle label="" value={props.symmetryConfig.enabled} onChange={(v) => props.setSymmetryConfig(p => ({...p, enabled: v}))} />
                  </div>
                  {props.symmetryConfig.enabled && (
                      <div className="animate-fade-in-up space-y-2">
                          <Select label="Type" value={props.symmetryConfig.type} options={['horizontal', 'vertical', 'quad', 'radial']} onChange={(v) => props.setSymmetryConfig(p => ({...p, type: v as any}))} />
                          {props.symmetryConfig.type === 'radial' && ( <Slider label="Count" value={props.symmetryConfig.count} min={2} max={12} step={1} onChange={(v) => props.setSymmetryConfig(p => ({...p, count: v}))} /> )}
                          <Toggle label="Show Guides" value={props.symmetryConfig.visible} onChange={(v) => props.setSymmetryConfig(p => ({...p, visible: v}))} />
                      </div>
                  )}
                </div>
            </div>
          )}
          <SidebarSeparator theme={theme} />
          
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
                      <button onClick={() => props.loadPreset(p.params, p.name)} className={`flex items-center gap-2 px-3 py-1.5 border text-[10px] font-bold uppercase rounded-lg transition-all shadow-sm ${activePresetName === p.name ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'}`} >
                        {p.name}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); props.deletePreset(idx); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-[8px] z-10" > <X size={8} /> </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mb-4">
                    <PanelButton onClick={props.exportPresets} label="EXPORT ALL" icon={<Save size={10} />} />
                    <PanelButton onClick={props.triggerImportPresets} label="IMPORT" icon={<FolderOpen size={10} />} />
                </div>
                {isNamingPreset ? (
                  <div className="flex flex-col gap-2 animate-fade-in-up bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Preset Name..." autoFocus />
                      <textarea value={newPresetDesc} onChange={(e) => setNewPresetDesc(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-16" placeholder="Description (optional)..." />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setIsNamingPreset(false); setNewPresetName(""); }} className="bg-slate-200 text-slate-600 px-3 py-1 text-[10px] font-bold rounded hover:bg-slate-300">CANCEL</button>
                        <button onClick={() => { props.saveNewPreset(newPresetName, newPresetDesc); setIsNamingPreset(false); setNewPresetName(""); }} className="bg-indigo-600 text-white px-3 py-1 text-[10px] font-bold rounded hover:bg-indigo-700">SAVE</button>
                      </div>
                  </div>
                ) : (
                  <PanelButton onClick={() => { setIsNamingPreset(true); setNewPresetName(`Preset ${presets.length + 1}`); }} label="SAVE CURRENT AS PRESET" icon={<Save size={10} />} />
                )}
            </div>
          )}
          <SidebarSeparator theme={theme} />
          
          {(isGroupModified('physics') || !showModifiedOnly) && (
            <>
                <SectionHeader title="Physics" isOpen={sections.physics} onToggle={() => toggleSection('physics')} onReset={() => props.resetSection('physics')} onRandom={() => props.randomizeSection('physics')} />
                {sections.physics && (
                    <div className="pb-4 space-y-1">
                    {shouldShow('mass') && <Slider label="Mass" value={currentParams.mass} min={0.1} max={5} step={0.1} onChange={(v) => props.updateParam('mass', v)} {...getCommonProps('mass')} />}
                    {shouldShow('friction') && <Slider label="Friction" value={currentParams.friction} min={0.5} max={0.99} step={0.01} onChange={(v) => props.updateParam('friction', v)} {...getCommonProps('friction')} />}
                    {shouldShow('elasticity') && <Slider label="Elasticity" value={currentParams.elasticity} min={0} max={0.5} step={0.001} onChange={(v) => props.updateParam('elasticity', v)} {...getCommonProps('elasticity')} />}
                    {shouldShow('maxDisplacement') && <Slider label="Max Displacement" value={currentParams.maxDisplacement} min={0} max={1000} step={1} onChange={(v) => props.updateParam('maxDisplacement', v)} {...getCommonProps('maxDisplacement')} />}
                    {shouldShow('viscosity') && <Slider label="Viscosity" value={currentParams.viscosity} min={0} max={1} step={0.01} onChange={(v) => props.updateParam('viscosity', v)} {...getCommonProps('viscosity')} />}
                    {shouldShow('tension') && <Slider label="Tension" value={currentParams.tension} min={0} max={5} step={0.1} onChange={(v) => props.updateParam('tension', v)} {...getCommonProps('tension')} />}
                    {shouldShow('gravityX') && <Slider label="Gravity X" value={currentParams.gravityX} min={-0.5} max={0.5} step={0.01} onChange={(v) => props.updateParam('gravityX', v)} {...getCommonProps('gravityX')} />}
                    {shouldShow('gravityY') && <Slider label="Gravity Y" value={currentParams.gravityY} min={-0.5} max={0.5} step={0.01} onChange={(v) => props.updateParam('gravityY', v)} {...getCommonProps('gravityY')} />}
                    </div>
                )}
                <SidebarSeparator theme={theme} />
            </>
          )}
          
          {(isGroupModified('visuals') || !showModifiedOnly) && (
            <>
              <SectionHeader title="Visuals" isOpen={sections.visuals} onToggle={() => toggleSection('visuals')} onReset={() => props.resetSection('visuals')} onRandom={() => props.randomizeSection('visuals')} />
              {sections.visuals && (
                <div className="pb-4 space-y-2">
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                    {shouldShow('strokeWidth') && <Slider label="Width" value={currentParams.strokeWidth} min={0} max={30} step={0.5} onChange={(v) => props.updateParam('strokeWidth', v)} {...getCommonProps('strokeWidth')} />}
                    {shouldShow('opacity') && <Slider label="Opacity" value={currentParams.opacity} min={0} max={1} step={0.01} onChange={(v) => props.updateParam('opacity', v)} {...getCommonProps('opacity')} />}
                    {shouldShow('blendMode') && <Select label="Blend Mode" value={currentParams.blendMode} options={BLEND_MODES} onChange={(v) => props.updateParam('blendMode', v as BlendMode)} {...getCommonProps('blendMode')} />}
                    {shouldShow('lineCap') && <Select label="Line Cap" value={currentParams.lineCap || 'round'} options={['round', 'butt', 'square']} onChange={(v) => props.updateParam('lineCap', v as LineCapMode)} description="End style of the stroke" />}
                    {shouldShow('seamlessPath') && <Toggle label="Seamless Path" value={currentParams.seamlessPath} onChange={(v) => props.updateParam('seamlessPath', v)} />}
                    {shouldShow('smoothModulation') && <Toggle label="Smooth Modulation" description={PARAM_DESCRIPTIONS['smoothModulation']} value={currentParams.smoothModulation} onChange={(v) => props.updateParam('smoothModulation', v)} />}
                    {shouldShow('drawPoints') && <Toggle label="Draw Points" description={PARAM_DESCRIPTIONS['drawPoints']} value={currentParams.drawPoints} onChange={(v) => props.updateParam('drawPoints', v)} />}
                    {shouldShow('hueShift') && <Slider label="Hue Shift" value={currentParams.hueShift || 0} min={0} max={360} step={1} onChange={(v) => props.updateParam('hueShift', v)} {...getCommonProps('hueShift')} />}
                </div>

                {shouldShow('fill') && (
                    <div className="bg-pink-50/50 p-3 rounded-xl border border-pink-100/50">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-pink-500"><PaintBucket size={12} /> Fill Mode</div>
                            <Toggle label="" value={currentParams.fill?.enabled || false} onChange={(v) => props.updateFill({ enabled: v })} />
                        </div>
                        {currentParams.fill?.enabled && (
                            <div className="animate-fade-in-up space-y-2">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"> {currentParams.fill.syncWithStroke ? <Link2 size={10} /> : <Link2Off size={10} />} Sync Gradient </span>
                                    <Toggle label="" value={currentParams.fill.syncWithStroke} onChange={(v) => props.updateFill({ syncWithStroke: v })} />
                                </div>
                                {shouldShow('fill', currentParams.fill.blendMode, DEFAULT_PARAMS.fill.blendMode) && <Select label="Fill Blend Mode" value={currentParams.fill.blendMode || 'source-over'} options={BLEND_MODES} onChange={(v) => props.updateFill({ blendMode: v as BlendMode })} />}
                                {shouldShow('fill', currentParams.fill.opacity, DEFAULT_PARAMS.fill.opacity) && <Slider label="Fill Opacity" value={currentParams.fill.opacity} min={0} max={1} step={0.01} onChange={(v) => props.updateFill({ opacity: v })} />}
                                {shouldShow('fill', currentParams.fill.blur, DEFAULT_PARAMS.fill.blur) && <Slider label="Fill Blur" value={currentParams.fill.blur || 0} min={0} max={50} step={1} onChange={(v) => props.updateFill({ blur: v })} />}
                                <Toggle label="Fill Glow" value={currentParams.fill.glow || false} onChange={(v) => props.updateFill({ glow: v })} description="Apply glow effect to the filled area" />
                                {!currentParams.fill.syncWithStroke && (
                                    <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">Type</span>
                                        <div className="flex bg-slate-200 rounded p-0.5">
                                        <button onClick={() => props.updateFill({ type: 'solid' })} className={`px-2 py-0.5 rounded text-[9px] font-bold ${currentParams.fill.type !== 'gradient' ? 'bg-white shadow text-pink-600' : 'text-slate-500'}`}>Solid</button>
                                        <button onClick={() => props.updateFill({ type: 'gradient' })} className={`px-2 py-0.5 rounded text-[9px] font-bold ${currentParams.fill.type === 'gradient' ? 'bg-white shadow text-pink-600' : 'text-slate-500'}`}>Gradient</button>
                                        </div>
                                    </div>
                                    {currentParams.fill.type === 'gradient' ? (
                                        <div className="space-y-2 p-2 bg-white/50 rounded-lg border border-pink-200">
                                            <div className="space-y-1">
                                              {currentParams.fill.gradient.colors.map((c, i) => (
                                                <ColorInput key={i} label={`Stop ${i+1}`} val={c} onChange={(v) => {
                                                    const newColors = [...currentParams.fill.gradient.colors];
                                                    newColors[i] = v;
                                                    props.updateFillGradient({ colors: newColors });
                                                }} />
                                              ))}
                                            </div>
                                            <Slider label="Angle" value={currentParams.fillGradientAngle} min={0} max={360} step={1} onChange={(v) => props.updateParam('fillGradientAngle', v)} {...getCommonProps('fillGradientAngle')} />
                                        </div>
                                    ) : (
                                        <>
                                        <Select label="Color Source" value={currentParams.fill.colorSource} options={['stroke', 'custom']} onChange={(v) => props.updateFill({ colorSource: v as any })} />
                                        {currentParams.fill.colorSource === 'custom' && ( <ColorInput label="Custom Color" val={currentParams.fill.customColor} onChange={(v) => props.updateFill({ customColor: v })} /> )}
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
                            <Toggle label="" value={currentParams.gradient?.enabled || false} onChange={(v) => props.updateGradient({ enabled: v })} />
                        </div>
                        {currentParams.gradient?.enabled && (
                            <div className="animate-fade-in-up space-y-2">
                                <Select label="Gradient Type" value={currentParams.strokeGradientType || 'linear'} options={['linear', 'path']} onChange={(v) => props.updateParam('strokeGradientType', v as any)} description={PARAM_DESCRIPTIONS['strokeGradientType']} />
                                <div className="space-y-1 bg-white/50 p-2 rounded-lg border border-sky-100">
                                    {currentParams.gradient.colors.map((c, i) => (
                                        <div key={i} className="flex items-center gap-1">
                                            <div className="flex-1"><ColorInput label={`Color ${i+1}`} val={c} onChange={(v) => props.updateGradientColor(i, v)} /></div>
                                            {currentParams.gradient.colors.length > 2 && (
                                                <button onClick={() => props.removeGradientColor(i)} className="text-red-400 hover:text-red-600 transition-colors"><MinusCircle size={12} /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={props.addGradientColor} className="w-full flex items-center justify-center py-1 mt-1 bg-sky-100/50 hover:bg-sky-200/50 text-sky-600 rounded-md text-[8px] font-bold transition-all"><Plus size={10} /> ADD COLOR</button>
                                </div>
                                {currentParams.strokeGradientType === 'linear' && (
                                    <>
                                    <Slider label="Angle" value={currentParams.strokeGradientAngle} min={0} max={360} step={1} onChange={(v) => props.updateParam('strokeGradientAngle', v)} {...getCommonProps('strokeGradientAngle')} />
                                    <Slider label="Midpoint" value={currentParams.strokeGradientMidpoint || 0.5} min={0} max={1} step={0.01} onChange={(v) => props.updateParam('strokeGradientMidpoint', v)} {...getCommonProps('strokeGradientMidpoint')} />
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {shouldShow('glowStrength') && <Slider label="Glow Strength" value={currentParams.glowStrength} min={0} max={50} step={1} onChange={(v) => props.updateParam('glowStrength', v)} {...getCommonProps('glowStrength')} />}
                {shouldShow('blurStrength') && <Slider label="Blur Strength" value={currentParams.blurStrength} min={0} max={20} step={0.1} onChange={(v) => props.updateParam('blurStrength', v)} {...getCommonProps('blurStrength')} />}
                </div>
              )}
              <SidebarSeparator theme={theme} />
            </>
          )}
          
          {(isGroupModified('shape') || !showModifiedOnly) && (
            <>
              <SectionHeader title="Shape & Motion" isOpen={sections.shape} onToggle={() => toggleSection('shape')} onReset={() => props.resetSection('shape')} onRandom={() => props.randomizeSection('shape')} />
              {sections.shape && (
                <div className="pb-4 space-y-1">
                {shouldShow('segmentation') && <Slider label="Resolution" value={currentParams.segmentation} min={2} max={50} step={1} onChange={(v) => props.updateParam('segmentation', v)} {...getCommonProps('segmentation')} />}
                {(!showModifiedOnly || [shouldShow('closePath'), shouldShow('closePathRadius')].some(Boolean)) && (
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 my-2">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"> <SplineIcon size={12} /> Auto Close </div>
                            <Toggle label="" value={currentParams.closePath} onChange={(v) => props.updateParam('closePath', v)} />
                        </div>
                        {currentParams.closePath && ( <div className="animate-fade-in-up"> <Slider label="Snap Radius" value={currentParams.closePathRadius} min={10} max={200} step={10} onChange={(v) => props.updateParam('closePathRadius', v)} {...getCommonProps('closePathRadius')} /> </div> )}
                    </div>
                )}
                {(!showModifiedOnly || [shouldShow('wiggleAmplitude'), shouldShow('wiggleFrequency'), shouldShow('waveSpeed')].some(Boolean)) && (
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 my-2">
                        <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Wiggle</div>
                        {shouldShow('wiggleAmplitude') && <Slider label="Amplitude" value={currentParams.wiggleAmplitude} min={0} max={20} step={0.1} onChange={(v) => props.updateParam('wiggleAmplitude', v)} {...getCommonProps('wiggleAmplitude')} />}
                        {shouldShow('wiggleFrequency') && <Slider label="Frequency" value={currentParams.wiggleFrequency} min={0.01} max={0.5} step={0.01} onChange={(v) => props.updateParam('wiggleFrequency', v)} {...getCommonProps('wiggleFrequency')} />}
                        {shouldShow('waveSpeed') && <Slider label="Speed" value={currentParams.waveSpeed} min={0} max={0.5} step={0.01} onChange={(v) => props.updateParam('waveSpeed', v)} {...getCommonProps('waveSpeed')} />}
                    </div>
                )}
                {(!showModifiedOnly || [shouldShow('breathingAmp'), shouldShow('breathingFreq')].some(Boolean)) && (
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Breathing</div>
                        {shouldShow('breathingAmp') && <Slider label="Amplitude" value={currentParams.breathingAmp} min={0} max={10} step={0.1} onChange={(v) => props.updateParam('breathingAmp', v)} {...getCommonProps('breathingAmp')} />}
                        {shouldShow('breathingFreq') && <Slider label="Frequency" value={currentParams.breathingFreq} min={0.01} max={0.2} step={0.01} onChange={(v) => props.updateParam('breathingFreq', v)} {...getCommonProps('breathingFreq')} />}
                    </div>
                )}
                </div>
              )}
              <SidebarSeparator theme={theme} />
            </>
          )}
          
          {(isGroupModified('social') || !showModifiedOnly) && (
            <>
              <SectionHeader title="Interaction" isOpen={sections.social} onToggle={() => toggleSection('social')} onReset={() => props.resetSection('social')} onRandom={() => props.randomizeSection('social')} />
              {sections.social && (
                <div className="pb-4 space-y-3">
                {(!showModifiedOnly || [shouldShow('neighborRadius'), shouldShow('repulsionForce'), shouldShow('attractionForce'), shouldShow('alignmentForce'), shouldShow('cohesionForce')].some(Boolean)) && (
                    <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                        <div className="text-[9px] font-bold text-indigo-400 mb-3 flex items-center gap-1 uppercase tracking-widest"><Users size={10}/> Swarm Intelligence</div>
                        {shouldShow('neighborRadius') && <Slider label="Radius" value={currentParams.neighborRadius} min={10} max={300} step={10} onChange={(v) => props.updateParam('neighborRadius', v)} {...getCommonProps('neighborRadius')} />}
                        {shouldShow('repulsionForce') && <Slider label="Repulsion" value={currentParams.repulsionForce} min={0} max={0.2} step={0.005} onChange={(v) => props.updateParam('repulsionForce', v)} {...getCommonProps('repulsionForce')} />}
                        {shouldShow('attractionForce') && <Slider label="Attraction" value={currentParams.attractionForce} min={0} max={0.2} step={0.005} onChange={(v) => props.updateParam('attractionForce', v)} {...getCommonProps('attractionForce')} />}
                        {shouldShow('alignmentForce') && <Slider label="Alignment" value={currentParams.alignmentForce} min={0} max={0.5} step={0.01} onChange={(v) => props.updateParam('alignmentForce', v)} {...getCommonProps('alignmentForce')} />}
                        {shouldShow('cohesionForce') && <Slider label="Cohesion" value={currentParams.cohesionForce} min={0} max={0.5} step={0.01} onChange={(v) => props.updateParam('cohesionForce', v)} {...getCommonProps('cohesionForce')} />}
                        <Slider label="Cursor Influence" value={currentParams.swarmCursorInfluence || 0} min={0} max={1} step={0.1} onChange={(v) => props.updateParam('swarmCursorInfluence', v)} description="0 = Always Active, 1 = Only near cursor" />
                    </div>
                )}
                {(!showModifiedOnly || [shouldShow('mouseInfluenceRadius'), shouldShow('mouseRepulsion'), shouldShow('mouseAttraction'), shouldShow('mouseFalloff')].some(Boolean)) && (
                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                        <div className="text-[9px] font-bold text-amber-500 mb-3 flex items-center gap-1 uppercase tracking-widest"><Zap size={10}/> Mouse Physics</div>
                        {shouldShow('mouseInfluenceRadius') && <Slider label="Influence Radius" value={currentParams.mouseInfluenceRadius || 150} min={50} max={500} step={10} onChange={(v) => props.updateParam('mouseInfluenceRadius', v)} {...getCommonProps('mouseInfluenceRadius')} />}
                        {shouldShow('mouseRepulsion') && <Slider label="Repulsion" value={currentParams.mouseRepulsion} min={0} max={20} step={0.1} onChange={(v) => props.updateParam('mouseRepulsion', v)} {...getCommonProps('mouseRepulsion')} />}
                        {shouldShow('mouseAttraction') && <Slider label="Attraction" value={currentParams.mouseAttraction} min={0} max={20} step={0.1} onChange={(v) => props.updateParam('mouseAttraction', v)} {...getCommonProps('mouseAttraction')} />}
                        {shouldShow('mouseFalloff') && <Slider label="Falloff (Sharpness)" value={currentParams.mouseFalloff || 1} min={1} max={4} step={0.1} onChange={(v) => props.updateParam('mouseFalloff', v)} {...getCommonProps('mouseFalloff')} />}
                    </div>
                )}
                </div>
              )}
              <SidebarSeparator theme={theme} />
            </>
          )}
          
          {(isGroupModified('audio') || !showModifiedOnly) && (
            <>
              <SectionHeader title="Audio Reactivity" isOpen={sections.audio} onToggle={() => toggleSection('audio')} onReset={() => props.resetSection('audio')} onRandom={() => props.randomizeSection('audio')} />
              {sections.audio && (
                <div className="pb-4 space-y-1">
                {shouldShow('audioSensitivity') && <Slider label="Sensitivity" value={currentParams.audioSensitivity} min={0} max={5} step={0.1} onChange={(v) => props.updateParam('audioSensitivity', v)} {...getCommonProps('audioSensitivity')} />}
                {shouldShow('audioToWidth') && <Toggle label="Audio -> Width" description={PARAM_DESCRIPTIONS['audioToWidth']} value={currentParams.audioToWidth} onChange={(v) => props.updateParam('audioToWidth', v)} />}
                {shouldShow('audioToColor') && <Toggle label="Audio -> Color" description={PARAM_DESCRIPTIONS['audioToColor']} value={currentParams.audioToColor} onChange={(v) => props.updateParam('audioToColor', v)} />}
                {shouldShow('audioToWiggle') && <Toggle label="Audio -> Wiggle" description={PARAM_DESCRIPTIONS['audioToWiggle']} value={currentParams.audioToWiggle} onChange={(v) => props.updateParam('audioToWiggle', v)} />}
                </div>
              )}
              <SidebarSeparator theme={theme} />
            </>
          )}
          
          <SectionHeader title="Sound Design" isOpen={sections.soundDesign} onToggle={() => toggleSection('soundDesign')} />
          {sections.soundDesign && (
            <div className="pb-4 space-y-3 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/20">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Source</span>
                  <SoundRecorder onBufferReady={props.handleBufferReady} />
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1 cursor-pointer hover:text-indigo-600 transition-colors">
                      <Upload size={10} /> Upload <input type="file" onChange={props.handleSoundUpload} className="hidden" accept="audio/*" />
                  </label>
                </div>
                {currentSound.bufferId ? (
                  <div className="text-[9px] text-green-600 font-mono bg-green-50 border border-green-200 px-2 py-1 rounded flex justify-between items-center">
                      <span>Active: {currentSound.bufferId.slice(0, 12)}...</span>
                      <button onClick={props.removeSound} className="text-red-500 hover:text-red-700"><Trash2 size={10} /></button>
                  </div>
                ) : ( <div className="text-[9px] text-slate-400 font-mono italic">No audio buffer assigned.</div> )}
                <Select label="Drive Volume With" value={currentSound.volumeSource} options={SOUND_VOLUME_SOURCES} onChange={(v) => props.updateSound('volumeSource', v as SoundVolumeSource)} />
                <Select label="Playback Mode" value={currentSound.playbackMode} options={['loop', 'timeline-scrub']} onChange={(v) => props.updateSound('playbackMode', v as SoundPlaybackMode)} />
                <Slider label="Min Vol" value={currentSound.minVolume} min={0} max={1} step={0.01} onChange={(v) => props.updateSound('minVolume', v)} />
                <Slider label="Max Vol" value={currentSound.maxVolume} min={0} max={2} step={0.01} onChange={(v) => props.updateSound('maxVolume', v)} />
                <Slider label="Base Pitch" value={currentSound.minPitch} min={0.1} max={4} step={0.01} onChange={(v) => props.updateSound('minPitch', v)} />
                <Slider label="Reverb" value={currentSound.reverbSend} min={0} max={1} step={0.01} onChange={(v) => props.updateSound('reverbSend', v)} />
                {currentSound.playbackMode === 'timeline-scrub' && ( <Slider label="Grain Size (s)" value={currentSound.grainSize} min={0.01} max={0.5} step={0.01} onChange={(v) => props.updateSound('grainSize', v)} /> )}
            </div>
          )}
          <SidebarSeparator theme={theme} />
          
          <SectionHeader title="Global Tools" isOpen={sections.globalTools} onToggle={() => toggleSection('globalTools')} />
          {sections.globalTools && (
            <div className="pb-4 space-y-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <div className="grid grid-cols-4 gap-2">
                  <PanelButton onClick={() => props.setForceTool('repulse')} label="PUSH" icon={<Move size={16} />} active={props.globalForceTool === 'repulse'} className="flex-col" />
                  <PanelButton onClick={() => props.setForceTool('attract')} label="PULL" icon={<Magnet size={16} />} active={props.globalForceTool === 'attract'} className="flex-col" />
                  <PanelButton onClick={() => props.setForceTool('vortex')} label="SWIRL" icon={<Tornado size={16} />} active={props.globalForceTool === 'vortex'} className="flex-col" />
                  <PanelButton onClick={() => props.setForceTool('connect')} label="LINK" icon={<Network size={16} />} active={props.globalForceTool === 'connect'} className="flex-col" />
                </div>
                <div className="pt-2 border-t border-slate-200">
                  {props.globalForceTool === 'connect' ? (
                     <div className="animate-fade-in">
                         <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Network size={10} /> Link Settings</span>
                            <div className="flex gap-2">
                              <button onClick={() => props.setGlobalToolConfig(prev => ({ ...prev, connectionsVisible: !prev.connectionsVisible }))} className="text-slate-400 hover:text-indigo-600 transition-colors" title={props.globalToolConfig.connectionsVisible ? "Hide Links" : "Show Links"} > {props.globalToolConfig.connectionsVisible ? <Eye size={14} /> : <EyeOff size={14} />} </button>
                              <button onClick={() => props.setDeleteAllLinksTrigger(t => t+1)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete All Links" > <Unplug size={14} /> </button>
                            </div>
                         </div>
                         <Slider label="Stiffness" value={props.globalToolConfig.connectionStiffness} min={0.01} max={1} step={0.01} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, connectionStiffness: v }))} />
                         <Slider label="Breaking Force" value={props.globalToolConfig.connectionBreakingForce} min={0} max={200} step={1} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, connectionBreakingForce: v }))} />
                         <Slider label="Influence (Bias)" value={props.globalToolConfig.connectionBias} min={0} max={1} step={0.1} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, connectionBias: v }))} />
                         <Slider label="Propagation" value={props.globalToolConfig.connectionInfluence} min={0} max={20} step={1} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, connectionInfluence: v }))} />
                         <Slider label="Decay" value={props.globalToolConfig.connectionFalloff} min={0} max={1} step={0.1} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, connectionFalloff: v }))} />
                         <Select label="Decay Curve" value={props.globalToolConfig.connectionDecayEasing || 'linear'} options={['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'step']} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, connectionDecayEasing: v as EasingMode }))} />
                         <div className="text-[9px] text-slate-500 italic p-2 bg-blue-50 border border-blue-100 rounded mt-2"> Drag between points to connect. Connect creates a spring physics constraint. </div>
                     </div>
                  ) : (
                     <div className="animate-fade-in">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Globe size={10} /> Tool Settings</span>
                          <Toggle label="Hover Trigger" value={props.globalToolConfig.trigger === 'hover'} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, trigger: v ? 'hover' : 'click' }))} />
                        </div>
                        <Slider label="Radius" value={props.globalToolConfig.radius} min={50} max={500} step={10} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, radius: v }))} />
                        <Slider label="Force" value={props.globalToolConfig.force} min={0.1} max={5} step={0.1} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, force: v }))} />
                        <Slider label="Falloff" value={props.globalToolConfig.falloff} min={0} max={1} step={0.1} onChange={(v) => props.setGlobalToolConfig(prev => ({ ...prev, falloff: v }))} />
                     </div>
                  )}
                </div>
            </div>
          )}
      </div>
      <div className="mt-auto pt-4 pb-2 border-t border-slate-100 text-[10px] text-slate-400 text-center font-medium tracking-wide"> vibe coded by <a href="http://www.ivangulizia.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 text-slate-500 transition-colors">Ivan Gulizia</a> </div>
    </div>
  );
};