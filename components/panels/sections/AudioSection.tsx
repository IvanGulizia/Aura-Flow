
import React, { useRef, useEffect, useState } from 'react';
import { Upload, Trash2, Speaker, Zap, Mic, Activity, Sliders } from 'lucide-react';
import { Slider, Toggle, Select, SectionHeader } from '../../ui/Controls';
import { SoundRecorder } from '../../IconButtons';
import { ParamsSectionProps } from './types';
import { SoundConfig, SoundVolumeSource, SoundPlaybackMode } from '../../../types';
import { PARAM_DESCRIPTIONS, SOUND_VOLUME_SOURCES } from '../../../constants/defaults';
import { audioManager } from '../../../services/audioService';

interface AudioSectionProps extends ParamsSectionProps {
  currentSound: SoundConfig;
  handleBufferReady: (buffer: AudioBuffer) => void;
  handleSoundUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeSound: () => void;
  updateSound: (key: keyof SoundConfig, value: any) => void;
}

const SpectrumVisualizer = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const reqRef = useRef<number>(0);

    useEffect(() => {
        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            if (!audioManager.isMicActive) {
                // Draw idle state
                ctx.fillStyle = '#e2e8f0';
                for (let i = 0; i < 6; i++) {
                    const barW = (w - 10) / 6;
                    const x = i * (barW + 2);
                    const height = 4;
                    ctx.fillRect(x, h - height, barW, height);
                }
                reqRef.current = requestAnimationFrame(draw);
                return;
            }

            const spectral = audioManager.getSpectralData();
            const bands = [spectral.sub, spectral.bass, spectral.lowMid, spectral.mid, spectral.highMid, spectral.treble];
            const labels = ['SUB', 'BASS', 'LO-MID', 'MID', 'HI-MID', 'TREBLE'];
            const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

            const barW = (w - 10) / 6;
            
            bands.forEach((val, i) => {
                const x = i * (barW + 2);
                const height = Math.max(4, val * h);
                const color = colors[i];
                
                // Draw Bar
                ctx.fillStyle = color;
                ctx.fillRect(x, h - height, barW, height);
                
                // Draw Cap
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.5;
                ctx.fillRect(x, h - height, barW, 2);
                ctx.globalAlpha = 1;
            });

            reqRef.current = requestAnimationFrame(draw);
        };
        reqRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(reqRef.current);
    }, []);

    return (
        <div className="w-full h-16 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-inner relative">
             <canvas ref={canvasRef} width={280} height={64} className="w-full h-full block" />
             <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pointer-events-none">
                {['SUB', 'BASS', 'LO', 'MID', 'HI', 'TRE'].map((l, i) => (
                    <span key={i} className="text-[7px] font-bold text-slate-500 w-1/6 text-center">{l}</span>
                ))}
             </div>
        </div>
    );
};

export const AudioSection: React.FC<AudioSectionProps> = ({ 
  isOpen, onToggle, onReset, onRandom, currentParams, updateParam, shouldShow, getCommonProps,
  currentSound, handleBufferReady, handleSoundUpload, removeSound, updateSound 
}) => {
  const [smoothing, setSmoothing] = useState(audioManager.smoothing);
  const [noiseFloor, setNoiseFloor] = useState(audioManager.noiseFloor);

  // Sync internal state with audioManager
  const updateGlobalAudio = (key: 'smoothing' | 'noiseFloor', val: number) => {
      if (key === 'smoothing') {
          setSmoothing(val);
          audioManager.smoothing = val;
      } else {
          setNoiseFloor(val);
          audioManager.noiseFloor = val;
      }
  };

  return (
    <>
      <SectionHeader title="Audio & Sound" isOpen={isOpen} onToggle={onToggle} onReset={onReset} onRandom={onRandom} />
      {isOpen && (
        <div className="pb-4 space-y-4">
          
          {/* PART 1: VISUAL REACTIVITY */}
          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div className="text-[9px] font-bold text-slate-500 mb-3 flex items-center justify-between uppercase tracking-widest">
                <span className="flex items-center gap-1"><Zap size={10}/> Reactivity Engine</span>
                {audioManager.isMicActive && <span className="text-green-500 animate-pulse flex items-center gap-1"><Mic size={8}/> LIVE</span>}
            </div>
            
            <SpectrumVisualizer />
            
            <div className="mt-4 space-y-4">
               {/* Global Signal Processing Controls */}
               <div className="bg-white/60 p-2 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase mb-2">
                     <Sliders size={8} /> Signal Processing
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="flex flex-col gap-1">
                        <div className="flex justify-between">
                            <span className="text-[8px] font-bold text-slate-500">SMOOTHING</span>
                            <span className="text-[8px] font-mono text-indigo-500">{smoothing.toFixed(2)}</span>
                        </div>
                        <input 
                            type="range" min="0" max="0.99" step="0.01" 
                            value={smoothing} 
                            onChange={(e) => updateGlobalAudio('smoothing', parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                     </div>
                     <div className="flex flex-col gap-1">
                        <div className="flex justify-between">
                            <span className="text-[8px] font-bold text-slate-500">NOISE GATE</span>
                            <span className="text-[8px] font-mono text-indigo-500">{noiseFloor.toFixed(2)}</span>
                        </div>
                        <input 
                            type="range" min="0" max="0.5" step="0.01" 
                            value={noiseFloor} 
                            onChange={(e) => updateGlobalAudio('noiseFloor', parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                     </div>
                  </div>
               </div>

               <div className="space-y-1">
                  {shouldShow('audioSensitivity') && <Slider label="Global Sensitivity" value={currentParams.audioSensitivity} min={0} max={5} step={0.1} onChange={(v) => updateParam('audioSensitivity', v)} {...getCommonProps('audioSensitivity')} />}
                  
                  {/* Legacy Toggles for Quick Setup */}
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[8px] font-bold text-slate-400 uppercase mb-2 block">Quick Mappings (Legacy)</span>
                    {shouldShow('audioToWidth') && <Toggle label="Audio -> Width" description="Maps Bass/Average to Stroke Width" value={currentParams.audioToWidth} onChange={(v) => updateParam('audioToWidth', v)} />}
                    {shouldShow('audioToColor') && <Toggle label="Audio -> Color" description="Maps Mids to Hue Shift" value={currentParams.audioToColor} onChange={(v) => updateParam('audioToColor', v)} />}
                    {shouldShow('audioToWiggle') && <Toggle label="Audio -> Wiggle" description="Maps Sub-Bass to Wiggle Amplitude" value={currentParams.audioToWiggle} onChange={(v) => updateParam('audioToWiggle', v)} />}
                  </div>
                  
                  <div className="p-2 bg-blue-50/50 border border-blue-100 rounded text-[9px] text-blue-600 italic leading-relaxed">
                     <span className="font-bold not-italic">Pro Tip:</span> For granular control (e.g., "Bass controls Opacity"), use the <span className="font-bold"><Activity size={8} className="inline"/> Modulation</span> button on any parameter slider and select specific frequency bands.
                  </div>
               </div>
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
