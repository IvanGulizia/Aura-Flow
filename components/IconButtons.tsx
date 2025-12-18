
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Lock, Unlock, Activity, Shuffle, RefreshCw, Mic, Square, Play, Upload, Music, Magnet, Move, Tornado, Trash2, GripHorizontal, MoreHorizontal, Minus, Clock, RotateCcw, SlidersHorizontal, ArrowRightFromLine, ArrowLeftRight, TrendingUp, TrendingDown, Waves, ArrowDownUp } from 'lucide-react';
import { ModulationConfig, ModulationSource, EasingMode, ModulationScope } from '../types';
import { audioManager } from '../services/audioService';

interface IconButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
  label?: string; // Kept for ARIA but removed title attribute
  className?: string;
  disabled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({ onClick, icon, active, label, className, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative group flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-full transition-all duration-300
        border backdrop-blur-sm
        ${active ? 'scale-105 shadow-lg' : 'hover:shadow-md hover:scale-105'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      style={{
        backgroundColor: active ? 'var(--btn-active-bg)' : (isHovered ? 'var(--btn-hover-bg)' : 'var(--btn-bg)'),
        color: active ? 'var(--btn-active-text)' : (isHovered ? 'var(--btn-hover-text)' : 'var(--btn-text)'),
        borderColor: 'var(--btn-border)',
      }}
    >
      {icon}
    </button>
  );
};

export const PanelButton: React.FC<{
  onClick: () => void;
  label: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  className?: string;
  disabled?: boolean;
}> = ({ onClick, label, icon, active, className, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={`flex-1 flex justify-center items-center gap-2 py-2 px-3 rounded-lg font-bold border transition-all text-[9px] uppercase tracking-wider ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={{
        backgroundColor: (active || isPressed) ? 'var(--btn-active-bg)' : (isHovered ? 'var(--btn-hover-bg)' : 'var(--btn-bg)'),
        color: (active || isPressed) ? 'var(--btn-active-text)' : (isHovered ? 'var(--btn-hover-text)' : 'var(--btn-text)'),
        borderColor: 'var(--btn-border)',
      }}
    >
      {icon}
      {label}
    </button>
  );
};

interface ControlProps {
  label: string;
  description?: string;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onReset?: () => void;
  isModified?: boolean; // New prop to indicate if it differs from default
}

const LockButton: React.FC<{ isLocked?: boolean; onToggle: () => void }> = ({ isLocked, onToggle }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    className={`ml-1 p-1 rounded transition-all ${isLocked ? 'text-amber-600 bg-amber-100/50' : 'text-slate-300 hover:text-slate-500'}`}
    title={isLocked ? "Unlock Parameter" : "Lock Parameter (Prevent Randomization)"}
  >
    {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
  </button>
);

const ModulationButton: React.FC<{ isActive: boolean; onClick: () => void }> = ({ isActive, onClick }) => (
   <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`ml-1 p-1 rounded transition-all ${isActive ? 'text-indigo-600 bg-indigo-100/50' : 'text-slate-300 hover:text-indigo-400'}`}
    title="Configure Modulation (Random, Velocity, Cursor, Audio...)"
   >
     <Activity size={10} />
   </button>
);

const ResetButton: React.FC<{ onReset: () => void; isModified?: boolean }> = ({ onReset, isModified }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onReset(); }}
    className={`ml-1 p-1 rounded transition-all ${isModified ? 'text-slate-300 hover:text-red-500 hover:bg-red-50' : 'text-slate-100'}`}
    title="Reset to Default"
    disabled={!isModified}
  >
    <RotateCcw size={10} className={!isModified ? "opacity-30" : ""} />
  </button>
);

const LabelWithTooltip: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
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

// --- VISUAL BEZIER EDITOR ---
const BezierEditor: React.FC<{
    p1x: number; p1y: number; p2x: number; p2y: number;
    p0y?: number; p3y?: number; // Start and End Y values
    onChange: (p: {p1x: number, p1y: number, p2x: number, p2y: number, p0y: number, p3y: number}) => void;
}> = ({ p1x, p1y, p2x, p2y, p0y = 0, p3y = 1, onChange }) => {
    
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<'p1' | 'p2' | null>(null);

    const toSvg = (x: number, y: number) => ({ x: x * 100, y: 100 - (y * 100) });
    const fromSvg = (x: number, y: number) => ({ x: Math.max(0, Math.min(1, x / 100)), y: Math.max(-0.5, Math.min(1.5, (100 - y) / 100)) });

    const cp1 = toSvg(p1x, p1y);
    const cp2 = toSvg(p2x, p2y);
    const start = toSvg(0, p0y);
    const end = toSvg(1, p3y);

    const pathData = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

    const handlePointerDown = (pt: 'p1' | 'p2') => (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(pt);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging || !svgRef.current) return;
        
        const rect = svgRef.current.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width) * 100;
        const relY = ((e.clientY - rect.top) / rect.height) * 100;
        
        const newVal = fromSvg(relX, relY);
        
        if (dragging === 'p1') {
            onChange({ p1x: newVal.x, p1y: newVal.y, p2x, p2y, p0y, p3y });
        } else {
            onChange({ p1x, p1y, p2x: newVal.x, p2y: newVal.y, p0y, p3y });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setDragging(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
        <div className="w-full flex flex-col gap-3 p-3 bg-white/50 rounded-xl border border-indigo-100 shadow-sm">
            <div className="flex justify-between items-center border-b border-indigo-100 pb-2 mb-1">
               <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Custom Curve</span>
               <span className="text-[9px] text-slate-400">0-1 / 1-0 Presets below</span>
            </div>

            <div className="flex gap-2 items-stretch h-40">
                {/* START VALUE SLIDER */}
                <div className="flex flex-col items-center justify-between w-6 bg-slate-100 rounded-lg p-1 relative border border-slate-200">
                    <span className="text-[7px] font-bold text-slate-400 uppercase">Start</span>
                    <input 
                        type="range" 
                        min="0" max="1" step="0.01" 
                        value={p0y} 
                        onChange={(e) => onChange({ p1x, p1y, p2x, p2y, p0y: parseFloat(e.target.value), p3y })}
                        className="absolute inset-0 m-auto -rotate-90 w-32 h-6 opacity-0 cursor-ns-resize z-20"
                    />
                    <div className="absolute w-2 bg-indigo-300 rounded-full bottom-6 pointer-events-none transition-all duration-75" style={{ height: `${p0y * 80}%` }} />
                    <span className="text-[8px] font-mono text-indigo-600 z-10 font-bold">{Math.round(p0y * 100)}%</span>
                </div>

                {/* INTERACTIVE GRAPH */}
                <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-inner relative touch-none select-none overflow-hidden">
                    <svg 
                        ref={svgRef}
                        viewBox="-10 -10 120 120" 
                        className="w-full h-full overflow-visible"
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    >
                        <defs>
                            <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
                                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
                            </pattern>
                        </defs>
                        <rect x="0" y="0" width="100" height="100" fill="url(#grid)" />
                        <line x1="0" y1="100" x2="100" y2="0" stroke="#e2e8f0" strokeDasharray="4" />
                        
                        {/* Control Lines */}
                        <line x1={start.x} y1={start.y} x2={cp1.x} y2={cp1.y} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="2" />
                        <line x1={end.x} y1={end.y} x2={cp2.x} y2={cp2.y} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="2" />
                        
                        {/* Curve */}
                        <path d={pathData} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
                        
                        {/* Handles */}
                        <circle 
                            cx={cp1.x} cy={cp1.y} r="6" 
                            fill="#818cf8" stroke="white" strokeWidth="2" 
                            className="cursor-pointer hover:fill-indigo-600 transition-colors shadow-sm"
                            onPointerDown={handlePointerDown('p1')}
                        />
                        <circle 
                            cx={cp2.x} cy={cp2.y} r="6" 
                            fill="#818cf8" stroke="white" strokeWidth="2" 
                            className="cursor-pointer hover:fill-indigo-600 transition-colors shadow-sm"
                            onPointerDown={handlePointerDown('p2')}
                        />

                        {/* Anchor points Visuals */}
                        <circle cx={start.x} cy={start.y} r="3" fill="#cbd5e1" />
                        <circle cx={end.x} cy={end.y} r="3" fill="#cbd5e1" />
                    </svg>
                </div>

                {/* END VALUE SLIDER */}
                <div className="flex flex-col items-center justify-between w-6 bg-slate-100 rounded-lg p-1 relative border border-slate-200">
                    <span className="text-[7px] font-bold text-slate-400 uppercase">End</span>
                    <input 
                        type="range" 
                        min="0" max="1" step="0.01" 
                        value={p3y} 
                        onChange={(e) => onChange({ p1x, p1y, p2x, p2y, p0y, p3y: parseFloat(e.target.value) })}
                        className="absolute inset-0 m-auto -rotate-90 w-32 h-6 opacity-0 cursor-ns-resize z-20"
                    />
                    <div className="absolute w-2 bg-indigo-300 rounded-full bottom-6 pointer-events-none transition-all duration-75" style={{ height: `${p3y * 80}%` }} />
                    <span className="text-[8px] font-mono text-indigo-600 z-10 font-bold">{Math.round(p3y * 100)}%</span>
                </div>
            </div>
            
            <div className="grid grid-cols-4 gap-1 border-t border-indigo-50 pt-2">
                <button 
                  onClick={() => onChange({ p1x: 0.5, p1y: 0.5, p2x: 0.5, p2y: 0.5, p0y: 0, p3y: 1 })} 
                  className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-indigo-100 rounded-lg transition-colors border border-slate-100"
                >
                  <TrendingUp size={12} className="text-indigo-500" />
                  <span className="text-[7px] font-bold uppercase">0-1</span>
                </button>
                <button 
                  onClick={() => onChange({ p1x: 0.5, p1y: 0.5, p2x: 0.5, p2y: 0.5, p0y: 1, p3y: 0 })} 
                  className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-indigo-100 rounded-lg transition-colors border border-slate-100"
                >
                  <TrendingDown size={12} className="text-pink-500" />
                  <span className="text-[7px] font-bold uppercase">1-0</span>
                </button>
                <button 
                  onClick={() => onChange({ p1x: 0.5, p1y: 1.5, p2x: 0.5, p2y: 1.5, p0y: 0, p3y: 0 })} 
                  className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-indigo-100 rounded-lg transition-colors border border-slate-100"
                >
                  <Waves size={12} className="text-emerald-500" />
                  <span className="text-[7px] font-bold uppercase">0-1-0</span>
                </button>
                <button 
                  onClick={() => onChange({ p1x: 0.5, p1y: -0.5, p2x: 0.5, p2y: -0.5, p0y: 1, p3y: 1 })} 
                  className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-indigo-100 rounded-lg transition-colors border border-slate-100"
                >
                  <ArrowDownUp size={12} className="text-amber-500" />
                  <span className="text-[7px] font-bold uppercase">1-0-1</span>
                </button>
            </div>
        </div>
    );
};

interface ModulationPopupProps {
  config?: ModulationConfig;
  onChange: (cfg: ModulationConfig | undefined) => void;
  baseValue: number;
}

const ModulationPopup: React.FC<ModulationPopupProps> = ({ config, onChange, baseValue }) => {
  const source = config?.source || 'none';
  const easing = config?.easing || 'linear';
  const scope = config?.scope || 'stroke';
  const speed = config?.speed ?? 1;
  const inputMin = config?.inputMin ?? 0;
  const inputMax = config?.inputMax ?? 1;
  const invert = config?.invertDirection || false;

  const handleSourceChange = (s: string) => {
    if (s === 'none') {
      onChange(undefined);
    } else {
      onChange({ 
        source: s as ModulationSource, 
        scope: scope,
        min: config?.min ?? baseValue, 
        max: config?.max ?? baseValue,
        easing: config?.easing ?? 'linear',
        speed: config?.speed ?? 1,
        inputMin: 0,
        inputMax: 1,
        paramA: 0.5, 
        paramB: 0.5,
        paramC: 0.5,
        paramD: 0.5,
        paramE: 0, 
        paramF: 1, 
        invertDirection: false
      });
    }
  };

  const updateConfig = (updates: Partial<ModulationConfig>) => {
    if (config) {
      onChange({ ...config, ...updates });
    }
  };

  const MiniSlider = ({ label, value, min, max, step, onChange, unit = "" }: any) => (
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-slate-400 w-12 text-right">{label}</span>
        <input 
            type="range" min={min} max={max} step={step} value={value} 
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 accent-indigo-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-[9px] font-mono text-slate-500 w-6">{value.toFixed(1)}{unit}</span>
      </div>
  );

  const isTimeBased = source.startsWith('time');

  return (
    <div className="mt-2 p-3 bg-slate-50/90 rounded-xl border border-slate-200 text-[10px] animate-fade-in-up z-20 relative shadow-sm">
       <div className="flex flex-col gap-3">
          
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 uppercase w-10 text-[9px] tracking-wider">Input</span>
            <select 
              value={source} 
              onChange={(e) => handleSourceChange(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:ring-1 ring-indigo-500 flex-1 cursor-pointer text-xs font-medium text-slate-700 shadow-sm"
            >
              <option value="none">Fixed Value</option>
              <optgroup label="Generative">
                <option value="random">Random</option>
                <option value="index">Stroke Index</option>
                <option value="time">Time (Loop)</option>
                <option value="time-pulse">Time (Pulse/Pause)</option>
                <option value="time-step">Time (Step)</option>
              </optgroup>
              <optgroup label="Geometry">
                <option value="path">Path Start -> End</option>
                <option value="path-mirror">Path Center (0-1-0)</option>
                <option value="path-mirror-inv">Path Edges (1-0-1)</option>
              </optgroup>
              <optgroup label="Interaction">
                <option value="velocity">Draw Speed</option>
                <option value="pressure">Pressure</option>
                <option value="cursor">Cursor Distance</option>
              </optgroup>
              <optgroup label="Audio">
                <option value="audio-live">Live Mic Volume</option>
                <option value="audio-sample">Stroke Sound</option>
              </optgroup>
            </select>
          </div>

          {source !== 'none' && (
            <>
              <div className="flex items-center gap-2">
                 <span className="font-bold text-slate-500 uppercase w-10 text-[9px] tracking-wider">Mode</span>
                 <div className="flex flex-1 bg-slate-200/50 p-0.5 rounded-lg border border-slate-200">
                    <button 
                      onClick={() => updateConfig({ scope: 'stroke' })}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md transition-all ${scope === 'stroke' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Per Stroke (One value for the whole stroke)"
                    >
                       <Minus size={10} strokeWidth={4} /> <span className="text-[9px]">Stroke</span>
                    </button>
                    <button 
                      onClick={() => updateConfig({ scope: 'point' })}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md transition-all ${scope === 'point' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Per Point (Varies along the stroke)"
                    >
                       <MoreHorizontal size={10} strokeWidth={4} /> <span className="text-[9px]">Points</span>
                    </button>
                 </div>
              </div>

              {isTimeBased && (
                 <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 uppercase w-10 text-[9px] tracking-wider">Speed</span>
                        <div className="flex flex-1 items-center gap-2">
                            <Clock size={12} className="text-slate-400" />
                            <input 
                            type="range" 
                            min="0.1" 
                            max="5" 
                            step="0.1" 
                            value={speed}
                            onChange={(e) => updateConfig({ speed: parseFloat(e.target.value) })}
                            className="flex-1 accent-indigo-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-[9px] font-mono w-6 text-right text-slate-500">{speed.toFixed(1)}x</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between bg-slate-100/50 p-2 rounded-lg border border-slate-200">
                        <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <ArrowLeftRight size={10} /> Invert Flow
                        </span>
                        <button
                            onClick={() => updateConfig({ invertDirection: !invert })}
                            className={`w-8 h-4 rounded-full transition-colors duration-200 relative shadow-inner ${invert ? 'bg-indigo-500' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 shadow-sm ${invert ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                 </div>
              )}

              {source === 'time-pulse' && (
                  <div className="space-y-1 bg-slate-100/50 p-2 rounded-lg border border-slate-200">
                      <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-1">Pulse Settings</div>
                      <MiniSlider label="Duty" value={config?.paramA ?? 0.5} min={0.1} max={0.9} step={0.01} onChange={(v:number) => updateConfig({paramA: v})} unit="%" />
                      <MiniSlider label="Pause" value={config?.paramB ?? 0.5} min={0} max={1} step={0.01} onChange={(v:number) => updateConfig({paramB: v})} unit="s" />
                  </div>
              )}

              <div className="space-y-1 bg-slate-100/50 p-2 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      <span>Input Range</span>
                      <ArrowRightFromLine size={10} />
                  </div>
                  <div className="flex gap-2 items-center">
                      <span className="text-[9px] text-slate-500 w-6">Min</span>
                      <input 
                          type="range" min="0" max="1" step="0.05" 
                          value={inputMin} 
                          onChange={(e) => updateConfig({ inputMin: parseFloat(e.target.value) })}
                          className="flex-1 accent-slate-400 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                  </div>
                  <div className="flex gap-2 items-center">
                      <span className="text-[9px] text-slate-500 w-6">Max</span>
                      <input 
                          type="range" min="0" max="1" step="0.05" 
                          value={inputMax} 
                          onChange={(e) => updateConfig({ inputMax: parseFloat(e.target.value) })}
                          className="flex-1 accent-slate-400 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                  </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase w-10 text-[9px] tracking-wider">Curve</span>
                <select 
                  value={easing} 
                  onChange={(e) => updateConfig({ easing: e.target.value as EasingMode })}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:ring-1 ring-indigo-500 flex-1 cursor-pointer text-xs font-medium text-slate-700 shadow-sm"
                >
                  <option value="linear">Linear ( / )</option>
                  <option value="easeInQuad">Ease In ( _/ )</option>
                  <option value="easeOutQuad">Ease Out ( /~ )</option>
                  <option value="easeInOutQuad">Smooth ( ~ )</option>
                  <option value="step">Step ( _|- )</option>
                  <option value="triangle">Triangle ( 0-1-0 )</option>
                  <option value="triangle-inv">Inv Triangle ( 1-0-1 )</option>
                  <option value="sine">Sine ( 0-1-0 Smooth )</option>
                  <option value="random">Random Noise</option>
                  <option value="custom-bezier">Custom Bezier</option>
                </select>
              </div>

              {easing === 'custom-bezier' && (
                  <BezierEditor 
                    p1x={config?.paramA ?? 0.5} 
                    p1y={config?.paramB ?? 0.5} 
                    p2x={config?.paramC ?? 0.5} 
                    p2y={config?.paramD ?? 0.5}
                    p0y={config?.paramE ?? 0}
                    p3y={config?.paramF ?? 1}
                    onChange={(pts) => updateConfig({ 
                        paramA: pts.p1x, 
                        paramB: pts.p1y, 
                        paramC: pts.p2x, 
                        paramD: pts.p2y,
                        paramE: pts.p0y,
                        paramF: pts.p3y
                    })}
                  />
              )}
            </>
          )}
       </div>
    </div>
  );
};

