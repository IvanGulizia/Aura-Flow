
import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Stroke, SimulationParams, ModulationConfig, SoundConfig, GlobalForceType, GlobalToolConfig, EasingMode, GridConfig, SymmetryConfig, Point, Connection, PointReference, ProjectData } from '../types';
import { audioManager } from '../services/audioService';
import { getShiftedColor, interpolateColors, hexToRgba } from '../utils/colorUtils';
import { cubicBezier, warpOffset, getPseudoRandom, applyEasing, distanceToLineSegment } from '../utils/mathUtils';
import { DEFAULT_PARAMS } from '../constants/defaults';

interface CanvasProps {
  brushParams: SimulationParams;
  brushSound: SoundConfig;
  gridConfig: GridConfig;       
  symmetryConfig: SymmetryConfig; 
  selectedStrokeId: string | null;
  selectedStrokeIds: Set<string>;
  selectedConnectionIds: Set<string>;
  isPlaying: boolean;
  isSoundEngineEnabled: boolean; 
  isMicEnabled: boolean; 
  interactionMode: 'draw' | 'select';
  selectionFilter: 'all' | 'links';
  globalForceTool: GlobalForceType;
  globalToolConfig: GlobalToolConfig;
  ecoMode: boolean;
  clearTrigger: number;
  deleteSelectedTrigger: number;
  undoTrigger: number;
  redoTrigger: number;
  resetPosTrigger: number;
  deleteAllLinksTrigger: number;
  onStrokeSelect: (strokeIds: string[] | string | null, params: SimulationParams | null, sound: SoundConfig | null, connectionIds: string[] | string | null, connectionParams: Connection | null) => void;
  onCanvasInteraction?: () => void;
  embedFit?: 'cover' | 'contain' | null;
}

export interface CanvasHandle {
  exportData: () => ProjectData;
  importData: (data: ProjectData | Stroke[]) => void;
  updateSelectedParams: (updates: Partial<SimulationParams> | { key: string, value: any, modulation?: boolean }) => void;
  syncSelectedParams: (sourceParams: SimulationParams) => void;
  updateSelectedConnectionParams: (updates: Partial<Connection>) => void;
  triggerRedraw: () => void;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ 
  brushParams,
  brushSound,
  gridConfig,
  symmetryConfig,
  selectedStrokeId,
  selectedStrokeIds,
  selectedConnectionIds,
  isPlaying, 
  isSoundEngineEnabled, 
  isMicEnabled,
  interactionMode,
  selectionFilter,
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
  onCanvasInteraction,
  embedFit
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const strokesRef = useRef<Stroke[]>([]);
  const connectionsRef = useRef<Connection[]>([]); 
  const activeStrokesRef = useRef<Stroke[]>([]); 

  const timeRef = useRef<number>(0);
  const reqRef = useRef<number | null>(null);
  const needsRedrawRef = useRef<boolean>(true); // Force redraw flag
  
  const pointerRef = useRef({ 
      x: -1000, y: -1000, 
      isDown: false, 
      startX: 0, startY: 0, 
      lastX: 0, lastY: 0, 
      hasMoved: false,
      connectionStart: null as PointReference | null
  });

  const selectionBoxRef = useRef({
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
  });
  
  const historyRef = useRef<{strokes: Stroke[], connections: Connection[]}[]>([]);
  const redoStackRef = useRef<{strokes: Stroke[], connections: Connection[]}[]>([]);
  const preDrawSnapshotRef = useRef<{strokes: Stroke[], connections: Connection[]} | null>(null);

  // Capture selection index snapshot on selection change
  useEffect(() => {
    if (selectedStrokeIds.size > 0) {
        let i = 0;
        const total = selectedStrokeIds.size;
        selectedStrokeIds.forEach(id => {
            const s = strokesRef.current.find(st => st.id === id);
            if (s) {
                s.selectionIndex = i;
                s.selectionTotal = total;
            }
            i++;
        });
    }
    needsRedrawRef.current = true;
  }, [selectedStrokeIds]);

