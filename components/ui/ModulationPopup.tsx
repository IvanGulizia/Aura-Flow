import React from 'react';
import { Minus, MoreHorizontal, Clock, ArrowLeftRight, ArrowRightFromLine } from 'lucide-react';
import { ModulationConfig, ModulationSource, EasingMode } from '../../types';
import { BezierEditor } from './BezierEditor';

interface ModulationPopupProps {
  config?: ModulationConfig;
  onChange: (cfg: ModulationConfig | undefined) => void;
  baseValue: number;
}

export const ModulationPopup: React.FC<ModulationPopupProps> = ({ config, onChange, baseValue }) => {
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