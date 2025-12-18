import React, { useRef, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import { UITheme } from '../../types';

interface PaletteProps {
  show: boolean;
  onClose: () => void;
  colors: string[];
  activeColor: string;
  onSelectColor: (color: string) => void;
  onUpdateColor: (index: number, color: string) => void;
  theme: UITheme;
}

export const Palette: React.FC<PaletteProps> = ({ show, onClose, colors, activeColor, onSelectColor, onUpdateColor, theme }) => {
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (show && paletteRef.current && !paletteRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div 
      ref={paletteRef}
      className="absolute top-16 left-1/2 -translate-x-1/2 p-3 grid grid-cols-4 gap-2 w-48 animate-fade-in-up z-50 pointer-events-auto"
      style={{ 
        background: `rgba(${parseInt(theme.menuBg.slice(1,3),16)}, ${parseInt(theme.menuBg.slice(3,5),16)}, ${parseInt(theme.menuBg.slice(5,7),16)}, ${theme.menuOpacity})`,
        color: theme.menuText,
        borderRadius: '1rem',
        border: `${theme.menuBorderWidth}px solid ${theme.menuBorderColor}`,
        boxShadow: theme.menuShadow,
        backdropFilter: `blur(${theme.menuBlur}px)`,
      }}
    >
        {colors.map((c, idx) => (
          <div key={idx} className="relative group/color w-8 h-8">
            <button
              onClick={() => onSelectColor(c)}
              className={`w-full h-full rounded-full border-2 transition-all hover:scale-110 shadow-sm ${activeColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
            <label className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white rounded-full shadow-sm border border-slate-200 cursor-pointer flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity z-10 hover:scale-110">
               <Edit2 size={8} className="text-slate-600" />
               <input type="color" value={c} onChange={(e) => onUpdateColor(idx, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            </label>
          </div>
        ))}
    </div>
  );
};