  useEffect(() => {
      needsRedrawRef.current = true;
  }, [gridConfig, symmetryConfig, globalToolConfig, globalForceTool, brushParams, selectedConnectionIds, selectionFilter, embedFit]);

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
      onStrokeSelect(null, null, null, null, null);
      needsRedrawRef.current = true;
    },
    updateSelectedParams: (update) => {
        if (selectedStrokeIds.size === 0) return;
        
        strokesRef.current.forEach(s => {
            if (selectedStrokeIds.has(s.id)) {
                if ('key' in update) {
                     if (update.modulation) {
                         if (!s.params.modulations) s.params.modulations = {};
                         // @ts-ignore
                         if (update.value === undefined) delete s.params.modulations[update.key];
                         // @ts-ignore
                         else s.params.modulations[update.key] = update.value;
                     } else {
                         // @ts-ignore
                         s.params[update.key] = update.value;
                     }
                } else {
                    Object.assign(s.params, update);
                }
            }
        });
        needsRedrawRef.current = true;
    },
    syncSelectedParams: (sourceParams: SimulationParams) => {
         if (selectedStrokeIds.size === 0) return;
         const cloned = JSON.parse(JSON.stringify(sourceParams));
         strokesRef.current.forEach(s => {
             if (selectedStrokeIds.has(s.id)) {
                 s.params = JSON.parse(JSON.stringify(cloned));
             }
         });
         needsRedrawRef.current = true;
    },
    updateSelectedConnectionParams: (updates: Partial<Connection>) => {
        if (selectedConnectionIds.size === 0) return;
        let modified = false;
        connectionsRef.current.forEach(c => {
            if (selectedConnectionIds.has(c.id)) {
                Object.assign(c, updates);
                modified = true;
            }
        });
        if (modified) {
            needsRedrawRef.current = true;
            draw(); 
        }
    },
    triggerRedraw: () => {
        needsRedrawRef.current = true;
    }
  }), [selectedStrokeIds, selectedConnectionIds]);

  const cloneStrokes = (strokes: Stroke[]): Stroke[] => {
    try { return JSON.parse(JSON.stringify(strokes)); } catch (e) { return []; }
  };
  
  const hydrateStrokes = (data: Stroke[]): Stroke[] => {
      return cloneStrokes(data).map(s => ({
            ...s,
            originCenter: s.originCenter || { ...s.center },
            params: { 
                ...DEFAULT_PARAMS,
                ...s.params, 
                fill: { ...DEFAULT_PARAMS.fill, ...(s.params.fill || {}) },
                gradient: { ...DEFAULT_PARAMS.gradient, ...(s.params.gradient || {}) },
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
        needsRedrawRef.current = true;
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
      onStrokeSelect(null, null, null, null, null);
      audioManager.stopAll();
      needsRedrawRef.current = true;
    }
  }, [clearTrigger]);

  useEffect(() => {
    if (deleteSelectedTrigger > 0 && (selectedStrokeIds.size > 0 || selectedConnectionIds.size > 0)) {
      saveToHistory();
      strokesRef.current = strokesRef.current.filter(s => !selectedStrokeIds.has(s.id));
      connectionsRef.current = connectionsRef.current.filter(c => !selectedConnectionIds.has(c.id));
      connectionsRef.current = connectionsRef.current.filter(c => !selectedStrokeIds.has(c.from.strokeId) && !selectedStrokeIds.has(c.to.strokeId));
      onStrokeSelect(null, null, null, null, null);
      needsRedrawRef.current = true;
    }
  }, [deleteSelectedTrigger]);

  useEffect(() => {
    if (deleteAllLinksTrigger > 0) {
        saveToHistory();
        connectionsRef.current = [];
        needsRedrawRef.current = true;
    }
  }, [deleteAllLinksTrigger]);

  useEffect(() => {
    if (resetPosTrigger > 0) {
      strokesRef.current.forEach(s => {
        s.velocity = { x: 0, y: 0 };
        s.points.forEach(p => { p.x = p.baseX; p.y = p.baseY; p.vx = 0; p.vy = 0; });
      });
      needsRedrawRef.current = true;
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
        const existingStrokeIds = new Set(strokesRef.current.map(s => s.id));
        const newStrokeSelection = new Set([...selectedStrokeIds].filter(id => existingStrokeIds.has(id)));
        const existingConnIds = new Set(connectionsRef.current.map(c => c.id));
        const newConnSelection = new Set([...selectedConnectionIds].filter(id => existingConnIds.has(id)));
        
        const strokeList = Array.from(newStrokeSelection);
        const connList = Array.from(newConnSelection);
        onStrokeSelect(strokeList.length ? strokeList : null, null, null, connList.length ? connList : null, null);
        needsRedrawRef.current = true;
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
        needsRedrawRef.current = true;
      }
    }
  }, [redoTrigger]);

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

  const getGlobalBounds = () => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const allStrokes = [...strokesRef.current, ...activeStrokesRef.current];
      
      if (allStrokes.length === 0) return null;

      for (const stroke of allStrokes) {
          for (const p of stroke.points) {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
          }
      }
      
      if (!isFinite(minX)) return null;
      
      const padding = 20;
      minX -= padding;
      maxX += padding;
      minY -= padding;
      maxY += padding;

      return { 
          minX, maxX, minY, maxY, 
          width: maxX - minX, 
          height: maxY - minY, 
          cx: (minX + maxX) / 2, 
          cy: (minY + maxY) / 2 
      };
  };

  // --- VIEWPORT TRANSFORM LOGIC ---
  const getFitTransform = () => {
      if (!embedFit || !canvasRef.current) return { scale: 1, x: 0, y: 0 };
      
      const bounds = getGlobalBounds();
      if (!bounds) return { scale: 1, x: 0, y: 0 };

      const canvasW = canvasRef.current.width;
      const canvasH = canvasRef.current.height;
      const contentW = bounds.width || 1;
      const contentH = bounds.height || 1;
      
      const scaleX = canvasW / contentW;
      const scaleY = canvasH / contentH;
      
      let scale = 1;
      if (embedFit === 'contain') {
          scale = Math.min(scaleX, scaleY);
          // Limit max upscaling to avoid blurry rendering if content is tiny
          if (scale > 5) scale = 5;
      } else if (embedFit === 'cover') {
          scale = Math.max(scaleX, scaleY);
      }
      
      // We want to center the content.
      // Target Center: canvasW/2, canvasH/2
      // Source Center: bounds.cx, bounds.cy
      // Transform logic: 
      // 1. Translate to origin relative to content center: (P - bounds.cx)
      // 2. Scale: (P - bounds.cx) * scale
      // 3. Translate to canvas center: (P - bounds.cx) * scale + (canvasW/2)
      //
      // Effectively: P * scale + (canvasW/2 - bounds.cx * scale)
      // So Translate X = canvasW/2 - bounds.cx * scale
      
      const tx = (canvasW / 2) - (bounds.cx * scale);
      const ty = (canvasH / 2) - (bounds.cy * scale);

      return { scale, x: tx, y: ty };
  };

  const getPointerCoordinates = (e: React.PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;

      if (!embedFit) return { x: rawX, y: rawY };

      const { scale, x: tx, y: ty } = getFitTransform();
      
      // Inverse Transform
      // Screen = World * scale + translate
      // World = (Screen - translate) / scale
      return {
          x: (rawX - tx) / scale,
          y: (rawY - ty) / scale
      };
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

  const getConnectionAtPosition = (x: number, y: number): Connection | null => {
      for (const conn of connectionsRef.current) {
          const s1 = strokesRef.current.find(s => s.id === conn.from.strokeId);
          const s2 = strokesRef.current.find(s => s.id === conn.to.strokeId);
          if (s1 && s2) {
              const p1 = s1.points[conn.from.pointIndex];
              const p2 = s2.points[conn.to.pointIndex];
              if (p1 && p2) {
                  const dist = distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
                  if (dist < 10) return conn;
              }
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

  const strokesIntersectRect = (x: number, y: number, w: number, h: number): Stroke[] => {
      const hits: Stroke[] = [];
      const x1 = Math.min(x, x + w); const x2 = Math.max(x, x + w);
      const y1 = Math.min(y, y + h); const y2 = Math.max(y, y + h);

      for (const s of strokesRef.current) {
          const bounds = getStrokeBounds(s);
          if (bounds.maxX < x1 || bounds.minX > x2 || bounds.maxY < y1 || bounds.minY > y2) continue;
          
          for (const p of s.points) {
              if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) {
                  hits.push(s);
                  break; 
              }
          }
      }
      return hits;
  };

  // --- INPUT HANDLING ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (onCanvasInteraction) onCanvasInteraction();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    // Use mapped coordinates
    const { x: rawX, y: rawY } = getPointerCoordinates(e);
    const { x, y } = snapToGrid(rawX, rawY);

    pointerRef.current = { ...pointerRef.current, isDown: true, x, y, startX: x, startY: y, lastX: x, lastY: y, hasMoved: false };
    needsRedrawRef.current = true;

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
      const hitStroke = selectionFilter === 'all' ? getStrokeAtPosition(rawX, rawY) : null;
      if (hitStroke) {
          if (e.shiftKey) {
             const newSet = new Set(selectedStrokeIds);
             let clickedId = hitStroke.id;
             if (newSet.has(clickedId)) newSet.delete(clickedId); else newSet.add(clickedId);
             
             const arr = Array.from(newSet);
             const primaryStroke = arr.length > 0 ? strokesRef.current.find(s => s.id === arr[arr.length-1]) : null;
             const conns = Array.from(selectedConnectionIds);
             const primaryConn = conns.length > 0 ? connectionsRef.current.find(c => c.id === conns[0]) : null;
             onStrokeSelect(arr, primaryStroke?.params || null, primaryStroke?.sound || null, conns, primaryConn || null);
          } else {
             if (!selectedStrokeIds.has(hitStroke.id)) onStrokeSelect(hitStroke.id, hitStroke.params, hitStroke.sound, null, null);
          }
      } else {
          const hitConn = getConnectionAtPosition(rawX, rawY);
          if (hitConn) {
              if (e.shiftKey) {
                  const newSet = new Set(selectedConnectionIds);
                  if (newSet.has(hitConn.id)) newSet.delete(hitConn.id); else newSet.add(hitConn.id);
                  const primaryConn = newSet.size > 0 ? connectionsRef.current.find(c => c.id === Array.from(newSet).pop()) : null;
                  onStrokeSelect(Array.from(selectedStrokeIds), null, null, Array.from(newSet), primaryConn || null);
              } else {
                  onStrokeSelect(null, null, null, hitConn.id, hitConn);
              }
          } else {
              if (!e.shiftKey) onStrokeSelect(null, null, null, null, null);
              selectionBoxRef.current = { active: true, startX: rawX, startY: rawY, currentX: rawX, currentY: rawY };
          }
      }
      return;
    }

    if (selectedStrokeId) onStrokeSelect(null, null, null, null, null);
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
    // Use mapped coordinates
    const { x: rawX, y: rawY } = getPointerCoordinates(e);
    const { x, y } = (pointerRef.current.isDown && interactionMode === 'draw') ? snapToGrid(rawX, rawY) : { x: rawX, y: rawY };

    pointerRef.current.x = x;
    pointerRef.current.y = y;

    if (selectionBoxRef.current.active) {
        selectionBoxRef.current.currentX = rawX;
        selectionBoxRef.current.currentY = rawY;
        needsRedrawRef.current = true;
        return;
    }

    if (globalForceTool === 'connect' && pointerRef.current.isDown) {
        needsRedrawRef.current = true;
        return;
    }
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
                 needsRedrawRef.current = true;
            }
        });
        pointerRef.current.lastX = x;
        pointerRef.current.lastY = y;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
    pointerRef.current.isDown = false;
    
    // Mapped coordinates required for selection box logic
    const { x: rawX, y: rawY } = getPointerCoordinates(e);

    if (selectionBoxRef.current.active) {
        const sx = selectionBoxRef.current.startX;
        const sy = selectionBoxRef.current.startY;
        // Use current pointer pos which is updated via Move, or calculate here if needed.
        // selectionBoxRef.current.currentX/Y are in World Space already from handlePointerMove.
        const w = selectionBoxRef.current.currentX - sx;
        const h = selectionBoxRef.current.currentY - sy;
        
        if (Math.abs(w) > 5 || Math.abs(h) > 5) {
            const hits = selectionFilter === 'all' ? strokesIntersectRect(sx, sy, w, h) : [];
            if (hits.length > 0) {
                const newIds = hits.map(s => s.id);
                const currentIds = e.shiftKey ? Array.from(selectedStrokeIds) : [];
                const merged = Array.from(new Set([...currentIds, ...newIds]));
                const last = merged[merged.length - 1];
                const primary = strokesRef.current.find(s => s.id === last);
                onStrokeSelect(merged, primary?.params || null, primary?.sound || null, Array.from(selectedConnectionIds), null);
            } else if (!e.shiftKey) {
                onStrokeSelect(null, null, null, null, null);
            }
        } else if (!e.shiftKey) {
             onStrokeSelect(null, null, null, null, null);
        }
        selectionBoxRef.current.active = false;
        draw();
        return;
    }

    if (globalForceTool === 'connect' && pointerRef.current.connectionStart) {
        // Use rawX/rawY from mapped input
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
                needsRedrawRef.current = true;
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
                    s.points.push({ x: first.x, y: first.y, baseX: first.baseX, baseY: first.baseY, vx: 0, vy: 0, pressure: last.pressure });
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
    needsRedrawRef.current = true;
  };

  // --- MODULATION LOGIC ---
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
      case 'random': t = isScopePoint ? getPseudoRandom(stroke.randomSeed + pointIndex * 0.1, key as string) : getPseudoRandom(stroke.randomSeed, key as string); break;
      case 'index': t = (stroke.index % 10) / 10; break;
      case 'selection-index': t = (stroke.selectionTotal ?? 1) > 1 ? (stroke.selectionIndex ?? 0) / ((stroke.selectionTotal ?? 1) - 1) : 0; break;
      case 'time':
      case 'time-pulse':
      case 'time-step':
        const dir = config.invertDirection ? -1 : 1;
        const speedVal = config.speed ?? 1;
        let timeFactor = timeRef.current * speedVal;
        if (config.speedStrategy === 'duration' && speedVal > 0) timeFactor = timeRef.current / speedVal; 
        const phaseOffset = isScopePoint ? (config.speedStrategy === 'duration' ? progress : pointIndex * 0.05) : 0;
        if (source === 'time') {
            t = (timeFactor * dir + phaseOffset) % 1;
            if (t < 0) t += 1;
        } else if (source === 'time-pulse') {
            const duty = config.paramA ?? 0.5;
            const edge = Math.min(0.2, config.paramB ?? 0.1);
            const cycleLen = 1 + (config.paramC ?? 0);
            const rawPulse = (timeFactor * dir + phaseOffset) % cycleLen;
            let normPulse = rawPulse < 0 ? rawPulse + cycleLen : rawPulse;
            if (normPulse > 1) t = 0;
            else if (normPulse < edge) t = normPulse / edge;
            else if (normPulse < duty) t = 1;
            else if (normPulse < duty + edge) t = 1 - (normPulse - duty) / edge;
            else t = 0;
        } else if (source === 'time-step') {
            const steps = 4;
            let rawStep = (timeFactor * dir + phaseOffset) % 1;
            if (rawStep < 0) rawStep += 1;
            t = Math.floor(rawStep * steps) / (steps - 1);
        }
        break;
      case 'velocity': t = isScopePoint ? pointPressure : stroke.points.reduce((acc, p) => acc + p.pressure, 0) / (stroke.points.length || 1); break;
      case 'pressure': t = isScopePoint ? pointPressure : stroke.points.reduce((acc, p) => acc + p.pressure, 0) / (stroke.points.length || 1); break;
      case 'cursor': const dist = isScopePoint ? cursorDistPoint : cursorDistCenter; t = (dist < cursorRadius) ? 1 - (dist / cursorRadius) : 0; break;
      case 'path': t = progress; break;
      case 'path-mirror': t = 1 - Math.abs((progress - 0.5) * 2); break;
      case 'path-mirror-inv': t = Math.abs((progress - 0.5) * 2); break;
      case 'audio-live': t = audioManager.getGlobalAudioData().average / 255; break;
      case 'audio-sample': t = audioManager.getStrokeAmplitude(stroke.id); break;
    }
    
    const inMin = config.inputMin ?? 0;
    const inMax = config.inputMax ?? 1;
    if (inMax > inMin) t = (t - inMin) / (inMax - inMin);
    t = Math.max(0, Math.min(1, t));

    const easedT = applyEasing(t, easing, config);
    return min + (max - min) * easedT;
  };

  const getProjectedPosition = (stroke: Stroke, px: number, py: number): number => {
      let minDistSq = Infinity;
      let closestIdx = 0;
      for(let i=0; i<stroke.points.length; i++) {
          const dSq = (stroke.points[i].x - px)**2 + (stroke.points[i].y - py)**2;
          if (dSq < minDistSq) { minDistSq = dSq; closestIdx = i; }
      }
      return closestIdx / (stroke.points.length - 1 || 1);
  };

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
      stroke.velocity = { x: 0, y: 0 }; // Placeholder for swarm average
      
      const centerDist = hasPointer ? Math.hypot(pointerX - stroke.center.x, pointerY - stroke.center.y) : 10000;
      const influenceRadius = stroke.params.mouseInfluenceRadius || 150;
      const swarmF = swarmForces.get(stroke.id) || { vx: 0, vy: 0 };

      if (isSoundEngineEnabled && stroke.sound.bufferId && stroke.sound.enabled) {
          const ox = stroke.originCenter?.x ?? stroke.center.x; const oy = stroke.originCenter?.y ?? stroke.center.y;
          const dispX = stroke.center.x - ox; const dispY = stroke.center.y - oy;
          audioManager.updateStrokeSound(stroke.id, stroke.sound.bufferId, { ...stroke.sound, reverb: stroke.sound.reverbSend }, {
               cursorDist: centerDist, physicsSpeed: (totalSpeed / len) * 20, displacement: { dist: Math.hypot(dispX, dispY), x: dispX, y: dispY },
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

        if (stroke.params.maxDisplacement > 0) {
            const distFromAnchor = Math.hypot(p.x - p.baseX, p.y - p.baseY);
            if (distFromAnchor > stroke.params.maxDisplacement) {
                const angle = Math.atan2(p.y - p.baseY, p.x - p.baseX);
                p.x = p.baseX + Math.cos(angle) * stroke.params.maxDisplacement;
                p.y = p.baseY + Math.sin(angle) * stroke.params.maxDisplacement;
                // Kill velocity against the wall
                p.vx *= 0.5; p.vy *= 0.5;
            }
        }
      }
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- VIEWPORT TRANSFORMATION FOR EMBED ---
    ctx.save();
    
    // Apply camera transform to context
    const { scale, x, y } = getFitTransform();
    if (scale !== 1 || x !== 0 || y !== 0) {
        ctx.translate(x, y);
        ctx.scale(scale, scale);
    }

    // Helper: Fillet (Rounded Corner) Path for ONE continuous path (Batch)
    const tracePath = (ctx: CanvasRenderingContext2D, points: Point[], rounding: number, closePath: boolean) => {
        if (points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        if (rounding <= 0.01) {
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        } else {
             // Corner cutting algorithm (Fillet)
             for (let i = 1; i < points.length - 1; i++) {
                const p0 = points[i - 1];
                const p1 = points[i];
                const p2 = points[i + 1];

                const v1x = p0.x - p1.x;
                const v1y = p0.y - p1.y;
                const v2x = p2.x - p1.x;
                const v2y = p2.y - p1.y;

                const len1 = Math.hypot(v1x, v1y);
                const len2 = Math.hypot(v2x, v2y);
                
                const maxR = Math.min(len1, len2) * 0.5;
                const r = rounding * maxR;

                if (r < 0.1) {
                     ctx.lineTo(p1.x, p1.y);
                } else {
                     const n1 = r / len1; 
                     const n2 = r / len2;
                     const startX = p1.x + v1x * n1;
                     const startY = p1.y + v1y * n1;
                     const endX = p1.x + v2x * n2;
                     const endY = p1.y + v2y * n2;

                     ctx.lineTo(startX, startY);
                     ctx.quadraticCurveTo(p1.x, p1.y, endX, endY);
                }
             }
             ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        }
        if (closePath) ctx.closePath();
    };

    // Helper: Get Corner Geometry for Segmented Draw
    const getCorner = (p0: Point, p1: Point, p2: Point, rounding: number) => {
        const v1x = p0.x - p1.x; const v1y = p0.y - p1.y;
        const v2x = p2.x - p1.x; const v2y = p2.y - p1.y;
        const len1 = Math.hypot(v1x, v1y); const len2 = Math.hypot(v2x, v2y);
        const maxR = Math.min(len1, len2) * 0.5;
        const r = rounding * maxR;
        if (r < 0.1) return null;
        
        const n1 = r / len1; const n2 = r / len2;
        return {
            start: { x: p1.x + v1x * n1, y: p1.y + v1y * n1 },
            end: { x: p1.x + v2x * n2, y: p1.y + v2y * n2 }
        };
    };

    // GRID
    if (gridConfig.visible && gridConfig.enabled) {
       ctx.fillStyle = hexToRgba(gridConfig.color, gridConfig.opacity);
       const cx = canvas.width / 2;
       const cy = canvas.height / 2;
       const size = Math.max(10, gridConfig.size);
       const cols = Math.ceil(cx / size);
       const rows = Math.ceil(cy / size);

       ctx.beginPath();
       for (let i = -cols; i <= cols; i++) {
           const x = cx + i * size;
           for (let j = -rows; j <= rows; j++) {
               const y = cy + j * size;
               ctx.moveTo(x + 1.5, y); 
               ctx.arc(x, y, 1.5, 0, Math.PI * 2);
           }
       }
       ctx.fill();
    }
    
    if (symmetryConfig.visible && symmetryConfig.enabled) {
        const cx = canvas.width / 2; const cy = canvas.height / 2;
        ctx.strokeStyle = `rgba(0,0,0,0.1)`; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
        ctx.beginPath();
        if (symmetryConfig.type === 'horizontal' || symmetryConfig.type === 'quad') { ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); }
        if (symmetryConfig.type === 'vertical' || symmetryConfig.type === 'quad') { ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); }
        if (symmetryConfig.type === 'radial') {
            const count = Math.max(2, symmetryConfig.count);
            for (let i = 0; i < count; i++) {
                const theta = (Math.PI * 2 / count) * i;
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(theta) * 2000, cy + Math.sin(theta) * 2000);
            }
        }
        ctx.stroke(); ctx.setLineDash([]);
    }

    if (globalToolConfig.connectionsVisible) {
        ctx.lineWidth = 1;
        for (const conn of connectionsRef.current) {
            const s1 = strokesRef.current.find(s => s.id === conn.from.strokeId);
            const s2 = strokesRef.current.find(s => s.id === conn.to.strokeId);
            const isConnSelected = selectedConnectionIds.has(conn.id);

            if (s1 && s2) {
                const p1 = s1.points[conn.from.pointIndex];
                const p2 = s2.points[conn.to.pointIndex];
                if (p1 && p2) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    
                    if (isConnSelected) {
                        ctx.strokeStyle = `rgba(99, 102, 241, 0.8)`;
                        ctx.lineWidth = 2;
                        ctx.shadowColor = `rgba(99, 102, 241, 0.5)`;
                        ctx.shadowBlur = 8;
                    } else {
                        ctx.strokeStyle = `rgba(100, 100, 100, 0.3)`;
                        ctx.lineWidth = 1;
                        ctx.shadowBlur = 0;
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }
        }
    }
    
    if (pointerRef.current.connectionStart && pointerRef.current.isDown) {
        const p1 = findPoint(pointerRef.current.connectionStart);
        if (p1) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(pointerRef.current.x, pointerRef.current.y);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.setLineDash([5,5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    
    if (selectionBoxRef.current.active) {
        const sx = selectionBoxRef.current.startX;
        const sy = selectionBoxRef.current.startY;
        const w = selectionBoxRef.current.currentX - sx;
        const h = selectionBoxRef.current.currentY - sy;
        
        ctx.save();
        ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
        ctx.strokeStyle = 'rgba(79, 70, 229, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.fillRect(sx, sy, w, h);
        ctx.strokeRect(sx, sy, w, h);
        ctx.restore();
    }

    const strokesToDraw = [...strokesRef.current, ...activeStrokesRef.current];

    if (!isPlaying) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
        
        strokesToDraw.forEach(stroke => {
            if (!selectedStrokeIds.has(stroke.id) || stroke.points.length < 2) return;
            const { points, params } = stroke;
            
            tracePath(ctx, points, params.pathRounding, params.closePath);

            ctx.strokeStyle = 'rgba(79, 70, 229, 0.5)';
            ctx.lineWidth = params.strokeWidth + 6;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(79, 70, 229, 0.8)';
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
    }

    strokesToDraw.forEach(stroke => {
      if (stroke.points.length < 2) return;
      const { params, points, center } = stroke;
      
      const centerDist = Math.hypot(pointerRef.current.x - center.x, pointerRef.current.y - center.y);
      const influenceRadius = params.mouseInfluenceRadius || 150;

      // FILL (Always Continuous Path to avoid artifacts)
      if (params.fill.enabled) {
          tracePath(ctx, points, params.pathRounding, params.closePath);

          ctx.globalCompositeOperation = params.fill.blendMode || 'source-over';
          ctx.globalAlpha = params.fill.opacity;

          if (params.fill.glow) {
              ctx.shadowBlur = 20;
              ctx.shadowColor = params.fill.colorSource === 'custom' ? params.fill.customColor : params.color;
          } else {
              ctx.shadowBlur = 0;
          }

          if (params.fill.type === 'gradient' || (params.fill.syncWithStroke && params.gradient.enabled)) {
               const bounds = getStrokeBounds(stroke);
               const angleRad = (params.fillGradientAngle || 0) * Math.PI / 180;
               const r = Math.sqrt(bounds.width**2 + bounds.height**2) / 2;
               const gx1 = bounds.cx - Math.cos(angleRad) * r;
               const gy1 = bounds.cy - Math.sin(angleRad) * r;
               const gx2 = bounds.cx + Math.cos(angleRad) * r;
               const gy2 = bounds.cy + Math.sin(angleRad) * r;
               
               const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
               const colors = (params.fill.syncWithStroke && params.gradient.enabled) ? params.gradient.colors : params.fill.gradient.colors;
               colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
               ctx.fillStyle = grad;
          } else {
               ctx.fillStyle = params.fill.colorSource === 'custom' ? params.fill.customColor : params.color;
          }
          
          if (params.fill.blur > 0) ctx.filter = `blur(${params.fill.blur}px)`;
          ctx.fill(params.fill.rule);
          ctx.filter = 'none';
          ctx.shadowBlur = 0;
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
      }

      // STROKE
      if (params.opacity > 0 && params.strokeWidth > 0) {
        ctx.lineCap = params.lineCap || 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = params.blendMode;

        if (params.blurStrength > 0 && !params.smoothModulation && params.strokeGradientType === 'linear' && !params.modulations?.strokeWidth) {
            ctx.filter = `blur(${params.blurStrength}px)`;
        } else {
            ctx.filter = 'none';
        }

        const canBatchDraw = !params.smoothModulation && params.strokeGradientType === 'linear' && !params.modulations?.strokeWidth && !params.modulations?.opacity && !params.modulations?.hueShift; 

        if (canBatchDraw) {
            // BATCH DRAW (Optimized, Single Path)
            const bounds = getStrokeBounds(stroke);
            const angleRad = (params.strokeGradientAngle || 0) * Math.PI / 180;
            const r = Math.sqrt(bounds.width**2 + bounds.height**2) / 2;
            const gx1 = bounds.cx - Math.cos(angleRad) * r;
            const gy1 = bounds.cy - Math.sin(angleRad) * r;
            const gx2 = bounds.cx + Math.cos(angleRad) * r;
            const gy2 = bounds.cy + Math.sin(angleRad) * r;

            let strokeStyle: string | CanvasGradient = params.color;
            
            // APPLY GLOBAL HUE SHIFT FOR BATCH DRAW
            if (params.hueShift !== 0 || (params.audioToColor && isMicEnabled)) {
                 let shift = params.hueShift;
                 if (params.audioToColor && isMicEnabled) shift += (audioManager.getGlobalAudioData().mid / 255) * 180;
                 strokeStyle = getShiftedColor(strokeStyle as string, shift);
            }

            if (params.gradient.enabled) {
                const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
                const midpoint = params.strokeGradientMidpoint ?? 0.5;
                params.gradient.colors.forEach((c, i) => {
                    const t = i / (params.gradient.colors.length - 1);
                    const offset = warpOffset(t, midpoint);
                    grad.addColorStop(offset, c);
                });
                strokeStyle = grad;
            }

            tracePath(ctx, points, params.pathRounding, params.closePath);

            if (params.glowStrength > 0) {
                ctx.shadowColor = strokeStyle as string; 
                ctx.shadowBlur = params.glowStrength;
            }

            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = params.strokeWidth;
            ctx.globalAlpha = params.opacity;
            ctx.stroke();
            ctx.shadowBlur = 0;

        } else {
            // SEGMENTED DRAW (Modulated, Point-by-Point)
            
            // Pre-calc corners if needed for smooth segmented joints
            const corners: any[] = [];
            if (params.pathRounding > 0) {
                for (let i = 1; i < points.length - 1; i++) {
                    corners[i] = getCorner(points[i-1], points[i], points[i+1], params.pathRounding);
                }
            }

            let lastX = points[0].x;
            let lastY = points[0].y;

            // Iterate points to draw segments
            // i is the target point of the segment. 
            // Segment i goes from (CornerEnd of i-1) to (CornerEnd of i) roughly.
            for (let i = 1; i < points.length; i++) {
                const p1 = points[i];
                const progress = i / (points.length - 1);
                const pDist = Math.hypot(pointerRef.current.x - p1.x, pointerRef.current.y - p1.y);

                const width = resolveParam(params.strokeWidth, 'strokeWidth', stroke, p1.pressure, pDist, centerDist, influenceRadius, progress, i);
                const opacity = resolveParam(params.opacity, 'opacity', stroke, p1.pressure, pDist, centerDist, influenceRadius, progress, i);
                const blur = resolveParam(params.blurStrength, 'blurStrength', stroke, p1.pressure, pDist, centerDist, influenceRadius, progress, i);

                ctx.lineWidth = width;
                ctx.globalAlpha = opacity;
                
                if (params.glowStrength > 0) { ctx.shadowColor = params.color; ctx.shadowBlur = params.glowStrength; } else { ctx.shadowBlur = 0; }
                if (blur > 0) { ctx.filter = `blur(${blur}px)`; } else { ctx.filter = 'none'; }

                // Determine Color
                if (params.gradient.enabled) {
                    if (params.strokeGradientType === 'path') {
                        const midpoint = params.strokeGradientMidpoint ?? 0.5;
                        const warpedT = warpOffset(progress, midpoint);
                        ctx.strokeStyle = interpolateColors(params.gradient.colors, warpedT);
                    } else {
                         const bounds = getStrokeBounds(stroke);
                         const angleRad = (params.strokeGradientAngle || 0) * Math.PI / 180;
                         const rx = p1.x - bounds.cx; const ry = p1.y - bounds.cy;
                         const proj = rx * Math.cos(angleRad) + ry * Math.sin(angleRad);
                         const r = Math.sqrt(bounds.width**2 + bounds.height**2) / 2;
                         const t = 0.5 + (proj / (r * 2));
                         const midpoint = params.strokeGradientMidpoint ?? 0.5;
                         const warpedT = warpOffset(Math.max(0, Math.min(1, t)), midpoint);
                         ctx.strokeStyle = interpolateColors(params.gradient.colors, warpedT);
                    }
                } else {
                    let c = params.color;
                    if (params.hueShift !== 0 || (params.audioToColor && isMicEnabled)) {
                         let shift = params.hueShift;
                         // Per point modulation overrides global
                         if (params.modulations?.hueShift) {
                             shift = resolveParam(shift, 'hueShift', stroke, p1.pressure, pDist, centerDist, influenceRadius, progress, i);
                         } else if (params.hueShift !== 0) {
                             shift = params.hueShift;
                         }
                         
                         if (params.audioToColor && isMicEnabled) {
                             shift += (audioManager.getGlobalAudioData().mid / 255) * 180;
                         }
                         c = getShiftedColor(c, shift);
                    }
                    ctx.strokeStyle = c;
                }

                // Draw Segment with potential Rounding
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);

                if (params.pathRounding > 0 && i < points.length - 1) {
                    const c = corners[i];
                    if (c) {
                        ctx.lineTo(c.start.x, c.start.y);
                        ctx.quadraticCurveTo(points[i].x, points[i].y, c.end.x, c.end.y);
                        lastX = c.end.x;
                        lastY = c.end.y;
                    } else {
                        // Fallback if corner invalid
                        ctx.lineTo(points[i].x, points[i].y);
                        lastX = points[i].x;
                        lastY = points[i].y;
                    }
                } else {
                    // Last point or no rounding
                    ctx.lineTo(points[i].x, points[i].y);
                    lastX = points[i].x;
                    lastY = points[i].y;
                }
                
                ctx.stroke();
            }
        }
        
        ctx.filter = 'none';
        
        if (params.drawPoints) {
            ctx.fillStyle = selectedStrokeIds.has(stroke.id) ? '#4f46e5' : 'rgba(0,0,0,0.2)';
            const ptSize = Math.max(2, params.strokeWidth / 3);
            for (const p of points) {
                ctx.beginPath(); ctx.arc(p.x, p.y, ptSize, 0, Math.PI * 2); ctx.fill();
            }
        }
      }
      ctx.shadowBlur = 0;
    });

    if (globalForceTool === 'connect' && !pointerRef.current.isDown) {
        const closest = getClosestPoint(pointerRef.current.x, pointerRef.current.y, 40);
        if (closest) {
            const p = findPoint(closest);
            if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.stroke(); }
        }
    }
    
    // RESTORE CONTEXT AFTER EMBED TRANSFORM
    ctx.restore();
  };

  const animate = (time: number) => {
    const needsUpdate = isPlaying || pointerRef.current.isDown || pointerRef.current.hasMoved || selectionBoxRef.current.active || needsRedrawRef.current;
    
    if (ecoMode && !needsUpdate) {
         // Skip frame
    } else {
         updatePhysics();
         draw();
         needsRedrawRef.current = false;
    }
    reqRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    reqRef.current = requestAnimationFrame(animate);
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [isPlaying, ecoMode, interactionMode, globalForceTool, globalToolConfig, gridConfig, symmetryConfig, brushParams, selectedStrokeIds, selectedConnectionIds, selectionFilter, embedFit]); // added embedFit dep

  return (
    <div 
        ref={containerRef} 
        className={`w-full h-full touch-none ${interactionMode === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
});
