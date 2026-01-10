
import React, { useState, useRef, useEffect } from 'react';
import { Edit3, Zap, Trash2, Link as LinkIcon, RefreshCcw } from 'lucide-react';
import { 
  SimulationParams, SoundConfig, GridConfig, SymmetryConfig, GlobalForceType, 
  GlobalToolConfig, Preset, UITheme, ModulationConfig, Connection 
} from '../../types';
import { 
  DEFAULT_PARAMS, PARAMS_GROUPS, PARAM_DESCRIPTIONS 
} from '../../constants/defaults';

// Import Sections
import { PhysicsSection } from './sections/PhysicsSection';
import { ShapeSection } from './sections/ShapeSection';
import { VisualsSection } from './sections/VisualsSection';
import { SocialSection } from './sections/SocialSection';
import { AudioSection } from './sections/AudioSection';
import { ProjectSection } from './sections/ProjectSection';
import { GuidesSection } from './sections/GuidesSection';
import { PresetsSection } from './sections/PresetsSection';
import { GlobalToolsSection } from './sections/GlobalToolsSection';
import { ConnectionSettingsSection } from './sections/ConnectionSettingsSection';

interface SettingsPanelProps {
  theme: UITheme;
  isOpen: boolean;
  onClose?: () => void;
  
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
  
  selectedConnectionIds: Set<string>;
  selectedConnectionParams: Connection | null;
  updateConnectionParam: (key: keyof Connection, value: any) => void;

  ecoMode: boolean;
  setEcoMode: (val: boolean) => void;

  selectionFilter: 'all' | 'links';
  setSelectionFilter: (filter: 'all' | 'links') => void;

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
  
  initiateSave: () => void;
  onCopyJson: () => void;
  triggerImportProject: () => void;
  setResetPosTrigger: React.Dispatch<React.SetStateAction<number>>;
  setDeleteSelectedTrigger: React.Dispatch<React.SetStateAction<number>>;
  setDeleteAllLinksTrigger: React.Dispatch<React.SetStateAction<number>>;
  savePresetTrigger: number;

  loadPreset: (params: SimulationParams, name: string) => void;
  deletePreset: (index: number) => void;
  saveNewPreset: (name: string, desc: string) => void;
  exportPresets: () => void;
  exportSinglePreset: () => void;
  triggerImportPresets: () => void;
  restoreDefaultPresets: () => void;
  
  handleSoundUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBufferReady: (buffer: AudioBuffer) => void;
  removeSound: () => void;
  
  onSyncSelected?: () => void;
}

const SidebarSeparator = ({ theme }: { theme: UITheme }) => (
   <div className="w-[calc(100%+2.5rem)] -mx-5 my-1" style={{ height: `${theme.separatorWidth}px`, backgroundColor: theme.separatorColor }} />
);

