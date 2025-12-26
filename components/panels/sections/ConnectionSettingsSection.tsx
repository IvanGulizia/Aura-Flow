
import React from 'react';
import { Slider, Select, SectionHeader } from '../../ui/Controls';
import { BaseSectionProps } from './types';
import { Connection, EasingMode } from '../../../types';

interface ConnectionSettingsSectionProps extends BaseSectionProps {
  selectedConnectionParams: Connection;
  updateConnectionParam: (key: keyof Connection, value: any) => void;
}

export const ConnectionSettingsSection: React.FC<ConnectionSettingsSectionProps> = ({ 
  isOpen, onToggle, selectedConnectionParams, updateConnectionParam 
}) => {
  return (
    <>
      <SectionHeader title="Connection Settings" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-4 space-y-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
          <Slider label="Stiffness" value={selectedConnectionParams.stiffness} min={0.01} max={1} step={0.01} onChange={(v) => updateConnectionParam('stiffness', v)} />
          <Slider label="Breaking Force" value={selectedConnectionParams.breakingForce} min={0} max={200} step={1} onChange={(v) => updateConnectionParam('breakingForce', v)} />
          <Slider label="Influence" value={selectedConnectionParams.bias} min={0} max={1} step={0.1} onChange={(v) => updateConnectionParam('bias', v)} description="Pull Bias: 0=Start, 1=End" />
          <Slider label="Propagation" value={selectedConnectionParams.influence} min={0} max={20} step={1} onChange={(v) => updateConnectionParam('influence', v)} />
          <Slider label="Decay" value={selectedConnectionParams.falloff} min={0} max={1} step={0.1} onChange={(v) => updateConnectionParam('falloff', v)} />
          <Select label="Decay Curve" value={selectedConnectionParams.decayEasing || 'linear'} options={['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'step']} onChange={(v) => updateConnectionParam('decayEasing', v as EasingMode)} />
        </div>
      )}
    </>
  );
};
