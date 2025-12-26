import React, { useState } from 'react';
import { Mic, Square, Play } from 'lucide-react';
import { audioManager } from '../services/audioService';

interface IconButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
  label?: string; // Kept for ARIA but removed title attribute
  className?: string;
  disabled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({ onClick, icon, active, label, className, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative group flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-full transition-all duration-300
        border backdrop-blur-sm
        ${active ? 'scale-105 shadow-lg' : 'hover:shadow-md hover:scale-105'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      style={{
        backgroundColor: active ? 'var(--btn-active-bg)' : (isHovered ? 'var(--btn-hover-bg)' : 'var(--btn-bg)'),
        color: active ? 'var(--btn-active-text)' : (isHovered ? 'var(--btn-hover-text)' : 'var(--btn-text)'),
        borderColor: 'var(--btn-border)',
      }}
    >
      {icon}
    </button>
  );
};

export const PanelButton: React.FC<{
  onClick: () => void;
  label: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  className?: string;
  disabled?: boolean;
  title?: string;
}> = ({ onClick, label, icon, active, className, disabled, title }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={`flex-1 flex justify-center items-center gap-2 py-2 px-3 rounded-lg font-bold border transition-all text-[9px] uppercase tracking-wider ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={{
        backgroundColor: (active || isPressed) ? 'var(--btn-active-bg)' : (isHovered ? 'var(--btn-hover-bg)' : 'var(--btn-bg)'),
        color: (active || isPressed) ? 'var(--btn-active-text)' : (isHovered ? 'var(--btn-hover-text)' : 'var(--btn-text)'),
        borderColor: 'var(--btn-border)',
      }}
    >
      {icon}
      {label}
    </button>
  );
};

export const SoundRecorder: React.FC<{
  onBufferReady: (buffer: AudioBuffer) => void;
}> = ({ onBufferReady }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [previewBuffer, setPreviewBuffer] = useState<AudioBuffer | null>(null);

  const handleRecord = async () => {
    setIsRecording(true);
    setPreviewBuffer(null);
    const buffer = await audioManager.recordAudio(2000); 
    setIsRecording(false);
    if (buffer) {
      setPreviewBuffer(buffer);
      onBufferReady(buffer);
    }
  };

  const playPreview = async () => {
    if (!previewBuffer) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = ctx.createBufferSource();
    source.buffer = previewBuffer;
    source.connect(ctx.destination);
    source.start();
  };

  return (
    <div className="flex gap-2 items-center bg-white/40 p-2 rounded-lg border border-white/20">
      <button 
        onClick={handleRecord}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
        title="Record (2s)"
      >
        {isRecording ? <Square size={12} fill="currentColor" /> : <Mic size={14} />}
      </button>
      
      {previewBuffer && (
        <button 
          onClick={playPreview}
          className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 flex items-center justify-center"
          title="Preview Recording"
        >
          <Play size={14} fill="currentColor" />
        </button>
      )}
      
      {!isRecording && !previewBuffer && <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Record Sound</span>}
      {isRecording && <span className="text-[9px] text-red-500 uppercase font-bold tracking-wide">Recording...</span>}
      {previewBuffer && <span className="text-[9px] text-indigo-500 uppercase font-bold tracking-wide">Ready</span>}
    </div>
  );
};