
import React from 'react';
import { Upload, Trash2, Speaker, Zap } from 'lucide-react';
import { Slider, Toggle, Select, SectionHeader } from '../../ui/Controls';
import { SoundRecorder } from '../../IconButtons';
import { ParamsSectionProps } from './types';
import { SoundConfig, SoundVolumeSource, SoundPlaybackMode } from '../../../types';
import { PARAM_DESCRIPTIONS, SOUND_VOLUME_SOURCES } from '../../../constants/defaults';

interface AudioSectionProps extends ParamsSectionProps {
  currentSound: SoundConfig;
  handleBufferReady: (buffer: AudioBuffer) => void;
  handleSoundUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeSound: () => void;
  updateSound: (key: keyof SoundConfig, value: any) => void;
}

export const AudioSection: React.FC<AudioSectionProps> = ({ 
  isOpen, onToggle, onReset, onRandom, currentParams, updateParam, shouldShow, getCommonProps,
  currentSound, handleBufferReady, handleSoundUpload, removeSound, updateSound 
}) => {
  return (
    <>
      <SectionHeader title="Audio & Sound" isOpen={isOpen} onToggle={onToggle} onReset={onReset} onRandom={onRandom} />
      {isOpen && (
        <div className="pb-4 space-y-4">
          
          {/* PART 1: VISUAL REACTIVITY */}
          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div className="text-[9px] font-bold text-slate-500 mb-3 flex items-center gap-1 uppercase tracking-widest"><Zap size={10}/> Visual Reactivity</div>
            <div className="space-y-1">
              {shouldShow('audioSensitivity') && <Slider label="Sensitivity" value={currentParams.audioSensitivity} min={0} max={5} step={0.1} onChange={(v) => updateParam('audioSensitivity', v)} {...getCommonProps('audioSensitivity')} />}
              {shouldShow('audioToWidth') && <Toggle label="Audio -> Width" description={PARAM_DESCRIPTIONS['audioToWidth']} value={currentParams.audioToWidth} onChange={(v) => updateParam('audioToWidth', v)} />}
              {shouldShow('audioToColor') && <Toggle label="Audio -> Color" description={PARAM_DESCRIPTIONS['audioToColor']} value={currentParams.audioToColor} onChange={(v) => updateParam('audioToColor', v)} />}
              {shouldShow('audioToWiggle') && <Toggle label="Audio -> Wiggle" description={PARAM_DESCRIPTIONS['audioToWiggle']} value={currentParams.audioToWiggle} onChange={(v) => updateParam('audioToWiggle', v)} />}
            </div>
          </div>

          {/* PART 2: SOUND DESIGN */}
          <div className="bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/20">
            <div className="text-[9px] font-bold text-indigo-500 mb-3 flex items-center gap-1 uppercase tracking-widest"><Speaker size={10}/> Synthesis & Sampling</div>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Source</span>
              <SoundRecorder onBufferReady={handleBufferReady} />
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1 cursor-pointer hover:text-indigo-600 transition-colors">
                <Upload size={10} /> <input type="file" onChange={handleSoundUpload} className="hidden" accept="audio/*" />
              </label>
            </div>

            {currentSound.bufferId ? (
              <div className="text-[9px] text-green-600 font-mono bg-green-50 border border-green-200 px-2 py-1 rounded flex justify-between items-center mb-3">
                <span>Active: {currentSound.bufferId.slice(0, 12)}...</span>
                <button onClick={removeSound} className="text-red-500 hover:text-red-700"><Trash2 size={10} /></button>
              </div>
            ) : ( <div className="text-[9px] text-slate-400 font-mono italic mb-3">No audio buffer assigned.</div> )}

            <div className="space-y-2">
              <Select label="Drive Vol With" value={currentSound.volumeSource} options={SOUND_VOLUME_SOURCES} onChange={(v) => updateSound('volumeSource', v as SoundVolumeSource)} />
              <Select label="Mode" value={currentSound.playbackMode} options={['loop', 'timeline-scrub']} onChange={(v) => updateSound('playbackMode', v as SoundPlaybackMode)} />
              
              <div className="grid grid-cols-2 gap-x-3">
                <Slider label="Min Vol" value={currentSound.minVolume} min={0} max={1} step={0.01} onChange={(v) => updateSound('minVolume', v)} className="mb-2" />
                <Slider label="Max Vol" value={currentSound.maxVolume} min={0} max={2} step={0.01} onChange={(v) => updateSound('maxVolume', v)} className="mb-2" />
              </div>
              
              <Slider label="Base Pitch" value={currentSound.minPitch} min={0.1} max={4} step={0.01} onChange={(v) => updateSound('minPitch', v)} />
              <Slider label="Reverb" value={currentSound.reverbSend} min={0} max={1} step={0.01} onChange={(v) => updateSound('reverbSend', v)} />
              
              {currentSound.playbackMode === 'timeline-scrub' && ( 
                <Slider label="Grain Size (s)" value={currentSound.grainSize} min={0.01} max={0.5} step={0.01} onChange={(v) => updateSound('grainSize', v)} /> 
              )}
            </div>
          </div>

        </div>
      )}
    </>
  );
};
