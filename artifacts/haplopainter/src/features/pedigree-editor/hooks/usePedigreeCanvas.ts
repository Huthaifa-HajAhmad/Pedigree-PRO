import { useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import type { PedigreeNode, CanvasData, DragState } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";
import { computeSnapRows, snapToNearestRow } from "@/features/pedigree-editor/utils/helpers";

export interface UsePedigreeCanvasParams {
  svgRef: React.RefObject<SVGSVGElement | null>;
  canvasNodes: PedigreeNode[];
  canvasAnnotations: CanvasData["annotations"];
  canvasEdges: CanvasData["edges"];
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setCanvas: Dispatch<SetStateAction<CanvasData>>;
  dragging: DragState | null;
  setDragging: Dispatch<SetStateAction<DragState | null>>;
  isDragging: boolean;
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  viewBox: { x: number; y: number; zoom: number };
  setViewBox: Dispatch<SetStateAction<{ x: number; y: number; zoom: number }>>;
  panning: { startX: number; startY: number; vbX: number; vbY: number } | null;
  setPanning: Dispatch<SetStateAction<{ startX: number; startY: number; vbX: number; vbY: number } | null>>;
  snapEnabled: boolean;
  snapRows: number[];
  setSnapRows: Dispatch<SetStateAction<number[]>>;
  annDragging: { annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number } } | null;
  setAnnDragging: Dispatch<SetStateAction<{ annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number } } | null>>;
  linkMode: "couple" | "parent-child" | "consanguinity" | null;
  lassoRef: React.MutableRefObject<{ startSVG: { x: number; y: number }; curSVG: { x: number; y: number } } | null>;
  isLassoingRef: React.MutableRefObject<boolean>;
  lassoRectRef: React.RefObject<SVGRectElement | null>;
  spaceHeldRef: React.MutableRefObject<boolean>;
  setLassoVisible: Dispatch<SetStateAction<boolean>>;
  preDragCanvasRef: React.MutableRefObject<CanvasData | null>;
  rafRef: React.MutableRefObject<number | null>;
  W: number;
  H: number;
  setHistory: Dispatch<SetStateAction<CanvasData[]>>;
  setFuture: Dispatch<SetStateAction<CanvasData[]>>;
  updateCanvas: (updater: (prev: CanvasData) => CanvasData, opts?: { skipHistory?: boolean }) => void;
  autoSave: (newCanvas: CanvasData) => void;
  canvasRef: React.RefObject<CanvasData | null>;
  draftEnabledRef: React.MutableRefObject<boolean>;
  draftKeyRef: React.MutableRefObject<string>;
}

