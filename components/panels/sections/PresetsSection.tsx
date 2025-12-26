
import React, { useState } from 'react';
import { Filter, X, Save, Download, FolderOpen } from 'lucide-react';
import { SectionHeader } from '../../ui/Controls';
import { PanelButton } from '../../IconButtons';
import { BaseSectionProps } from './types';
import { Preset, SimulationParams } from '../../../types';

interface PresetsSectionProps extends BaseSectionProps {
  presets: Preset[];
  activePresetName: string | null;
  loadPreset: (params: SimulationParams, name: string) => void;
  deletePreset: (index: number) => void;
  exportPresets: () => void;
  exportSinglePreset: () => void;
  triggerImportPresets: () => void;
  saveNewPreset: (name: string, desc: string) => void;
  setShowModifiedOnly: (val: boolean) => void;
}

export const PresetsSection: React.FC<PresetsSectionProps> = ({ 
  isOpen, onToggle, presets, activePresetName, loadPreset, deletePreset, 
  exportPresets, exportSinglePreset, triggerImportPresets, saveNewPreset,
  showModifiedOnly, setShowModifiedOnly
}) => {
  const [isNamingPreset, setIsNamingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");

  return (
    <>
      <SectionHeader title="Presets" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
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
                </button>
                <button onClick={(e) => { e.stopPropagation(); deletePreset(idx); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-[8px] z-10" > <X size={8} /> </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4 border-t border-slate-100 pt-3">
            <PanelButton onClick={exportPresets} label="EXPORT ALL" icon={<Save size={10} />} />
            <PanelButton onClick={exportSinglePreset} label="EXPORT SELECT" icon={<Download size={10} />} title="Export current settings as a single preset file" />
            <PanelButton onClick={triggerImportPresets} label="IMPORT" icon={<FolderOpen size={10} />} />
          </div>

          {isNamingPreset ? (
            <div className="flex flex-col gap-2 animate-fade-in-up bg-slate-50 p-2 rounded-lg border border-slate-200">
              <input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Preset Name..." autoFocus />
              <textarea value={newPresetDesc} onChange={(e) => setNewPresetDesc(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-16" placeholder="Description (optional)..." />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setIsNamingPreset(false); setNewPresetName(""); }} className="bg-slate-200 text-slate-600 px-3 py-1 text-[10px] font-bold rounded hover:bg-slate-300">CANCEL</button>
                <button onClick={() => { saveNewPreset(newPresetName, newPresetDesc); setIsNamingPreset(false); setNewPresetName(""); }} className="bg-indigo-600 text-white px-3 py-1 text-[10px] font-bold rounded hover:bg-indigo-700">SAVE</button>
              </div>
            </div>
          ) : (
            <PanelButton onClick={() => { setIsNamingPreset(true); setNewPresetName(`Preset ${presets.length + 1}`); }} label="SAVE AS PRESET" icon={<Save size={10} />} />
          )}
        </div>
      )}
    </>
  );
};
