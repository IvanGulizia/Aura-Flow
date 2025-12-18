
import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Stroke, SimulationParams, ModulationConfig, SoundConfig, GlobalForceType, GlobalToolConfig, EasingMode, GridConfig, SymmetryConfig, Point, Connection, PointReference, ProjectData } from '../types';
import { audioManager } from '../services/audioService';

interface CanvasProps {
  brushParams: SimulationParams;
  brushSound: SoundConfig;
  gridConfig: GridConfig;       
  symmetryConfig: SymmetryConfig; 
  selectedStrokeId: string | null;
  selectedStrokeParams: SimulationParams | null;
  isPlaying: boolean;
  isSoundEngineEnabled: boolean; // Master Audio Switch
  isMicEnabled: boolean; // Visual Reactivity Switch
  interactionMode: 'draw' | 'select';
  globalForceTool: GlobalForceType;
  globalToolConfig: GlobalToolConfig;
  ecoMode: boolean;
  clearTrigger: number;
  deleteSelectedTrigger: number;
  undoTrigger: number;
  redoTrigger: number;
  resetPosTrigger: number;
  deleteAllLinksTrigger: number;
  onStrokeSelect: (strokeId: string | null, params: SimulationParams | null, sound: SoundConfig | null) => void;
  onCanvasInteraction?: () => void; // New prop to notify parent of interaction
}

export interface CanvasHandle {
  exportData: () => ProjectData;
  importData: (data: ProjectData | Stroke[]) => void; // Handle legacy array format
}

// --- COLOR UTILS ---
const hexToHsl = (hex: string): { h: number, s: number, l: number } => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }
  r /= 255; g /= 255; b /= 255;
  const cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin;
  let h = 0, s = 0, l = 0;

  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return { h, s, l };
};

const getShiftedColor = (hex: string, shift: number): string => {
    if (shift === 0) return hex;
    const hsl = hexToHsl(hex);
    const newH = (hsl.h + shift) % 360;
    return `hsl(${newH}, ${hsl.s}%, ${hsl.l}%)`;
};

// Multi-color interpolation
const interpolateColors = (colors: string[], t: number): string => {
    if (colors.length === 0) return '#000000';
    if (colors.length === 1) return colors[0];
    if (t <= 0) return colors[0];
    if (t >= 1) return colors[colors.length - 1];

    const scaledT = t * (colors.length - 1);
    const index = Math.floor(scaledT);
    const innerT = scaledT - index;
    
    return getGradientMiddleColor(colors[index], colors[index + 1], innerT);
};

// Returns color mixed in RGB space
const getGradientMiddleColor = (c1: string, c2: string, ratio: number = 0.5) => {
    const parse = (c: string) => {
        if (c.startsWith('rgb')) {
            const matches = c.match(/\d+/g);
            if (matches) return [parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2])];
        }
        if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
        const r = parseInt(c.slice(1, 3), 16);
        const g = parseInt(c.slice(3, 5), 16);
        const b = parseInt(c.slice(5, 7), 16);
        return [r, g, b];
    };
    
    let [r1, g1, b1] = [0,0,0];
    let [r2, g2, b2] = [255,255,255];
    
    try { 
        [r1, g1, b1] = parse(c1);
        [r2, g2, b2] = parse(c2);
    } catch(e) {}

    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    
    return `rgb(${r}, ${g}, ${b})`;
};

