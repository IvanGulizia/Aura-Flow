import React, { useState, useRef, useEffect } from 'react';
import { GripHorizontal, FileJson, X, Layers, Circle, Monitor } from 'lucide-react';
import { UITheme } from '../../types';
import { ColorInput, NumberInput } from '../ui/Controls';

export const DebugMenu = ({ theme, setTheme, onClose }: { theme: UITheme, setTheme: (t: UITheme) => void, onClose: () => void }) => {
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      }
    };
    const handleMouseUp = () => isDragging.current = false;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const exportTheme = () => {
    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-flow-theme.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="fixed z-50 w-72 bg-slate-800 text-white rounded-xl shadow-2xl border border-slate-600 overflow-hidden font-sans text-xs select-none"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        onMouseDown={handleMouseDown}
        className="bg-slate-700 p-2 cursor-grab active:cursor-grabbing flex justify-between items-center border-b border-slate-600"
      >
        <span className="font-bold flex items-center gap-2"><GripHorizontal size={14}/> Debug UI</span>
        <div className="flex gap-2">
            <button onClick={exportTheme} title="Export JSON" className="hover:text-indigo-400"><FileJson size={14} /></button>
            <button onClick={onClose} className="hover:text-red-400"><X size={14} /></button>
        </div>
      </div>
      
      <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
         <div className="space-y-2">
            <h4 className="font-bold text-indigo-400 flex items-center gap-1 uppercase tracking-wider text-[10px]"><Layers size={12}/> Menus & Panels</h4>
            <ColorInput label="Background" val={theme.menuBg} onChange={(v) => setTheme({...theme, menuBg: v})} />
            <ColorInput label="Text Color" val={theme.menuText} onChange={(v) => setTheme({...theme, menuText: v})} />
            <NumberInput label="Opacity (Alpha)" val={theme.menuOpacity} min={0} max={1} step={0.01} onChange={(v) => setTheme({...theme, menuOpacity: v})} />
            <NumberInput label="Blur (Backdrop)" val={theme.menuBlur} min={0} max={40} step={1} onChange={(v) => setTheme({...theme, menuBlur: v})} />
            <ColorInput label="Border Color" val={theme.menuBorderColor} onChange={(v) => setTheme({...theme, menuBorderColor: v})} />
            <NumberInput label="Border Width" val={theme.menuBorderWidth} min={0} max={10} step={1} onChange={(v) => setTheme({...theme, menuBorderWidth: v})} />
         </div>
         <div className="w-full -mx-4 my-2 h-px bg-slate-600/50" style={{ width: 'calc(100% + 2rem)' }} />
         <div className="space-y-2">
            <h4 className="font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-wider text-[10px]"><Circle size={12}/> Buttons</h4>
            <ColorInput label="Normal Bg" val={theme.buttonBg} onChange={(v) => setTheme({...theme, buttonBg: v})} />
            <ColorInput label="Normal Text" val={theme.buttonText} onChange={(v) => setTheme({...theme, buttonText: v})} />
            <div className="h-2" />
            <ColorInput label="Active Bg" val={theme.buttonActiveBg} onChange={(v) => setTheme({...theme, buttonActiveBg: v})} />
            <ColorInput label="Active Text" val={theme.buttonActiveText} onChange={(v) => setTheme({...theme, buttonActiveText: v})} />
         </div>
         <div className="w-full -mx-4 my-2 h-px bg-slate-600/50" style={{ width: 'calc(100% + 2rem)' }} />
         <div className="space-y-2">
            <h4 className="font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-wider text-[10px]"><Monitor size={12}/> Screen & Borders</h4>
            <ColorInput label="Screen Border Color" val={theme.screenBorderColor} onChange={(v) => setTheme({...theme, screenBorderColor: v})} />
            <ColorInput label="Canvas Background" val={theme.canvasBg} onChange={(v) => setTheme({...theme, canvasBg: v})} />
         </div>
      </div>
    </div>
  );
};