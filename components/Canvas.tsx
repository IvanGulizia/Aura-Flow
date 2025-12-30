
import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Stroke, SimulationParams, SoundConfig, GlobalForceType, GlobalToolConfig, GridConfig, SymmetryConfig, Point, Connection, PointReference, ProjectData } from '../types';
import { audioManager } from '../services/audioService';
import { getShiftedColor, interpolateColors, hexToRgba } from '../utils/colorUtils';
import { getPseudoRandom, applyEasing, distanceToLineSegment, warpOffset } from '../utils/mathUtils';
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
  embedZoom?: number; 
}

export interface CanvasHandle {
  exportData: () => ProjectData;
  importData: (data: ProjectData | Stroke[]) => void;
  updateSelectedParams: (updates: Partial<SimulationParams> | { key: string, value: any, modulation?: boolean }) => void;
  syncSelectedParams: (sourceParams: SimulationParams) => void;
  updateSelectedConnectionParams: (updates: Partial<Connection>) => void;
  triggerRedraw: () => void;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>((props, ref) => {
  const { 
    brushParams, brushSound, gridConfig, symmetryConfig, selectedStrokeId, selectedStrokeIds, selectedConnectionIds,
    isPlaying, isSoundEngineEnabled, isMicEnabled, interactionMode, selectionFilter, globalForceTool, globalToolConfig,
    ecoMode, clearTrigger, deleteSelectedTrigger, undoTrigger, redoTrigger, resetPosTrigger, deleteAllLinksTrigger,
    onStrokeSelect, onCanvasInteraction, embedFit, embedZoom = 1
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const strokesRef = useRef<Stroke[]>([]);
  const connectionsRef = useRef<Connection[]>([]); 
  const activeStrokesRef = useRef<Stroke[]>([]); 

  const timeRef = useRef<number>(0);
  const reqRef = useRef<number | null>(null);
  const needsRedrawRef = useRef<boolean>(true); 
  const viewTransformRef = useRef({ scale: 1, x: 0, y: 0 });
  const initialBoundsRef = useRef<{ minX: number, maxX: number, minY: number, maxY: number, width: number, height: number, cx: number, cy: number } | null>(null);

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
      startX: 0, startY: 0, currentX: 0, currentY: 0
  });
  
  const historyRef = useRef<{strokes: Stroke[], connections: Connection[]}[]>([]);
  const redoStackRef = useRef<{strokes: Stroke[], connections: Connection[]}[]>([]);
  const preDrawSnapshotRef = useRef<{strokes: Stroke[], connections: Connection[]} | null>(null);

  const latestProps = useRef(props);
  useEffect(() => {
      latestProps.current = props;
  });

  const getPointerCoordinates = (e: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      if (!latestProps.current.embedFit) return { x: rawX, y: rawY };
      const { scale, x: tx, y: ty } = viewTransformRef.current;
      return { x: (rawX - tx) / scale, y: (rawY - ty) / scale };
  };

  const snapToGrid = (x: number, y: number): { x: number, y: number } => {
    const { gridConfig } = latestProps.current;
    if (!gridConfig.enabled || !gridConfig.snap || !canvasRef.current) return { x, y };
    const cx = canvasRef.current.width / 2;
    const cy = canvasRef.current.height / 2;
    const baseSize = Math.max(10, gridConfig.size);
    const factor = gridConfig.snapFactor || 1;
    const snapSize = factor < 1 ? baseSize * factor : baseSize;
    const snX = Math.round((x - cx) / snapSize) * snapSize;
    const snY = Math.round((y - cy) / snapSize) * snapSize;
    return { x: cx + snX, y: cy + snY };
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

  const strokesIntersectRect = (x: number, y: number, w: number, h: number): Stroke[] => {
      const hits: Stroke[] = [];
      const x1 = Math.min(x, x + w); const x2 = Math.max(x, x + w);
      const y1 = Math.min(y, y + h); const y2 = Math.max(y, y + h);
      for (const s of strokesRef.current) {
          const bounds = getStrokeBounds(s);
          if (bounds.maxX < x1 || bounds.minX > x2 || bounds.maxY < y1 || bounds.minY > y2) continue;
          for (const p of s.points) { if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) { hits.push(s); break; } }
      }
      return hits;
  };

  const cloneStrokes = (strokes: Stroke[]): Stroke[] => { try { return JSON.parse(JSON.stringify(strokes)); } catch (e) { return []; } };

  useEffect(() => {
    const canvas = containerRef.current; 
    if (!canvas) return;
    const handleNativePointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const P = latestProps.current;
        if (P.onCanvasInteraction) P.onCanvasInteraction();
        try { (e.target as Element).setPointerCapture(e.pointerId); } catch(err){}
        const { x: rawX, y: rawY } = getPointerCoordinates(e);
        const { x, y } = snapToGrid(rawX, rawY);
        pointerRef.current = { ...pointerRef.current, isDown: true, x, y, startX: x, startY: y, lastX: x, lastY: y, hasMoved: false };
        needsRedrawRef.current = true;
        if (P.globalForceTool === 'connect') {
            const closest = getClosestPoint(rawX, rawY, 40);
            if (closest) {
                pointerRef.current.connectionStart = closest;
                preDrawSnapshotRef.current = { strokes: cloneStrokes(strokesRef.current), connections: JSON.parse(JSON.stringify(connectionsRef.current)) };
            }
            return;
        }
        if (P.globalForceTool !== 'none') return;
        if (P.interactionMode === 'select') {
            const hitStroke = P.selectionFilter === 'all' ? getStrokeAtPosition(rawX, rawY) : null;
            if (hitStroke) {
                if (e.shiftKey) {
                    const newSet = new Set(P.selectedStrokeIds);
                    if (newSet.has(hitStroke.id)) newSet.delete(hitStroke.id); else newSet.add(hitStroke.id);
                    const arr = Array.from(newSet);
                    const primaryStroke = arr.length > 0 ? strokesRef.current.find(s => s.id === arr[arr.length-1]) : null;
                    const conns = Array.from(P.selectedConnectionIds);
                    const primaryConn = conns.length > 0 ? connectionsRef.current.find(c => c.id === conns[0]) : null;
                    P.onStrokeSelect(arr, primaryStroke?.params || null, primaryStroke?.sound || null, conns, primaryConn || null);
                } else {
                    if (!P.selectedStrokeIds.has(hitStroke.id)) { P.onStrokeSelect(hitStroke.id, hitStroke.params, hitStroke.sound, null, null); }
                }
            } else {
                const hitConn = getConnectionAtPosition(rawX, rawY);
                if (hitConn) {
                    if (e.shiftKey) {
                        const newSet = new Set(P.selectedConnectionIds);
                        if (newSet.has(hitConn.id)) newSet.delete(hitConn.id); else newSet.add(hitConn.id);
                        const primaryConn = newSet.size > 0 ? connectionsRef.current.find(c => c.id === Array.from(newSet).pop()) : null;
                        P.onStrokeSelect(Array.from(P.selectedStrokeIds), null, null, Array.from(newSet), primaryConn || null);
                    } else { P.onStrokeSelect(null, null, null, hitConn.id, hitConn); }
                } else {
                    if (!e.shiftKey) P.onStrokeSelect(null, null, null, null, null);
                    selectionBoxRef.current = { active: true, startX: rawX, startY: rawY, currentX: rawX, currentY: rawY };
                }
            }
            return;
        }
        if (P.selectedStrokeId) P.onStrokeSelect(null, null, null, null, null);
        preDrawSnapshotRef.current = { strokes: cloneStrokes(strokesRef.current), connections: JSON.parse(JSON.stringify(connectionsRef.current)) };
        const symPoints = getSymmetryPoints(x, y);
        const newStrokes: Stroke[] = [];
        const baseId = Date.now().toString();
        const effectiveSeamless = P.gridConfig.enabled ? false : P.brushParams.seamlessPath;
        const initialPressure = e.pressure !== 0.5 && e.pressure > 0 ? e.pressure : 0.5;
        
        symPoints.forEach((p, idx) => {
            const strokeId = `${baseId}-${idx}`;
            const stroke: Stroke = {
                id: strokeId,
                index: strokesRef.current.length + idx,
                points: [{ x: p.x, y: p.y, baseX: p.x, baseY: p.y, vx: 0, vy: 0, pressure: initialPressure }],
                center: { x: p.x, y: p.y },
                originCenter: { x: p.x, y: p.y },
                velocity: { x: 0, y: 0 },
                params: { ...JSON.parse(JSON.stringify(P.brushParams)), seamlessPath: effectiveSeamless }, 
                sound: JSON.parse(JSON.stringify(P.brushSound)),
                createdAt: Date.now(),
                phaseOffset: Math.random() * 100,
                randomSeed: Math.random()
            };
            newStrokes.push(stroke);

            if (stroke.params.autoLinkStart) {
                const radius = resolveParam(stroke.params.autoLinkRadius, 'autoLinkRadius', stroke, 0.5, pointerRef.current.x, pointerRef.current.y, 0.5, 0);
                const closest = getClosestPoint(p.x, p.y, radius, [strokeId]);
                if (closest) {
                    connectionsRef.current.push({
                        id: `auto-conn-${Date.now()}-${idx}`,
                        from: { strokeId: strokeId, pointIndex: 0 },
                        to: closest,
                        stiffness: stroke.params.autoLinkStiffness,
                        length: 0,
                        breakingForce: stroke.params.autoLinkBreakingForce,
                        bias: stroke.params.autoLinkBias,
                        influence: stroke.params.autoLinkInfluence,
                        falloff: stroke.params.autoLinkFalloff,
                        decayEasing: stroke.params.autoLinkDecayEasing
                    });
                }
            }
        });
        activeStrokesRef.current = newStrokes;
        needsRedrawRef.current = true;
    };
    
    const handleNativePointerMove = (e: PointerEvent) => {
        if (!e.cancelable) {} else { e.preventDefault(); }
        const P = latestProps.current;
        const { x: rawX, y: rawY } = getPointerCoordinates(e);
        const { x, y } = (pointerRef.current.isDown && P.interactionMode === 'draw') ? snapToGrid(rawX, rawY) : { x: rawX, y: rawY };
        pointerRef.current.x = x; pointerRef.current.y = y;
        if (selectionBoxRef.current.active) { selectionBoxRef.current.currentX = rawX; selectionBoxRef.current.currentY = rawY; needsRedrawRef.current = true; return; }
        if (P.globalForceTool === 'connect' && pointerRef.current.isDown) { needsRedrawRef.current = true; return; }
        if (P.globalForceTool !== 'none' || P.interactionMode === 'select') return;
        if (pointerRef.current.isDown && activeStrokesRef.current.length > 0) {
            const distSq = (x - pointerRef.current.lastX) ** 2 + (y - pointerRef.current.lastY) ** 2;
            if (distSq > 0.5) pointerRef.current.hasMoved = true;
            const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            if (events.length > 0) {
                for (const ev of events) {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (!rect) continue;
                    let evX = ev.clientX - rect.left; let evY = ev.clientY - rect.top;
                    if (P.embedFit) { const { scale, x: tx, y: ty } = viewTransformRef.current; evX = (evX - tx) / scale; evY = (evY - ty) / scale; }
                    if (P.interactionMode === 'draw' && P.gridConfig.enabled && P.gridConfig.snap) { const snapped = snapToGrid(evX, evY); evX = snapped.x; evY = snapped.y; }
                    let pressure = 0.5;
                    if (ev.pressure !== 0.5 && ev.pressure > 0) pressure = ev.pressure;
                    else { const d = Math.hypot(evX - pointerRef.current.lastX, evY - pointerRef.current.lastY); pressure = Math.min(1, Math.max(0.01, d / 30)); }
                    addPointToActiveStrokes(evX, evY, pressure);
                    pointerRef.current.lastX = evX; pointerRef.current.lastY = evY;
                }
            }
        }
    };
    const handleNativePointerUp = (e: PointerEvent) => {
        const P = latestProps.current;
        try { (e.target as Element).releasePointerCapture(e.pointerId); } catch(err) {}
        pointerRef.current.isDown = false;
        const { x: rawX, y: rawY } = getPointerCoordinates(e);
        if (selectionBoxRef.current.active) {
            const sx = selectionBoxRef.current.startX; const sy = selectionBoxRef.current.startY; const w = selectionBoxRef.current.currentX - sx; const h = selectionBoxRef.current.currentY - sy;
            if (Math.abs(w) > 5 || Math.abs(h) > 5) {
                const hits = P.selectionFilter === 'all' ? strokesIntersectRect(sx, sy, w, h) : [];
                if (hits.length > 0) {
                    const newIds = hits.map(s => s.id);
                    const currentIds = e.shiftKey ? Array.from(P.selectedStrokeIds) : [];
                    const merged = Array.from(new Set([...currentIds, ...newIds]));
                    const last = merged[merged.length - 1];
                    const primary = strokesRef.current.find(s => s.id === last);
                    P.onStrokeSelect(merged, primary?.params || null, primary?.sound || null, Array.from(P.selectedConnectionIds), null);
                } else if (!e.shiftKey) { P.onStrokeSelect(null, null, null, null, null); }
            } else if (!e.shiftKey) { P.onStrokeSelect(null, null, null, null, null); }
            selectionBoxRef.current.active = false; needsRedrawRef.current = true; return;
        }
        if (P.globalForceTool === 'connect' && pointerRef.current.connectionStart) {
            const closest = getClosestPoint(rawX, rawY, 40);
            if (closest && !(closest.strokeId === pointerRef.current.connectionStart.strokeId && closest.pointIndex === pointerRef.current.connectionStart.pointIndex)) {
                connectionsRef.current.push({ 
                    id: `conn-${Date.now()}`, 
                    from: pointerRef.current.connectionStart, 
                    to: closest, 
                    stiffness: P.brushParams.autoLinkStiffness, 
                    length: 0, 
                    breakingForce: P.brushParams.autoLinkBreakingForce, 
                    bias: P.brushParams.autoLinkBias, 
                    influence: P.brushParams.autoLinkInfluence, 
                    falloff: P.brushParams.autoLinkFalloff, 
                    decayEasing: P.brushParams.autoLinkDecayEasing 
                });
                if (preDrawSnapshotRef.current) { historyRef.current.push(preDrawSnapshotRef.current); if (historyRef.current.length > 30) historyRef.current.shift(); redoStackRef.current = []; }
                needsRedrawRef.current = true;
            }
            pointerRef.current.connectionStart = null; return;
        }
        if (P.globalForceTool !== 'none' || P.interactionMode === 'select') return;
        if (activeStrokesRef.current.length > 0) {
            activeStrokesRef.current.forEach((stroke, idx) => {
                if (!strokesRef.current.includes(stroke)) strokesRef.current.push(stroke);
                if (stroke.params.autoLinkEnd && stroke.points.length > 1) {
                    const lastIdx = stroke.points.length - 1;
                    const p = stroke.points[lastIdx];
                    const radius = resolveParam(stroke.params.autoLinkRadius, 'autoLinkRadius', stroke, p.pressure, pointerRef.current.x, pointerRef.current.y, 1, lastIdx);
                    const closest = getClosestPoint(p.x, p.y, radius, [stroke.id]);
                    if (closest) {
                        connectionsRef.current.push({
                            id: `auto-end-conn-${Date.now()}-${idx}`,
                            from: { strokeId: stroke.id, pointIndex: lastIdx },
                            to: closest,
                            stiffness: stroke.params.autoLinkStiffness,
                            length: 0,
                            breakingForce: stroke.params.autoLinkBreakingForce,
                            bias: stroke.params.autoLinkBias,
                            influence: stroke.params.autoLinkInfluence,
                            falloff: stroke.params.autoLinkFalloff,
                            decayEasing: stroke.params.autoLinkDecayEasing
                        });
                    }
                }
            });
            activeStrokesRef.current.forEach(s => {
                s.originCenter = { ...s.center };
                if (s.params.closePath && s.points.length > 2) {
                    const first = s.points[0]; const last = s.points[s.points.length - 1]; const dist = Math.hypot(first.x - last.x, first.y - last.y);
                    if (dist < (s.params.closePathRadius || 50)) { s.points.push({ x: first.x, y: first.y, baseX: first.baseX, baseY: first.baseY, vx: 0, vy: 0, pressure: last.pressure }); }
                }
            });
            if (preDrawSnapshotRef.current) { historyRef.current.push(preDrawSnapshotRef.current); if (historyRef.current.length > 30) historyRef.current.shift(); redoStackRef.current = []; }
        }
        activeStrokesRef.current = []; needsRedrawRef.current = true;
    };
    const handlePointerCancel = (e: PointerEvent) => {
        pointerRef.current.isDown = false; pointerRef.current.connectionStart = null; selectionBoxRef.current.active = false; activeStrokesRef.current = []; needsRedrawRef.current = true;
    };
    canvas.addEventListener('pointerdown', handleNativePointerDown, { passive: false });
    canvas.addEventListener('pointermove', handleNativePointerMove, { passive: false });
    canvas.addEventListener('pointerup', handleNativePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);
    canvas.addEventListener('pointerleave', handleNativePointerUp);
    return () => {
        canvas.removeEventListener('pointerdown', handleNativePointerDown);
        canvas.removeEventListener('pointermove', handleNativePointerMove);
        canvas.removeEventListener('pointerup', handleNativePointerUp);
        canvas.removeEventListener('pointercancel', handlePointerCancel);
        canvas.removeEventListener('pointerleave', handleNativePointerUp);
    };
  }, []);