export const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
  const { theme, isOpen, selectedStrokeId, selectedStrokeParams, brushParams, savePresetTrigger } = props;
  
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSide, setPanelSide] = useState<'left' | 'right'>('right');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panelTop, setPanelTop] = useState(24);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [forceNamingPreset, setForceNamingPreset] = useState(0);

  const [sections, setSections] = useState({
    project: false, guides: false, presets: true, physics: false, visuals: false, 
    shape: false, social: false, audio: false, globalTools: false, 
    connections: true
  });
  
  const toggleSection = (key: keyof typeof sections) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (savePresetTrigger > 0) {
      setSections(prev => ({ ...prev, presets: true }));
      setForceNamingPreset(t => t + 1);
    }
  }, [savePresetTrigger]);

  const currentParams = (selectedStrokeId && selectedStrokeParams) ? selectedStrokeParams : brushParams;
  const currentSound = (selectedStrokeId && props.selectedStrokeSound) ? props.selectedStrokeSound : props.brushSound;
  const modeTitle = selectedStrokeId ? "Editing Selection" : (props.selectedConnectionIds.size > 0 ? "Editing Link" : "Settings");

  const shouldShow = (key: keyof SimulationParams | 'fill' | 'gradient' | string, subValue?: any, subDefault?: any) => {
    if (!showModifiedOnly) return true;
    
    // UPDATED: Check for active modulation on this key
    const isModulated = currentParams.modulations?.[key as keyof SimulationParams]?.source !== 'none' && 
                        currentParams.modulations?.[key as keyof SimulationParams] !== undefined;
    if (isModulated) return true;

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
              guides: prev.guides,
              connections: true
          }));
      }
  }, [showModifiedOnly, currentParams]); 

  if (!isOpen) return null;

  const currentTop = isDraggingPanel ? dragOffset.y : panelTop;
  const sharedProps = { theme, currentParams, updateParam: props.updateParam, shouldShow, getCommonProps, showModifiedOnly };

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
      <div className="flex-none px-6 py-4 border-b border-slate-100 flex justify-between items-center cursor-grab active:cursor-grabbing" onPointerDown={handlePanelPointerDown}>
          <div className="flex items-center gap-3">
            <h3 className="font-bold flex items-center gap-2 text-sm tracking-wide pointer-events-none">
                {selectedStrokeId ? <Edit3 size={15} className="text-indigo-600"/> : (props.selectedConnectionIds.size > 0 ? <LinkIcon size={15} className="text-indigo-600" /> : <Zap size={15} className="text-amber-500" />)}
                {modeTitle}
            </h3>
          </div>
          {(selectedStrokeId || props.selectedConnectionIds.size > 0) && (
            <div className="flex items-center gap-2">
              <button 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); props.setDeleteSelectedTrigger(t => t + 1); }} 
                className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              >
                <Trash2 size={14} />
              </button>
              {selectedStrokeId && (
                  <button 
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); props.onSyncSelected?.(); }} 
                    title="Sync All Selected" 
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                  >
                      <RefreshCcw size={14} />
                  </button>
              )}
            </div>
          )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 custom-scrollbar scroll-smooth">
          
          {props.selectedConnectionIds.size > 0 && props.selectedConnectionParams && (
            <>
              <ConnectionSettingsSection 
                {...sharedProps}
                isOpen={sections.connections}
                onToggle={() => toggleSection('connections')}
                selectedConnectionParams={props.selectedConnectionParams}
                updateConnectionParam={props.updateConnectionParam}
              />
              <SidebarSeparator theme={theme} />
            </>
          )}

          <ProjectSection 
            {...sharedProps}
            isOpen={sections.project} 
            onToggle={() => toggleSection('project')} 
            initiateSave={props.initiateSave}
            triggerImportProject={props.triggerImportProject}
            setResetPosTrigger={props.setResetPosTrigger}
            onCopyJson={props.onCopyJson}
          />
          <SidebarSeparator theme={theme} />
          
          <GuidesSection 
            {...sharedProps}
            isOpen={sections.guides}
            onToggle={() => toggleSection('guides')}
            gridConfig={props.gridConfig}
            setGridConfig={props.setGridConfig}
            symmetryConfig={props.symmetryConfig}
            setSymmetryConfig={props.setSymmetryConfig}
            shouldShow={(key) => shouldShow(key)}
          />
          <SidebarSeparator theme={theme} />
          
          <PresetsSection 
            {...sharedProps}
            isOpen={sections.presets}
            onToggle={() => toggleSection('presets')}
            presets={props.presets}
            activePresetName={props.activePresetName}
            loadPreset={props.loadPreset}
            deletePreset={props.deletePreset}
            exportPresets={props.exportPresets}
            exportSinglePreset={props.exportSinglePreset}
            triggerImportPresets={props.triggerImportPresets}
            saveNewPreset={props.saveNewPreset}
            restoreDefaultPresets={props.restoreDefaultPresets}
            setShowModifiedOnly={setShowModifiedOnly}
            forceNamingTrigger={forceNamingPreset}
          />
          <SidebarSeparator theme={theme} />
          
          {(isGroupModified('physics') || !showModifiedOnly) && (
            <>
              <PhysicsSection 
                {...sharedProps}
                isOpen={sections.physics}
                onToggle={() => toggleSection('physics')}
                onReset={() => props.resetSection('physics')}
                onRandom={() => props.randomizeSection('physics')}
              />
              <SidebarSeparator theme={theme} />
            </>
          )}
          
          {(isGroupModified('visuals') || !showModifiedOnly) && (
            <>
              <VisualsSection 
                {...sharedProps}
                isOpen={sections.visuals}
                onToggle={() => toggleSection('visuals')}
                onReset={() => props.resetSection('visuals')}
                onRandom={() => props.randomizeSection('visuals')}
                updateFill={props.updateFill}
                updateFillGradient={props.updateFillGradient}
                updateGradient={props.updateGradient}
                addGradientColor={props.addGradientColor}
                removeGradientColor={props.removeGradientColor}
                updateGradientColor={props.updateGradientColor}
              />
              <SidebarSeparator theme={theme} />
            </>
          )}
          
          {(isGroupModified('shape') || !showModifiedOnly) && (
            <>
              <ShapeSection 
                {...sharedProps}
                isOpen={sections.shape}
                onToggle={() => toggleSection('shape')}
                onReset={() => props.resetSection('shape')}
                onRandom={() => props.randomizeSection('shape')}
              />
              <SidebarSeparator theme={theme} />
            </>
          )}
          
          {(isGroupModified('social') || !showModifiedOnly) && (
            <>
              <SocialSection 
                {...sharedProps}
                isOpen={sections.social}
                onToggle={() => toggleSection('social')}
                onReset={() => props.resetSection('social')}
                onRandom={() => props.randomizeSection('social')}
              />
              <SidebarSeparator theme={theme} />
            </>
          )}
          
          {/* COMBINED AUDIO REACTIVITY & SOUND DESIGN */}
          {(isGroupModified('audio') || !showModifiedOnly) && (
            <>
              <AudioSection 
                {...sharedProps}
                isOpen={sections.audio}
                onToggle={() => toggleSection('audio')}
                onReset={() => props.resetSection('audio')}
                onRandom={() => props.randomizeSection('audio')}
                currentSound={currentSound}
                handleBufferReady={props.handleBufferReady}
                handleSoundUpload={props.handleSoundUpload}
                removeSound={props.removeSound}
                updateSound={props.updateSound}
              />
              <SidebarSeparator theme={theme} />
            </>
          )}
          
          <GlobalToolsSection 
            {...sharedProps}
            isOpen={sections.globalTools}
            onToggle={() => toggleSection('globalTools')}
            globalForceTool={props.globalForceTool}
            setForceTool={props.setForceTool}
            globalToolConfig={props.globalToolConfig}
            setGlobalToolConfig={props.setGlobalToolConfig}
            setDeleteAllLinksTrigger={props.setDeleteAllLinksTrigger}
            selectionFilter={props.selectionFilter}
            setSelectionFilter={props.setSelectionFilter}
            ecoMode={props.ecoMode}
            setEcoMode={props.setEcoMode}
          />
          <SidebarSeparator theme={theme} />
      </div>
      <div className="mt-auto pt-4 pb-2 border-t border-slate-100 text-[10px] text-slate-400 text-center font-medium tracking-wide"> vibe coded by <a href="http://www.ivangulizia.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 text-slate-500 transition-colors">Ivan Gulizia</a> </div>
    </div>
  );
};
