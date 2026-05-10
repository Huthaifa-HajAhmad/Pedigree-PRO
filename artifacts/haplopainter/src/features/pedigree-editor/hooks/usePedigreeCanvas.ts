import { useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import type { PedigreeNode, CanvasData, DragState } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";
import { computeSnapRows, snapToNearestRow } from "@/features/pedigree-editor/utils/helpers";

export interface UsePedigreeCanvasParams {
  svgRef: React.RefObject<SVGSVGElement | null>;
  canvasNodes: PedigreeNode[];
  canvasAnnotations: CanvasData["annotations"];
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
  const {
    svgRef, canvasNodes, canvasAnnotations,
    selectedIds, setSelectedIds,
    setCanvas, viewBox, setViewBox,
    panning, setPanning,
    snapEnabled, snapRows, setSnapRows,
    annDragging, linkMode, lassoRef, isLassoingRef,
    lassoRectRef, spaceHeldRef, setLassoVisible,
    preDragCanvasRef, rafRef, W, H,
    setHistory, setFuture, updateCanvas, autoSave,
    canvasRef, draftEnabledRef, draftKeyRef,
    setAnnDragging,
  } = params;

  const draggingRef = useRef(params.dragging);
  draggingRef.current = params.dragging;
  const isDraggingRef = useRef(params.isDragging);
  isDraggingRef.current = params.isDragging;

  const getSVGCoords = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (linkMode) return;
    const coords = getSVGCoords(e);
    const node = canvasNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const movingIds = selectedIds.has(nodeId) ? selectedIds : new Set([nodeId]);
    if (!selectedIds.has(nodeId)) setSelectedIds(new Set([nodeId]));
    const rows = computeSnapRows(canvasNodes, movingIds);
    setSnapRows(rows);
    const initialPositions: Record<string, { x: number; y: number }> = {};
    for (const n of canvasNodes) {
      if (movingIds.has(n.id)) initialPositions[n.id] = { x: n.x, y: n.y };
    }
    preDragCanvasRef.current = {
      nodes: canvasNodes,
      edges: [],
      annotations: canvasAnnotations as any,
    };
    params.setDragging({ primaryNodeId: nodeId, startSVG: coords, initialPositions });
    params.setIsDragging(false);
  }, [linkMode, getSVGCoords, canvasNodes, selectedIds]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (annDragging) {
      const coords = getSVGCoords(e);
      const dx = coords.x - annDragging.startSVG.x;
      const dy = coords.y - annDragging.startSVG.y;
      setCanvas((prev) => ({
        ...prev,
        annotations: prev.annotations.map((a) =>
          a.id === annDragging.annId
            ? { ...a, offsetX: annDragging.initOffset.x + dx, offsetY: annDragging.initOffset.y + dy }
            : a
        ),
      }));
      return;
    }
    const d = draggingRef.current;
    if (d) {
      const coords = getSVGCoords(e);
      const dx = coords.x - d.startSVG.x;
      const dy = coords.y - d.startSVG.y;
      if (!isDraggingRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) params.setIsDragging(true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setCanvas((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => {
            const init = d.initialPositions[n.id];
            if (!init) return n;
            const rawY = init.y + dy;
            const newY = snapEnabled ? snapToNearestRow(rawY, snapRows) : rawY;
            return { ...n, x: init.x + dx, y: newY };
          }),
        }));
      });
      return;
    }
    if (panning) {
      const dx = (e.clientX - panning.startX) * viewBox.zoom;
      const dy = (e.clientY - panning.startY) * viewBox.zoom;
      setViewBox((prev) => ({ ...prev, x: panning.vbX - dx, y: panning.vbY - dy }));
    }
    if (lassoRef.current) {
      const coords = getSVGCoords(e);
      lassoRef.current.curSVG = coords;
      const dx = coords.x - lassoRef.current.startSVG.x;
      const dy = coords.y - lassoRef.current.startSVG.y;
      if (!isLassoingRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        isLassoingRef.current = true; setLassoVisible(true);
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
  }, [annDragging, params]);

  const handleMouseUp = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (draggingRef.current && isDraggingRef.current) {
      const movedIds = new Set(Object.keys(draggingRef.current.initialPositions));
      const preDrag = preDragCanvasRef.current;
      preDragCanvasRef.current = null;
      updateCanvas((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => movedIds.has(n.id) ? { ...n, pinned: true } : n),
      }), { skipHistory: !!preDrag });
      if (preDrag) { setHistory((h) => [...h.slice(-49), preDrag]); setFuture([]); }
    }
    if (lassoRef.current) {
      if (isLassoingRef.current) {
        const { startSVG, curSVG } = lassoRef.current;
        const x1 = Math.min(startSVG.x, curSVG.x), x2 = Math.max(startSVG.x, curSVG.x);
        const y1 = Math.min(startSVG.y, curSVG.y), y2 = Math.max(startSVG.y, curSVG.y);
        const half = NODE_SIZE / 2;
        const enclosed = canvasNodes.filter(
          (n) => n.x + half >= x1 && n.x - half <= x2 && n.y + half >= y1 && n.y - half <= y2
        );
        setSelectedIds(new Set(enclosed.map((n) => n.id)));
      } else { setSelectedIds(new Set()); }
    }
    lassoRef.current = null; isLassoingRef.current = false; setLassoVisible(false);
    if (lassoRectRef.current) lassoRectRef.current.style.display = "none";
    params.setDragging(null); params.setIsDragging(false); setSnapRows([]); setPanning(null);
    if (annDragging) {
      const preDrag = preDragCanvasRef.current; preDragCanvasRef.current = null;
      if (preDrag) { setHistory((h) => [...h.slice(-49), preDrag]); setFuture([]); }
      autoSave(canvasRef.current!);
      if (draftEnabledRef.current) {
        try { localStorage.setItem(draftKeyRef.current, JSON.stringify({ canvas: canvasRef.current, at: Date.now() })); } catch {}
      }
    }
    setAnnDragging(null);
  }, [params, annDragging]);

  const handleSVGMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== svgRef.current) return;
    if (e.button === 1 || e.button === 2 || e.altKey || spaceHeldRef.current) {
      e.preventDefault();
      setPanning({ startX: e.clientX, startY: e.clientY, vbX: viewBox.x, vbY: viewBox.y });
      return;
    }
    const coords = getSVGCoords(e);
    lassoRef.current = { startSVG: coords, curSVG: coords };
    isLassoingRef.current = false; setLassoVisible(false);
    if (lassoRectRef.current) lassoRectRef.current.style.display = "none";
  }, [viewBox, getSVGCoords]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const svgW = rect.width, svgH = rect.height;
    const zoomAt = (factor: number) => {
      setViewBox((prev) => {
        const newZoom = Math.min(4, Math.max(0.25, prev.zoom * factor));
        const vbW = 1400 * prev.zoom, vbH = 900 * prev.zoom;
        const newVbW = 1400 * newZoom, newVbH = 900 * newZoom;
        const cx = prev.x + (px / svgW) * vbW;
        const cy = prev.y + (py / svgH) * vbH;
        return { x: cx - (px / svgW) * newVbW, y: cy - (py / svgH) * newVbH, zoom: newZoom };
      });
    };
    if (e.ctrlKey) { zoomAt(Math.pow(0.992, e.deltaY)); return; }
    if (e.shiftKey) { setViewBox((prev) => ({ ...prev, x: prev.x + e.deltaY * prev.zoom * 0.6 })); return; }
    const hasHoriz = Math.abs(e.deltaX) > 1;
    const isSmooth = e.deltaMode === 0 && Math.abs(e.deltaY) < 50;
    if (hasHoriz || isSmooth) {
      setViewBox((prev) => ({
        ...prev,
        x: prev.x + e.deltaX * prev.zoom * 0.8,
        y: prev.y + e.deltaY * prev.zoom * 0.8,
      }));
      return;
    }
    zoomAt(Math.pow(1.0003, -e.deltaY));
  }, []);

  const fitToScreen = useCallback(() => {
    if (canvasNodes.length === 0) return;
    const pad = NODE_SIZE * 3;
    const xs = canvasNodes.map((n) => n.x), ys = canvasNodes.map((n) => n.y);
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad + NODE_SIZE;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad + NODE_SIZE;
    const spanX = maxX - minX, spanY = maxY - minY;
    const zoom = Math.max(0.2, Math.min(Math.max(spanX / W, spanY / H), 1.5));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setViewBox({ x: cx - (W * zoom) / 2, y: cy - (H * zoom) / 2, zoom });
  }, [canvasNodes]);

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