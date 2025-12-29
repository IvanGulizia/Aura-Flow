import React from 'react';
import { Slider, SectionHeader } from '../../ui/Controls';
import { ParamsSectionProps } from './types';

export const PhysicsSection: React.FC<ParamsSectionProps> = ({ 
  isOpen, onToggle, onReset, onRandom, currentParams, updateParam, shouldShow, getCommonProps 
}) => {
  return (
    <>
      <SectionHeader title="Physics" isOpen={isOpen} onToggle={onToggle} onReset={onReset} onRandom={onRandom} />
      {isOpen && (
        <div className="pb-4 space-y-1">
          {shouldShow('mass') && <Slider label="Mass" value={currentParams.mass} min={0.1} max={5} step={0.1} onChange={(v) => updateParam('mass', v)} {...getCommonProps('mass')} />}
          {shouldShow('friction') && <Slider label="Friction" value={currentParams.friction} min={0.5} max={0.99} step={0.01} onChange={(v) => updateParam('friction', v)} {...getCommonProps('friction')} />}
          {shouldShow('elasticity') && <Slider label="Elasticity" value={currentParams.elasticity} min={0} max={0.5} step={0.001} onChange={(v) => updateParam('elasticity', v)} {...getCommonProps('elasticity')} />}
          {shouldShow('maxDisplacement') && <Slider label="Max Displacement" value={currentParams.maxDisplacement} min={0} max={1000} step={1} onChange={(v) => updateParam('maxDisplacement', v)} {...getCommonProps('maxDisplacement')} />}
          {shouldShow('viscosity') && <Slider label="Viscosity" value={currentParams.viscosity} min={0} max={1} step={0.01} onChange={(v) => updateParam('viscosity', v)} {...getCommonProps('viscosity')} />}
          {shouldShow('tension') && <Slider label="Tension" value={currentParams.tension} min={0} max={5} step={0.1} onChange={(v) => updateParam('tension', v)} {...getCommonProps('tension')} />}
          {shouldShow('gravityX') && <Slider label="Gravity X" value={currentParams.gravityX} min={-0.5} max={0.5} step={0.01} onChange={(v) => updateParam('gravityX', v)} {...getCommonProps('gravityX')} />}
          {shouldShow('gravityY') && <Slider label="Gravity Y" value={currentParams.gravityY} min={-0.5} max={0.5} step={0.01} onChange={(v) => updateParam('gravityY', v)} {...getCommonProps('gravityY')} />}
        </div>
      )}
    </>
  );
};