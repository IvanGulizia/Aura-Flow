import React, { useState, useRef } from 'react';
import { ChevronDown, Lock, Unlock, Activity, RotateCcw, Shuffle, RefreshCw } from 'lucide-react';
import { ModulationConfig } from '../../types';
import { ModulationPopup } from './ModulationPopup';

// --- ATOMIC BUTTONS ---

export const LockButton: React.FC<{ isLocked?: boolean; onToggle: () => void }> = ({ isLocked, onToggle }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    className={`ml-1 p-1 rounded transition-all ${isLocked ? 'text-amber-600 bg-amber-100/50' : 'text-slate-300 hover:text-slate-500'}`}
    title={isLocked ? "Unlock Parameter" : "Lock Parameter (Prevent Randomization)"}
  >
    {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
  </button>
);

export const ModulationButton: React.FC<{ isActive: boolean; onClick: () => void }> = ({ isActive, onClick }) => (
   <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`ml-1 p-1 rounded transition-all ${isActive ? 'text-indigo-600 bg-indigo-100/50' : 'text-slate-300 hover:text-indigo-400'}`}
    title="Configure Modulation (Random, Velocity, Cursor, Audio...)"
   >
     <Activity size={10} />
   </button>
);

export const ResetButton: React.FC<{ onReset: () => void; isModified?: boolean }> = ({ onReset, isModified }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onReset(); }}
    className={`ml-1 p-1 rounded transition-all ${isModified ? 'text-slate-300 hover:text-red-500 hover:bg-red-50' : 'text-slate-100'}`}
    title="Reset to Default"
    disabled={!isModified}
  >
    <RotateCcw size={10} className={!isModified ? "opacity-30" : ""} />
  </button>
);

export const LabelWithTooltip: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <div className="group/label relative flex items-center">
    {children}
    {description && (
       <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-900/95 backdrop-blur text-slate-100 text-[10px] rounded-lg shadow-xl opacity-0 group-hover/label:opacity-100 transition-opacity duration-300 pointer-events-none z-50 font-normal leading-relaxed delay-500">
         {description}
         <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-900/95" />
       </div>
    )}
  </div>
);

// --- FORM CONTROLS ---

interface ControlProps {
  label: string;
  description?: string;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onReset?: () => void;
  isModified?: boolean; 
}

