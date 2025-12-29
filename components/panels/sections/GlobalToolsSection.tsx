
import React from 'react';
import { Network, Eye, EyeOff, Unplug, Globe, MousePointer, LinkIcon, Cpu } from 'lucide-react';
import { Slider, Toggle, SectionHeader } from '../../ui/Controls';
import { PanelButton } from '../../IconButtons';
import { BaseSectionProps } from './types';
import { GlobalForceType, GlobalToolConfig } from '../../../types';

interface GlobalToolsSectionProps extends BaseSectionProps {
  globalForceTool: GlobalForceType;
  setForceTool: (tool: GlobalForceType) => void;
  globalToolConfig: GlobalToolConfig;
  setGlobalToolConfig: React.Dispatch<React.SetStateAction<GlobalToolConfig>>;
  setDeleteAllLinksTrigger: React.Dispatch<React.SetStateAction<number>>;
  selectionFilter: 'all' | 'links';
  setSelectionFilter: (filter: 'all' | 'links') => void;
  ecoMode: boolean;
  setEcoMode: (val: boolean) => void;
}

export const GlobalToolsSection: React.FC<GlobalToolsSectionProps> = ({ 
  isOpen, onToggle, globalForceTool, setForceTool, globalToolConfig, setGlobalToolConfig, setDeleteAllLinksTrigger,
  selectionFilter, setSelectionFilter, ecoMode, setEcoMode
}) => {
  return (
    <>
      <SectionHeader title="Global Tools" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-4 space-y-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
          {/* Main Interaction Tools - PUSH, PULL, SWIRL masked for now */}
          <div className="grid grid-cols-2 gap-2">
            <PanelButton onClick={() => setForceTool('cursor')} label="CURSOR" icon={<MousePointer size={16} />} active={globalForceTool === 'cursor'} />
            <PanelButton onClick={() => setForceTool('connect')} label="LINK" icon={<Network size={16} />} active={globalForceTool === 'connect'} />
          </div>

          <div className="pt-2 border-t border-slate-200">
            {globalForceTool === 'connect' ? (
              <div className="animate-fade-in space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Network size={10} /> View Options</span>
                  <div className="flex gap-2">
                    <button onClick={() => setGlobalToolConfig(prev => ({ ...prev, connectionsVisible: !prev.connectionsVisible }))} className="text-slate-400 hover:text-indigo-600 transition-colors" title={globalToolConfig.connectionsVisible ? "Hide Links" : "Show Links"} > {globalToolConfig.connectionsVisible ? <Eye size={14} /> : <EyeOff size={14} />} </button>
                    <button onClick={() => setDeleteAllLinksTrigger(t => t+1)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete All Links" > <Unplug size={14} /> </button>
                  </div>
                </div>

                <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                   <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-1"><LinkIcon size={10} /> Select Links Only</span>
                      <Toggle label="" value={selectionFilter === 'links'} onChange={(v) => setSelectionFilter(v ? 'links' : 'all')} />
                   </div>
                </div>

                <div className="text-[9px] text-slate-500 italic p-2 bg-blue-50 border border-blue-100 rounded mt-2"> 
                  Drag between points to connect. <br/>
                  <span className="font-bold text-indigo-600">Note:</span> Manual links use the <span className="underline">Current Brush</span> (Interaction) settings.
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                   <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-1"><LinkIcon size={10} /> Select Links Only</span>
                      <Toggle label="" value={selectionFilter === 'links'} onChange={(v) => setSelectionFilter(v ? 'links' : 'all')} />
                   </div>
                </div>
                {globalForceTool === 'cursor' && (
                  <div className="text-[9px] text-slate-500 italic p-2 bg-slate-100/50 border border-slate-200 rounded mt-2 text-center">
                      Use this to interact with physics without drawing.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Eco Mode moved here */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Cpu size={10} /> Eco Mode</span>
              <Toggle label="" value={ecoMode} onChange={setEcoMode} />
            </div>
            <div className="text-[8px] text-slate-400 italic mt-1 text-right">Pauses rendering when idle to save battery.</div>
          </div>
        </div>
      )}
    </>
  );
};
