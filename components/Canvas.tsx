
import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Stroke, SimulationParams, ModulationConfig, SoundConfig, GlobalForceType, GlobalToolConfig } from '../types';
import { audioManager } from '../services/audioService';

interface CanvasProps {
  brushParams: SimulationParams;
  brushSound: SoundConfig;
  selectedStrokeId: string | null;
  selectedStrokeParams: SimulationParams | null;
  isPlaying: boolean;
  isAudioEnabled: boolean;
  interactionMode: 'draw' | 'select';
  globalForceTool: GlobalForceType;
  globalToolConfig: GlobalToolConfig;
  ecoMode: boolean;
  onClear: () => void;
  clearTrigger: number;
  deleteSelectedTrigger: number;
  undoTrigger: number;
  redoTrigger: number;
  resetPosTrigger: number;
  onStrokeSelect: (strokeId: string | null, params: SimulationParams | null, sound: SoundConfig | null) => void;
}

export interface CanvasHandle {
  exportData: () => Stroke[];
  importData: (data: Stroke[]) => void;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ 
  brushParams,
  brushSound,
  selectedStrokeId,
  selectedStrokeParams,
  isPlaying, 
  isAudioEnabled, 
  interactionMode,
  globalForceTool,
  globalToolConfig,
  ecoMode,
  clearTrigger,
  deleteSelectedTrigger,
  undoTrigger,
  redoTrigger,
  resetPosTrigger,
  onStrokeSelect
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const timeRef = useRef<number>(0);
  const reqRef = useRef<number>();
  const pointerRef = useRef({ x: -1000, y: -1000, isDown: false, startX: 0, startY: 0, lastX: 0, lastY: 0, hasMoved: false });
  const lastFrameTimeRef = useRef<number>(0);

  const historyRef = useRef<Stroke[][]>([]);
  const redoStackRef = useRef<Stroke[][]>([]);
  const preDrawSnapshotRef = useRef<Stroke[]>([]);

