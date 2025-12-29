
import React, { useEffect, useState } from 'react';
import { Minus, MoreHorizontal, Clock, ArrowLeftRight, ArrowRightFromLine, Timer, Activity, Mic, MousePointer } from 'lucide-react';
import { ModulationConfig, ModulationSource, EasingMode } from '../../types';
import { BezierEditor } from './BezierEditor';
import { audioManager } from '../../services/audioService';

interface ModulationPopupProps {
  config?: ModulationConfig;
  onChange: (cfg: ModulationConfig | undefined) => void;
  baseValue: number;
}

const MiniSlider = ({ label, value, min, max, step, onChange, unit = "" }: any) => (
  <div className="flex items-center gap-2">
    <span className="text-[9px] font-bold text-slate-400 w-16 text-right">{label}</span>
    <input 
        type="range" min={min} max={max} step={step} value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-indigo-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
    />
    <span className="text-[9px] font-mono text-slate-500 w-6">{value.toFixed(1)}{unit}</span>
  </div>
);

// New component for real-time visualization inside popup
const ModulationMonitor = ({ source }: { source: ModulationSource }) => {
    const [level, setLevel] = useState(0);

    useEffect(() => {
        let req: number;
        const update = () => {
            if (source === 'audio-live') {
                setLevel(audioManager.getGlobalAudioData().average / 255);
            } else if (source === 'cursor') {
                // Approximate global cursor level for visual feedback
                // (This is just for UI visualization, actual physics uses precise coords)
                setLevel(0.5); 
            }
            req = requestAnimationFrame(update);
        };
        req = requestAnimationFrame(update);
        return () => cancelAnimationFrame(req);
    }, [source]);

    const isAudio = source === 'audio-live';

    return (
        <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded border border-slate-200">
            <div className="flex-none text-indigo-500">
                {isAudio ? <Mic size={10} /> : <MousePointer size={10} />}
            </div>
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden relative shadow-inner">
                <div 
                    className={`absolute inset-y-0 left-0 transition-all duration-75 ${isAudio ? 'bg-indigo-500' : 'bg-amber-500'}`}
                    style={{ width: `${level * 100}%` }}
                />
            </div>
            <span className="text-[8px] font-mono text-slate-400 w-6 text-right">{Math.round(level * 100)}%</span>
        </div>
    );
};

