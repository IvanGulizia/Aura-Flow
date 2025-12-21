import React, { useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Waves, ArrowDownUp } from 'lucide-react';

export const BezierEditor: React.FC<{
    p1x: number; p1y: number; p2x: number; p2y: number;
    p0y?: number; p3y?: number; // Start and End Y values
    onChange: (p: {p1x: number, p1y: number, p2x: number, p2y: number, p0y: number, p3y: number}) => void;
}> = ({ p1x, p1y, p2x, p2y, p0y = 0, p3y = 1, onChange }) => {
    
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<'p1' | 'p2' | null>(null);

    const toSvg = (x: number, y: number) => ({ x: x * 100, y: 100 - (y * 100) });
    const fromSvg = (x: number, y: number) => ({ x: Math.max(0, Math.min(1, x / 100)), y: Math.max(-0.5, Math.min(1.5, (100 - y) / 100)) });

    const cp1 = toSvg(p1x, p1y);
    const cp2 = toSvg(p2x, p2y);
    const start = toSvg(0, p0y);
    const end = toSvg(1, p3y);

    const pathData = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

    const handlePointerDown = (pt: 'p1' | 'p2') => (e: React.PointerEvent) => {
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
        
        if (dragging === 'p1') {
            onChange({ p1x: newVal.x, p1y: newVal.y, p2x, p2y, p0y, p3y });
        } else {
            onChange({ p1x, p1y, p2x: newVal.x, p2y: newVal.y, p0y, p3y });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setDragging(null);
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {
            // Ignore if pointer capture lost
        }
    };

    return (
        <div className="w-full flex flex-col gap-3 p-3 bg-white/50 rounded-xl border border-indigo-100 shadow-sm">
            <div className="flex justify-between items-center border-b border-indigo-100 pb-2 mb-1">
               <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Custom Curve</span>
               <span className="text-[9px] text-slate-400">0-1 / 1-0 Presets below</span>
            </div>

            <div className="flex gap-2 items-stretch h-40">
                {/* START VALUE SLIDER */}
                <div className="flex flex-col items-center justify-between w-6 bg-slate-100 rounded-lg p-1 relative border border-slate-200">
                    <span className="text-[7px] font-bold text-slate-400 uppercase">Start</span>
                    <input 
                        type="range" 
                        min="0" max="1" step="0.01" 
                        value={p0y} 
                        onChange={(e) => onChange({ p1x, p1y, p2x, p2y, p0y: parseFloat(e.target.value), p3y })}
                        className="absolute inset-0 m-auto -rotate-90 w-32 h-6 opacity-0 cursor-ns-resize z-20"
                    />
                    <div className="absolute w-2 bg-indigo-300 rounded-full bottom-6 pointer-events-none transition-all duration-75" style={{ height: `${p0y * 80}%` }} />
                    <span className="text-[8px] font-mono text-indigo-600 z-10 font-bold">{Math.round(p0y * 100)}%</span>
                </div>

                {/* INTERACTIVE GRAPH */}
                <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-inner relative touch-none select-none overflow-hidden">
                    <svg 
                        ref={svgRef}
                        viewBox="-10 -10 120 120" 
                        className="w-full h-full overflow-visible"
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    >
                        <defs>
                            <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
                                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
                            </pattern>
                        </defs>
                        <rect x="0" y="0" width="100" height="100" fill="url(#grid)" />
                        <line x1="0" y1="100" x2="100" y2="0" stroke="#e2e8f0" strokeDasharray="4" />
                        
                        {/* Control Lines */}
                        <line x1={start.x} y1={start.y} x2={cp1.x} y2={cp1.y} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="2" />
                        <line x1={end.x} y1={end.y} x2={cp2.x} y2={cp2.y} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="2" />
                        
                        {/* Curve */}
                        <path d={pathData} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
                        
                        {/* Handles */}
                        <circle 
                            cx={cp1.x} cy={cp1.y} r="6" 
                            fill="#818cf8" stroke="white" strokeWidth="2" 
                            className="cursor-pointer hover:fill-indigo-600 transition-colors shadow-sm"
                            onPointerDown={handlePointerDown('p1')}
                        />
                        <circle 
                            cx={cp2.x} cy={cp2.y} r="6" 
                            fill="#818cf8" stroke="white" strokeWidth="2" 
                            className="cursor-pointer hover:fill-indigo-600 transition-colors shadow-sm"
                            onPointerDown={handlePointerDown('p2')}
                        />

                        {/* Anchor points Visuals */}
                        <circle cx={start.x} cy={start.y} r="3" fill="#cbd5e1" />
                        <circle cx={end.x} cy={end.y} r="3" fill="#cbd5e1" />
                    </svg>
                </div>

                {/* END VALUE SLIDER */}
                <div className="flex flex-col items-center justify-between w-6 bg-slate-100 rounded-lg p-1 relative border border-slate-200">
                    <span className="text-[7px] font-bold text-slate-400 uppercase">End</span>
                    <input 
                        type="range" 
                        min="0" max="1" step="0.01" 
                        value={p3y} 
                        onChange={(e) => onChange({ p1x, p1y, p2x, p2y, p0y, p3y: parseFloat(e.target.value) })}
                        className="absolute inset-0 m-auto -rotate-90 w-32 h-6 opacity-0 cursor-ns-resize z-20"
                    />
                    <div className="absolute w-2 bg-indigo-300 rounded-full bottom-6 pointer-events-none transition-all duration-75" style={{ height: `${p3y * 80}%` }} />
                    <span className="text-[8px] font-mono text-indigo-600 z-10 font-bold">{Math.round(p3y * 100)}%</span>
                </div>
            </div>
            
            <div className="grid grid-cols-4 gap-1 border-t border-indigo-50 pt-2">
                <button 
                  onClick={() => onChange({ p1x: 0.5, p1y: 0.5, p2x: 0.5, p2y: 0.5, p0y: 0, p3y: 1 })} 
                  className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-indigo-100 rounded-lg transition-colors border border-slate-100"
                >
                  <TrendingUp size={12} className="text-indigo-500" />
                  <span className="text-[7px] font-bold uppercase">0-1</span>
                </button>
                <button 
                  onClick={() => onChange({ p1x: 0.5, p1y: 0.5, p2x: 0.5, p2y: 0.5, p0y: 1, p3y: 0 })} 
                  className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-indigo-100 rounded-lg transition-colors border border-slate-100"
                >
                  <TrendingDown size={12} className="text-pink-500" />
                  <span className="text-[7px] font-bold uppercase">1-0</span>
                </button>
                <button 
                  onClick={() => onChange({ p1x: 0.5, p1y: 1.5, p2x: 0.5, p2y: 1.5, p0y: 0, p3y: 0 })} 
                  className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-indigo-100 rounded-lg transition-colors border border-slate-100"
                >
                  <Waves size={12} className="text-emerald-500" />
                  <span className="text-[7px] font-bold uppercase">0-1-0</span>
                </button>
                <button 
                  onClick={() => onChange({ p1x: 0.5, p1y: -0.5, p2x: 0.5, p2y: -0.5, p0y: 1, p3y: 1 })} 
                  className="flex flex-col items-center gap-1 p-1 bg-slate-50 hover:bg-indigo-100 rounded-lg transition-colors border border-slate-100"
                >
                  <ArrowDownUp size={12} className="text-amber-500" />
                  <span className="text-[7px] font-bold uppercase">1-0-1</span>
                </button>
            </div>
        </div>
    );
};