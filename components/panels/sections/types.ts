
import { SimulationParams, UITheme, ModulationConfig } from '../../../types';

export interface BaseSectionProps {
  theme: UITheme;
  isOpen: boolean;
  onToggle: () => void;
  onReset?: () => void;
  onRandom?: () => void;
  showModifiedOnly: boolean;
}

export interface ParamsSectionProps extends BaseSectionProps {
  currentParams: SimulationParams;
  updateParam: (key: keyof SimulationParams, value: any) => void;
  shouldShow: (key: keyof SimulationParams | string, subValue?: any, subDefault?: any) => boolean;
  getCommonProps: (key: keyof SimulationParams) => {
    isLocked: boolean;
    onToggleLock: () => void;
    description: string;
    modulation: ModulationConfig | undefined;
    onModulationChange: (cfg: ModulationConfig | undefined) => void;
    onReset: () => void;
    isModified: boolean;
  };
}
