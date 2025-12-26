
import React from 'react';
import { Cpu } from 'lucide-react';
import { Toggle, SectionHeader } from '../../ui/Controls';
import { BaseSectionProps } from './types';

interface SystemSectionProps extends BaseSectionProps {
  ecoMode: boolean;
  setEcoMode: (val: boolean) => void;
}

export const SystemSection: React.FC<SystemSectionProps> = ({ isOpen, onToggle, ecoMode, setEcoMode }) => {
  return (
    <>
      <SectionHeader title="System & Performance" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-4 space-y-2 bg-slate-100/50 p-3 rounded-xl border border-slate-200/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"><Cpu size={12} /> Performance</div>
            <Toggle label="Eco Mode" value={ecoMode} onChange={setEcoMode} description="Save battery by pausing rendering when idle." />
          </div>
          <div className="text-[9px] text-slate-400 italic">Disable Eco Mode if you experience input lag or visual stuttering.</div>
        </div>
      )}
    </>
  );
};
