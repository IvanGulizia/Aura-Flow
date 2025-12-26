
import React from 'react';
import { Slider, Toggle, SectionHeader } from '../../ui/Controls';
import { ParamsSectionProps } from './types';
import { PARAM_DESCRIPTIONS } from '../../../constants/defaults';

export const AudioSection: React.FC<ParamsSectionProps> = ({ 
  isOpen, onToggle, onReset, onRandom, currentParams, updateParam, shouldShow, getCommonProps 
}) => {
  return (
    <>
      <SectionHeader title="Audio Reactivity" isOpen={isOpen} onToggle={onToggle} onReset={onReset} onRandom={onRandom} />
      {isOpen && (
        <div className="pb-4 space-y-1">
          {shouldShow('audioSensitivity') && <Slider label="Sensitivity" value={currentParams.audioSensitivity} min={0} max={5} step={0.1} onChange={(v) => updateParam('audioSensitivity', v)} {...getCommonProps('audioSensitivity')} />}
          {shouldShow('audioToWidth') && <Toggle label="Audio -> Width" description={PARAM_DESCRIPTIONS['audioToWidth']} value={currentParams.audioToWidth} onChange={(v) => updateParam('audioToWidth', v)} />}
          {shouldShow('audioToColor') && <Toggle label="Audio -> Color" description={PARAM_DESCRIPTIONS['audioToColor']} value={currentParams.audioToColor} onChange={(v) => updateParam('audioToColor', v)} />}
          {shouldShow('audioToWiggle') && <Toggle label="Audio -> Wiggle" description={PARAM_DESCRIPTIONS['audioToWiggle']} value={currentParams.audioToWiggle} onChange={(v) => updateParam('audioToWiggle', v)} />}
        </div>
      )}
    </>
  );
};
