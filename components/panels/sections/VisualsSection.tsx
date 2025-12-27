
import React from 'react';
import { PaintBucket, Link2, Link2Off, Palette, Plus, MinusCircle } from 'lucide-react';
import { Slider, Toggle, Select, ColorInput, SectionHeader } from '../../ui/Controls';
import { ParamsSectionProps } from './types';
import { SimulationParams, BlendMode, LineCapMode } from '../../../types';
import { BLEND_MODES, DEFAULT_PARAMS, PARAM_DESCRIPTIONS } from '../../../constants/defaults';

interface VisualsSectionProps extends ParamsSectionProps {
  updateFill: (updates: Partial<SimulationParams['fill']>) => void;
  updateFillGradient: (updates: Partial<SimulationParams['fill']['gradient']>) => void;
  updateGradient: (updates: Partial<SimulationParams['gradient']>) => void;
  addGradientColor: () => void;
  removeGradientColor: (index: number) => void;
  updateGradientColor: (index: number, color: string) => void;
}

export const VisualsSection: React.FC<VisualsSectionProps> = ({ 
  isOpen, onToggle, onReset, onRandom, currentParams, updateParam, shouldShow, getCommonProps,
  updateFill, updateFillGradient, updateGradient, addGradientColor, removeGradientColor, updateGradientColor
}) => {
  return (
    <>
      <SectionHeader title="Visuals" isOpen={isOpen} onToggle={onToggle} onReset={onReset} onRandom={onRandom} />
      {isOpen && (
        <div className="pb-4 space-y-2">
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
            {shouldShow('strokeWidth') && <Slider label="Width" value={currentParams.strokeWidth} min={0} max={30} step={0.5} onChange={(v) => updateParam('strokeWidth', v)} {...getCommonProps('strokeWidth')} />}
            {shouldShow('opacity') && <Slider label="Opacity" value={currentParams.opacity} min={0} max={1} step={0.01} onChange={(v) => updateParam('opacity', v)} {...getCommonProps('opacity')} />}
            {shouldShow('blendMode') && <Select label="Blend Mode" value={currentParams.blendMode} options={BLEND_MODES} onChange={(v) => updateParam('blendMode', v as BlendMode)} {...getCommonProps('blendMode')} />}
            {shouldShow('lineCap') && <Select label="Line Cap" value={currentParams.lineCap || 'round'} options={['round', 'butt', 'square']} onChange={(v) => updateParam('lineCap', v as LineCapMode)} description="End style of the stroke" />}
            {shouldShow('seamlessPath') && <Toggle label="Seamless Path" value={currentParams.seamlessPath} onChange={(v) => updateParam('seamlessPath', v)} />}
            {shouldShow('pathRounding') && <Slider label="Roundness" value={currentParams.pathRounding} min={0} max={2} step={0.1} onChange={(v) => updateParam('pathRounding', v)} {...getCommonProps('pathRounding')} description="0 = Sharp, 1 = Classic, 2 = Max Arc" />}
            {shouldShow('smoothModulation') && <Toggle label="Smooth Modulation" description={PARAM_DESCRIPTIONS['smoothModulation']} value={currentParams.smoothModulation} onChange={(v) => updateParam('smoothModulation', v)} />}
            {shouldShow('drawPoints') && <Toggle label="Draw Points" description={PARAM_DESCRIPTIONS['drawPoints']} value={currentParams.drawPoints} onChange={(v) => updateParam('drawPoints', v)} />}
            {shouldShow('hueShift') && <Slider label="Hue Shift" value={currentParams.hueShift || 0} min={0} max={360} step={1} onChange={(v) => updateParam('hueShift', v)} {...getCommonProps('hueShift')} />}
          </div>

          {shouldShow('fill') && (
            <div className="bg-pink-50/50 p-3 rounded-xl border border-pink-100/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-pink-500"><PaintBucket size={12} /> Fill Mode</div>
                <Toggle label="" value={currentParams.fill?.enabled || false} onChange={(v) => updateFill({ enabled: v })} />
              </div>
              {currentParams.fill?.enabled && (
                <div className="animate-fade-in-up space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"> {currentParams.fill.syncWithStroke ? <Link2 size={10} /> : <Link2Off size={10} />} Sync Gradient </span>
                    <Toggle label="" value={currentParams.fill.syncWithStroke} onChange={(v) => updateFill({ syncWithStroke: v })} />
                  </div>
                  {shouldShow('fill', currentParams.fill.blendMode, DEFAULT_PARAMS.fill.blendMode) && <Select label="Fill Blend Mode" value={currentParams.fill.blendMode || 'source-over'} options={BLEND_MODES} onChange={(v) => updateFill({ blendMode: v as BlendMode })} />}
                  {shouldShow('fill', currentParams.fill.opacity, DEFAULT_PARAMS.fill.opacity) && <Slider label="Fill Opacity" value={currentParams.fill.opacity} min={0} max={1} step={0.01} onChange={(v) => updateFill({ opacity: v })} />}
                  {shouldShow('fill', currentParams.fill.blur, DEFAULT_PARAMS.fill.blur) && <Slider label="Fill Blur" value={currentParams.fill.blur || 0} min={0} max={50} step={1} onChange={(v) => updateFill({ blur: v })} />}
                  <Toggle label="Fill Glow" value={currentParams.fill.glow || false} onChange={(v) => updateFill({ glow: v })} description="Apply glow effect to the filled area" />
                  {!currentParams.fill.syncWithStroke && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Type</span>
                        <div className="flex bg-slate-200 rounded p-0.5">
                          <button onClick={() => updateFill({ type: 'solid' })} className={`px-2 py-0.5 rounded text-[9px] font-bold ${currentParams.fill.type !== 'gradient' ? 'bg-white shadow text-pink-600' : 'text-slate-500'}`}>Solid</button>
                          <button onClick={() => updateFill({ type: 'gradient' })} className={`px-2 py-0.5 rounded text-[9px] font-bold ${currentParams.fill.type === 'gradient' ? 'bg-white shadow text-pink-600' : 'text-slate-500'}`}>Gradient</button>
                        </div>
                      </div>
                      {currentParams.fill.type === 'gradient' ? (
                        <div className="space-y-2 p-2 bg-white/50 rounded-lg border border-pink-200">
                          <div className="space-y-1">
                            {currentParams.fill.gradient.colors.map((c, i) => (
                              <ColorInput key={i} label={`Stop ${i+1}`} val={c} onChange={(v) => {
                                const newColors = [...currentParams.fill.gradient.colors];
                                newColors[i] = v;
                                updateFillGradient({ colors: newColors });
                              }} />
                            ))}
                          </div>
                          <Slider label="Angle" value={currentParams.fillGradientAngle} min={0} max={360} step={1} onChange={(v) => updateParam('fillGradientAngle', v)} {...getCommonProps('fillGradientAngle')} />
                        </div>
                      ) : (
                        <>
                          <Select label="Color Source" value={currentParams.fill.colorSource} options={['stroke', 'custom']} onChange={(v) => updateFill({ colorSource: v as any })} />
                          {currentParams.fill.colorSource === 'custom' && ( <ColorInput label="Custom Color" val={currentParams.fill.customColor} onChange={(v) => updateFill({ customColor: v })} /> )}
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
                <Toggle label="" value={currentParams.gradient?.enabled || false} onChange={(v) => updateGradient({ enabled: v })} />
              </div>
              {currentParams.gradient?.enabled && (
                <div className="animate-fade-in-up space-y-2">
                  <Select label="Gradient Type" value={currentParams.strokeGradientType || 'linear'} options={['linear', 'path']} onChange={(v) => updateParam('strokeGradientType', v as any)} description={PARAM_DESCRIPTIONS['strokeGradientType']} />
                  <div className="space-y-1 bg-white/50 p-2 rounded-lg border border-sky-100">
                    {currentParams.gradient.colors.map((c, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="flex-1"><ColorInput label={`Color ${i+1}`} val={c} onChange={(v) => updateGradientColor(i, v)} /></div>
                        {currentParams.gradient.colors.length > 2 && (
                          <button onClick={() => removeGradientColor(i)} className="text-red-400 hover:text-red-600 transition-colors"><MinusCircle size={12} /></button>
                        )}
                      </div>
                    ))}
                    <button onClick={addGradientColor} className="w-full flex items-center justify-center py-1 mt-1 bg-sky-100/50 hover:bg-sky-200/50 text-sky-600 rounded-md text-[8px] font-bold transition-all"><Plus size={10} /> ADD COLOR</button>
                  </div>
                  {currentParams.strokeGradientType === 'linear' && (
                    <>
                      <Slider label="Angle" value={currentParams.strokeGradientAngle} min={0} max={360} step={1} onChange={(v) => updateParam('strokeGradientAngle', v)} {...getCommonProps('strokeGradientAngle')} />
                      <Slider label="Midpoint" value={currentParams.strokeGradientMidpoint || 0.5} min={0} max={1} step={0.01} onChange={(v) => updateParam('strokeGradientMidpoint', v)} {...getCommonProps('strokeGradientMidpoint')} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {shouldShow('glowStrength') && <Slider label="Glow Strength" value={currentParams.glowStrength} min={0} max={50} step={1} onChange={(v) => updateParam('glowStrength', v)} {...getCommonProps('glowStrength')} />}
          {shouldShow('blurStrength') && <Slider label="Blur Strength" value={currentParams.blurStrength} min={0} max={20} step={0.1} onChange={(v) => updateParam('blurStrength', v)} {...getCommonProps('blurStrength')} />}
        </div>
      )}
    </>
  );
};