export function usePedigreeCanvas(params: UsePedigreeCanvasParams) {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const svgRef = params.svgRef;
  const rafRef = params.rafRef;
  const preDragCanvasRef = params.preDragCanvasRef;
  const lassoRef = params.lassoRef;
  const isLassoingRef = params.isLassoingRef;
  const lassoRectRef = params.lassoRectRef;
  const spaceHeldRef = params.spaceHeldRef;
  const W = params.W;
  const H = params.H;

  const draggingRef = useRef(params.dragging);
  draggingRef.current = params.dragging;
  const isDraggingRef = useRef(params.isDragging);
  isDraggingRef.current = params.isDragging;

  const getSVGCoords = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    const p = paramsRef.current;
    if (p.linkMode) return;
    const coords = getSVGCoords(e);
    if (!coords) return;
    const movingIds = p.selectedIds.has(nodeId) ? p.selectedIds : new Set([nodeId]);
    if (!p.selectedIds.has(nodeId)) p.setSelectedIds(new Set([nodeId]));
    const rows = computeSnapRows(p.canvasNodes, movingIds);
    p.setSnapRows(rows);
    const initialPositions: Record<string, { x: number; y: number }> = {};
    for (const n of p.canvasNodes) {
      if (movingIds.has(n.id)) initialPositions[n.id] = { x: n.x, y: n.y };
    }
    preDragCanvasRef.current = {
      nodes: p.canvasNodes,
      edges: p.canvasEdges,
      annotations: JSON.parse(JSON.stringify(p.canvasAnnotations)),
    };
    p.setDragging({ primaryNodeId: nodeId, startSVG: coords, initialPositions });
    p.setIsDragging(false);
  }, [getSVGCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const p = paramsRef.current;
    if (p.annDragging) {
      const coords = getSVGCoords(e);
      if (!coords) return;
      const dx = coords.x - p.annDragging.startSVG.x;
      const dy = coords.y - p.annDragging.startSVG.y;
      p.setCanvas((prev) => ({
        ...prev,
        annotations: prev.annotations.map((a) =>
          a.id === p.annDragging!.annId
            ? { ...a, offsetX: p.annDragging!.initOffset.x + dx, offsetY: p.annDragging!.initOffset.y + dy }
            : a
        ),
      }));
      return;
    }
    const d = draggingRef.current;
    if (d) {
      const coords = getSVGCoords(e);
      if (!coords) return;
      const dx = coords.x - d.startSVG.x;
      const dy = coords.y - d.startSVG.y;
      if (!isDraggingRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) p.setIsDragging(true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        p.setCanvas((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => {
            const init = d.initialPositions[n.id];
            if (!init) return n;
            const rawY = init.y + dy;
            const newY = p.snapEnabled ? snapToNearestRow(rawY, p.snapRows) : rawY;
            return { ...n, x: init.x + dx, y: newY };
          }),
        }));
      });
      return;
    }
    if (p.panning) {
      const dx = (e.clientX - p.panning.startX) * p.viewBox.zoom;
      const dy = (e.clientY - p.panning.startY) * p.viewBox.zoom;
      p.setViewBox((prev) => ({ ...prev, x: p.panning!.vbX - dx, y: p.panning!.vbY - dy }));
    }
    if (lassoRef.current) {
      const coords = getSVGCoords(e);
      if (!coords) return;
      lassoRef.current.curSVG = coords;
      const dx = coords.x - lassoRef.current.startSVG.x;
      const dy = coords.y - lassoRef.current.startSVG.y;
      if (!isLassoingRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        isLassoingRef.current = true; p.setLassoVisible(true);
      }
      if (isLassoingRef.current && lassoRectRef.current) {
        const x1 = Math.min(lassoRef.current.startSVG.x, coords.x);
        const y1 = Math.min(lassoRef.current.startSVG.y, coords.y);
        const w  = Math.abs(coords.x - lassoRef.current.startSVG.x);
        const h  = Math.abs(coords.y - lassoRef.current.startSVG.y);
        lassoRectRef.current.setAttribute("x", String(x1));
        lassoRectRef.current.setAttribute("y", String(y1));
        lassoRectRef.current.setAttribute("width",  String(w));
        lassoRectRef.current.setAttribute("height", String(h));
        lassoRectRef.current.style.display = "";
      }
    }
  }, [getSVGCoords]);

  const handleMouseUp = useCallback(() => {
    const p = paramsRef.current;
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (draggingRef.current && isDraggingRef.current) {
      const movedIds = new Set(Object.keys(draggingRef.current.initialPositions));
      const preDrag = preDragCanvasRef.current;
      preDragCanvasRef.current = null;
      p.updateCanvas((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => movedIds.has(n.id) ? { ...n, pinned: true } : n),
      }), { skipHistory: !!preDrag });
      if (preDrag) { p.setHistory((h) => [...h.slice(-49), preDrag]); p.setFuture([]); }
    }
    if (lassoRef.current) {
      if (isLassoingRef.current) {
        const { startSVG, curSVG } = lassoRef.current;
        const x1 = Math.min(startSVG.x, curSVG.x), x2 = Math.max(startSVG.x, curSVG.x);
        const y1 = Math.min(startSVG.y, curSVG.y), y2 = Math.max(startSVG.y, curSVG.y);
        const half = NODE_SIZE / 2;
        const enclosed = p.canvasNodes.filter(
          (n) => n.x + half >= x1 && n.x - half <= x2 && n.y + half >= y1 && n.y - half <= y2
        );
        p.setSelectedIds(new Set(enclosed.map((n) => n.id)));
      } else { p.setSelectedIds(new Set()); }
    }
    lassoRef.current = null; isLassoingRef.current = false; p.setLassoVisible(false);
    if (lassoRectRef.current) lassoRectRef.current.style.display = "none";
    p.setDragging(null); p.setIsDragging(false); p.setSnapRows([]); p.setPanning(null);
    if (p.annDragging) {
      const preDrag = preDragCanvasRef.current; preDragCanvasRef.current = null;
      if (preDrag) { p.setHistory((h) => [...h.slice(-49), preDrag]); p.setFuture([]); }
      if (p.canvasRef.current) {
        if (p.draftEnabledRef.current) {
          try { localStorage.setItem(p.draftKeyRef.current, JSON.stringify({ canvas: p.canvasRef.current, at: Date.now() })); } catch {}
        }
      }
    }
    p.setAnnDragging(null);
  }, []);

  const handleSVGMouseDown = useCallback((e: React.MouseEvent) => {
    const p = paramsRef.current;
    if (e.target !== svgRef.current) return;
    if (e.button === 1 || e.button === 2 || e.altKey || spaceHeldRef.current) {
      e.preventDefault();
      p.setPanning({ startX: e.clientX, startY: e.clientY, vbX: p.viewBox.x, vbY: p.viewBox.y });
      return;
    }
    const coords = getSVGCoords(e);
    if (!coords) return;
    lassoRef.current = { startSVG: coords, curSVG: coords };
    isLassoingRef.current = false; p.setLassoVisible(false);
    if (lassoRectRef.current) lassoRectRef.current.style.display = "none";
  }, [getSVGCoords]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const svgW = rect.width, svgH = rect.height;
    const zoomAt = (factor: number) => {
      paramsRef.current.setViewBox((prev: { x: number; y: number; zoom: number }) => {
        const newZoom = Math.min(4, Math.max(0.25, prev.zoom * factor));
        const vbW = 1400 * prev.zoom, vbH = 900 * prev.zoom;
        const newVbW = 1400 * newZoom, newVbH = 900 * newZoom;
        const cx = prev.x + (px / svgW) * vbW;
        const cy = prev.y + (py / svgH) * vbH;
        return { x: cx - (px / svgW) * newVbW, y: cy - (py / svgH) * newVbH, zoom: newZoom };
      });
    };
    if (e.ctrlKey) { zoomAt(Math.pow(0.992, e.deltaY)); return; }
    if (e.shiftKey) { paramsRef.current.setViewBox((prev: { x: number; y: number; zoom: number }) => ({ ...prev, x: prev.x + e.deltaY * prev.zoom * 0.6 })); return; }
    const hasHoriz = Math.abs(e.deltaX) > 1;
    const isSmooth = e.deltaMode === 0 && Math.abs(e.deltaY) < 50;
    if (hasHoriz || isSmooth) {
      paramsRef.current.setViewBox((prev: { x: number; y: number; zoom: number }) => ({
        ...prev,
        x: prev.x + e.deltaX * prev.zoom * 0.8,
        y: prev.y + e.deltaY * prev.zoom * 0.8,
      }));
      return;
    }
    zoomAt(Math.pow(1.0003, -e.deltaY));
  }, []);

  const fitToScreen = useCallback(() => {
    const p = paramsRef.current;
    if (p.canvasNodes.length === 0) return;
    const pad = NODE_SIZE * 3;
    const xs = p.canvasNodes.map((n) => n.x), ys = p.canvasNodes.map((n) => n.y);
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad + NODE_SIZE;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad + NODE_SIZE;
    const spanX = maxX - minX, spanY = maxY - minY;
    const zoom = Math.max(0.2, Math.min(Math.max(spanX / W, spanY / H), 1.5));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    p.setViewBox({ x: cx - (W * zoom) / 2, y: cy - (H * zoom) / 2, zoom });
  }, []);

  return {
    getSVGCoords,
    handleDragStart,
    handleMouseMove,
    handleMouseUp,
    handleSVGMouseDown,
    handleWheel,
    fitToScreen,
  };
}