  useImperativeHandle(ref, () => ({
    exportData: () => cloneStrokes(strokesRef.current),
    importData: (data: Stroke[]) => {
      if (Array.isArray(data)) {
        saveToHistory(strokesRef.current);
        strokesRef.current = cloneStrokes(data);
        onStrokeSelect(null, null, null);
      }
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

  const saveToHistory = (currentStrokes: Stroke[]) => {
    const snapshot = cloneStrokes(currentStrokes);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 30) historyRef.current.shift();
    redoStackRef.current = [];
  };

  const handleResize = useCallback(() => {
    if (canvasRef.current && containerRef.current) {
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Triggers
  useEffect(() => {
    if (clearTrigger > 0) {
      saveToHistory(strokesRef.current);
      strokesRef.current = [];
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      onStrokeSelect(null, null, null);
    }
  }, [clearTrigger]);

  useEffect(() => {
    if (deleteSelectedTrigger > 0 && selectedStrokeId) {
      saveToHistory(strokesRef.current);
      strokesRef.current = strokesRef.current.filter(s => s.id !== selectedStrokeId);
      onStrokeSelect(null, null, null);
    }
  }, [deleteSelectedTrigger]);

  useEffect(() => {
    if (resetPosTrigger > 0) {
      strokesRef.current.forEach(s => {
        s.velocity = { x: 0, y: 0 };
        s.points.forEach(p => {
          p.x = p.baseX;
          p.y = p.baseY;
          p.vx = 0;
          p.vy = 0;
        });
      });
    }
  }, [resetPosTrigger]);

  useEffect(() => {
    if (undoTrigger > 0 && historyRef.current.length > 0) {
      const previousState = historyRef.current.pop();
      if (previousState) {
        redoStackRef.current.push(cloneStrokes(strokesRef.current));
        strokesRef.current = previousState;
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
        historyRef.current.push(cloneStrokes(strokesRef.current));
        strokesRef.current = nextState;
      }
    }
  }, [redoTrigger]);

  useEffect(() => {
    if (selectedStrokeId && selectedStrokeParams) {
      const stroke = strokesRef.current.find(s => s.id === selectedStrokeId);
      if (stroke) stroke.params = { ...selectedStrokeParams };
    }
  }, [selectedStrokeParams, selectedStrokeId]);

  // --- HIT DETECTION & INPUT ---
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

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pointerRef.current = { ...pointerRef.current, isDown: true, x, y, startX: x, startY: y, lastX: x, lastY: y, hasMoved: false };

    // If using a global force tool, interact immediately and skip selection/drawing
    if (globalForceTool !== 'none') {
       return; 
    }

    if (interactionMode === 'select') {
      const hitStroke = getStrokeAtPosition(x, y);
      onStrokeSelect(hitStroke?.id || null, hitStroke?.params || null, hitStroke?.sound || null);
      return;
    }

    if (selectedStrokeId) onStrokeSelect(null, null, null);

    preDrawSnapshotRef.current = cloneStrokes(strokesRef.current);

    const id = Date.now().toString();
    const newStroke: Stroke = {
      id,
      points: [{ x, y, baseX: x, baseY: y, vx: 0, vy: 0, pressure: 0.5 }],
      center: { x, y },
      velocity: { x: 0, y: 0 },
      params: JSON.parse(JSON.stringify(brushParams)),
      sound: JSON.parse(JSON.stringify(brushSound)), // Use passed brush sound
      createdAt: Date.now(),
      phaseOffset: Math.random() * 100,
      randomSeed: Math.random()
    };
    currentStrokeRef.current = newStroke;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pointerRef.current.x = x;
    pointerRef.current.y = y;

    if (globalForceTool !== 'none') return;
    if (interactionMode === 'select') return;

    if (pointerRef.current.isDown && currentStrokeRef.current) {
      const distSq = (x - pointerRef.current.startX) ** 2 + (y - pointerRef.current.startY) ** 2;
      if (distSq > 25) pointerRef.current.hasMoved = true;

      if (pointerRef.current.hasMoved && !strokesRef.current.includes(currentStrokeRef.current)) {
         strokesRef.current.push(currentStrokeRef.current);
      }

      if (pointerRef.current.hasMoved) {
        const stroke = currentStrokeRef.current;
        const lastP = stroke.points[stroke.points.length - 1];
        if (((x - lastP.x) ** 2 + (y - lastP.y) ** 2) >= stroke.params.segmentation ** 2) {
          const speed = Math.hypot(x - pointerRef.current.lastX, y - pointerRef.current.lastY);
          const pressure = Math.min(1, Math.max(0.01, speed / 30)); 

          stroke.points.push({ x, y, baseX: x, baseY: y, vx: 0, vy: 0, pressure });
          stroke.center.x = (stroke.center.x * (stroke.points.length - 1) + x) / stroke.points.length;
          stroke.center.y = (stroke.center.y * (stroke.points.length - 1) + y) / stroke.points.length;

          pointerRef.current.lastX = x;
          pointerRef.current.lastY = y;
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    pointerRef.current.isDown = false;
    
    if (globalForceTool !== 'none') return;
    if (interactionMode === 'select') return;
    
    if (pointerRef.current.hasMoved) {
      historyRef.current.push(preDrawSnapshotRef.current);
      if (historyRef.current.length > 30) historyRef.current.shift();
      redoStackRef.current = [];
    }
    currentStrokeRef.current = null;
  };

  // --- GENERIC MODULATION RESOLVER ---
  const resolveParam = (
    baseValue: number, 
    key: keyof SimulationParams, 
    stroke: Stroke, 
    pointPressure: number, 
    cursorDist: number, 
    cursorRadius: number,
    progress: number
  ): number => {
    const config = stroke.params.modulations?.[key];
    if (!config) return baseValue;

    const { source, min, max } = config;
    if (source === 'none') return baseValue;

    let t = 0; 

    switch (source) {
      case 'random':
        t = stroke.randomSeed ?? 0.5;
        break;
      case 'velocity':
        t = pointPressure;
        break;
      case 'pressure':
        t = pointPressure; 
        break;
      case 'cursor':
        if (cursorDist < cursorRadius) {
          t = 1 - (cursorDist / cursorRadius);
        } else {
          t = 0;
        }
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
    
    return min + (max - min) * t;
  };

  // --- PHYSICS LOOP ---
  const updatePhysics = () => {
    if (!isPlaying) return;
    timeRef.current += 0.01;
    const globalAudio = isAudioEnabled ? audioManager.getGlobalAudioData() : { average: 0, low: 0, mid: 0, high: 0 };
    const globalBass = globalAudio.low / 255;
    
    const strokes = strokesRef.current;
    const pointerX = pointerRef.current.x;
    const pointerY = pointerRef.current.y;
    const hasPointer = pointerX > -100;
    
    // Calculate global mouse velocity for audio effects
    const mouseSpeed = hasPointer ? Math.hypot(pointerX - pointerRef.current.lastX, pointerY - pointerRef.current.lastY) : 0;
    pointerRef.current.lastX = pointerX;
    pointerRef.current.lastY = pointerY;

    // GLOBAL FORCE TOOL LOGIC (NEW: Hover or Click)
    const isGlobalToolActive = globalForceTool !== 'none' && (pointerRef.current.isDown || globalToolConfig.trigger === 'hover');
    
    if (isGlobalToolActive && hasPointer) {
       for (const stroke of strokes) {
          // Use Global Tool Config parameters
          const influenceRadius = globalToolConfig.radius;
          const strength = globalToolConfig.force * 2; // Scaling factor for impact

          for (const p of stroke.points) {
             const dx = pointerX - p.x;
             const dy = pointerY - p.y;
             const dSq = dx*dx + dy*dy;
             
             if (dSq < influenceRadius * influenceRadius) {
                const dist = Math.sqrt(dSq);
                // Linear falloff for smoother tool feel
                const forceMag = (1 - dist / influenceRadius) * strength; 
                
                if (globalForceTool === 'repulse') {
                   p.vx -= (dx / dist) * forceMag;
                   p.vy -= (dy / dist) * forceMag;
                } else if (globalForceTool === 'attract') {
                   p.vx += (dx / dist) * forceMag;
                   p.vy += (dy / dist) * forceMag;
                } else if (globalForceTool === 'vortex') {
                   // Perpendicular force: (-dy, dx)
                   p.vx += (-dy / dist) * forceMag;
                   p.vy += (dx / dist) * forceMag;
                }
             }
          }
       }
    }

    for (const stroke of strokes) {
      let cx = 0, cy = 0, len = stroke.points.length;
      let totalSpeed = 0;

      if (len === 0) continue;
      for (const p of stroke.points) { 
          cx += p.x; cy += p.y; 
          totalSpeed += Math.hypot(p.vx, p.vy);
      }
      stroke.center.x = cx / len; stroke.center.y = cy / len;
      
      const avgStrokeSpeed = totalSpeed / len; // Kinetic energy of the stroke

      const cursorDistCenter = hasPointer ? Math.hypot(pointerX - stroke.center.x, pointerY - stroke.center.y) : 10000;
      const influenceRadius = stroke.params.mouseInfluenceRadius || 150;
      
      // Update Audio for this stroke (With Physics Velocity Modulation)
      if (isAudioEnabled && stroke.sound.bufferId) {
          audioManager.updateStrokeSound(
            stroke.id, 
            stroke.sound.bufferId, 
            { 
              volume: stroke.sound.baseVolume, 
              pitch: stroke.sound.pitch, 
              reverb: stroke.sound.reverbSend,
              motionSensitivity: stroke.sound.motionSensitivity || 0 
            },
            cursorDistCenter, 
            mouseSpeed,
            avgStrokeSpeed * 20 // scale up logic speed to audio gain
          );
      }

      for (let j = 0; j < stroke.points.length; j++) {
        const p = stroke.points[j];
        const progress = j / (stroke.points.length - 1 || 1);
        const cursorDistPoint = hasPointer ? Math.hypot(pointerX - p.x, pointerY - p.y) : 10000;

        const mass = resolveParam(stroke.params.mass, 'mass', stroke, p.pressure, cursorDistPoint, influenceRadius, progress);
        const friction = resolveParam(stroke.params.friction, 'friction', stroke, p.pressure, cursorDistPoint, influenceRadius, progress);
        const tension = resolveParam(stroke.params.tension, 'tension', stroke, p.pressure, cursorDistPoint, influenceRadius, progress);
        const wiggleAmp = resolveParam(stroke.params.wiggleAmplitude, 'wiggleAmplitude', stroke, p.pressure, cursorDistPoint, influenceRadius, progress);
        
        const mouseRep = resolveParam(stroke.params.mouseRepulsion, 'mouseRepulsion', stroke, p.pressure, cursorDistPoint, influenceRadius, progress);
        const mouseAttr = resolveParam(stroke.params.mouseAttraction, 'mouseAttraction', stroke, p.pressure, cursorDistPoint, influenceRadius, progress);
        const elasticity = resolveParam(stroke.params.elasticity, 'elasticity', stroke, p.pressure, cursorDistPoint, influenceRadius, progress);
        
        const rGravityX = resolveParam(stroke.params.gravityX, 'gravityX', stroke, p.pressure, cursorDistPoint, influenceRadius, progress);
        const rGravityY = resolveParam(stroke.params.gravityY, 'gravityY', stroke, p.pressure, cursorDistPoint, influenceRadius, progress);

        const mouseFalloff = stroke.params.mouseFalloff || 1;

        const effectiveMass = Math.max(0.1, mass);
        const invMass = 1 / effectiveMass;
        const gravX = rGravityX * effectiveMass;
        const gravY = rGravityY * effectiveMass;
        const frictionFactor = friction * (1 - stroke.params.viscosity * 0.1);
        
        const isWiggling = wiggleAmp > 0 || tension > 0 || (stroke.params.audioToWiggle && globalBass > 0.1);

        const springX = (p.baseX - p.x) * elasticity;
        const springY = (p.baseY - p.y) * elasticity;

        let fx = springX + gravX;
        let fy = springY + gravY;

        if (isWiggling) {
            const phase = (j * stroke.params.wiggleFrequency) + (timeRef.current * stroke.params.waveSpeed) + stroke.phaseOffset;
            let noiseX = Math.sin(phase) * wiggleAmp;
            let noiseY = Math.cos(phase + 2.3) * wiggleAmp;
            
            if (tension > 0) {
               noiseX += (Math.random() - 0.5) * tension;
               noiseY += (Math.random() - 0.5) * tension;
            }

            if (stroke.params.audioToWiggle) {
               const boost = 1 + globalBass * stroke.params.audioSensitivity * 5;
               noiseX *= boost; noiseY *= boost;
            }
            fx += noiseX * 0.1;
            fy += noiseY * 0.1;
        }

        p.vx += fx * invMass;
        p.vy += fy * invMass;

        // Local Mouse Interaction (Only if Global Tool NOT active)
        if (hasPointer && globalForceTool === 'none' && (mouseRep > 0 || mouseAttr > 0)) {
           const dx = pointerX - p.x;
           const dy = pointerY - p.y;
           const dSq = dx*dx + dy*dy;
           const influenceRadSq = influenceRadius * influenceRadius;
           
           if (dSq < influenceRadSq) { 
             const dist = Math.sqrt(dSq);
             // Non-linear falloff
             const rawForce = 1 - (dist / influenceRadius);
             const force = Math.pow(rawForce, mouseFalloff);
             
             if (mouseRep > 0) {
               p.vx -= (dx / dist) * force * mouseRep;
               p.vy -= (dy / dist) * force * mouseRep;
             }
             if (mouseAttr > 0) {
               p.vx += (dx / dist) * force * mouseAttr;
               p.vy += (dy / dist) * force * mouseAttr;
             }
           }
        }

        p.vx *= frictionFactor;
        p.vy *= frictionFactor;
        p.x += p.vx;
        p.y += p.vy;
      }
    }
  };

  const render = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const audio = isAudioEnabled ? audioManager.getGlobalAudioData() : { average: 0, low: 0, high: 0 };
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

      let opacity = resolveParam(stroke.params.opacity, 'opacity', stroke, avgPressure, centerDist, influenceRadius, 0.5);
      let glow = resolveParam(stroke.params.glowStrength, 'glowStrength', stroke, avgPressure, centerDist, influenceRadius, 0.5);
      const blur = resolveParam(stroke.params.blurStrength, 'blurStrength', stroke, avgPressure, centerDist, influenceRadius, 0.5);
      
      const isPathModulated = 
        stroke.params.modulations?.strokeWidth?.source === 'path' || 
        stroke.params.modulations?.opacity?.source === 'path' ||
        stroke.params.modulations?.strokeWidth?.source === 'path-mirror' || 
        stroke.params.modulations?.opacity?.source === 'path-mirror' ||
        stroke.params.modulations?.strokeWidth?.source === 'path-mirror-inv' || 
        stroke.params.modulations?.opacity?.source === 'path-mirror-inv';

      opacity = Math.max(0, Math.min(1, opacity));

      ctx.save();
      if (!isPathModulated) ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = stroke.params.blendMode;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (isSelected) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#ffffff';
      } else if (glow > 0) {
          ctx.shadowBlur = glow;
          ctx.shadowColor = stroke.params.color;
      } else {
          ctx.shadowBlur = 0;
      }

      if (blur > 0) ctx.filter = `blur(${blur}px)`;
      else ctx.filter = 'none';
      
      let baseWidth = stroke.params.strokeWidth;
      if (stroke.params.breathingAmp > 0) baseWidth += Math.sin(timeRef.current * stroke.params.breathingFreq * 10) * stroke.params.breathingAmp;
      if (isAudioEnabled && stroke.params.audioToWidth) baseWidth += (bass * stroke.params.audioSensitivity * 20);

      ctx.strokeStyle = stroke.params.color;

      if (stroke.params.seamlessPath && !isPathModulated) {
         const finalWidth = resolveParam(baseWidth, 'strokeWidth', stroke, avgPressure, centerDist, influenceRadius, 0.5);
         ctx.lineWidth = Math.max(0.5, finalWidth);
         ctx.beginPath();
         const pts = stroke.points;
         ctx.moveTo(pts[0].x, pts[0].y);
         for (let i = 1; i < pts.length - 1; i++) {
           const p0 = pts[i];
           const p1 = pts[i + 1];
           ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
         }
         const last = pts[pts.length - 1];
         ctx.lineTo(last.x, last.y);
         ctx.stroke();

      } else {
        const pts = stroke.points;
        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i+1];
            const progress = i / (pts.length - 1 || 1);
            
            if (isPathModulated) {
                ctx.globalAlpha = resolveParam(stroke.params.opacity, 'opacity', stroke, avgPressure, centerDist, influenceRadius, progress);
            } else {
               ctx.globalAlpha = opacity;
            }

            const segPressure = (p1.pressure + p2.pressure) / 2;
            const mx = (p1.x + p2.x) / 2; 
            const my = (p1.y + p2.y) / 2;
            const segDist = hasPointer ? Math.hypot(pointerX - mx, pointerY - my) : 10000;

            const finalWidth = resolveParam(baseWidth, 'strokeWidth', stroke, segPressure, segDist, influenceRadius, progress);
            
            ctx.beginPath();
            ctx.lineWidth = Math.max(0.5, finalWidth);
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
      }
      ctx.restore();

      if (isSelected) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.filter = 'none';
        ctx.strokeStyle = '#6366f1'; 
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const pts = stroke.points;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
           ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i+1].x)/2, (pts[i].y + pts[i+1].y)/2);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const loop = (timestamp: number) => {
    if (ecoMode) {
        const elapsed = timestamp - lastFrameTimeRef.current;
        if (elapsed < 33) { 
            reqRef.current = requestAnimationFrame(loop);
            return; 
        }
        lastFrameTimeRef.current = timestamp - (elapsed % 33);
    }
    updatePhysics();
    render();
    reqRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    reqRef.current = requestAnimationFrame(loop);
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [isPlaying, isAudioEnabled, selectedStrokeId, interactionMode, globalForceTool, ecoMode]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 touch-none bg-[#fdfcf8]">
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