export const ModulationPopup: React.FC<ModulationPopupProps> = ({ config, onChange, baseValue }) => {
  const source = config?.source || 'none';
  const easing = config?.easing || 'linear';
  const scope = config?.scope || 'stroke';
  const speed = config?.speed ?? 1;
  const speedStrategy = config?.speedStrategy || 'frequency';
  const inputMin = config?.inputMin ?? 0;
  const inputMax = config?.inputMax ?? (source === 'cursor' ? 500 : 1);
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
        speedStrategy: 'frequency',
        inputMin: 0,
        inputMax: s === 'cursor' ? 300 : 1,
        paramA: 0.5, 
        paramB: 0, // 0: Radial, 1: X, 2: Y
        paramC: 0, 
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

  const isTimeBased = source.startsWith('time');
  const isCursor = source === 'cursor';
  const isAudioLive = source === 'audio-live';

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
                <option value="index">Global Stroke Index</option>
                <option value="selection-index">Selection Index</option>
                <option value="time">Time (Loop)</option>
                <option value="time-pulse">Time (Pulse)</option>
                <option value="time-step">Time (Step)</option>
              </optgroup>
              <optgroup label="Geometry">
                <option value="path">Path progression</option>
                <option value="path-mirror">Path mirror (0-1-0)</option>
              </optgroup>
              <optgroup label="Interaction">
                <option value="velocity">Draw Velocity</option>
                <option value="pressure">Pressure</option>
                <option value="cursor">Cursor Distance</option>
              </optgroup>
              <optgroup label="Audio">
                <option value="audio-live">Microphone (Live)</option>
                <option value="audio-sample">Stroke Audio Buffer</option>
              </optgroup>
            </select>
          </div>

          {(isAudioLive || isCursor) && <ModulationMonitor source={source as ModulationSource} />}

          {source !== 'none' && (
            <>
              <div className="flex items-center gap-2">
                 <span className="font-bold text-slate-500 uppercase w-10 text-[9px] tracking-wider">Scope</span>
                 <div className="flex flex-1 bg-slate-200/50 p-0.5 rounded-lg border border-slate-200">
                    <button 
                      onClick={() => updateConfig({ scope: 'stroke' })}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md transition-all ${scope === 'stroke' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Apply one value to the whole stroke"
                    >
                       <Minus size={10} strokeWidth={4} /> <span className="text-[9px]">Stroke</span>
                    </button>
                    <button 
                      onClick={() => updateConfig({ scope: 'point' })}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md transition-all ${scope === 'point' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Vary value along the path points"
                    >
                       <MoreHorizontal size={10} strokeWidth={4} /> <span className="text-[9px]">Point</span>
                    </button>
                 </div>
              </div>

              {isCursor && (
                 <div className="flex flex-col gap-2 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-600 uppercase w-10 text-[9px] tracking-wider">Axis</span>
                        <div className="flex flex-1 bg-white/50 p-0.5 rounded-lg border border-indigo-200 shadow-sm">
                            <button 
                              onClick={() => updateConfig({ paramB: 0 })}
                              className={`flex-1 flex items-center justify-center py-1 rounded-md transition-all ${config?.paramB === 0 || !config?.paramB ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-400'}`}
                            >
                               <span className="text-[9px]">Radial</span>
                            </button>
                            <button 
                              onClick={() => updateConfig({ paramB: 1 })}
                              className={`flex-1 flex items-center justify-center py-1 rounded-md transition-all ${config?.paramB === 1 ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-400'}`}
                            >
                               <span className="text-[9px]">X-Axis</span>
                            </button>
                            <button 
                              onClick={() => updateConfig({ paramB: 2 })}
                              className={`flex-1 flex items-center justify-center py-1 rounded-md transition-all ${config?.paramB === 2 ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-400'}`}
                            >
                               <span className="text-[9px]">Y-Axis</span>
                            </button>
                        </div>
                    </div>
                 </div>
              )}

              <div className="space-y-1 bg-slate-100/50 p-2 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      <span>{isCursor ? 'Trigger Distance (px)' : 'Input Range (Sensitivity)'}</span>
                      <ArrowRightFromLine size={10} />
                  </div>
                  <div className="flex gap-2 items-center">
                      <span className="text-[9px] text-slate-500 w-6">Start</span>
                      <input 
                          type="range" min="0" max={isCursor ? 1000 : 1} step={isCursor ? 10 : 0.01} 
                          value={inputMin} 
                          onChange={(e) => updateConfig({ inputMin: parseFloat(e.target.value) })}
                          className="flex-1 accent-indigo-400 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-[8px] font-mono w-8 text-right">{isCursor ? Math.round(inputMin) : Math.round(inputMin * 100) + '%'}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                      <span className="text-[9px] text-slate-500 w-6">End</span>
                      <input 
                          type="range" min="0" max={isCursor ? 1000 : 1} step={isCursor ? 10 : 0.01} 
                          value={inputMax} 
                          onChange={(e) => updateConfig({ inputMax: parseFloat(e.target.value) })}
                          className="flex-1 accent-indigo-400 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-[8px] font-mono w-8 text-right">{isCursor ? Math.round(inputMax) : Math.round(inputMax * 100) + '%'}</span>
                  </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase w-10 text-[9px] tracking-wider">Curve</span>
                <select 
                  value={easing} 
                  onChange={(e) => updateConfig({ easing: e.target.value as EasingMode })}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:ring-1 ring-indigo-500 flex-1 cursor-pointer text-xs font-medium text-slate-700 shadow-sm"
                >
                  <option value="linear">Linear</option>
                  <option value="easeInQuad">Ease In</option>
                  <option value="easeOutQuad">Ease Out</option>
                  <option value="easeInOutQuad">Smooth</option>
                  <option value="step">Snap Step</option>
                  <option value="triangle">Triangle</option>
                  <option value="sine">Sine</option>
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
