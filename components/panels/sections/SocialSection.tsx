import React from 'react';
import { Users, Zap, Link2, Share2, Activity } from 'lucide-react';
import { Slider, SectionHeader, Toggle, Select } from '../../ui/Controls';
import { ParamsSectionProps } from './types';
import { EasingMode } from '../../../types';

export const SocialSection: React.FC<ParamsSectionProps> = ({ 
  isOpen, onToggle, onReset, onRandom, currentParams, updateParam, shouldShow, getCommonProps, showModifiedOnly 
}) => {
  return (
    <>
      <SectionHeader title="Interaction" isOpen={isOpen} onToggle={onToggle} onReset={onReset} onRandom={onRandom} />
      {isOpen && (
        <div className="pb-4 space-y-3">
          {(!showModifiedOnly || [shouldShow('neighborRadius'), shouldShow('repulsionForce'), shouldShow('attractionForce'), shouldShow('alignmentForce'), shouldShow('cohesionForce'), shouldShow('swarmCursorInfluence')].some(Boolean)) && (
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
              <div className="text-[9px] font-bold text-indigo-400 mb-3 flex items-center gap-1 uppercase tracking-widest"><Users size={10}/> Swarm Intelligence</div>
              {shouldShow('neighborRadius') && <Slider label="Radius" value={currentParams.neighborRadius} min={10} max={300} step={10} onChange={(v) => updateParam('neighborRadius', v)} {...getCommonProps('neighborRadius')} />}
              {shouldShow('repulsionForce') && <Slider label="Repulsion" value={currentParams.repulsionForce} min={0} max={0.2} step={0.005} onChange={(v) => updateParam('repulsionForce', v)} {...getCommonProps('repulsionForce')} />}
              {shouldShow('attractionForce') && <Slider label="Attraction" value={currentParams.attractionForce} min={0} max={0.2} step={0.005} onChange={(v) => updateParam('attractionForce', v)} {...getCommonProps('attractionForce')} />}
              {shouldShow('alignmentForce') && <Slider label="Alignment" value={currentParams.alignmentForce} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('alignmentForce', v)} {...getCommonProps('alignmentForce')} />}
              {shouldShow('cohesionForce') && <Slider label="Cohesion" value={currentParams.cohesionForce} min={0} max={0.5} step={0.01} onChange={(v) => updateParam('cohesionForce', v)} {...getCommonProps('cohesionForce')} />}
              {shouldShow('swarmCursorInfluence') && <Slider label="Cursor Influence" value={currentParams.swarmCursorInfluence || 0} min={0} max={1} step={0.1} onChange={(v) => updateParam('swarmCursorInfluence', v)} {...getCommonProps('swarmCursorInfluence')} />}
            </div>
          )}

          {(!showModifiedOnly || [shouldShow('autoLinkStart'), shouldShow('autoLinkEnd'), shouldShow('autoLinkRadius'), shouldShow('autoLinkStiffness'), shouldShow('autoLinkBreakingForce'), shouldShow('autoLinkBias'), shouldShow('autoLinkInfluence'), shouldShow('autoLinkFalloff')].some(Boolean)) && (
            <div className="bg-violet-50/50 p-3 rounded-xl border border-violet-100/50">
              <div className="text-[9px] font-bold text-violet-400 mb-3 flex items-center gap-1 uppercase tracking-widest"><Link2 size={10}/> Magnetic Bonding & Linking</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                 <Toggle label="Stick Start" value={currentParams.autoLinkStart} onChange={(v) => updateParam('autoLinkStart', v)} />
                 <Toggle label="Stick End" value={currentParams.autoLinkEnd} onChange={(v) => updateParam('autoLinkEnd', v)} />
              </div>
              
              {shouldShow('autoLinkRadius') && <Slider label="Detect Radius" value={currentParams.autoLinkRadius} min={5} max={300} step={5} onChange={(v) => updateParam('autoLinkRadius', v)} {...getCommonProps('autoLinkRadius')} />}
              {shouldShow('autoLinkStiffness') && <Slider label="Stiffness" value={currentParams.autoLinkStiffness} min={0.01} max={1} step={0.01} onChange={(v) => updateParam('autoLinkStiffness', v)} {...getCommonProps('autoLinkStiffness')} />}
              {shouldShow('autoLinkBreakingForce') && <Slider label="Break Force" value={currentParams.autoLinkBreakingForce} min={0} max={200} step={1} onChange={(v) => updateParam('autoLinkBreakingForce', v)} {...getCommonProps('autoLinkBreakingForce')} />}
              {shouldShow('autoLinkBias') && <Slider label="Bias (Pull)" value={currentParams.autoLinkBias} min={0} max={1} step={0.1} onChange={(v) => updateParam('autoLinkBias', v)} {...getCommonProps('autoLinkBias')} />}
              
              <div className="pt-2 border-t border-violet-100 mt-2 space-y-1">
                 <div className="text-[8px] font-bold text-violet-300 uppercase tracking-widest mb-2 flex items-center gap-1"><Share2 size={8}/> Force Propagation</div>
                 {shouldShow('autoLinkInfluence') && <Slider label="Node Radius" value={currentParams.autoLinkInfluence} min={0} max={20} step={1} onChange={(v) => updateParam('autoLinkInfluence', v)} {...getCommonProps('autoLinkInfluence')} />}
                 {shouldShow('autoLinkFalloff') && <Slider label="Decay Falloff" value={currentParams.autoLinkFalloff} min={0} max={1} step={0.1} onChange={(v) => updateParam('autoLinkFalloff', v)} {...getCommonProps('autoLinkFalloff')} />}
                 <Select label="Decay Curve" value={currentParams.autoLinkDecayEasing || 'linear'} options={['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'step']} onChange={(v) => updateParam('autoLinkDecayEasing', v as EasingMode)} />
              </div>
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