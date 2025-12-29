import React from 'react';
import { Spline as SplineIcon } from 'lucide-react';
import { Slider, Toggle, SectionHeader } from '../../ui/Controls';
import { ParamsSectionProps } from './types';

export const ShapeSection: React.FC<ParamsSectionProps> = ({ 
  isOpen, onToggle, onReset, onRandom, currentParams, updateParam, shouldShow, getCommonProps, showModifiedOnly 
}) => {
  return (
    <>
      <SectionHeader title="Shape & Motion" isOpen={isOpen} onToggle={onToggle} onReset={onReset} onRandom={onRandom} />
      {isOpen && (
        <div className="pb-4 space-y-1">
          {shouldShow('segmentation') && <Slider label="Resolution" value={currentParams.segmentation} min={2} max={50} step={1} onChange={(v) => updateParam('segmentation', v)} {...getCommonProps('segmentation')} />}
          
          {(!showModifiedOnly || [shouldShow('closePath'), shouldShow('closePathRadius')].some(Boolean)) && (
            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 my-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"> <SplineIcon size={12} /> Auto Close </div>
                <Toggle label="" value={currentParams.closePath} onChange={(v) => updateParam('closePath', v)} />
              </div>
              {currentParams.closePath && ( <div className="animate-fade-in-up"> <Slider label="Snap Radius" value={currentParams.closePathRadius} min={10} max={200} step={10} onChange={(v) => updateParam('closePathRadius', v)} {...getCommonProps('closePathRadius')} /> </div> )}
            </div>
          )}
          
          {(!showModifiedOnly || [shouldShow('wiggleAmplitude'), shouldShow('wiggleFrequency'), shouldShow('waveSpeed')].some(Boolean)) && (
            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 my-2">
              <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Wiggle</div>
              {shouldShow('wiggleAmplitude') && <Slider label="Amplitude" value={currentParams.wiggleAmplitude} min={0} max={20} step={0.1} onChange={(v) => updateParam('wiggleAmplitude', v)} {...getCommonProps('wiggleAmplitude')} />}
              {shouldShow('wiggleFrequency') && <Slider label="Frequency" value={currentParams.wiggleFrequency} min={0.01} max={0.5} step={0.01} onChange={(v) => updateParam('wiggleFrequency', v)} {...getCommonProps('wiggleFrequency')} />}
              {shouldShow('waveSpeed') && <Slider label="Speed" value={currentParams.waveSpeed} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('waveSpeed', v)} {...getCommonProps('waveSpeed')} />}
            </div>
          )}
        </div>
      )}
    </>
  );
};