export const SoundRecorder: React.FC<{
  onBufferReady: (buffer: AudioBuffer) => void;
}> = ({ onBufferReady }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [previewBuffer, setPreviewBuffer] = useState<AudioBuffer | null>(null);

  const handleRecord = async () => {
    setIsRecording(true);
    setPreviewBuffer(null);
    const buffer = await audioManager.recordAudio(2000); 
    setIsRecording(false);
    if (buffer) {
      setPreviewBuffer(buffer);
      onBufferReady(buffer);
    }
  };

  const playPreview = async () => {
    if (!previewBuffer) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = ctx.createBufferSource();
    source.buffer = previewBuffer;
    source.connect(ctx.destination);
    source.start();
  };

  return (
    <div className="flex gap-2 items-center bg-white/40 p-2 rounded-lg border border-white/20">
      <button 
        onClick={handleRecord}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
        title="Record (2s)"
      >
        {isRecording ? <Square size={12} fill="currentColor" /> : <Mic size={14} />}
      </button>
      
      {previewBuffer && (
        <button 
          onClick={playPreview}
          className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 flex items-center justify-center"
          title="Preview Recording"
        >
          <Play size={14} fill="currentColor" />
        </button>
      )}
      
      {!isRecording && !previewBuffer && <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Record Sound</span>}
      {isRecording && <span className="text-[9px] text-red-500 uppercase font-bold tracking-wide">Recording...</span>}
      {previewBuffer && <span className="text-[9px] text-indigo-500 uppercase font-bold tracking-wide">Ready</span>}
    </div>
  );
};

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
