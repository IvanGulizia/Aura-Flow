
import React from 'react';
import { Users, Zap } from 'lucide-react';
import { Slider, SectionHeader } from '../../ui/Controls';
import { ParamsSectionProps } from './types';

export const SocialSection: React.FC<ParamsSectionProps> = ({ 
  isOpen, onToggle, onReset, onRandom, currentParams, updateParam, shouldShow, getCommonProps, showModifiedOnly 
}) => {
  return (
    <>
      <SectionHeader title="Interaction" isOpen={isOpen} onToggle={onToggle} onReset={onReset} onRandom={onRandom} />
      {isOpen && (
        <div className="pb-4 space-y-3">
          {(!showModifiedOnly || [shouldShow('neighborRadius'), shouldShow('repulsionForce'), shouldShow('attractionForce'), shouldShow('alignmentForce'), shouldShow('cohesionForce')].some(Boolean)) && (
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
              <div className="text-[9px] font-bold text-indigo-400 mb-3 flex items-center gap-1 uppercase tracking-widest"><Users size={10}/> Swarm Intelligence</div>
              {shouldShow('neighborRadius') && <Slider label="Radius" value={currentParams.neighborRadius} min={10} max={300} step={10} onChange={(v) => updateParam('neighborRadius', v)} {...getCommonProps('neighborRadius')} />}
              {shouldShow('repulsionForce') && <Slider label="Repulsion" value={currentParams.repulsionForce} min={0} max={0.2} step={0.005} onChange={(v) => updateParam('repulsionForce', v)} {...getCommonProps('repulsionForce')} />}
              {shouldShow('attractionForce') && <Slider label="Attraction" value={currentParams.attractionForce} min={0} max={0.2} step={0.005} onChange={(v) => updateParam('attractionForce', v)} {...getCommonProps('attractionForce')} />}
              {shouldShow('alignmentForce') && <Slider label="Alignment" value={currentParams.alignmentForce} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('alignmentForce', v)} {...getCommonProps('alignmentForce')} />}
              {shouldShow('cohesionForce') && <Slider label="Cohesion" value={currentParams.cohesionForce} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('cohesionForce', v)} {...getCommonProps('cohesionForce')} />}
              <Slider label="Cursor Influence" value={currentParams.swarmCursorInfluence || 0} min={0} max={1} step={0.1} onChange={(v) => updateParam('swarmCursorInfluence', v)} description="0 = Always Active, 1 = Only near cursor" />
            </div>
          )}
          {(!showModifiedOnly || [shouldShow('mouseInfluenceRadius'), shouldShow('mouseRepulsion'), shouldShow('mouseAttraction'), shouldShow('mouseFalloff')].some(Boolean)) && (
            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
              <div className="text-[9px] font-bold text-amber-500 mb-3 flex items-center gap-1 uppercase tracking-widest"><Zap size={10}/> Mouse Physics</div>
              {shouldShow('mouseInfluenceRadius') && <Slider label="Influence Radius" value={currentParams.mouseInfluenceRadius || 150} min={50} max={500} step={10} onChange={(v) => updateParam('mouseInfluenceRadius', v)} {...getCommonProps('mouseInfluenceRadius')} />}
              {shouldShow('mouseRepulsion') && <Slider label="Repulsion" value={currentParams.mouseRepulsion} min={0} max={20} step={0.1} onChange={(v) => updateParam('mouseRepulsion', v)} {...getCommonProps('mouseRepulsion')} />}
              {shouldShow('mouseAttraction') && <Slider label="Attraction" value={currentParams.mouseAttraction} min={0} max={20} step={0.1} onChange={(v) => updateParam('mouseAttraction', v)} {...getCommonProps('mouseAttraction')} />}
              {shouldShow('mouseFalloff') && <Slider label="Falloff (Sharpness)" value={currentParams.mouseFalloff || 1} min={1} max={4} step={0.1} onChange={(v) => updateParam('mouseFalloff', v)} {...getCommonProps('mouseFalloff')} />}
            </div>
          )}
        </div>
      )}
    </>
  );
};
