
import React from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { Slider, Select, SectionHeader } from '../../ui/Controls';
import { SoundRecorder } from '../../IconButtons';
import { BaseSectionProps } from './types';
import { SoundConfig, SoundVolumeSource, SoundPlaybackMode } from '../../../types';
import { SOUND_VOLUME_SOURCES } from '../../../constants/defaults';

interface SoundDesignSectionProps extends BaseSectionProps {
  currentSound: SoundConfig;
  handleBufferReady: (buffer: AudioBuffer) => void;
  handleSoundUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeSound: () => void;
  updateSound: (key: keyof SoundConfig, value: any) => void;
}

export const SoundDesignSection: React.FC<SoundDesignSectionProps> = ({ 
  isOpen, onToggle, currentSound, handleBufferReady, handleSoundUpload, removeSound, updateSound 
}) => {
  return (
    <>
      <SectionHeader title="Sound Design" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-4 space-y-3 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/20">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Source</span>
            <SoundRecorder onBufferReady={handleBufferReady} />
            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1 cursor-pointer hover:text-indigo-600 transition-colors">
              <Upload size={10} /> Upload <input type="file" onChange={handleSoundUpload} className="hidden" accept="audio/*" />
            </label>
          </div>
          {currentSound.bufferId ? (
            <div className="text-[9px] text-green-600 font-mono bg-green-50 border border-green-200 px-2 py-1 rounded flex justify-between items-center">
              <span>Active: {currentSound.bufferId.slice(0, 12)}...</span>
              <button onClick={removeSound} className="text-red-500 hover:text-red-700"><Trash2 size={10} /></button>
            </div>
          ) : ( <div className="text-[9px] text-slate-400 font-mono italic">No audio buffer assigned.</div> )}
          <Select label="Drive Volume With" value={currentSound.volumeSource} options={SOUND_VOLUME_SOURCES} onChange={(v) => updateSound('volumeSource', v as SoundVolumeSource)} />
          <Select label="Playback Mode" value={currentSound.playbackMode} options={['loop', 'timeline-scrub']} onChange={(v) => updateSound('playbackMode', v as SoundPlaybackMode)} />
          <Slider label="Min Vol" value={currentSound.minVolume} min={0} max={1} step={0.01} onChange={(v) => updateSound('minVolume', v)} />
          <Slider label="Max Vol" value={currentSound.maxVolume} min={0} max={2} step={0.01} onChange={(v) => updateSound('maxVolume', v)} />
          <Slider label="Base Pitch" value={currentSound.minPitch} min={0.1} max={4} step={0.01} onChange={(v) => updateSound('minPitch', v)} />
          <Slider label="Reverb" value={currentSound.reverbSend} min={0} max={1} step={0.01} onChange={(v) => updateSound('reverbSend', v)} />
          {currentSound.playbackMode === 'timeline-scrub' && ( <Slider label="Grain Size (s)" value={currentSound.grainSize} min={0.01} max={0.5} step={0.01} onChange={(v) => updateSound('grainSize', v)} /> )}
        </div>
      )}
    </>
  );
};