  useEffect(() => { if (selectedStrokeIds.size > 0) { let i = 0; const total = selectedStrokeIds.size; selectedStrokeIds.forEach(id => { const s = strokesRef.current.find(st => st.id === id); if (s) { s.selectionIndex = i; s.selectionTotal = total; } i++; }); } needsRedrawRef.current = true; }, [selectedStrokeIds]);
  useEffect(() => { needsRedrawRef.current = true; }, [gridConfig, symmetryConfig, globalToolConfig, globalForceTool, brushParams, selectedConnectionIds, selectionFilter, embedFit, embedZoom]);
  const updateFitTransform = useCallback(() => {
      if (!embedFit || !canvasRef.current || !initialBoundsRef.current) { viewTransformRef.current = { scale: 1, x: 0, y: 0 }; return; }
      const bounds = initialBoundsRef.current;
      const canvasW = canvasRef.current.width; const canvasH = canvasRef.current.height;
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const scaleX = canvasW / bounds.width; const scaleY = canvasH / bounds.height;
      let scale = 1;
      if (embedFit === 'contain') { scale = Math.min(scaleX, scaleY); if (scale > 5) scale = 5; } else if (embedFit === 'cover') { scale = Math.max(scaleX, scaleY); }
      scale *= embedZoom;
      const tx = (canvasW / 2) - (bounds.cx * scale); const ty = (canvasH / 2) - (bounds.cy * scale);
      viewTransformRef.current = { scale, x: tx, y: ty }; needsRedrawRef.current = true;
  }, [embedFit, embedZoom]);
  const updateCanvasSize = useCallback(() => {
    if (canvasRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (canvasRef.current.width !== rect.width || canvasRef.current.height !== rect.height) { canvasRef.current.width = rect.width; canvasRef.current.height = rect.height; updateFitTransform(); needsRedrawRef.current = true; }
    }
  }, [updateFitTransform]);
  useEffect(() => { const observer = new ResizeObserver(() => { updateCanvasSize(); }); if (containerRef.current) observer.observe(containerRef.current); return () => observer.disconnect(); }, [updateCanvasSize]);
  useEffect(() => { updateFitTransform(); }, [updateFitTransform]);
  const calculateInitialBounds = (strokes: Stroke[]) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      if (strokes.length === 0) return null;
      for (const stroke of strokes) { for (const p of stroke.points) { const x = p.baseX ?? p.x; const y = p.baseY ?? p.y; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
      if (!isFinite(minX)) return null; const padding = 20;
      return { minX: minX-padding, maxX: maxX+padding, minY: minY-padding, maxY: maxY+padding, width: (maxX-minX)+padding*2, height: (maxY-minY)+padding*2, cx: (minX+maxX)/2, cy: (minY+maxY)/2 };
  };
  const hydrateStrokes = (data: Stroke[]): Stroke[] => { return cloneStrokes(data).map(s => ({ ...s, originCenter: s.originCenter || { ...s.center }, params: { ...DEFAULT_PARAMS, ...s.params, fill: { ...DEFAULT_PARAMS.fill, ...(s.params.fill || {}) }, gradient: { ...DEFAULT_PARAMS.gradient, ...(s.params.gradient || {}) }, } })); };
  const saveToHistory = () => { const snapshot = { strokes: cloneStrokes(strokesRef.current), connections: JSON.parse(JSON.stringify(connectionsRef.current)) }; historyRef.current.push(snapshot); if (historyRef.current.length > 30) historyRef.current.shift(); redoStackRef.current = []; };
  useImperativeHandle(ref, () => ({
    exportData: () => ({ strokes: cloneStrokes(strokesRef.current), connections: JSON.parse(JSON.stringify(connectionsRef.current)), version: 1 }),
    importData: (data: ProjectData | Stroke[]) => { saveToHistory(); if (Array.isArray(data)) { strokesRef.current = hydrateStrokes(data); connectionsRef.current = []; } else { strokesRef.current = hydrateStrokes(data.strokes); connectionsRef.current = data.connections || []; } onStrokeSelect(null, null, null, null, null); initialBoundsRef.current = calculateInitialBounds(strokesRef.current); updateFitTransform(); needsRedrawRef.current = true; },
    updateSelectedParams: (update) => { if (selectedStrokeIds.size === 0) return; strokesRef.current.forEach(s => { if (selectedStrokeIds.has(s.id)) { if ('key' in update) { if (update.modulation) { if (!s.params.modulations) s.params.modulations = {}; if (update.value === undefined) delete s.params.modulations[update.key]; else s.params.modulations[update.key] = update.value; } else { s.params[update.key] = update.value; } } else { Object.assign(s.params, update); } } }); needsRedrawRef.current = true; },
    syncSelectedParams: (sourceParams: SimulationParams) => { if (selectedStrokeIds.size === 0) return; const cloned = JSON.parse(JSON.stringify(sourceParams)); strokesRef.current.forEach(s => { if (selectedStrokeIds.has(s.id)) s.params = JSON.parse(JSON.stringify(cloned)); }); needsRedrawRef.current = true; },
    updateSelectedConnectionParams: (updates: Partial<Connection>) => { if (selectedConnectionIds.size === 0) return; let modified = false; connectionsRef.current.forEach(c => { if (selectedConnectionIds.has(c.id)) { Object.assign(c, updates); modified = true; } }); if (modified) { needsRedrawRef.current = true; draw(); } },
    triggerRedraw: () => { needsRedrawRef.current = true; }
  }));
  useEffect(() => { if (clearTrigger > 0) { saveToHistory(); strokesRef.current = []; connectionsRef.current = []; initialBoundsRef.current = null; viewTransformRef.current = { scale: 1, x: 0, y: 0 }; onStrokeSelect(null, null, null, null, null); audioManager.stopAll(); needsRedrawRef.current = true; } }, [clearTrigger]);
  useEffect(() => { if (deleteSelectedTrigger > 0 && (selectedStrokeIds.size > 0 || selectedConnectionIds.size > 0)) { saveToHistory(); strokesRef.current = strokesRef.current.filter(s => !selectedStrokeIds.has(s.id)); connectionsRef.current = connectionsRef.current.filter(c => !selectedConnectionIds.has(c.id)); connectionsRef.current = connectionsRef.current.filter(c => !selectedStrokeIds.has(c.from.strokeId) && !selectedStrokeIds.has(c.to.strokeId)); onStrokeSelect(null, null, null, null, null); needsRedrawRef.current = true; } }, [deleteSelectedTrigger]);
  useEffect(() => { if (deleteAllLinksTrigger > 0) { saveToHistory(); connectionsRef.current = []; needsRedrawRef.current = true; } }, [deleteAllLinksTrigger]);
  useEffect(() => { if (resetPosTrigger > 0) { strokesRef.current.forEach(s => { s.velocity = { x: 0, y: 0 }; s.points.forEach(p => { p.x = p.baseX; p.y = p.baseY; p.vx = 0; p.vy = 0; }); }); needsRedrawRef.current = true; } }, [resetPosTrigger]);
  useEffect(() => { if (undoTrigger > 0 && historyRef.current.length > 0) { const previousState = historyRef.current.pop(); if (previousState) { redoStackRef.current.push({ strokes: cloneStrokes(strokesRef.current), connections: JSON.parse(JSON.stringify(connectionsRef.current)) }); strokesRef.current = previousState.strokes; connectionsRef.current = previousState.connections; const existingStrokeIds = new Set(strokesRef.current.map(s => s.id)); const newStrokeSelection = new Set([...selectedStrokeIds].filter(id => existingStrokeIds.has(id))); const existingConnIds = new Set(connectionsRef.current.map(c => c.id)); const newConnSelection = new Set([...selectedConnectionIds].filter(id => existingConnIds.has(id))); const strokeList = Array.from(newStrokeSelection); const connList = Array.from(newConnSelection); onStrokeSelect(strokeList.length ? strokeList : null, null, null, connList.length ? connList : null, null); needsRedrawRef.current = true; } } }, [undoTrigger]);
  useEffect(() => { if (redoTrigger > 0 && redoStackRef.current.length > 0) { const nextState = redoStackRef.current.pop(); if (nextState) { historyRef.current.push({ strokes: cloneStrokes(strokesRef.current), connections: JSON.parse(JSON.stringify(connectionsRef.current)) }); strokesRef.current = nextState.strokes; connectionsRef.current = nextState.connections; needsRedrawRef.current = true; } } }, [redoTrigger]);
  const getSymmetryPoints = (x: number, y: number): { x: number, y: number }[] => {
    const { symmetryConfig } = latestProps.current;
    if (!symmetryConfig.enabled || !canvasRef.current) return [{ x, y }];
    const cx = canvasRef.current.width / 2; const cy = canvasRef.current.height / 2;
    const points: { x: number, y: number }[] = []; points.push({ x, y }); 
    if (symmetryConfig.type === 'horizontal') points.push({ x: cx - (x - cx), y: y }); 
    else if (symmetryConfig.type === 'vertical') points.push({ x: x, y: cy - (y - cy) }); 
    else if (symmetryConfig.type === 'quad') { points.push({ x: cx - (x - cx), y: y }); points.push({ x: x, y: cy - (y - cy) }); points.push({ x: cx - (x - cx), y: cy - (y - cy) }); } 
    else if (symmetryConfig.type === 'radial') { const count = Math.max(2, symmetryConfig.count); const rx = x - cx; const ry = y - cy; const radius = Math.hypot(rx, ry); const angle = Math.atan2(ry, rx); for (let i = 1; i < count; i++) { const theta = angle + (Math.PI * 2 / count) * i; points.push({ x: cx + Math.cos(theta) * radius, y: cy + Math.sin(theta) * radius }); } }
    return points;
  };
  const getClosestPoint = (x: number, y: number, maxDist: number = 30, ignoreStrokeIds: string[] = []): PointReference | null => {
      let minDistSq = maxDist * maxDist; let result: PointReference | null = null;
      for (const stroke of strokesRef.current) { 
          if (ignoreStrokeIds.includes(stroke.id)) continue;
          for (let i = 0; i < stroke.points.length; i++) { 
              const p = stroke.points[i]; 
              const dSq = (p.x - x)**2 + (p.y - y)**2; 
              if (dSq < minDistSq) { minDistSq = dSq; result = { strokeId: stroke.id, pointIndex: i }; } 
          } 
      }
      return result;
  };
  const getStrokeAtPosition = (x: number, y: number): Stroke | null => {
    for (let i = strokesRef.current.length - 1; i >= 0; i--) { const stroke = strokesRef.current[i]; const hitDist = Math.max(20, stroke.params.strokeWidth + 15); const hitDistSq = hitDist * hitDist; for (let j = 0; j < stroke.points.length; j += 2) { const p = stroke.points[j]; if (((p.x - x) ** 2 + (p.y - y) ** 2) < hitDistSq) return stroke; } }
    return null;
  };
  const getConnectionAtPosition = (x: number, y: number): Connection | null => {
      for (const conn of connectionsRef.current) { const s1 = strokesRef.current.find(s => s.id === conn.from.strokeId); const s2 = strokesRef.current.find(s => s.id === conn.to.strokeId); if (s1 && s2) { const p1 = s1.points[conn.from.pointIndex]; const p2 = s2.points[conn.to.pointIndex]; if (p1 && p2 && distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y) < 10) return conn; } }
      return null;
  };
  const addPointToActiveStrokes = (x: number, y: number, pressure: number) => {
      const P = latestProps.current;
      activeStrokesRef.current.forEach(s => { if (!strokesRef.current.includes(s)) strokesRef.current.push(s); });
      const symPoints = getSymmetryPoints(x, y);
      activeStrokesRef.current.forEach((stroke, idx) => {
        if (idx >= symPoints.length) return;
        const target = symPoints[idx]; const lastP = stroke.points[stroke.points.length - 1]; const isStart = stroke.points.length < 2;
        const dx = target.x - lastP.x;
        const dy = target.y - lastP.y;
        const distSq = dx*dx + dy*dy;
        const dist = Math.sqrt(distSq);
        let seg = Math.max(1, stroke.params.segmentation);
        if (P.gridConfig.enabled && P.gridConfig.snap) {
            const gridSize = Math.max(10, P.gridConfig.size);
            const snapFactor = P.gridConfig.snapFactor || 1;
            seg = gridSize * snapFactor;
        }
        if (isStart) {
             stroke.points.push({ x: target.x, y: target.y, baseX: target.x, baseY: target.y, vx: 0, vy: 0, pressure });
        } else if (dist >= seg) {
             const steps = Math.max(1, Math.floor(dist / seg));
             for (let i = 1; i <= steps; i++) {
                 const t = i / steps;
                 const nx = lastP.x + dx * t;
                 const ny = lastP.y + dy * t;
                 const nPressure = lastP.pressure + (pressure - lastP.pressure) * t;
                 stroke.points.push({ x: nx, y: ny, baseX: nx, baseY: ny, vx: 0, vy: 0, pressure: nPressure });
             }
        } else { return; }
        let cx = 0, cy = 0; stroke.points.forEach(p => { cx += p.x; cy += p.y; }); 
        stroke.center.x = cx / stroke.points.length; stroke.center.y = cy / stroke.points.length; 
        if (!stroke.originCenter.x) stroke.originCenter = { ...stroke.center }; 
        needsRedrawRef.current = true;
      });
  };
  const resolveParam = (baseValue: number, key: keyof SimulationParams, stroke: Stroke, pointPressure: number, pointerX: number, pointerY: number, progress: number, pointIndex: number): number => {
    const config = stroke.params.modulations?.[key]; if (!config) return baseValue; const { source, min, max, easing, scope } = config; if (source === 'none') return baseValue; let t = 0; const isScopePoint = scope === 'point';
    
    // NEW AUDIO LOGIC: Use the detailed spectrum data if available
    const spectral = audioManager.getSpectralData();
    const sensitivity = stroke.params.audioSensitivity ?? 1.0; 

    switch (source) {
      case 'random': t = isScopePoint ? getPseudoRandom(stroke.randomSeed + pointIndex * 0.1, key as string) : getPseudoRandom(stroke.randomSeed, key as string); break;
      case 'index': t = (stroke.index % 10) / 10; break;
      case 'selection-index': t = (stroke.selectionTotal ?? 1) > 1 ? (stroke.selectionIndex ?? 0) / ((stroke.selectionTotal ?? 1) - 1) : 0; break;
      case 'time': case 'time-pulse': case 'time-step': const dir = config.invertDirection ? -1 : 1; const speedVal = config.speed ?? 1; let timeFactor = timeRef.current * speedVal; if (config.speedStrategy === 'duration' && speedVal > 0) timeFactor = timeRef.current / speedVal; const phaseOffset = isScopePoint ? (config.speedStrategy === 'duration' ? progress : pointIndex * 0.05) : 0; if (source === 'time') { t = (timeFactor * dir + phaseOffset) % 1; if (t < 0) t += 1; } else if (source === 'time-pulse') { const duty = config.paramA ?? 0.5; const edge = Math.min(0.2, config.paramB ?? 0.1); const cycleLen = 1 + (config.paramC ?? 0); const rawPulse = (timeFactor * dir + phaseOffset) % cycleLen; let normPulse = rawPulse < 0 ? rawPulse + cycleLen : rawPulse; if (normPulse > 1) t = 0; else if (normPulse < edge) t = normPulse / edge; else if (normPulse < duty) t = 1; else if (normPulse < duty + edge) t = 1 - (normPulse - duty) / edge; else t = 0; } else if (source === 'time-step') { const steps = 4; let rawStep = (timeFactor * dir + phaseOffset) % 1; if (rawStep < 0) rawStep += 1; t = Math.floor(rawStep * steps) / (steps - 1); } break;
      case 'velocity': t = isScopePoint ? pointPressure : stroke.points.reduce((acc, p) => acc + p.pressure, 0) / (stroke.points.length || 1); break;
      case 'pressure': t = isScopePoint ? pointPressure : stroke.points.reduce((acc, p) => acc + p.pressure, 0) / (stroke.points.length || 1); break;
      case 'cursor': 
        const targetX = isScopePoint ? stroke.points[pointIndex].x : stroke.center.x;
        const targetY = isScopePoint ? stroke.points[pointIndex].y : stroke.center.y;
        const dx = pointerX - targetX;
        const dy = pointerY - targetY;
        const axis = config.paramB ?? 0; // 0: Radial, 1: X, 2: Y
        if (axis === 1) t = Math.abs(dx);
        else if (axis === 2) t = Math.abs(dy);
        else t = Math.sqrt(dx*dx + dy*dy);
        break;
      case 'path': t = progress; break;
      case 'path-mirror': t = 1 - Math.abs((progress - 0.5) * 2); break;
      case 'path-mirror-inv': t = Math.abs((progress - 0.5) * 2); break;
      
      // Legacy Generic Audio
      case 'audio-live': t = spectral.average * sensitivity; break;
      case 'audio-average': t = spectral.average * sensitivity; break;

      // New Granular Bands (Now scaled by global sensitivity!)
      case 'audio-sub': t = spectral.sub * sensitivity; break;
      case 'audio-bass': t = spectral.bass * sensitivity; break;
      case 'audio-low-mid': t = spectral.lowMid * sensitivity; break;
      case 'audio-mid': t = spectral.mid * sensitivity; break;
      case 'audio-high-mid': t = spectral.highMid * sensitivity; break;
      case 'audio-treble': t = spectral.treble * sensitivity; break;
      
      case 'audio-sample': t = audioManager.getStrokeAmplitude(stroke.id); break;
    }
    const inMin = config.inputMin ?? 0; const inMax = config.inputMax ?? (source === 'cursor' ? 500 : 1); 
    if (inMax > inMin) t = (t - inMin) / (inMax - inMin); 
    t = Math.max(0, Math.min(1, t)); const easedT = applyEasing(t, easing, config); return min + (max - min) * easedT;
  };
  const getProjectedPosition = (stroke: Stroke, px: number, py: number): number => { let minDistSq = Infinity; let closestIdx = 0; for(let i=0; i<stroke.points.length; i++) { const dSq = (stroke.points[i].x - px)**2 + (stroke.points[i].y - py)**2; if (dSq < minDistSq) { minDistSq = dSq; closestIdx = i; } } return closestIdx / (stroke.points.length - 1 || 1); };
  const updatePhysics = () => {
    if (!latestProps.current.isPlaying) return;
    const P = latestProps.current;
    timeRef.current += 0.01;
    
    // NEW: Get full spectral data
    const spectral = P.isMicEnabled ? audioManager.getSpectralData() : { average: 0, sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0 };
    
    // Legacy mapping for old flags
    const globalBass = spectral.bass + spectral.sub * 0.5; // Combo of sub and bass for wiggle
    
    const pointerX = pointerRef.current.x; const pointerY = pointerRef.current.y;
    const hasPointer = pointerRef.current.x > -100;
    pointerRef.current.lastX = pointerX; pointerRef.current.lastY = pointerY;

    if (P.globalForceTool !== 'none' && P.globalForceTool !== 'connect' && P.globalForceTool !== 'cursor' && (pointerRef.current.isDown || P.globalToolConfig.trigger === 'hover') && hasPointer) { const influenceRadius = P.globalToolConfig.radius; const strength = P.globalToolConfig.force * 2; const falloffExp = P.globalToolConfig.falloff ? (1 + P.globalToolConfig.falloff * 2) : 1; strokesRef.current.forEach(stroke => { stroke.points.forEach(p => { const dx = pointerX - p.x; const dy = pointerY - p.y; const dSq = dx*dx + dy*dy; if (dSq < influenceRadius * influenceRadius) { const dist = Math.sqrt(dSq); const forceMag = Math.pow(1 - (dist / influenceRadius), falloffExp) * strength; if (P.globalForceTool === 'repulse') { p.vx -= (dx / dist) * forceMag; p.vy -= (dy / dist) * forceMag; } else if (P.globalForceTool === 'attract') { p.vx += (dx / dist) * forceMag; p.vy += (dx / dist) * forceMag; } else if (P.globalForceTool === 'vortex') { p.vx += (-dy / dist) * forceMag; p.vy += (dx / dist) * forceMag; } } }); }); }
    
    for (let i = connectionsRef.current.length - 1; i >= 0; i--) { 
        const conn = connectionsRef.current[i]; 
        const s1 = strokesRef.current.find(s => s.id === conn.from.strokeId); 
        const s2 = strokesRef.current.find(s => s.id === conn.to.strokeId); 
        if (s1 && s2) { 
            const p1 = s1.points[conn.from.pointIndex]; 
            const p2 = s2.points[conn.to.pointIndex]; 
            if (p1 && p2) { 
                const dx = p2.x - p1.x; 
                const dy = p2.y - p1.y; 
                const dist = Math.sqrt(dx*dx + dy*dy); 
                if (dist > 0.1) { 
                    const progress = conn.from.pointIndex / (s1.points.length - 1 || 1);
                    const currentMouseRadius = resolveParam(s1.params.mouseInfluenceRadius, 'mouseInfluenceRadius', s1, p1.pressure, pointerX, pointerY, progress, conn.from.pointIndex);
                    const stiffness = resolveParam(s1.params.autoLinkStiffness, 'autoLinkStiffness', s1, p1.pressure, pointerX, pointerY, progress, conn.from.pointIndex);
                    const breakingForce = resolveParam(s1.params.autoLinkBreakingForce, 'autoLinkBreakingForce', s1, p1.pressure, pointerX, pointerY, progress, conn.from.pointIndex);
                    const bias = resolveParam(s1.params.autoLinkBias, 'autoLinkBias', s1, p1.pressure, pointerX, pointerY, progress, conn.from.pointIndex);
                    const influence = Math.round(resolveParam(s1.params.autoLinkInfluence, 'autoLinkInfluence', s1, p1.pressure, pointerX, pointerY, progress, conn.from.pointIndex));
                    const falloff = resolveParam(s1.params.autoLinkFalloff, 'autoLinkFalloff', s1, p1.pressure, pointerX, pointerY, progress, conn.from.pointIndex);
                    const decayEasing = s1.params.autoLinkDecayEasing;

                    const diff = dist - conn.length; 
                    if (breakingForce > 0 && Math.abs(diff) > breakingForce * 10) { 
                        connectionsRef.current.splice(i, 1); 
                        continue; 
                    } 
                    const force = diff * stiffness * 0.5; 
                    const fx = (dx / dist) * force; 
                    const fy = (dy / dist) * force; 
                    const w1 = bias; 
                    const w2 = 1 - w1; 
                    p1.vx += fx * w1; p1.vy += fy * w1; 
                    p2.vx += -fx * w2; p2.vy += -fy * w2; 
                    
                    if (influence > 0) { 
                        for (let k = 1; k <= influence; k++) { 
                            const factor = 1.0 * (1 - falloff) + (1 - applyEasing(k / (influence + 1), decayEasing)) * falloff; 
                            const left1 = s1.points[conn.from.pointIndex - k]; 
                            const right1 = s1.points[conn.from.pointIndex + k]; 
                            if (left1) { left1.vx += fx * w1 * factor; left1.vy += fy * w1 * factor; } 
                            if (right1) { right1.vx += fx * w1 * factor; right1.vy += fy * w1 * factor; } 
                            const left2 = s2.points[conn.to.pointIndex - k]; 
                            const right2 = s2.points[conn.to.pointIndex + k]; 
                            if (left2) { left2.vx += -fx * w2 * factor; left2.vy += -fy * w2 * factor; } 
                            if (right2) { right2.vx += -fx * w2 * factor; right2.vy += -fy * w2 * factor; } 
                        } 
                    } 
                } 
            } 
        } else { 
            connectionsRef.current.splice(i, 1); 
        } 
    }
    
    const swarmForces = new Map<string, { vx: number, vy: number }>(); 
    for (let i = 0; i < strokesRef.current.length; i++) {
        const s1 = strokesRef.current[i];
        if (s1.points.length < 2) continue;
        const s1MouseRadius = resolveParam(s1.params.mouseInfluenceRadius, 'mouseInfluenceRadius', s1, 0.5, pointerX, pointerY, 0.5, 0);
        const r = resolveParam(s1.params.neighborRadius, 'neighborRadius', s1, 0.5, pointerX, pointerY, 0.5, 0);
        const alignF = resolveParam(s1.params.alignmentForce, 'alignmentForce', s1, 0.5, pointerX, pointerY, 0.5, 0);
        const cohF = resolveParam(s1.params.cohesionForce, 'cohesionForce', s1, 0.5, pointerX, pointerY, 0.5, 0);
        const repF = resolveParam(s1.params.repulsionForce, 'repulsionForce', s1, 0.5, pointerX, pointerY, 0.5, 0);
        const swarmCursorInf = resolveParam(s1.params.swarmCursorInfluence, 'swarmCursorInfluence', s1, 0.5, pointerX, pointerY, 0.5, 0);
        
        if (r <= 0 || (alignF === 0 && cohF === 0 && repF === 0)) continue;
        let influenceFactor = 1;
        if (swarmCursorInf > 0 && hasPointer) {
            const distToCursor = Math.hypot(pointerX - s1.center.x, pointerY - s1.center.y);
            influenceFactor = distToCursor > s1MouseRadius ? 0 : 1 - (distToCursor / s1MouseRadius);
            influenceFactor = 1 * (1 - swarmCursorInf) + influenceFactor * swarmCursorInf;
        }
        if (influenceFactor <= 0.01) continue;
        let alignX = 0, alignY = 0, cohX = 0, cohY = 0, sepX = 0, sepY = 0, count = 0;
        for (let j = 0; j < strokesRef.current.length; j++) {
            if (i === j) continue;
            const s2 = strokesRef.current[j];
            if (s2.points.length < 2) continue;
            const dx = s2.center.x - s1.center.x;
            const dy = s2.center.y - s1.center.y;
            const distSq = dx*dx + dy*dy;
            if (distSq < r * r && distSq > 0.1) {
                const dist = Math.sqrt(distSq);
                let s2vx = 0, s2vy = 0;
                const step = Math.ceil(s2.points.length / 5);
                for(let k=0; k<s2.points.length; k+=step) {
                    s2vx += s2.points[k].vx;
                    s2vy += s2.points[k].vy;
                }
                s2vx /= (s2.points.length/step);
                s2vy /= (s2.points.length/step);
                alignX += s2vx; alignY += s2vy;
                cohX += s2.center.x; cohY += s2.center.y;
                sepX += (s1.center.x - s2.center.x) / dist;
                sepY += (s1.center.y - s2.center.y) / dist;
                count++;
            }
        }
        if (count > 0) {
            alignX /= count; alignY /= count;
            cohX = (cohX/count - s1.center.x);
            cohY = (cohY/count - s1.center.y);
            const fAlign = alignF * influenceFactor * 0.5;
            const fCoh = cohF * influenceFactor * 0.05;
            const fSep = repF * influenceFactor * 2.0;
            swarmForces.set(s1.id, { vx: (alignX * fAlign) + (cohX * fCoh) + (sepX * fSep), vy: (alignY * fAlign) + (cohY * fCoh) + (sepY * fSep) });
        }
    }

    for (const stroke of strokesRef.current) { 
      let cx = 0, cy = 0, len = stroke.points.length; 
      let totalSpeed = 0; 
      if (len === 0) continue; 
      for (const p of stroke.points) { cx += p.x; cy += p.y; totalSpeed += Math.hypot(p.vx, p.vy); } 
      stroke.center.x = cx / len; stroke.center.y = cy / len; 
      const centerDist = hasPointer ? Math.hypot(pointerX - stroke.center.x, pointerY - stroke.center.y) : 10000; 
      
      const swarmF = swarmForces.get(stroke.id) || { vx: 0, vy: 0 }; 
      if (P.isSoundEngineEnabled && stroke.sound.bufferId && stroke.sound.enabled) { 
          const ox = stroke.originCenter?.x ?? stroke.center.x; 
          const oy = stroke.originCenter?.y ?? stroke.center.y; 
          audioManager.updateStrokeSound(stroke.id, stroke.sound.bufferId, { ...stroke.sound, reverb: stroke.sound.reverbSend }, { cursorDist: centerDist, physicsSpeed: (totalSpeed / len) * 20, displacement: { dist: Math.hypot(stroke.center.x - ox, stroke.center.y - oy), x: stroke.center.x - ox, y: stroke.center.y - oy }, timelinePos: (stroke.sound.playbackMode === 'timeline-scrub' && hasPointer) ? getProjectedPosition(stroke, pointerX, pointerY) : 0 }); 
      }
      
      for (let j = 0; j < stroke.points.length; j++) { 
          const p = stroke.points[j]; 
          const progress = j / (len - 1 || 1); 
          const currentMouseRadius = resolveParam(stroke.params.mouseInfluenceRadius, 'mouseInfluenceRadius', stroke, p.pressure, pointerX, pointerY, progress, j); 
          
          const mass = resolveParam(stroke.params.mass, 'mass', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const friction = resolveParam(stroke.params.friction, 'friction', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const tension = resolveParam(stroke.params.tension, 'tension', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const wiggleAmp = resolveParam(stroke.params.wiggleAmplitude, 'wiggleAmplitude', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const wiggleFreq = resolveParam(stroke.params.wiggleFrequency, 'wiggleFrequency', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const waveSpd = resolveParam(stroke.params.waveSpeed, 'waveSpeed', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const mouseRep = resolveParam(stroke.params.mouseRepulsion, 'mouseRepulsion', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const mouseAttr = resolveParam(stroke.params.mouseAttraction, 'mouseAttraction', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const mouseFall = resolveParam(stroke.params.mouseFalloff, 'mouseFalloff', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const viscosity = resolveParam(stroke.params.viscosity, 'viscosity', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const elasticity = resolveParam(stroke.params.elasticity, 'elasticity', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const rGravX = resolveParam(stroke.params.gravityX, 'gravityX', stroke, p.pressure, pointerX, pointerY, progress, j); 
          const rGravY = resolveParam(stroke.params.gravityY, 'gravityY', stroke, p.pressure, pointerX, pointerY, progress, j); 

          const invMass = 1 / Math.max(0.1, mass); 
          const frictionFactor = friction * (1 - viscosity * 0.1); 
          const isWiggling = wiggleAmp > 0 || tension > 0 || (stroke.params.audioToWiggle && globalBass > 0.1); 

          let fx = (p.baseX - p.x) * elasticity + rGravX * mass; 
          let fy = (p.baseY - p.y) * elasticity + rGravY * mass; 
          fx += swarmF.vx * mass; 
          fy += swarmF.vy * mass; 

          if (isWiggling) { 
              const phase = (j * wiggleFreq) + (timeRef.current * waveSpd) + stroke.phaseOffset; 
              let noiseX = Math.sin(phase) * wiggleAmp; 
              let noiseY = Math.cos(phase + 2.3) * wiggleAmp; 
              if (tension > 0) { noiseX += (Math.random() - 0.5) * tension; noiseY += (Math.random() - 0.5) * tension; } 
              if (stroke.params.audioToWiggle) { const boost = 1 + globalBass * stroke.params.audioSensitivity * 5; noiseX *= boost; noiseY *= boost; } 
              fx += noiseX * 0.1; fy += noiseY * 0.1; 
          } 

          p.vx += fx * invMass; 
          p.vy += fy * invMass; 

          const dx = pointerX - p.x; const dy = pointerY - p.y;
          const pDist = Math.hypot(dx, dy);
          if (hasPointer && pDist < currentMouseRadius) { 
              const force = Math.pow(1 - (pDist / currentMouseRadius), mouseFall); 
              if (mouseRep > 0) { p.vx -= (dx / pDist) * force * mouseRep; p.vy -= (dy / pDist) * force * mouseRep; } 
              if (mouseAttr > 0) { p.vx += (dx / pDist) * force * mouseAttr; p.vy += (dy / pDist) * force * mouseAttr; } 
          } 

          p.vx *= frictionFactor; p.vy *= frictionFactor; 
          p.x += p.vx; p.y += p.vy; 

          if (stroke.params.maxDisplacement > 0) { 
              const distFromAnchor = Math.hypot(p.x - p.baseX, p.y - p.baseY); 
              if (distFromAnchor > stroke.params.maxDisplacement) { 
                  const angle = Math.atan2(p.y - p.baseY, p.x - p.baseX); 
                  p.x = p.baseX + Math.cos(angle) * stroke.params.maxDisplacement; 
                  p.y = p.baseY + Math.sin(angle) * stroke.params.maxDisplacement; 
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
    const P = latestProps.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const { scale, x, y } = viewTransformRef.current;
    if (scale !== 1 || x !== 0 || y !== 0) { ctx.translate(x, y); ctx.scale(scale, scale); }
    
    const tracePath = (ctx: CanvasRenderingContext2D, stroke: Stroke, closePath: boolean) => {
        const rawPoints = stroke.points;
        if (rawPoints.length < 2) return;
        const points: Point[] = [rawPoints[0]];
        for (let k = 1; k < rawPoints.length; k++) {
            const last = points[points.length - 1];
            const curr = rawPoints[k];
            const d = Math.hypot(curr.x - last.x, curr.y - last.y);
            if (d > 0.1) points.push(curr);
        }
        const len = points.length;
        if (len < 2) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        const roundingParam = resolveParam(stroke.params.pathRounding, 'pathRounding', stroke, 0.5, pointerRef.current.x, pointerRef.current.y, 0.5, 0);
        
        if (roundingParam <= 0.01) {
            for (let i = 1; i < len; i++) ctx.lineTo(points[i].x, points[i].y);
            if (closePath) ctx.closePath();
        } else {
            for (let i = 1; i < len - 1; i++) {
                const isStartTerminal = (i - 1 === 0) && !closePath;
                const isEndTerminal = (i + 1 === len - 1) && !closePath;
                const geom = getCornerGeometry(points[i-1], points[i], points[i+1], roundingParam, isStartTerminal, isEndTerminal);
                if (geom) { ctx.lineTo(geom.sx, geom.sy); ctx.arcTo(points[i].x, points[i].y, geom.ex, geom.ey, geom.radius); } else { ctx.lineTo(points[i].x, points[i].y); }
            }
            if (closePath) {
                const geomLast = getCornerGeometry(points[len-2], points[len-1], points[0], roundingParam, false, false);
                if (geomLast) { ctx.lineTo(geomLast.sx, geomLast.sy); ctx.arcTo(points[len-1].x, points[len-1].y, geomLast.ex, geomLast.ey, geomLast.radius); } else { ctx.lineTo(points[len-1].x, points[len-1].y); }
                const geomFirst = getCornerGeometry(points[len-1], points[0], points[1], roundingParam, false, false);
                if (geomFirst) { ctx.lineTo(geomFirst.sx, geomFirst.sy); ctx.arcTo(points[0].x, points[0].y, geomFirst.ex, geomFirst.ey, geomFirst.radius); } else { ctx.lineTo(points[0].x, points[0].y); }
                ctx.closePath();
            } else { ctx.lineTo(points[len-1].x, points[len-1].y); }
        }
    };
    
    const getCornerGeometry = (p0: Point, p1: Point, p2: Point, rawRounding: number, isStartTerminal: boolean, isEndTerminal: boolean) => {
        const dx1 = p0.x - p1.x, dy1 = p0.y - p1.y;
        const dx2 = p2.x - p1.x, dy2 = p2.y - p1.y;
        const len1 = Math.hypot(dx1, dy1);
        const len2 = Math.hypot(dx2, dy2);
        if (len1 < 0.1 || len2 < 0.1) return null;
        const limit1 = isStartTerminal ? len1 : len1 * 0.5;
        const limit2 = isEndTerminal ? len2 : len2 * 0.5;
        const maxTangent = Math.min(limit1, limit2);
        const ratio = Math.max(0, Math.min(2, rawRounding)) / 2; 
        const tangentLen = maxTangent * ratio;
        if (tangentLen < 0.1) return null; 
        const u1x = dx1 / len1, u1y = dy1 / len1; 
        const u2x = dx2 / len2, u2y = dy2 / len2; 
        const dot = u1x * u2x + u1y * u2y;
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
        const halfAngle = angle / 2;
        const radius = tangentLen * Math.tan(halfAngle);
        const sx = p1.x + u1x * tangentLen;
        const sy = p1.y + u1y * tangentLen;
        const ex = p1.x + u2x * tangentLen;
        const ey = p1.y + u2y * tangentLen;
        const bx = u1x + u2x;
        const by = u1y + u2y;
        const bLen = Math.hypot(bx, by);
        if (bLen < 0.001) return null; 
        const bisectorX = bx / bLen;
        const bisectorY = by / bLen;
        const distToCenter = radius / Math.sin(halfAngle);
        const cx = p1.x + bisectorX * distToCenter;
        const cy = p1.y + bisectorY * distToCenter;
        const startAngle = Math.atan2(sy - cy, sx - cx);
        let endAngle = Math.atan2(ey - cy, ex - cx);
        const cross = u1x * u2y - u1y * u2x;
        const ccw = cross < 0; 
        let sweep = endAngle - startAngle;
        if (ccw) { if (sweep > 0) sweep -= Math.PI * 2; } else { if (sweep < 0) sweep += Math.PI * 2; }
        endAngle = startAngle + sweep;
        return { cx, cy, radius, startAngle, endAngle, sx, sy, ex, ey, ccw };
    };

    if (P.gridConfig.visible && P.gridConfig.enabled) {
       ctx.fillStyle = hexToRgba(P.gridConfig.color, P.gridConfig.opacity);
       const cx = canvas.width / 2; const cy = canvas.height / 2; const size = Math.max(10, P.gridConfig.size);
       const cols = Math.ceil(cx / size); const rows = Math.ceil(cy / size);
       ctx.beginPath();
       for (let i = -cols; i <= cols; i++) { const x = cx + i * size; for (let j = -rows; j <= rows; j++) { const y = cy + j * size; ctx.moveTo(x + 1.5, y); ctx.arc(x, y, 1.5, 0, Math.PI * 2); } }
       ctx.fill();
    }
    if (P.symmetryConfig.visible && P.symmetryConfig.enabled) {
        const cx = canvas.width / 2; const cy = canvas.height / 2;
        ctx.strokeStyle = `rgba(0,0,0,0.1)`; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.beginPath();
        if (P.symmetryConfig.type === 'horizontal' || P.symmetryConfig.type === 'quad') { ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); }
        if (P.symmetryConfig.type === 'vertical' || P.symmetryConfig.type === 'quad') { ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); }
        if (P.symmetryConfig.type === 'radial') {
            const count = Math.max(2, P.symmetryConfig.count);
            for (let i = 0; i < count; i++) { const theta = (Math.PI * 2 / count) * i; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(theta) * 2000, cy + Math.sin(theta) * 2000); }
        }
        ctx.stroke(); ctx.setLineDash([]);
    }
    if (P.globalToolConfig.connectionsVisible) {
        ctx.lineWidth = 1;
        for (const conn of connectionsRef.current) {
            const s1 = strokesRef.current.find(s => s.id === conn.from.strokeId);
            const s2 = strokesRef.current.find(s => s.id === conn.to.strokeId);
            const isConnSelected = P.selectedConnectionIds.has(conn.id);
            if (s1 && s2) {
                const p1 = s1.points[conn.from.pointIndex]; const p2 = s2.points[conn.to.pointIndex];
                if (p1 && p2) {
                    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
                    if (isConnSelected) { ctx.strokeStyle = `rgba(99, 102, 241, 0.8)`; ctx.lineWidth = 2; ctx.shadowColor = `rgba(99, 102, 241, 0.5)`; ctx.shadowBlur = 8; } 
                    else { ctx.strokeStyle = `rgba(100, 100, 100, 0.3)`; ctx.lineWidth = 1; ctx.shadowBlur = 0; }
                    ctx.stroke(); ctx.shadowBlur = 0;
                }
            }
        }
    }
    if (pointerRef.current.connectionStart && pointerRef.current.isDown) {
        const s = strokesRef.current.find(st => st.id === pointerRef.current.connectionStart!.strokeId);
        const p1 = s ? s.points[pointerRef.current.connectionStart!.pointIndex] : null;
        if (p1) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(pointerRef.current.x, pointerRef.current.y); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (selectionBoxRef.current.active) {
        const sx = selectionBoxRef.current.startX; const sy = selectionBoxRef.current.startY; const w = selectionBoxRef.current.currentX - sx; const h = selectionBoxRef.current.currentY - sy;
        ctx.save(); ctx.fillStyle = 'rgba(79, 70, 229, 0.1)'; ctx.strokeStyle = 'rgba(79, 70, 229, 0.5)'; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.fillRect(sx, sy, w, h); ctx.strokeRect(sx, sy, w, h); ctx.restore();
    }
    const strokesToDraw = [...strokesRef.current, ...activeStrokesRef.current];
    if (!P.isPlaying) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'source-over';
        strokesToDraw.forEach(stroke => {
            if (!P.selectedStrokeIds.has(stroke.id) || stroke.points.length < 2) return;
            const { params } = stroke;
            tracePath(ctx, stroke, params.closePath);
            ctx.strokeStyle = 'rgba(79, 70, 229, 0.5)'; ctx.lineWidth = params.strokeWidth + 6; ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(79, 70, 229, 0.8)'; ctx.stroke(); ctx.shadowBlur = 0;
        });
    }
    strokesToDraw.forEach(stroke => {
      if (stroke.points.length === 1) {
          const p = stroke.points[0]; ctx.beginPath(); ctx.arc(p.x, p.y, stroke.params.strokeWidth / 2, 0, Math.PI * 2); ctx.fillStyle = stroke.params.color; ctx.fill(); return;
      }
      if (stroke.points.length < 2) return;
      const { params, points, center } = stroke;

      if (params.fill.enabled) {
          tracePath(ctx, stroke, params.closePath);
          ctx.globalCompositeOperation = params.fill.blendMode || 'source-over'; ctx.globalAlpha = params.fill.opacity;
          if (params.fill.glow) { ctx.shadowBlur = 20; ctx.shadowColor = params.fill.colorSource === 'custom' ? params.fill.customColor : params.color; } else { ctx.shadowBlur = 0; }
          if (params.fill.type === 'gradient' || (params.fill.syncWithStroke && params.gradient.enabled)) {
               const bounds = getStrokeBounds(stroke); const angleRad = (params.fillGradientAngle || 0) * Math.PI / 180; const r = Math.sqrt(bounds.width**2 + bounds.height**2) / 2;
               const gx1 = bounds.cx - Math.cos(angleRad) * r; const gy1 = bounds.cy - Math.sin(angleRad) * r; const gx2 = bounds.cx + Math.cos(angleRad) * r; const gy2 = bounds.cy + Math.sin(angleRad) * r;
               const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
               const colors = (params.fill.syncWithStroke && params.gradient.enabled) ? params.gradient.colors : params.fill.gradient.colors;
               colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
               ctx.fillStyle = grad;
          } else { ctx.fillStyle = params.fill.colorSource === 'custom' ? params.fill.customColor : params.color; }
          if (params.fill.blur > 0) ctx.filter = `blur(${params.fill.blur}px)`;
          ctx.fill(params.fill.rule); ctx.filter = 'none'; ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      if (params.opacity > 0 && params.strokeWidth > 0) {
        ctx.lineCap = params.lineCap || 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = params.blendMode;
        if (params.blurStrength > 0 && !params.smoothModulation && params.strokeGradientType === 'linear' && !params.modulations?.strokeWidth) { ctx.filter = `blur(${params.blurStrength}px)`; } else { ctx.filter = 'none'; }
        const isModActive = (m?: any) => m && m.source !== 'none';
        const canBatchDraw = !params.smoothModulation && params.strokeGradientType === 'linear' && !isModActive(params.modulations?.strokeWidth) && !isModActive(params.modulations?.opacity) && !isModActive(params.modulations?.hueShift);
        if (canBatchDraw) {
            const bounds = getStrokeBounds(stroke); const angleRad = (params.strokeGradientAngle || 0) * Math.PI / 180; const r = Math.sqrt(bounds.width**2 + bounds.height**2) / 2;
            const gx1 = bounds.cx - Math.cos(angleRad) * r; const gy1 = bounds.cy - Math.sin(angleRad) * r; const gx2 = bounds.cx + Math.cos(angleRad) * r; const gy2 = bounds.cy + Math.sin(angleRad) * r;
            let strokeStyle: string | CanvasGradient = params.color;
            if (params.hueShift !== 0 || (params.audioToColor && P.isMicEnabled)) { let shift = params.hueShift; if (params.audioToColor && P.isMicEnabled) shift += (audioManager.getGlobalAudioData().mid / 255) * 180; strokeStyle = getShiftedColor(strokeStyle as string, shift); }
            if (params.gradient.enabled) {
                const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2); const midpoint = params.strokeGradientMidpoint ?? 0.5;
                params.gradient.colors.forEach((c, i) => { const t = i / (params.gradient.colors.length - 1); const offset = warpOffset(t, midpoint); grad.addColorStop(offset, c); });
                strokeStyle = grad;
            }
            tracePath(ctx, stroke, params.closePath);
            if (params.glowStrength > 0) { ctx.shadowColor = strokeStyle as string; ctx.shadowBlur = params.glowStrength; }
            ctx.strokeStyle = strokeStyle; ctx.lineWidth = params.strokeWidth; ctx.globalAlpha = params.opacity; ctx.stroke(); ctx.shadowBlur = 0;
            
            // Draw points if enabled in batch mode
            if (params.drawPoints) {
                ctx.fillStyle = P.selectedStrokeIds.has(stroke.id) ? '#4f46e5' : strokeStyle;
                const ptSize = Math.max(2, params.strokeWidth / 3);
                for (const p of stroke.points) { ctx.beginPath(); ctx.arc(p.x, p.y, ptSize, 0, Math.PI * 2); ctx.fill(); }
            }
        } else {
            const rawPoints = stroke.points;
            if (rawPoints.length < 2) return;
            const points: Point[] = [rawPoints[0]];
            for (let k = 1; k < rawPoints.length; k++) {
                const last = points[points.length - 1];
                const curr = rawPoints[k];
                const d = Math.hypot(curr.x - last.x, curr.y - last.y);
                if (d > 0.1) points.push(curr);
            }
            const len = points.length;
            const roundingRatio = Math.max(0, resolveParam(params.pathRounding, 'pathRounding', stroke, 0.5, pointerRef.current.x, pointerRef.current.y, 0.5, 0));
            let currentX = points[0].x;
            let currentY = points[0].y;
            if (points.length > 1) {
                const loopLimit = params.closePath ? points.length : points.length - 1;
                for (let i = 1; i <= loopLimit; i++) {
                    const p0 = points[(i - 1) % points.length];
                    const p1 = points[i % points.length];
                    const p2 = points[(i + 1) % points.length];
                    const isStartTerminal = (i - 1 === 0) && !params.closePath;
                    const isEndTerminal = (i + 1 === points.length - 1) && !params.closePath;
                    const geom = getCornerGeometry(p0, p1, p2, roundingRatio, isStartTerminal, isEndTerminal);
                    const endX = geom ? geom.sx : p1.x;
                    const endY = geom ? geom.sy : p1.y;
                    const progress = (i-1) / points.length;
                    
                    const width = resolveParam(params.strokeWidth, 'strokeWidth', stroke, p0.pressure, pointerRef.current.x, pointerRef.current.y, progress, i-1);
                    const opacity = resolveParam(params.opacity, 'opacity', stroke, p0.pressure, pointerRef.current.x, pointerRef.current.y, progress, i-1);
                    let c = params.color;
                    if (params.hueShift !== 0 || (params.audioToColor && P.isMicEnabled)) {
                         let shift = params.hueShift;
                         if (isModActive(params.modulations?.hueShift)) shift = resolveParam(shift, 'hueShift', stroke, p0.pressure, pointerRef.current.x, pointerRef.current.y, progress, i-1);
                         if (params.audioToColor && P.isMicEnabled) shift += (audioManager.getGlobalAudioData().mid / 255) * 180;
                         c = getShiftedColor(c, shift);
                    }
                    if (params.glowStrength > 0) { ctx.shadowColor = c; ctx.shadowBlur = params.glowStrength; } else { ctx.shadowBlur = 0; }
                    ctx.strokeStyle = c;
                    ctx.lineWidth = Math.max(0.1, width);
                    ctx.globalAlpha = opacity;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(currentX, currentY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();

                    // Correctly Draw Points in modulated mode
                    if (params.drawPoints) {
                        ctx.save();
                        ctx.fillStyle = P.selectedStrokeIds.has(stroke.id) ? '#4f46e5' : c;
                        ctx.beginPath();
                        ctx.arc(p0.x, p0.y, Math.max(2, width / 3), 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }

                    if (geom) {
                        const steps = 8;
                        let totalSweep = geom.endAngle - geom.startAngle;
                        if (geom.ccw) { if (totalSweep > 0) totalSweep -= Math.PI * 2; } else { if (totalSweep < 0) totalSweep += Math.PI * 2; }
                        let prevArcX = geom.sx;
                        let prevArcY = geom.sy;
                        for (let s = 1; s <= steps; s++) {
                            const t = s / steps;
                            const angle = geom.startAngle + totalSweep * t;
                            const bx = geom.cx + Math.cos(angle) * geom.radius;
                            const by = geom.cy + Math.sin(angle) * geom.radius;
                            const p1Prog = i / points.length;
                            const wArc = resolveParam(params.strokeWidth, 'strokeWidth', stroke, p1.pressure, pointerRef.current.x, pointerRef.current.y, p1Prog, i);
                            const oArc = resolveParam(params.opacity, 'opacity', stroke, p1.pressure, pointerRef.current.x, pointerRef.current.y, p1Prog, i);
                            let cArc = params.color;
                            if (params.hueShift !== 0 || (params.audioToColor && P.isMicEnabled)) { 
                                let shift = params.hueShift; 
                                if (isModActive(params.modulations?.hueShift)) shift = resolveParam(shift, 'hueShift', stroke, p1.pressure, pointerRef.current.x, pointerRef.current.y, p1Prog, i); 
                                if (params.audioToColor && P.isMicEnabled) shift += (audioManager.getGlobalAudioData().mid / 255) * 180; 
                                cArc = getShiftedColor(cArc, shift); 
                            }
                            if (params.glowStrength > 0) { ctx.shadowColor = cArc; ctx.shadowBlur = params.glowStrength; } else { ctx.shadowBlur = 0; }
                            ctx.strokeStyle = cArc; ctx.lineWidth = Math.max(0.1, wArc); ctx.globalAlpha = oArc;
                            ctx.beginPath(); ctx.moveTo(prevArcX, prevArcY); ctx.lineTo(bx, by); ctx.stroke();
                            prevArcX = bx; prevArcY = by;
                        }
                        currentX = prevArcX; currentY = prevArcY;
                    } else { currentX = p1.x; currentY = p1.y; }
                }
                if (!params.closePath) {
                    const lastIdx = points.length - 1;
                    const pLast = points[lastIdx];
                    const width = resolveParam(params.strokeWidth, 'strokeWidth', stroke, pLast.pressure, pointerRef.current.x, pointerRef.current.y, 1, lastIdx);
                    const opacity = resolveParam(params.opacity, 'opacity', stroke, pLast.pressure, pointerRef.current.x, pointerRef.current.y, 1, lastIdx);
                    let c = params.color;
                    if (params.hueShift !== 0 || (params.audioToColor && P.isMicEnabled)) {
                         let shift = params.hueShift;
                         if (isModActive(params.modulations?.hueShift)) shift = resolveParam(shift, 'hueShift', stroke, pLast.pressure, pointerRef.current.x, pointerRef.current.y, 1, lastIdx);
                         if (params.audioToColor && P.isMicEnabled) shift += (audioManager.getGlobalAudioData().mid / 255) * 180;
                         c = getShiftedColor(c, shift);
                    }
                    ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.1, width); ctx.globalAlpha = opacity;
                    ctx.beginPath(); ctx.moveTo(currentX, currentY); ctx.lineTo(pLast.x, pLast.y); ctx.stroke();
                    
                    if (params.drawPoints) {
                        ctx.fillStyle = P.selectedStrokeIds.has(stroke.id) ? '#4f46e5' : c;
                        ctx.beginPath();
                        ctx.arc(pLast.x, pLast.y, Math.max(2, width / 3), 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
        ctx.filter = 'none';
      }
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  };
  const animate = (time: number) => {
    const P = latestProps.current;
    const needsUpdate = P.isPlaying || pointerRef.current.isDown || pointerRef.current.hasMoved || selectionBoxRef.current.active || needsRedrawRef.current;
    if (P.ecoMode && !needsUpdate) { /* Skip */ } else { updatePhysics(); draw(); needsRedrawRef.current = false; }
    reqRef.current = requestAnimationFrame(animate);
  };
  useEffect(() => {
    reqRef.current = requestAnimationFrame(animate);
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, []);
  return (
    <div ref={containerRef} className={`w-full h-full touch-none ${interactionMode === 'select' ? 'cursor-default' : 'cursor-crosshair'}`} style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
});