// Cubic Bezier function solver
const cubicBezier = (t: number, p1x: number, p1y: number, p2x: number, p2y: number, p0y: number = 0, p3y: number = 1): number => {
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
const warpOffset = (t: number, midpoint: number): number => {
  if (Math.abs(midpoint - 0.5) < 0.001) return t;
  // Map t so that 0.5 becomes midpoint using a power function
  const exponent = Math.log(0.5) / Math.log(Math.max(0.01, Math.min(0.99, midpoint)));
  return Math.pow(t, exponent);
};

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ 
  brushParams,
  brushSound,
  gridConfig,
  symmetryConfig,
  selectedStrokeId,
  selectedStrokeParams,
  isPlaying, 
  isSoundEngineEnabled, 
  isMicEnabled,
  interactionMode,
  globalForceTool,
  globalToolConfig,
  ecoMode,
  clearTrigger,
  deleteSelectedTrigger,
  undoTrigger,
  redoTrigger,
  resetPosTrigger,
  deleteAllLinksTrigger,
  onStrokeSelect,
  onCanvasInteraction
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const strokesRef = useRef<Stroke[]>([]);
  const connectionsRef = useRef<Connection[]>([]); 
  const activeStrokesRef = useRef<Stroke[]>([]); 

  const timeRef = useRef<number>(0);
  const reqRef = useRef<number>();
  
  const pointerRef = useRef({ 
      x: -1000, y: -1000, 
      isDown: false, 
      startX: 0, startY: 0, 
      lastX: 0, lastY: 0, 
      hasMoved: false,
      connectionStart: null as PointReference | null
  });
  
  const lastFrameTimeRef = useRef<number>(0);

  const historyRef = useRef<{strokes: Stroke[], connections: Connection[]}[]>([]);
  const redoStackRef = useRef<{strokes: Stroke[], connections: Connection[]}[]>([]);
  const preDrawSnapshotRef = useRef<{strokes: Stroke[], connections: Connection[]} | null>(null);

  useImperativeHandle(ref, () => ({
    exportData: () => ({
        strokes: cloneStrokes(strokesRef.current),
        connections: JSON.parse(JSON.stringify(connectionsRef.current)),
        version: 1
    }),
    importData: (data: ProjectData | Stroke[]) => {
      saveToHistory();
      if (Array.isArray(data)) {
        strokesRef.current = hydrateStrokes(data);
        connectionsRef.current = [];
      } else {
        strokesRef.current = hydrateStrokes(data.strokes);
        connectionsRef.current = data.connections || [];
      }
      onStrokeSelect(null, null, null);
    }
  }));

  const cloneStrokes = (strokes: Stroke[]): Stroke[] => {
    try {
      return JSON.parse(JSON.stringify(strokes));
    } catch (e) {
      console.error("Clone failed", e);
      return [];
    }
  };
  
  const hydrateStrokes = (data: Stroke[]): Stroke[] => {
      return cloneStrokes(data).map(s => ({
            ...s,
            originCenter: s.originCenter || { ...s.center },
            params: { 
                ...s.params, 
                maxDisplacement: s.params.maxDisplacement || 0,
                strokeGradientType: s.params.strokeGradientType || 'linear',
                hueShift: s.params.hueShift || 0, 
                drawPoints: s.params.drawPoints || false,
                smoothModulation: s.params.smoothModulation || false,
                closePath: s.params.closePath || false,
                closePathRadius: s.params.closePathRadius || 50,
                strokeGradientMidpoint: s.params.strokeGradientMidpoint ?? 0.5,
                lineCap: s.params.lineCap || 'round',
                fill: {
                    enabled: false, 
                    type: 'solid', 
                    syncWithStroke: false, 
                    blendMode: 'source-over', 
                    colorSource: 'stroke', 
                    customColor: '#574dff', 
                    opacity: 0.2, 
                    rule: 'nonzero',
                    blur: 0,
                    glow: false,
                    ...(s.params.fill || {}),
                    gradient: s.params.fill?.gradient || { enabled: false, colors: ['#000000', '#ffffff'] },
                },
                gradient: s.params.gradient || { enabled: false, colors: ['#f472b6', '#60a5fa'] },
                pathRounding: s.params.pathRounding || 0,
                strokeGradientAngle: s.params.strokeGradientAngle || 45,
                fillGradientAngle: s.params.fillGradientAngle || 0,
                swarmCursorInfluence: s.params.swarmCursorInfluence || 0
            }
      }));
  };

  const saveToHistory = () => {
    const snapshot = {
        strokes: cloneStrokes(strokesRef.current),
        connections: JSON.parse(JSON.stringify(connectionsRef.current))
    };
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 30) historyRef.current.shift();
    redoStackRef.current = [];
  };

  const updateCanvasSize = useCallback(() => {
    if (canvasRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (canvasRef.current.width !== rect.width || canvasRef.current.height !== rect.height) {
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
      }
    }
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(() => { updateCanvasSize(); });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateCanvasSize]);

  // Triggers
  useEffect(() => {
    if (clearTrigger > 0) {
      saveToHistory();
      strokesRef.current = [];
      connectionsRef.current = [];
      onStrokeSelect(null, null, null);
      audioManager.stopAll();
    }
  }, [clearTrigger]);

  useEffect(() => {
    if (deleteSelectedTrigger > 0 && selectedStrokeId) {
      saveToHistory();
      strokesRef.current = strokesRef.current.filter(s => s.id !== selectedStrokeId);
      connectionsRef.current = connectionsRef.current.filter(c => c.from.strokeId !== selectedStrokeId && c.to.strokeId !== selectedStrokeId);
      onStrokeSelect(null, null, null);
    }
  }, [deleteSelectedTrigger]);

  useEffect(() => {
    if (deleteAllLinksTrigger > 0) {
        saveToHistory();
        connectionsRef.current = [];
    }
  }, [deleteAllLinksTrigger]);

  useEffect(() => {
    if (resetPosTrigger > 0) {
      strokesRef.current.forEach(s => {
        s.velocity = { x: 0, y: 0 };
        s.points.forEach(p => { p.x = p.baseX; p.y = p.baseY; p.vx = 0; p.vy = 0; });
      });
    }
  }, [resetPosTrigger]);

  useEffect(() => {
    if (undoTrigger > 0 && historyRef.current.length > 0) {
      const previousState = historyRef.current.pop();
      if (previousState) {
        redoStackRef.current.push({
            strokes: cloneStrokes(strokesRef.current),
            connections: JSON.parse(JSON.stringify(connectionsRef.current))
        });
        strokesRef.current = previousState.strokes;
        connectionsRef.current = previousState.connections;
        if (selectedStrokeId && !strokesRef.current.find(s => s.id === selectedStrokeId)) {
          onStrokeSelect(null, null, null);
        }
      }
    }
  }, [undoTrigger]);

  useEffect(() => {
    if (redoTrigger > 0 && redoStackRef.current.length > 0) {
      const nextState = redoStackRef.current.pop();
      if (nextState) {
        historyRef.current.push({
            strokes: cloneStrokes(strokesRef.current),
            connections: JSON.parse(JSON.stringify(connectionsRef.current))
        });
        strokesRef.current = nextState.strokes;
        connectionsRef.current = nextState.connections;
      }
    }
  }, [redoTrigger]);

  useEffect(() => {
    if (selectedStrokeId && selectedStrokeParams) {
      const stroke = strokesRef.current.find(s => s.id === selectedStrokeId);
      if (stroke) stroke.params = { ...selectedStrokeParams };
    }
  }, [selectedStrokeParams, selectedStrokeId]);

  // --- HELPER FUNCTIONS ---

  const snapToGrid = (x: number, y: number): { x: number, y: number } => {
    if (!gridConfig.enabled || !gridConfig.snap || !canvasRef.current) return { x, y };
    const cx = canvasRef.current.width / 2;
    const cy = canvasRef.current.height / 2;
    const size = Math.max(10, gridConfig.size);
    const snX = Math.round((x - cx) / size) * size;
    const snY = Math.round((y - cy) / size) * size;
    return { x: cx + snX, y: cy + snY };
  };

  const getSymmetryPoints = (x: number, y: number): { x: number, y: number }[] => {
    if (!symmetryConfig.enabled || !canvasRef.current) return [{ x, y }];
    const cx = canvasRef.current.width / 2;
    const cy = canvasRef.current.height / 2;
    const points: { x: number, y: number }[] = [];
    points.push({ x, y }); 

    if (symmetryConfig.type === 'horizontal') points.push({ x: cx - (x - cx), y: y }); 
    else if (symmetryConfig.type === 'vertical') points.push({ x: x, y: cy - (y - cy) }); 
    else if (symmetryConfig.type === 'quad') {
       points.push({ x: cx - (x - cx), y: y });
       points.push({ x: x, y: cy - (y - cy) });
       points.push({ x: cx - (x - cx), y: cy - (y - cy) });
    } else if (symmetryConfig.type === 'radial') {
       const count = Math.max(2, symmetryConfig.count);
       const rx = x - cx; const ry = y - cy;
       const angle = Math.atan2(ry, rx);
       const radius = Math.hypot(rx, ry);
       for (let i = 1; i < count; i++) {
          const theta = angle + (Math.PI * 2 / count) * i;
          points.push({ x: cx + Math.cos(theta) * radius, y: cy + Math.sin(theta) * radius });
       }
    }
    return points;
  };

  const getStrokeBounds = (stroke: Stroke) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of stroke.points) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
      }
      if (!isFinite(minX)) { minX = 0; maxX = 0; minY = 0; maxY = 0; }
      return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, cx: (minX+maxX)/2, cy: (minY+maxY)/2 };
  };

  const getStrokeAtPosition = (x: number, y: number): Stroke | null => {
    for (let i = strokesRef.current.length - 1; i >= 0; i--) {
      const stroke = strokesRef.current[i];
      const hitDist = Math.max(20, stroke.params.strokeWidth + 15);
      const hitDistSq = hitDist * hitDist;
      for (let j = 0; j < stroke.points.length; j += 2) { 
        const p = stroke.points[j];
        if (((p.x - x) ** 2 + (p.y - y) ** 2) < hitDistSq) return stroke;
      }
    }
    return null;
  };

  const getClosestPoint = (x: number, y: number, maxDist: number = 30): PointReference | null => {
      let minDistSq = maxDist * maxDist;
      let result: PointReference | null = null;
      for (const stroke of strokesRef.current) {
          for (let i = 0; i < stroke.points.length; i++) {
              const p = stroke.points[i];
              const dSq = (p.x - x)**2 + (p.y - y)**2;
              if (dSq < minDistSq) {
                  minDistSq = dSq;
                  result = { strokeId: stroke.id, pointIndex: i };
              }
          }
      }
      return result;
  };

  const findPoint = (ref: PointReference): Point | null => {
      const s = strokesRef.current.find(st => st.id === ref.strokeId);
      if (!s) return null;
      return s.points[ref.pointIndex] || null;
  };

  // --- INPUT HANDLING ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (onCanvasInteraction) onCanvasInteraction();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const { x, y } = snapToGrid(rawX, rawY);

    pointerRef.current = { ...pointerRef.current, isDown: true, x, y, startX: x, startY: y, lastX: x, lastY: y, hasMoved: false };

    if (globalForceTool === 'connect') {
        const closest = getClosestPoint(rawX, rawY, 40);
        if (closest) {
            pointerRef.current.connectionStart = closest;
            preDrawSnapshotRef.current = { strokes: cloneStrokes(strokesRef.current), connections: JSON.parse(JSON.stringify(connectionsRef.current)) };
        }
        return;
    }

    if (globalForceTool !== 'none') return;
    
    if (interactionMode === 'select') {
      const hitStroke = getStrokeAtPosition(rawX, rawY);
      onStrokeSelect(hitStroke?.id || null, hitStroke?.params || null, hitStroke?.sound || null);
      return;
    }

    if (selectedStrokeId) onStrokeSelect(null, null, null);

    preDrawSnapshotRef.current = { strokes: cloneStrokes(strokesRef.current), connections: JSON.parse(JSON.stringify(connectionsRef.current)) };
    
    const symPoints = getSymmetryPoints(x, y);
    const newStrokes: Stroke[] = [];
    const baseId = Date.now().toString();
    const effectiveSeamless = gridConfig.enabled ? false : brushParams.seamlessPath;
    
    symPoints.forEach((p, idx) => {
       const newStroke: Stroke = {
          id: `${baseId}-${idx}`,
          index: strokesRef.current.length + idx,
          points: [{ x: p.x, y: p.y, baseX: p.x, baseY: p.y, vx: 0, vy: 0, pressure: 0.5 }],
          center: { x: p.x, y: p.y },
          originCenter: { x: p.x, y: p.y },
          velocity: { x: 0, y: 0 },
          params: { ...JSON.parse(JSON.stringify(brushParams)), seamlessPath: effectiveSeamless }, 
          sound: JSON.parse(JSON.stringify(brushSound)),
          createdAt: Date.now(),
          phaseOffset: Math.random() * 100,
          randomSeed: Math.random()
       };
       newStrokes.push(newStroke);
    });
    activeStrokesRef.current = newStrokes;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const { x, y } = (pointerRef.current.isDown && interactionMode === 'draw') ? snapToGrid(rawX, rawY) : { x: rawX, y: rawY };

    pointerRef.current.x = x;
    pointerRef.current.y = y;

    if (globalForceTool === 'connect' && pointerRef.current.isDown) return;
    if (globalForceTool !== 'none' || interactionMode === 'select') return;

    if (pointerRef.current.isDown && activeStrokesRef.current.length > 0) {
      const distSq = (x - pointerRef.current.lastX) ** 2 + (y - pointerRef.current.lastY) ** 2;
      if (distSq > 4) pointerRef.current.hasMoved = true;

      if (pointerRef.current.hasMoved) {
          activeStrokesRef.current.forEach(s => { if (!strokesRef.current.includes(s)) strokesRef.current.push(s); });
          
          const symPoints = getSymmetryPoints(x, y);
          activeStrokesRef.current.forEach((stroke, idx) => {
            if (idx >= symPoints.length) return;
            const target = symPoints[idx];
            const lastP = stroke.points[stroke.points.length - 1];
            if (((target.x - lastP.x) ** 2 + (target.y - lastP.y) ** 2) >= stroke.params.segmentation ** 2) {
                 const speed = Math.hypot(x - pointerRef.current.lastX, y - pointerRef.current.lastY);
                 const pressure = Math.min(1, Math.max(0.01, speed / 30)); 
                 stroke.points.push({ x: target.x, y: target.y, baseX: target.x, baseY: target.y, vx: 0, vy: 0, pressure });
                 
                 let cx = 0, cy = 0;
                 stroke.points.forEach(p => { cx += p.x; cy += p.y; });
                 stroke.center.x = cx / stroke.points.length;
                 stroke.center.y = cy / stroke.points.length;
                 if (!stroke.originCenter.x) stroke.originCenter = { ...stroke.center };
            }
        });
        pointerRef.current.lastX = x;
        pointerRef.current.lastY = y;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    pointerRef.current.isDown = false;
    
    if (globalForceTool === 'connect' && pointerRef.current.connectionStart) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;
            const closest = getClosestPoint(rawX, rawY, 40);
            if (closest && !(closest.strokeId === pointerRef.current.connectionStart.strokeId && closest.pointIndex === pointerRef.current.connectionStart.pointIndex)) {
                connectionsRef.current.push({
                    id: `conn-${Date.now()}`,
                    from: pointerRef.current.connectionStart,
                    to: closest,
                    stiffness: globalToolConfig.connectionStiffness,
                    length: 0,
                    breakingForce: globalToolConfig.connectionBreakingForce,
                    bias: globalToolConfig.connectionBias,
                    influence: globalToolConfig.connectionInfluence || 0,
                    falloff: globalToolConfig.connectionFalloff || 1, 
                    decayEasing: globalToolConfig.connectionDecayEasing || 'linear'
                });
                if (preDrawSnapshotRef.current) {
                    historyRef.current.push(preDrawSnapshotRef.current);
                    if (historyRef.current.length > 30) historyRef.current.shift();
                    redoStackRef.current = [];
                }
            }
        }
        pointerRef.current.connectionStart = null;
        return;
    }

    if (globalForceTool !== 'none' || interactionMode === 'select') return;
    
    if (pointerRef.current.hasMoved && activeStrokesRef.current.length > 0) {
        activeStrokesRef.current.forEach(s => {
            s.originCenter = { ...s.center };
            if (s.params.closePath && s.points.length > 2) {
                const first = s.points[0];
                const last = s.points[s.points.length - 1];
                const dist = Math.hypot(first.x - last.x, first.y - last.y);
                if (dist < (s.params.closePathRadius || 50)) {
                    s.points.push({ 
                        x: first.x, y: first.y, 
                        baseX: first.baseX, baseY: first.baseY, 
                        vx: 0, vy: 0, 
                        pressure: last.pressure 
                    });
                }
            }
        });
        
        if (preDrawSnapshotRef.current) {
            historyRef.current.push(preDrawSnapshotRef.current);
            if (historyRef.current.length > 30) historyRef.current.shift();
            redoStackRef.current = [];
        }
    }
    activeStrokesRef.current = [];
  };

  // --- MODULATION LOGIC ---
  const getPseudoRandom = (seed: number, salt: string) => {
    let h = 0x811c9dc5;
    for(let i = 0; i < salt.length; i++) {
        h ^= salt.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    h ^= Math.floor(seed * 1000000);
    h = Math.imul(h, 0x01000193);
    return ((h >>> 0) / 4294967296);
  };

  const applyEasing = (t: number, mode?: EasingMode, config?: ModulationConfig) => {
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

  const resolveParam = (
    baseValue: number, 
    key: keyof SimulationParams, 
    stroke: Stroke, 
    pointPressure: number, 
    cursorDistPoint: number, 
    cursorDistCenter: number, 
    cursorRadius: number,
    progress: number, 
    pointIndex: number
  ): number => {
    const config = stroke.params.modulations?.[key];
    if (!config) return baseValue;

    const { source, min, max, easing, scope } = config;
    if (source === 'none') return baseValue;

    let t = 0; 
    const isScopePoint = scope === 'point';

    switch (source) {
      case 'random':
        t = isScopePoint ? getPseudoRandom(stroke.randomSeed + pointIndex * 0.1, key as string) : getPseudoRandom(stroke.randomSeed, key as string);
        break;
      case 'index':
        t = (stroke.index % 10) / 10;
        break;
      case 'time':
        const dirT = config.invertDirection ? -1 : 1;
        t = (timeRef.current * (config.speed ?? 1) * dirT + (isScopePoint ? progress : 0)) % 1;
        if (t < 0) t += 1;
        break;
      case 'time-pulse':
        const dirP = config.invertDirection ? -1 : 1;
        const duty = config.paramA ?? 0.5; 
        const rawPulse = (timeRef.current * (config.speed ?? 1) * dirP + (isScopePoint ? progress : 0)) % 1;
        let normPulse = rawPulse;
        if (normPulse < 0) normPulse += 1;
        
        const edge = 0.1; 
        if (normPulse < edge) t = normPulse / edge;
        else if (normPulse < duty) t = 1;
        else if (normPulse < duty + edge) t = 1 - (normPulse - duty) / edge;
        else t = 0;
        break;
      case 'time-step':
        const dirS = config.invertDirection ? -1 : 1;
        const steps = 4;
        let rawStep = (timeRef.current * (config.speed ?? 1) * dirS + (isScopePoint ? progress : 0)) % 1;
        if (rawStep < 0) rawStep += 1;
        t = Math.floor(rawStep * steps) / (steps - 1);
        break;
      case 'velocity':
        t = isScopePoint ? pointPressure : stroke.points.reduce((acc, p) => acc + p.pressure, 0) / (stroke.points.length || 1);
        break;
      case 'pressure':
         t = isScopePoint ? pointPressure : stroke.points.reduce((acc, p) => acc + p.pressure, 0) / (stroke.points.length || 1);
        break;
      case 'cursor':
        const dist = isScopePoint ? cursorDistPoint : cursorDistCenter;
        t = (dist < cursorRadius) ? 1 - (dist / cursorRadius) : 0;
        break;
      case 'path':
        t = progress; 
        break;
      case 'path-mirror':
        t = 1 - Math.abs((progress - 0.5) * 2);
        break;
      case 'path-mirror-inv':
        t = Math.abs((progress - 0.5) * 2);
        break;
      case 'audio-live':
        t = audioManager.getGlobalAudioData().average / 255;
        break;
      case 'audio-sample':
        t = audioManager.getStrokeAmplitude(stroke.id);
        break;
    }
    
    const inMin = config.inputMin ?? 0;
    const inMax = config.inputMax ?? 1;
    if (inMax > inMin) {
        t = (t - inMin) / (inMax - inMin);
    }
    t = Math.max(0, Math.min(1, t));

    const easedT = applyEasing(t, easing, config);
    return min + (max - min) * easedT;
  };

  const getProjectedPosition = (stroke: Stroke, px: number, py: number): number => {
      let minDistSq = Infinity;
      let closestIdx = 0;
      for(let i=0; i<stroke.points.length; i++) {
          const p = stroke.points[i];
          const dSq = (p.x - px)**2 + (p.y - py)**2;
          if (dSq < minDistSq) { minDistSq = dSq; closestIdx = i; }
      }
      return closestIdx / (stroke.points.length - 1 || 1);
  };

  // --- PHYSICS ---
  const updatePhysics = () => {
    if (!isPlaying) return;
    timeRef.current += 0.01;
    const globalAudio = isMicEnabled ? audioManager.getGlobalAudioData() : { average: 0, low: 0 };
    const globalBass = globalAudio.low / 255;
    const pointerX = pointerRef.current.x;
    const pointerY = pointerRef.current.y;
    const hasPointer = pointerX > -100;
    
    pointerRef.current.lastX = pointerX;
    pointerRef.current.lastY = pointerY;

    if (globalForceTool !== 'none' && globalForceTool !== 'connect' && (pointerRef.current.isDown || globalToolConfig.trigger === 'hover') && hasPointer) {
       const influenceRadius = globalToolConfig.radius;
       const strength = globalToolConfig.force * 2;
       const falloffExp = globalToolConfig.falloff ? (1 + globalToolConfig.falloff * 2) : 1; 

       strokesRef.current.forEach(stroke => {
          stroke.points.forEach(p => {
             const dx = pointerX - p.x; const dy = pointerY - p.y;
             const dSq = dx*dx + dy*dy;
             if (dSq < influenceRadius * influenceRadius) {
                const dist = Math.sqrt(dSq);
                const forceMag = Math.pow(1 - (dist / influenceRadius), falloffExp) * strength;
                if (globalForceTool === 'repulse') { p.vx -= (dx / dist) * forceMag; p.vy -= (dy / dist) * forceMag; } 
                else if (globalForceTool === 'attract') { p.vx += (dx / dist) * forceMag; p.vy += (dy / dist) * forceMag; } 
                else if (globalForceTool === 'vortex') { p.vx += (-dy / dist) * forceMag; p.vy += (dx / dist) * forceMag; }
             }
          });
       });
    }

    for (let i = connectionsRef.current.length - 1; i >= 0; i--) {
        const conn = connectionsRef.current[i];
        const s1 = strokesRef.current.find(s => s.id === conn.from.strokeId);
        const s2 = strokesRef.current.find(s => s.id === conn.to.strokeId);
        
        if (s1 && s2) {
            const p1Idx = conn.from.pointIndex;
            const p2Idx = conn.to.pointIndex;
            const p1 = s1.points[p1Idx];
            const p2 = s2.points[p2Idx];

            if (p1 && p2) {
                const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 0.1) {
                    const diff = dist - conn.length;
                    if (conn.breakingForce > 0 && Math.abs(diff) > conn.breakingForce * 10) {
                        connectionsRef.current.splice(i, 1); continue;
                    }
                    const force = diff * conn.stiffness * 0.5; 
                    const fx = (dx / dist) * force; const fy = (dy / dist) * force;
                    const w1 = (conn.bias !== undefined) ? conn.bias : 0.5; const w2 = 1 - w1;
                    
                    const baseForceX1 = fx * w1;
                    const baseForceY1 = fy * w1;
                    const baseForceX2 = -fx * w2;
                    const baseForceY2 = -fy * w2;

                    p1.vx += baseForceX1; p1.vy += baseForceY1;
                    p2.vx += baseForceX2; p2.vy += baseForceY2;

                    const influence = conn.influence || 0;
                    const falloff = conn.falloff !== undefined ? conn.falloff : 1; 
                    const decayEasing = conn.decayEasing || 'linear';

                    if (influence > 0) {
                        for (let k = 1; k <= influence; k++) {
                            const t = k / (influence + 1);
                            const easedT = applyEasing(t, decayEasing);
                            const curveFactor = 1 - easedT; 
                            const factor = 1.0 * (1 - falloff) + curveFactor * falloff;
                            
                            const left1 = s1.points[p1Idx - k];
                            const right1 = s1.points[p1Idx + k];
                            if (left1) { left1.vx += baseForceX1 * factor; left1.vy += baseForceY1 * factor; }
                            if (right1) { right1.vx += baseForceX1 * factor; right1.vy += baseForceY1 * factor; }

                            const left2 = s2.points[p2Idx - k];
                            const right2 = s2.points[p2Idx + k];
                            if (left2) { left2.vx += baseForceX2 * factor; left2.vy += baseForceY2 * factor; }
                            if (right2) { right2.vx += baseForceX2 * factor; right2.vy += baseForceY2 * factor; }
                        }
                    }
                }
            }
        } else { connectionsRef.current.splice(i, 1); }
    }

    const activeStrokes = strokesRef.current;
    const swarmForces = new Map<string, { vx: number, vy: number }>();

    for (let i = 0; i < activeStrokes.length; i++) {
        const s1 = activeStrokes[i];
        if (s1.points.length < 2) continue;

        const r = s1.params.neighborRadius;
        if (r <= 0 || (s1.params.alignmentForce === 0 && s1.params.cohesionForce === 0 && s1.params.repulsionForce === 0)) continue;

        let influenceFactor = 1;
        if (s1.params.swarmCursorInfluence > 0 && hasPointer) {
             const distToCursor = Math.hypot(pointerX - s1.center.x, pointerY - s1.center.y);
             const range = s1.params.mouseInfluenceRadius || 200;
             if (distToCursor > range) influenceFactor = 0;
             else influenceFactor = 1 - (distToCursor / range);
             
             influenceFactor = 1 * (1 - s1.params.swarmCursorInfluence) + influenceFactor * s1.params.swarmCursorInfluence;
        }

        if (influenceFactor <= 0.01) continue;

        let alignX = 0, alignY = 0;
        let cohX = 0, cohY = 0;
        let sepX = 0, sepY = 0;
        let count = 0;

        for (let j = 0; j < activeStrokes.length; j++) {
            if (i === j) continue;
            const s2 = activeStrokes[j];
            if (s2.points.length < 2) continue;

            const dx = s2.center.x - s1.center.x;
            const dy = s2.center.y - s1.center.y;
            const distSq = dx*dx + dy*dy;

            if (distSq < r * r && distSq > 0.1) {
                const dist = Math.sqrt(distSq);
                
                let s2vx = 0, s2vy = 0;
                const step = Math.ceil(s2.points.length / 5);
                for(let k=0; k<s2.points.length; k+=step) { s2vx += s2.points[k].vx; s2vy += s2.points[k].vy; }
                s2vx /= (s2.points.length/step); s2vy /= (s2.points.length/step);

                alignX += s2vx; alignY += s2vy;
                cohX += s2.center.x; cohY += s2.center.y;
                sepX += (s1.center.x - s2.center.x) / dist; 
                sepY += (s1.center.y - s2.center.y) / dist;
                count++;
            }
        }

        if (count > 0) {
            alignX /= count; alignY /= count;
            cohX /= count; cohY /= count;
            cohX = (cohX - s1.center.x);
            cohY = (cohY - s1.center.y);
            
            const fAlign = s1.params.alignmentForce * influenceFactor * 0.5;
            const fCoh = s1.params.cohesionForce * influenceFactor * 0.05; 
            const fSep = s1.params.repulsionForce * influenceFactor * 2.0;

            swarmForces.set(s1.id, {
                vx: (alignX * fAlign) + (cohX * fCoh) + (sepX * fSep),
                vy: (alignY * fAlign) + (cohY * fCoh) + (sepY * fSep)
            });
        }
    }

    for (const stroke of strokesRef.current) {
      let cx = 0, cy = 0, len = stroke.points.length;
      let totalSpeed = 0;
      if (len === 0) continue;
      for (const p of stroke.points) { cx += p.x; cy += p.y; totalSpeed += Math.hypot(p.vx, p.vy); }
      stroke.center.x = cx / len; stroke.center.y = cy / len;
      
      const avgStrokeSpeed = totalSpeed / len; 
      const centerDist = hasPointer ? Math.hypot(pointerX - stroke.center.x, pointerY - stroke.center.y) : 10000;
      const influenceRadius = stroke.params.mouseInfluenceRadius || 150;
      const swarmF = swarmForces.get(stroke.id) || { vx: 0, vy: 0 };

      if (isSoundEngineEnabled && stroke.sound.bufferId && stroke.sound.enabled) {
          const ox = stroke.originCenter?.x ?? stroke.center.x; const oy = stroke.originCenter?.y ?? stroke.center.y;
          const dispX = stroke.center.x - ox; const dispY = stroke.center.y - oy;
          audioManager.updateStrokeSound(stroke.id, stroke.sound.bufferId, { ...stroke.sound, reverb: stroke.sound.reverbSend }, {
               cursorDist: centerDist, physicsSpeed: avgStrokeSpeed * 20, displacement: { dist: Math.hypot(dispX, dispY), x: dispX, y: dispY },
               timelinePos: (stroke.sound.playbackMode === 'timeline-scrub' && hasPointer) ? getProjectedPosition(stroke, pointerX, pointerY) : 0
          });
      }

      for (let j = 0; j < stroke.points.length; j++) {
        const p = stroke.points[j];
        const progress = j / (len - 1 || 1);
        const pDist = hasPointer ? Math.hypot(pointerX - p.x, pointerY - p.y) : 10000;

        const mass = resolveParam(stroke.params.mass, 'mass', stroke, p.pressure, pDist, centerDist, influenceRadius, progress, j);
        const friction = resolveParam(stroke.params.friction, 'friction', stroke, p.pressure, pDist, centerDist, influenceRadius, progress, j);
        const tension = resolveParam(stroke.params.tension, 'tension', stroke, p.pressure, pDist, centerDist, influenceRadius, progress, j);
        const wiggleAmp = resolveParam(stroke.params.wiggleAmplitude, 'wiggleAmplitude', stroke, p.pressure, pDist, centerDist, influenceRadius, progress, j);
        const mouseRep = resolveParam(stroke.params.mouseRepulsion, 'mouseRepulsion', stroke, p.pressure, pDist, centerDist, influenceRadius, progress, j);
        const mouseAttr = resolveParam(stroke.params.mouseAttraction, 'mouseAttraction', stroke, p.pressure, pDist, centerDist, influenceRadius, progress, j);
        const elasticity = resolveParam(stroke.params.elasticity, 'elasticity', stroke, p.pressure, pDist, centerDist, influenceRadius, progress, j);
        const rGravX = resolveParam(stroke.params.gravityX, 'gravityX', stroke, p.pressure, pDist, centerDist, influenceRadius, progress, j);
        const rGravY = resolveParam(stroke.params.gravityY, 'gravityY', stroke, p.pressure, pDist, centerDist, influenceRadius, progress, j);

        const invMass = 1 / Math.max(0.1, mass);
        const frictionFactor = friction * (1 - stroke.params.viscosity * 0.1);
        const isWiggling = wiggleAmp > 0 || tension > 0 || (stroke.params.audioToWiggle && globalBass > 0.1);

        let fx = (p.baseX - p.x) * elasticity + rGravX * mass;
        let fy = (p.baseY - p.y) * elasticity + rGravY * mass;

        fx += swarmF.vx * mass; 

        if (isWiggling) {
            const phase = (j * stroke.params.wiggleFrequency) + (timeRef.current * stroke.params.waveSpeed) + stroke.phaseOffset;
            let noiseX = Math.sin(phase) * wiggleAmp;
            let noiseY = Math.cos(phase + 2.3) * wiggleAmp;
            if (tension > 0) { noiseX += (Math.random() - 0.5) * tension; noiseY += (Math.random() - 0.5) * tension; }
            if (stroke.params.audioToWiggle) { const boost = 1 + globalBass * stroke.params.audioSensitivity * 5; noiseX *= boost; noiseY *= boost; }
            fx += noiseX * 0.1; fy += noiseY * 0.1;
        }

        p.vx += fx * invMass + swarmF.vx; 
        p.vy += fy * invMass + swarmF.vy;

        if (hasPointer && globalForceTool === 'none' && (mouseRep > 0 || mouseAttr > 0) && pDist < influenceRadius) {
             const dist = pDist; const dx = pointerX - p.x; const dy = pointerY - p.y;
             const force = Math.pow(1 - (dist / influenceRadius), stroke.params.mouseFalloff || 1);
             if (mouseRep > 0) { p.vx -= (dx / dist) * force * mouseRep; p.vy -= (dy / dist) * force * mouseRep; }
             if (mouseAttr > 0) { p.vx += (dx / dist) * force * mouseAttr; p.vy += (dy / dist) * force * mouseAttr; }
        }

        p.vx *= frictionFactor; p.vy *= frictionFactor;
        p.x += p.vx; p.y += p.vy;

        // NEW: Max Displacement Limiter
        if (stroke.params.maxDisplacement > 0) {
            const distFromAnchor = Math.hypot(p.x - p.baseX, p.y - p.baseY);
            if (distFromAnchor > stroke.params.maxDisplacement) {
                const angle = Math.atan2(p.y - p.baseY, p.x - p.baseX);
                p.x = p.baseX + Math.cos(angle) * stroke.params.maxDisplacement;
                p.y = p.baseY + Math.sin(angle) * stroke.params.maxDisplacement;
                // Zero out velocity components that move away from anchor
                p.vx *= 0.1; p.vy *= 0.1;
            }
        }
      }
    }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!gridConfig.visible || !gridConfig.enabled) return;
    const cx = width / 2; const cy = height / 2; const size = Math.max(10, gridConfig.size);
    ctx.save(); ctx.fillStyle = gridConfig.color; ctx.globalAlpha = gridConfig.opacity;
    const countX = Math.ceil(cx / size); const countY = Math.ceil(cy / size);
    for (let x = -countX; x <= countX; x++) {
        for (let y = -countY; y <= countY; y++) {
            const px = cx + x * size; const py = cy + y * size;
            if (px >= 0 && px <= width && py >= 0 && py <= height) { ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill(); }
        }
    }
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  const drawSmoothPath = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
     ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
     for (let i = 1; i < pts.length - 1; i++) {
        const p0 = pts[i]; const p1 = pts[i + 1];
        ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
     }
     const last = pts[pts.length - 1]; ctx.lineTo(last.x, last.y);
  };

  const drawRoundedPolyline = (ctx: CanvasRenderingContext2D, pts: Point[], rounding: number) => {
     ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
     for (let i = 1; i < pts.length - 1; i++) {
        const pPrev = pts[i-1]; const pCurr = pts[i]; const pNext = pts[i+1];
        const v1x = pCurr.x - pPrev.x; const v1y = pCurr.y - pPrev.y;
        const v2x = pNext.x - pCurr.x; const v2y = pNext.y - pCurr.y;
        const len1 = Math.hypot(v1x, v1y); const len2 = Math.hypot(v2x, v2y);
        const maxR = Math.min(len1, len2) / 2;
        const r = maxR * Math.min(1, Math.max(0, rounding));
        if (r < 1) { ctx.lineTo(pCurr.x, pCurr.y); } else {
            const aX = pCurr.x - (v1x / len1) * r; const aY = pCurr.y - (v1y / len1) * r;
            const bX = pCurr.x + (v2x / len2) * r; const bY = pCurr.y + (v2y / len2) * r;
            ctx.lineTo(aX, aY); ctx.quadraticCurveTo(pCurr.x, pCurr.y, bX, bY);
        }
     }
     const last = pts[pts.length - 1]; ctx.lineTo(last.x, last.y);
  };

  const render = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);
    
    if (connectionsRef.current.length > 0 && globalToolConfig.connectionsVisible) {
        ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
        for (const conn of connectionsRef.current) {
            const p1 = findPoint(conn.from); const p2 = findPoint(conn.to);
            if (p1 && p2) {
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.arc(p1.x, p1.y, 2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(p2.x, p2.y, 2, 0, Math.PI*2); ctx.fill();
            }
        }
        ctx.restore();
    }

    if (globalForceTool === 'connect' && pointerRef.current.isDown && pointerRef.current.connectionStart) {
        const startP = findPoint(pointerRef.current.connectionStart);
        if (startP) {
            ctx.save(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(startP.x, startP.y); ctx.lineTo(pointerRef.current.x, pointerRef.current.y); ctx.stroke();
            ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(startP.x, startP.y, 4, 0, Math.PI*2); ctx.fill(); ctx.restore();
        }
    }

    const audio = isMicEnabled ? audioManager.getGlobalAudioData() : { average: 0, low: 0, high: 0 };
    const bass = audio.low / 255;
    const pointerX = pointerRef.current.x;
    const pointerY = pointerRef.current.y;
    const hasPointer = pointerX > -100;

    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue;
      
      const isSelected = stroke.id === selectedStrokeId;
      const centerDist = hasPointer ? Math.hypot(pointerX - stroke.center.x, pointerY - stroke.center.y) : 10000;
      const influenceRadius = stroke.params.mouseInfluenceRadius || 150;
      const avgPressure = stroke.points.reduce((a,b) => a+b.pressure, 0) / stroke.points.length;

      let opacity = resolveParam(stroke.params.opacity, 'opacity', stroke, avgPressure, centerDist, centerDist, influenceRadius, 0.5, 0);
      let glow = resolveParam(stroke.params.glowStrength, 'glowStrength', stroke, avgPressure, centerDist, centerDist, influenceRadius, 0.5, 0);
      const blur = resolveParam(stroke.params.blurStrength, 'blurStrength', stroke, avgPressure, centerDist, centerDist, influenceRadius, 0.5, 0);
      const pathRounding = resolveParam(stroke.params.pathRounding, 'pathRounding', stroke, avgPressure, centerDist, centerDist, influenceRadius, 0.5, 0);
      const hueShift = resolveParam(stroke.params.hueShift || 0, 'hueShift', stroke, avgPressure, centerDist, centerDist, influenceRadius, 0.5, 0);

      // RESOLVE MODULATED GRADIENT PARAMS
      const strokeAngle = resolveParam(stroke.params.strokeGradientAngle, 'strokeGradientAngle', stroke, avgPressure, centerDist, centerDist, influenceRadius, 0.5, 0);
      const strokeMidpoint = resolveParam(stroke.params.strokeGradientMidpoint ?? 0.5, 'strokeGradientMidpoint', stroke, avgPressure, centerDist, centerDist, influenceRadius, 0.5, 0);
      const fillAngle = resolveParam(stroke.params.fillGradientAngle || 0, 'fillGradientAngle', stroke, avgPressure, centerDist, centerDist, influenceRadius, 0.5, 0);

      const isPathModulated = Object.values(stroke.params.modulations || {}).some((m: any) => m && m.scope === 'point' && m.source !== 'none');

      opacity = Math.max(0, Math.min(1, opacity));
      const strokeColor = getShiftedColor(stroke.params.color, hueShift);

      ctx.save();
      
      if (isSelected) { ctx.shadowBlur = 20; ctx.shadowColor = '#ffffff'; } 
      else if (glow > 0) { ctx.shadowBlur = glow; ctx.shadowColor = strokeColor; } 
      else { ctx.shadowBlur = 0; }

      // FILL
      if (stroke.params.fill && stroke.params.fill.enabled && stroke.points.length > 2) {
          ctx.save();
          if (!stroke.params.fill.glow) ctx.shadowBlur = 0; 
          
          if (stroke.params.fill.blur && stroke.params.fill.blur > 0) ctx.filter = `blur(${stroke.params.fill.blur}px)`;
          else ctx.filter = 'none';
          
          ctx.globalCompositeOperation = stroke.params.fill.blendMode || 'source-over';
          
          const useGradient = stroke.params.fill.syncWithStroke ? stroke.params.gradient.enabled : (stroke.params.fill.type === 'gradient');
          const gradientConfig = stroke.params.fill.syncWithStroke ? stroke.params.gradient : stroke.params.fill.gradient;
          const gradientAngle = stroke.params.fill.syncWithStroke ? strokeAngle : fillAngle;
          
          const rawFillColor = stroke.params.fill.syncWithStroke ? stroke.params.color : (stroke.params.fill.colorSource === 'custom' ? stroke.params.fill.customColor : stroke.params.color);
          const finalFillColor = getShiftedColor(rawFillColor, hueShift);

          let fillStyle: string | CanvasGradient = finalFillColor;

          if (useGradient && gradientConfig) {
             const bounds = getStrokeBounds(stroke);
             const rad = (gradientAngle * Math.PI) / 180;
             const halfW = bounds.width / 2; const halfH = bounds.height / 2;
             const dist = Math.abs(halfW * Math.cos(rad)) + Math.abs(halfH * Math.sin(rad));
             const x0 = bounds.cx - Math.cos(rad) * dist; const y0 = bounds.cy - Math.sin(rad) * dist;
             const x1 = bounds.cx + Math.cos(rad) * dist; const y1 = bounds.cy + Math.sin(rad) * dist;
             const g = ctx.createLinearGradient(x0, y0, x1, y1);
             
             gradientConfig.colors.forEach((c, idx) => {
                const rawT = idx / (gradientConfig.colors.length - 1);
                const warpedT = warpOffset(rawT, strokeMidpoint);
                g.addColorStop(warpedT, getShiftedColor(c, hueShift));
             });
             fillStyle = g;
          }
          
          ctx.fillStyle = fillStyle;
          ctx.globalAlpha = stroke.params.fill.opacity; 

          if (stroke.params.seamlessPath) drawSmoothPath(ctx, stroke.points);
          else if (pathRounding > 0) drawRoundedPolyline(ctx, stroke.points, pathRounding);
          else { ctx.beginPath(); ctx.moveTo(stroke.points[0].x, stroke.points[0].y); for(let i=1; i<stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y); }
          
          ctx.closePath();
          ctx.fill(stroke.params.fill.rule || 'nonzero');
          ctx.restore();
      }

      // STROKE
      let baseWidth = stroke.params.strokeWidth;
      if (stroke.params.breathingAmp > 0) baseWidth += Math.sin(timeRef.current * stroke.params.breathingFreq * 10) * stroke.params.breathingAmp;
      if (isMicEnabled && stroke.params.audioToWidth) baseWidth += (bass * stroke.params.audioSensitivity * 20);
      
      const finalWidth = resolveParam(baseWidth, 'strokeWidth', stroke, avgPressure, centerDist, centerDist, influenceRadius, 0.5, 0);

      if (finalWidth > 0.001) {
          ctx.globalCompositeOperation = stroke.params.blendMode;
          if (blur > 0 && !isPathModulated) ctx.filter = `blur(${blur}px)`;
          else ctx.filter = 'none';

          // NEW: PATH-FOLLOWING GRADIENT LOGIC (Non-modulated path)
          if (stroke.params.seamlessPath && !isPathModulated) {
             if (!isPathModulated) ctx.globalAlpha = opacity;
             ctx.lineWidth = finalWidth;
             ctx.lineCap = (stroke.params.lineCap as CanvasLineCap) || 'round'; 
             
             if (stroke.params.gradient.enabled && stroke.params.strokeGradientType === 'linear') {
                 const bounds = getStrokeBounds(stroke);
                 const rad = (strokeAngle * Math.PI) / 180;
                 const halfW = bounds.width / 2; const halfH = bounds.height / 2;
                 const dist = Math.abs(halfW * Math.cos(rad)) + Math.abs(halfH * Math.sin(rad));
                 const g = ctx.createLinearGradient(bounds.cx - Math.cos(rad)*dist, bounds.cy - Math.sin(rad)*dist, bounds.cx + Math.cos(rad)*dist, bounds.cy + Math.sin(rad)*dist);
                 
                 stroke.params.gradient.colors.forEach((c, idx) => {
                    const rawT = idx / (stroke.params.gradient.colors.length - 1);
                    const warpedT = warpOffset(rawT, strokeMidpoint);
                    g.addColorStop(warpedT, getShiftedColor(c, hueShift));
                 });
                 ctx.strokeStyle = g;
                 drawSmoothPath(ctx, stroke.points);
                 ctx.stroke();
             } else if (stroke.params.gradient.enabled && stroke.params.strokeGradientType === 'path') {
                 // Path following gradient requires segmentation even if seamless
                 for (let i = 0; i < stroke.points.length - 1; i++) {
                    const p1 = stroke.points[i]; const p2 = stroke.points[i+1];
                    const t1 = i / (stroke.points.length - 1);
                    const t2 = (i+1) / (stroke.points.length - 1);
                    const wt1 = warpOffset(t1, strokeMidpoint);
                    const wt2 = warpOffset(t2, strokeMidpoint);
                    const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                    grad.addColorStop(0, interpolateColors(stroke.params.gradient.colors.map(c => getShiftedColor(c, hueShift)), wt1));
                    grad.addColorStop(1, interpolateColors(stroke.params.gradient.colors.map(c => getShiftedColor(c, hueShift)), wt2));
                    ctx.strokeStyle = grad;
                    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                 }
             } else {
                 ctx.strokeStyle = strokeColor;
                 drawSmoothPath(ctx, stroke.points);
                 ctx.stroke();
             }
          } else {
            // MODULATED OR SEGMENTED MODE
            for (let i = 0; i < stroke.points.length - 1; i++) {
                const p1 = stroke.points[i];
                const p2 = stroke.points[i+1];
                const prog1 = i / (stroke.points.length - 1);
                const prog2 = (i + 1) / (stroke.points.length - 1);
                const p1Dist = hasPointer ? Math.hypot(pointerX - p1.x, pointerY - p1.y) : 10000;
                const p2Dist = hasPointer ? Math.hypot(pointerX - p2.x, pointerY - p2.y) : 10000;

                const op1 = isPathModulated ? resolveParam(stroke.params.opacity, 'opacity', stroke, avgPressure, p1Dist, centerDist, influenceRadius, prog1, i) : opacity;
                const w1 = resolveParam(baseWidth, 'strokeWidth', stroke, p1.pressure, p1Dist, centerDist, influenceRadius, prog1, i);
                const shift1 = resolveParam(stroke.params.hueShift || 0, 'hueShift', stroke, p1.pressure, p1Dist, centerDist, influenceRadius, prog1, i);
                const blur1 = resolveParam(stroke.params.blurStrength, 'blurStrength', stroke, avgPressure, p1Dist, centerDist, influenceRadius, prog1, i);
                const blur2 = resolveParam(stroke.params.blurStrength, 'blurStrength', stroke, avgPressure, p2Dist, centerDist, influenceRadius, prog2, i+1);

                if (w1 > 0.001) {
                    ctx.beginPath();
                    ctx.globalAlpha = op1;
                    ctx.lineWidth = w1;
                    
                    // Color decision for modulated mode
                    if (stroke.params.gradient.enabled && stroke.params.strokeGradientType === 'path') {
                        const wt1 = warpOffset(prog1, strokeMidpoint);
                        ctx.strokeStyle = interpolateColors(stroke.params.gradient.colors.map(c => getShiftedColor(c, shift1)), wt1);
                    } else {
                        ctx.strokeStyle = getShiftedColor(stroke.params.color, shift1);
                    }

                    ctx.lineCap = (stroke.params.lineCap as CanvasLineCap) || 'round'; 

                    if (isPathModulated && (blur1 > 0 || blur2 > 0)) {
                        ctx.filter = `blur(${(blur1+blur2)/2}px)`;
                    } else if (isPathModulated) {
                        ctx.filter = 'none';
                    }

                    if (pathRounding > 0) {
                        const mid1 = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
                        if (i === 0) { ctx.moveTo(p1.x, p1.y); ctx.lineTo(mid1.x, mid1.y); }
                        else {
                            const p0 = stroke.points[i-1];
                            const mid0 = { x: (p0.x + p1.x)/2, y: (p0.y + p1.y)/2 };
                            ctx.moveTo(mid0.x, mid0.y);
                            ctx.quadraticCurveTo(p1.x, p1.y, mid1.x, mid1.y);
                        }
                        if (i === stroke.points.length - 2) ctx.lineTo(p2.x, p2.y);
                    } else {
                        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
                    }
                    ctx.stroke();
                }
            }
          }
      }

      if (stroke.params.drawPoints && stroke.points.length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = stroke.params.blendMode;
          for (let i = 0; i < stroke.points.length; i++) {
              const p = stroke.points[i];
              const prog = i / (stroke.points.length - 1);
              const pDist = hasPointer ? Math.hypot(pointerX - p.x, pointerY - p.y) : 10000;
              const w = resolveParam(baseWidth, 'strokeWidth', stroke, p.pressure, pDist, centerDist, influenceRadius, prog, i);
              const shift = resolveParam(stroke.params.hueShift || 0, 'hueShift', stroke, p.pressure, pDist, centerDist, influenceRadius, prog, i);
              const op = resolveParam(stroke.params.opacity, 'opacity', stroke, avgPressure, pDist, centerDist, influenceRadius, prog, i);
              
              if (w > 0.1) {
                  ctx.globalAlpha = op;
                  if (stroke.params.gradient.enabled && stroke.params.strokeGradientType === 'path') {
                      const wt = warpOffset(prog, strokeMidpoint);
                      ctx.fillStyle = interpolateColors(stroke.params.gradient.colors.map(c => getShiftedColor(c, shift)), wt);
                  } else {
                      ctx.fillStyle = getShiftedColor(stroke.params.color, shift);
                  }
                  ctx.beginPath(); ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2); ctx.fill();
              }
          }
          ctx.restore();
      }
      ctx.restore();
    }
  };

  const loop = (timestamp: number) => {
    if (ecoMode) {
        const elapsed = timestamp - lastFrameTimeRef.current;
        if (elapsed < 33) { reqRef.current = requestAnimationFrame(loop); return; }
        lastFrameTimeRef.current = timestamp - (elapsed % 33);
    }
    updatePhysics();
    render();
    reqRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    reqRef.current = requestAnimationFrame(loop);
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [isPlaying, isMicEnabled, isSoundEngineEnabled, selectedStrokeId, interactionMode, globalForceTool, ecoMode, gridConfig, symmetryConfig, globalToolConfig]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 touch-none bg-transparent">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`w-full h-full touch-none ${interactionMode === 'draw' && globalForceTool === 'none' ? 'cursor-crosshair' : 'cursor-default'}`}
      />
    </div>
  );
});

Canvas.displayName = "Canvas";
