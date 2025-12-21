import { EasingMode, ModulationConfig } from '../types';

// Cubic Bezier function solver
export const cubicBezier = (t: number, p1x: number, p1y: number, p2x: number, p2y: number, p0y: number = 0, p3y: number = 1): number => {
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    
    const sampleCurveX = (T: number) => ((ax * T + bx) * T + cx) * T;
    const sampleCurveDerivativeX = (T: number) => (3 * ax * T + 2 * bx) * T + cx;

    let T = t; 
    for (let i = 0; i < 8; i++) {
        const x2 = sampleCurveX(T) - t;
        if (Math.abs(x2) < 1e-6) break;
        const d2 = sampleCurveDerivativeX(T);
        if (Math.abs(d2) < 1e-6) break;
        T = T - x2 / d2;
    }
    
    T = Math.max(0, Math.min(1, T));

    const mt = 1 - T;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const T2 = T * T;
    const T3 = T2 * T;

    return (mt3 * p0y) + (3 * mt2 * T * p1y) + (3 * mt * T2 * p2y) + (T3 * p3y);
};

// Helper for warping stop offsets based on a midpoint
export const warpOffset = (t: number, midpoint: number): number => {
  if (Math.abs(midpoint - 0.5) < 0.001) return t;
  // Map t so that 0.5 becomes midpoint using a power function
  const exponent = Math.log(0.5) / Math.log(Math.max(0.01, Math.min(0.99, midpoint)));
  return Math.pow(t, exponent);
};

export const getPseudoRandom = (seed: number, salt: string) => {
    let h = 0x811c9dc5;
    for(let i = 0; i < salt.length; i++) {
        h ^= salt.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    h ^= Math.floor(seed * 1000000);
    h = Math.imul(h, 0x01000193);
    return ((h >>> 0) / 4294967296);
};

export const applyEasing = (t: number, mode?: EasingMode, config?: ModulationConfig) => {
     if (!mode || mode === 'linear') return t;
     if (mode === 'easeInQuad') return t * t;
     if (mode === 'easeOutQuad') return t * (2 - t);
     if (mode === 'easeInOutQuad') return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
     if (mode === 'step') return t < 0.5 ? 0 : 1;
     if (mode === 'triangle') return 1 - Math.abs((t - 0.5) * 2); 
     if (mode === 'triangle-inv') return Math.abs((t - 0.5) * 2); 
     if (mode === 'sine') return (Math.sin(t * Math.PI * 2 - Math.PI/2) + 1) / 2;
     if (mode === 'random') return Math.random(); 
     
     if (mode === 'custom-bezier' && config) {
         return cubicBezier(t, config.paramA ?? 0.5, config.paramB ?? 0.5, config.paramC ?? 0.5, config.paramD ?? 0.5, config.paramE ?? 0, config.paramF ?? 1);
     }
     
     return t;
};

// Distance from point (x,y) to line segment (x1,y1)-(x2,y2)
export const distanceToLineSegment = (x: number, y: number, x1: number, y1: number, x2: number, y2: number): number => {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) // in case of 0 length line
      param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  }
  else if (param > 1) {
    xx = x2;
    yy = y2;
  }
  else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};