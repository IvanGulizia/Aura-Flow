
import React, { useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Waves, ArrowDownUp, MousePointer2 } from 'lucide-react';

interface BezierEditorProps {
    p1x: number; p1y: number; p2x: number; p2y: number;
    p0y?: number; p3y?: number;
    onChange: (p: {p1x: number, p1y: number, p2x: number, p2y: number, p0y: number, p3y: number}) => void;
}

export const BezierEditor: React.FC<BezierEditorProps> = ({ p1x, p1y, p2x, p2y, p0y = 0, p3y = 1, onChange }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<'p0' | 'p1' | 'p2' | 'p3' | null>(null);

    // Coordinate mapping: SVG is 0-100, Logic is 0-1 (with Y overshoot support)
    const toSvg = (x: number, y: number) => ({ x: x * 100, y: 100 - (y * 100) });
    const fromSvg = (x: number, y: number) => ({ 
        x: Math.max(0, Math.min(1, x / 100)), 
        y: parseFloat(((100 - y) / 100).toFixed(3)) 
    });

    const cp0 = toSvg(0, p0y);
    const cp1 = toSvg(p1x, p1y);
    const cp2 = toSvg(p2x, p2y);
    const cp3 = toSvg(1, p3y);

    const pathData = `M ${cp0.x} ${cp0.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${cp3.x} ${cp3.y}`;

    const handlePointerDown = (pt: typeof dragging) => (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(pt);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width) * 100;
        const relY = ((e.clientY - rect.top) / rect.height) * 100;
        const newVal = fromSvg(relX, relY);
        
        const updates = { p1x, p1y, p2x, p2y, p0y, p3y };
        if (dragging === 'p0') updates.p0y = Math.max(-0.5, Math.min(1.5, newVal.y));
        else if (dragging === 'p1') { updates.p1x = newVal.x; updates.p1y = newVal.y; }
        else if (dragging === 'p2') { updates.p2x = newVal.x; updates.p2y = newVal.y; }
        else if (dragging === 'p3') updates.p3y = Math.max(-0.5, Math.min(1.5, newVal.y));
        
        onChange(updates);
    };

    const updateValue = (key: keyof typeof dragging | string, val: number) => {
        const updates = { p1x, p1y, p2x, p2y, p0y, p3y, [key]: val };
        onChange(updates as any);
    };

    return (
        <div className="w-full flex flex-col gap-4 p-4 bg-white/40 rounded-2xl border border-slate-200 shadow-sm">
            {/* Header with quick presets */}
            <div className="flex items-center justify-between">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Curve Editor</span>
               <div className="flex gap-1">
                    <button onClick={() => onChange({p1x: 0.4, p1y: 0, p2x: 0.2, p2y: 1, p0y: 0, p3y: 1})} className="p-1 hover:bg-indigo-50 rounded text-indigo-500 transition-colors" title="Ease In Out"><Waves size={14}/></button>
                    <button onClick={() => onChange({p1x: 0.5, p1y: 0.5, p2x: 0.5, p2y: 0.5, p0y: 0, p3y: 1})} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors" title="Linear"><TrendingUp size={14}/></button>
               </div>
            </div>

            {/* Main Interactive Graph */}
            <div className="relative h-44 bg-slate-50 rounded-xl border border-slate-200 overflow-visible touch-none select-none">
                <svg 
                    ref={svgRef}
                    viewBox="-10 -20 120 140" 
                    className="w-full h-full overflow-visible"
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => setDragging(null)}
                >
                    <defs>
                        <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                        </pattern>
                    </defs>
                    
                    {/* Background Grid */}
                    <rect x="0" y="0" width="100" height="100" fill="url(#grid-pattern)" />
                    <line x1="0" y1="100" x2="100" y2="0" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="4" />
                    
                    {/* Handle Lines */}
                    <line x1={cp0.x} y1={cp0.y} x2={cp1.x} y2={cp1.y} stroke="#6366f1" strokeWidth="1" strokeDasharray="2" opacity="0.4" />
                    <line x1={cp3.x} y1={cp3.y} x2={cp2.x} y2={cp2.y} stroke="#ec4899" strokeWidth="1" strokeDasharray="2" opacity="0.4" />
                    
                    {/* The Bezier Curve */}
                    <path d={pathData} fill="none" stroke="currentColor" className="text-slate-800" strokeWidth="3" strokeLinecap="round" />
                    
                    {/* Control Handles (Circles) */}
                    <circle 
                        cx={cp1.x} cy={cp1.y} r="6" 
                        className={`cursor-grab active:cursor-grabbing transition-all fill-indigo-500 stroke-white stroke-2 shadow-sm ${dragging === 'p1' ? 'scale-125' : 'hover:scale-110'}`}
                        onPointerDown={handlePointerDown('p1')}
                    />
                    <circle 
                        cx={cp2.x} cy={cp2.y} r="6" 
                        className={`cursor-grab active:cursor-grabbing transition-all fill-pink-500 stroke-white stroke-2 shadow-sm ${dragging === 'p2' ? 'scale-125' : 'hover:scale-110'}`}
                        onPointerDown={handlePointerDown('p2')}
                    />

                    {/* Anchor Handles (Squares for Y-only dragging) */}
                    <rect 
                        x={cp0.x - 4} y={cp0.y - 4} width="8" height="8" rx="1"
                        className={`cursor-ns-resize fill-white stroke-slate-400 stroke-2 transition-all ${dragging === 'p0' ? 'fill-indigo-100 scale-125' : 'hover:scale-110'}`}
                        onPointerDown={handlePointerDown('p0')}
                    />
                    <rect 
                        x={cp3.x - 4} y={cp3.y - 4} width="8" height="8" rx="1"
                        className={`cursor-ns-resize fill-white stroke-slate-400 stroke-2 transition-all ${dragging === 'p3' ? 'fill-pink-100 scale-125' : 'hover:scale-110'}`}
                        onPointerDown={handlePointerDown('p3')}
                    />
                </svg>
            </div>

            {/* Numeric Controls for Precision */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                         <span className="text-[8px] font-bold text-indigo-500 uppercase">Handle 1 (X, Y)</span>
                    </div>
                    <div className="flex gap-1">
                        <input type="number" step="0.01" value={p1x} onChange={(e) => updateValue('p1x', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded p-1 text-[10px] font-mono no-spinners" />
                        <input type="number" step="0.01" value={p1y} onChange={(e) => updateValue('p1y', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded p-1 text-[10px] font-mono no-spinners" />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                         <span className="text-[8px] font-bold text-pink-500 uppercase">Handle 2 (X, Y)</span>
                    </div>
                    <div className="flex gap-1">
                        <input type="number" step="0.01" value={p2x} onChange={(e) => updateValue('p2x', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded p-1 text-[10px] font-mono no-spinners" />
                        <input type="number" step="0.01" value={p2y} onChange={(e) => updateValue('p2y', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded p-1 text-[10px] font-mono no-spinners" />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Start (Y)</span>
                    <input type="number" step="0.01" value={p0y} onChange={(e) => updateValue('p0y', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded p-1 text-[10px] font-mono no-spinners" />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">End (Y)</span>
                    <input type="number" step="0.01" value={p3y} onChange={(e) => updateValue('p3y', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded p-1 text-[10px] font-mono no-spinners" />
                </div>
            </div>
            
            {/* Presets Grid */}
            <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-100">
                <button onClick={() => onChange({ p1x: 0.5, p1y: 0, p2x: 0.5, p2y: 1, p0y: 0, p3y: 1 })} className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-200 group transition-colors">
                  <TrendingUp size={12} className="text-slate-400 group-hover:text-indigo-500" />
                  <span className="text-[7px] font-bold uppercase text-slate-400 group-hover:text-indigo-600">Linear</span>
                </button>
                <button onClick={() => onChange({ p1x: 0.5, p1y: 1, p2x: 0.5, p2y: 0, p0y: 1, p3y: 0 })} className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-pink-50 rounded-lg border border-slate-200 group transition-colors">
                  <TrendingDown size={12} className="text-slate-400 group-hover:text-pink-500" />
                  <span className="text-[7px] font-bold uppercase text-slate-400 group-hover:text-pink-600">Invert</span>
                </button>
                <button onClick={() => onChange({ p1x: 0.5, p1y: 1.5, p2x: 0.5, p2y: 1.5, p0y: 0, p3y: 0 })} className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-emerald-50 rounded-lg border border-slate-200 group transition-colors">
                  <Waves size={12} className="text-slate-400 group-hover:text-emerald-500" />
                  <span className="text-[7px] font-bold uppercase text-slate-400 group-hover:text-emerald-600">Pulse</span>
                </button>
                <button onClick={() => onChange({ p1x: 0.5, p1y: -0.5, p2x: 0.5, p2y: -0.5, p0y: 1, p3y: 1 })} className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-amber-50 rounded-lg border border-slate-200 group transition-colors">
                  <ArrowDownUp size={12} className="text-slate-400 group-hover:text-amber-500" />
                  <span className="text-[7px] font-bold uppercase text-slate-400 group-hover:text-amber-600">Dip</span>
                </button>
            </div>
        </div>
    );
};
