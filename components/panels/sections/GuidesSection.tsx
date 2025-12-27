
import React from 'react';
import { Grid3X3, SplitSquareHorizontal } from 'lucide-react';
import { Toggle, Slider, Select, SectionHeader } from '../../ui/Controls';
import { PanelButton } from '../../IconButtons';
import { BaseSectionProps } from './types';
import { GridConfig, SymmetryConfig, SimulationParams } from '../../../types';

interface GuidesSectionProps extends BaseSectionProps {
  gridConfig: GridConfig;
  setGridConfig: React.Dispatch<React.SetStateAction<GridConfig>>;
  symmetryConfig: SymmetryConfig;
  setSymmetryConfig: React.Dispatch<React.SetStateAction<SymmetryConfig>>;
  currentParams: SimulationParams;
  updateParam: (key: keyof SimulationParams, value: any) => void;
  shouldShow: (key: string) => boolean;
  getCommonProps: (key: keyof SimulationParams) => any;
}

export const GuidesSection: React.FC<GuidesSectionProps> = ({
  isOpen, onToggle, gridConfig, setGridConfig, symmetryConfig, setSymmetryConfig, currentParams, updateParam, shouldShow, getCommonProps
}) => {
  return (
    <>
      <SectionHeader title="Guides & Symmetry" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-4 space-y-3">
          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"><Grid3X3 size={12} /> Modular Grid</div>
              <Toggle label="" value={gridConfig.enabled} onChange={(v) => setGridConfig(p => ({...p, enabled: v}))} />
            </div>
            {gridConfig.enabled && (
              <div className="animate-fade-in-up space-y-2">
                <div className="flex gap-2 mb-2">
                  <PanelButton onClick={() => setGridConfig(p => ({...p, visible: !p.visible}))} label={gridConfig.visible ? "HIDE POINTS" : "SHOW POINTS"} active={gridConfig.visible} />
                  <PanelButton onClick={() => setGridConfig(p => ({...p, snap: !p.snap}))} label={gridConfig.snap ? "SNAP ON" : "SNAP OFF"} active={gridConfig.snap} />
                </div>
                {shouldShow('pathRounding') && <Slider label="Roundness" value={currentParams.pathRounding} min={0} max={2} step={0.1} onChange={(v) => updateParam('pathRounding', v)} {...getCommonProps('pathRounding')} description="0 = Sharp, 1 = Classic, 2 = Max Arc" />}
                <Slider label="Cell Size" value={gridConfig.size} min={10} max={200} step={10} onChange={(v) => setGridConfig(p => ({...p, size: v}))} />
                <Slider label="Snap Scale" value={gridConfig.snapFactor || 1} min={1} max={10} step={1} onChange={(v) => setGridConfig(p => ({...p, snapFactor: v}))} description="Multiply snapping grid relative to visual grid" />
                <Slider label="Opacity" value={gridConfig.opacity} min={0.1} max={1} step={0.1} onChange={(v) => setGridConfig(p => ({...p, opacity: v}))} />
              </div>
            )}
          </div>
          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-slate-500"><SplitSquareHorizontal size={12} /> Symmetry</div>
              <Toggle label="" value={symmetryConfig.enabled} onChange={(v) => setSymmetryConfig(p => ({...p, enabled: v}))} />
            </div>
            {symmetryConfig.enabled && (
              <div className="animate-fade-in-up space-y-2">
                <Select label="Type" value={symmetryConfig.type} options={['horizontal', 'vertical', 'quad', 'radial']} onChange={(v) => setSymmetryConfig(p => ({...p, type: v as any}))} />
                {symmetryConfig.type === 'radial' && ( <Slider label="Count" value={symmetryConfig.count} min={2} max={12} step={1} onChange={(v) => setSymmetryConfig(p => ({...p, count: v}))} /> )}
                <Toggle label="Show Guides" value={symmetryConfig.visible} onChange={(v) => setSymmetryConfig(p => ({...p, visible: v}))} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