export const Slider: React.FC<ControlProps & {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  className?: string;
  modulation?: ModulationConfig;
  onModulationChange?: (cfg: ModulationConfig | undefined) => void;
}> = ({ label, description, value, min, max, step, onChange, className, isLocked, onToggleLock, modulation, onModulationChange, onReset, isModified }) => {
  const [showModulation, setShowModulation] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const isModulated = modulation && modulation.source !== 'none';
  
  const handleValueChange = (v: number) => {
    onChange(Math.min(max, Math.max(min, v)));
  };

  const handleMinChange = (v: number) => {
    if (!onModulationChange || !modulation) return;
    onModulationChange({ ...modulation, min: v });
  };

  const handleMaxChange = (v: number) => {
    if (!onModulationChange || !modulation) return;
    onModulationChange({ ...modulation, max: v });
  };

  const handlePointerDown = (e: React.PointerEvent, target: 'value' | 'min' | 'max') => {
    if (!trackRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const rect = trackRef.current.getBoundingClientRect();
    
    const onPointerMove = (moveEvent: PointerEvent) => {
      const clientX = moveEvent.clientX;
      let pct = (clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      
      let rawVal = min + pct * (max - min);
      if (step > 0) {
        rawVal = Math.round(rawVal / step) * step;
      }
      const val = parseFloat(rawVal.toFixed(3));

      if (target === 'value') {
        onChange(val);
      } else if (isModulated && onModulationChange) {
        if (target === 'min') {
           onModulationChange({ ...modulation, min: val });
        } else {
           onModulationChange({ ...modulation, max: val });
        }
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
       window.removeEventListener('pointermove', onPointerMove);
       window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };
  
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  
  const displayVal = Number.isFinite(value) ? value : min;
  const displayStart = isModulated ? (Number.isFinite(modulation.min) ? modulation.min : min) : min;
  const displayEnd = isModulated ? (Number.isFinite(modulation.max) ? modulation.max : min) : min;

  const visualMin = Math.min(displayStart, displayEnd);
  const visualMax = Math.max(displayStart, displayEnd);

  return (
    <div className={`flex flex-col space-y-2 mb-4 ${className}`}>
      <div className="flex justify-between items-end">
        <LabelWithTooltip label={label} description={description}>
          <div className="flex items-center cursor-help">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest opacity-80 border-b border-dotted border-slate-300 hover:border-slate-500 transition-colors">{label}</span>
            {onToggleLock && <LockButton isLocked={isLocked} onToggle={onToggleLock} />}
            {onModulationChange && (
              <ModulationButton 
                isActive={isModulated || showModulation} 
                onClick={() => setShowModulation(!showModulation)} 
              />
            )}
            {onReset && <ResetButton onReset={onReset} isModified={isModified} />}
          </div>
        </LabelWithTooltip>
        
        <div className="flex items-center gap-2">
          {isModulated ? (
            <>
               <span className="text-[9px] text-indigo-500 font-bold">A</span>
               <input 
                  type="number" 
                  className="w-12 text-right bg-white/40 border border-white/30 rounded px-1 py-0.5 text-[10px] font-mono text-indigo-600 focus:bg-white focus:ring-1 ring-indigo-500 outline-none no-spinners"
                  value={parseFloat(displayStart.toFixed(2))}
                  step={step}
                  onChange={(e) => handleMinChange(parseFloat(e.target.value))}
               />
               <span className="text-[9px] text-pink-500 font-bold">B</span>
               <input 
                  type="number" 
                  className="w-12 text-right bg-white/40 border border-white/30 rounded px-1 py-0.5 text-[10px] font-mono text-pink-600 focus:bg-white focus:ring-1 ring-pink-500 outline-none no-spinners"
                  value={parseFloat(displayEnd.toFixed(2))}
                  step={step}
                  onChange={(e) => handleMaxChange(parseFloat(e.target.value))}
               />
            </>
          ) : (
            <input 
              type="number" 
              className="w-14 text-right bg-white/40 border border-white/30 rounded px-1 py-0.5 text-[10px] font-mono text-slate-600 focus:bg-white focus:ring-1 ring-slate-400 outline-none no-spinners"
              value={parseFloat(displayVal.toFixed(2))}
              step={step}
              onChange={(e) => handleValueChange(parseFloat(e.target.value))}
            />
          )}
        </div>
      </div>

      <div className="relative w-full h-5 flex items-center touch-none select-none" ref={trackRef}>
        <div className="absolute left-0 right-0 h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
           {isModulated ? (
             <div 
               className="absolute top-0 bottom-0 bg-gradient-to-r from-indigo-200 to-pink-200" 
               style={{ 
                 left: `${pct(visualMin)}%`, 
                 right: `${100 - pct(visualMax)}%` 
               }} 
             />
           ) : (
              <div 
                className="absolute top-0 bottom-0 bg-slate-300"
                style={{ width: `${pct(displayVal)}%` }}
              />
           )}
        </div>

        {isModulated ? (
          <>
             <div 
                className="absolute w-4 h-4 bg-white border-2 border-indigo-500 shadow-sm rounded-full cursor-col-resize hover:scale-110 transition-transform z-20 flex items-center justify-center"
                style={{ left: `calc(${pct(displayStart)}% - 8px)` }}
                onPointerDown={(e) => handlePointerDown(e, 'min')}
                title="Start Value"
             >
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
             </div>
             <div 
                className="absolute w-4 h-4 bg-white border-2 border-pink-500 shadow-md rounded-full cursor-col-resize hover:scale-110 transition-transform z-20 flex items-center justify-center"
                style={{ left: `calc(${pct(displayEnd)}% - 8px)` }}
                onPointerDown={(e) => handlePointerDown(e, 'max')}
                title="End Value"
             >
                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
             </div>
          </>
        ) : (
          <div 
             className="absolute w-4 h-4 bg-white border border-slate-300 shadow-sm rounded-full cursor-pointer hover:scale-110 transition-transform z-10"
             style={{ left: `calc(${pct(displayVal)}% - 8px)` }}
             onPointerDown={(e) => handlePointerDown(e, 'value')}
          />
        )}
      </div>

      {showModulation && onModulationChange && (
        <ModulationPopup config={modulation} onChange={onModulationChange} baseValue={value} />
      )}
    </div>
  );
};

export const Select: React.FC<ControlProps & {
  value: string;
  options: string[];
  onChange: (val: string) => void;
}> = ({ label, description, value, options, onChange, isLocked, onToggleLock, onReset, isModified }) => (
  <div className="flex flex-col space-y-1.5 mb-4">
    <LabelWithTooltip label={label} description={description}>
      <div className="flex items-center cursor-help">
        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest opacity-80 border-b border-dotted border-slate-300 hover:border-slate-500 transition-colors">{label}</span>
        {onToggleLock && <LockButton isLocked={isLocked} onToggle={onToggleLock} />}
        {onReset && <ResetButton onReset={onReset} isModified={isModified} />}
      </div>
    </LabelWithTooltip>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 rounded-lg bg-white/40 border border-slate-200 text-xs text-slate-700 focus:ring-1 focus:ring-slate-400 outline-none cursor-pointer shadow-sm appearance-none font-medium"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
        <ChevronDown size={14} />
      </div>
    </div>
  </div>
);

export const Toggle: React.FC<ControlProps & {
  value: boolean;
  onChange: (val: boolean) => void;
}> = ({ label, description, value, onChange, isLocked, onToggleLock, onReset, isModified }) => (
  <div className="flex items-center justify-between mb-3 bg-white/40 p-2 rounded-lg border border-slate-200/50 shadow-sm">
    <LabelWithTooltip label={label} description={description}>
      <div className="flex items-center cursor-help">
        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest opacity-80 border-b border-dotted border-slate-300 hover:border-slate-500 transition-colors">{label}</span>
        {onToggleLock && <LockButton isLocked={isLocked} onToggle={onToggleLock} />}
        {onReset && <ResetButton onReset={onReset} isModified={isModified} />}
      </div>
    </LabelWithTooltip>
    <button
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full transition-colors duration-200 relative shadow-inner ${value ? 'bg-slate-800' : 'bg-slate-300'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  </div>
);

export const SectionHeader: React.FC<{
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  onReset?: () => void;
  onRandom?: () => void;
}> = ({ title, isOpen, onToggle, onReset, onRandom }) => (
  <div className="flex items-center justify-between py-3 mb-2 mt-1 select-none">
    <button 
      onClick={onToggle}
      className="flex items-center gap-2 text-[11px] font-bold text-slate-800 uppercase tracking-widest hover:text-indigo-600 transition-colors flex-1 text-left"
      style={{ color: isOpen ? 'var(--header-active)' : 'inherit' }}
    >
      {title}
      <div className={`transition-transform duration-300 text-slate-400 ${isOpen ? 'rotate-180' : ''}`}>
         <ChevronDown size={14} />
      </div>
    </button>
    
    {isOpen && (
      <div className="flex items-center gap-1">
        {onRandom && (
          <button 
            onClick={(e) => { e.stopPropagation(); onRandom(); }}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
            title="Randomize Section (Ignores Locked)"
          >
            <Shuffle size={12} />
          </button>
        )}
        {onReset && (
          <button 
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
            title="Reset Section to Defaults"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>
    )}
  </div>
);

// New atomic inputs moved from App.tsx
export const ColorInput: React.FC<{ label: string; val: string; onChange: (v: string) => void }> = ({ label, val, onChange }) => (
  <div className="flex justify-between items-center gap-2">
    <span className="opacity-60 text-[10px]">{label}</span>
    <div className="flex gap-2 items-center">
      <input type="color" value={val} onChange={(e) => onChange(e.target.value)} className="w-5 h-5 rounded overflow-hidden cursor-pointer border-none p-0 bg-transparent" />
    </div>
  </div>
);

export const NumberInput: React.FC<{ label: string; val: number; min: number; max: number; step: number; onChange: (v: number) => void }> = ({ label, val, min, max, step, onChange }) => (
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