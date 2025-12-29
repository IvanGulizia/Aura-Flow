
import React from 'react';
import { Move, Magnet, Tornado, Network, Eye, EyeOff, Unplug, Globe, MousePointer } from 'lucide-react';
import { Slider, Toggle, Select, SectionHeader } from '../../ui/Controls';
import { PanelButton } from '../../IconButtons';
import { BaseSectionProps } from './types';
import { GlobalForceType, GlobalToolConfig, EasingMode } from '../../../types';

interface GlobalToolsSectionProps extends BaseSectionProps {
  globalForceTool: GlobalForceType;
  setForceTool: (tool: GlobalForceType) => void;
  globalToolConfig: GlobalToolConfig;
  setGlobalToolConfig: React.Dispatch<React.SetStateAction<GlobalToolConfig>>;
  setDeleteAllLinksTrigger: React.Dispatch<React.SetStateAction<number>>;
}

export const GlobalToolsSection: React.FC<GlobalToolsSectionProps> = ({ 
  isOpen, onToggle, globalForceTool, setForceTool, globalToolConfig, setGlobalToolConfig, setDeleteAllLinksTrigger 
}) => {
  return (
    <>
      <SectionHeader title="Global Tools" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-4 space-y-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
          <div className="grid grid-cols-5 gap-2">
            <PanelButton onClick={() => setForceTool('cursor')} label="CURSOR" icon={<MousePointer size={16} />} active={globalForceTool === 'cursor'} className="flex-col" />
            <PanelButton onClick={() => setForceTool('repulse')} label="PUSH" icon={<Move size={16} />} active={globalForceTool === 'repulse'} className="flex-col" />
            <PanelButton onClick={() => setForceTool('attract')} label="PULL" icon={<Magnet size={16} />} active={globalForceTool === 'attract'} className="flex-col" />
            <PanelButton onClick={() => setForceTool('vortex')} label="SWIRL" icon={<Tornado size={16} />} active={globalForceTool === 'vortex'} className="flex-col" />
            <PanelButton onClick={() => setForceTool('connect')} label="LINK" icon={<Network size={16} />} active={globalForceTool === 'connect'} className="flex-col" />
          </div>
          <div className="pt-2 border-t border-slate-200">
            {globalForceTool === 'connect' ? (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Network size={10} /> View Options</span>
                  <div className="flex gap-2">
                    <button onClick={() => setGlobalToolConfig(prev => ({ ...prev, connectionsVisible: !prev.connectionsVisible }))} className="text-slate-400 hover:text-indigo-600 transition-colors" title={globalToolConfig.connectionsVisible ? "Hide Links" : "Show Links"} > {globalToolConfig.connectionsVisible ? <Eye size={14} /> : <EyeOff size={14} />} </button>
                    <button onClick={() => setDeleteAllLinksTrigger(t => t+1)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete All Links" > <Unplug size={14} /> </button>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 italic p-2 bg-blue-50 border border-blue-100 rounded mt-2"> 
                  Drag between points to connect. <br/>
                  <span className="font-bold text-indigo-600">Note:</span> Manual links now use the <span className="underline">current Brush Settings</span> (Interaction -> Magnetic Bonding) for stiffness and strength.
                </div>
              </div>
            ) : globalForceTool !== 'cursor' ? (
              <div className="animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Globe size={10} /> Tool Settings</span>
                  <Toggle label="Hover Trigger" value={globalToolConfig.trigger === 'hover'} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, trigger: v ? 'hover' : 'click' }))} />
                </div>
                <Slider label="Radius" value={globalToolConfig.radius} min={50} max={500} step={10} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, radius: v }))} />
                <Slider label="Force" value={globalToolConfig.force} min={0.1} max={5} step={0.1} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, force: v }))} />
                <Slider label="Falloff" value={globalToolConfig.falloff} min={0} max={1} step={0.1} onChange={(v) => setGlobalToolConfig(prev => ({ ...prev, falloff: v }))} />
              </div>
            ) : (
              <div className="text-[9px] text-slate-500 italic p-2 bg-slate-100/50 border border-slate-200 rounded mt-2 text-center">
                  Use this tool to interact with physics (Repulsion/Attraction defined in Stroke Settings) without drawing.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
