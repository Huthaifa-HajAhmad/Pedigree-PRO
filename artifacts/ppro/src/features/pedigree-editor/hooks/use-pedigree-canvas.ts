import { useRef, useCallback } from "react";
import type { CanvasData, DragState } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";
import { computeSnapRows, snapToNearestRow } from "@/features/pedigree-editor/utils/helpers";
import type { PedigreeEditorState, PedigreeEditorAction } from "@/features/pedigree-editor/context/types";

interface UsePedigreeCanvasParams {
  stateRef: React.MutableRefObject<PedigreeEditorState>;
  dispatch: React.Dispatch<PedigreeEditorAction>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  lassoRef: React.MutableRefObject<{ startSVG: { x: number; y: number }; curSVG: { x: number; y: number } } | null>;
  isLassoingRef: React.MutableRefObject<boolean>;
  lassoRectRef: React.RefObject<SVGRectElement | null>;
  spaceHeldRef: React.MutableRefObject<boolean>;
  preDragCanvasRef: React.MutableRefObject<CanvasData | null>;
  rafRef: React.MutableRefObject<number | null>;
  canvasRef: React.MutableRefObject<CanvasData | null>;
  draftEnabledRef: React.MutableRefObject<boolean>;
  draftKeyRef: React.MutableRefObject<string>;
}

export function usePedigreeCanvas(params: UsePedigreeCanvasParams) {
  const {
    stateRef, dispatch,
    svgRef, lassoRef, isLassoingRef, lassoRectRef,
    spaceHeldRef, preDragCanvasRef, rafRef, canvasRef,
    draftEnabledRef, draftKeyRef,
  } = params;

  const draggingRef = useRef<DragState | null>(null);
  const isDraggingRef = useRef(false);

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
    const s = stateRef.current;
    if (s.linkMode) return;
    const coords = getSVGCoords(e);
    if (!coords) return;
    const movingIds = s.selectedIds.has(nodeId) ? s.selectedIds : new Set([nodeId]);
    if (!s.selectedIds.has(nodeId)) {
      dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nodeId]) } });
    }
    const rows = computeSnapRows(s.canvas.nodes, movingIds);
    const initialPositions: Record<string, { x: number; y: number }> = {};
    for (const n of s.canvas.nodes) {
      if (movingIds.has(n.id)) initialPositions[n.id] = { x: n.x, y: n.y };
    }
    preDragCanvasRef.current = {
      nodes: s.canvas.nodes,
      edges: s.canvas.edges,
      annotations: JSON.parse(JSON.stringify(s.canvas.annotations)),
    };
    const d: DragState = { primaryNodeId: nodeId, startSVG: coords, initialPositions };
    draggingRef.current = d;
    isDraggingRef.current = false;
    dispatch({ type: "SET_STATE", patch: { dragging: d, isDragging: false, snapRows: rows } });
  }, [getSVGCoords, dispatch, stateRef, preDragCanvasRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const s = stateRef.current;
    if (s.annDragging) {
      const coords = getSVGCoords(e);
      if (!coords) return;
      const dx = coords.x - s.annDragging.startSVG.x;
      const dy = coords.y - s.annDragging.startSVG.y;
      dispatch({
        type: "UPDATE_CANVAS",
        updater: (prev: CanvasData) => ({
          ...prev,
          annotations: prev.annotations.map((a) =>
            a.id === s.annDragging!.annId
              ? { ...a, offsetX: s.annDragging!.initOffset.x + dx, offsetY: s.annDragging!.initOffset.y + dy }
              : a
          ),
        }),
        pushHistory: false,
      });
      return;
    }
    const d = draggingRef.current;
    if (d) {
      const coords = getSVGCoords(e);
      if (!coords) return;
      const dx = coords.x - d.startSVG.x;
      const dy = coords.y - d.startSVG.y;
      if (!isDraggingRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isDraggingRef.current = true;
        dispatch({ type: "SET_STATE", patch: { isDragging: true } });
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const curState = stateRef.current;
        dispatch({
          type: "UPDATE_CANVAS",
          updater: (prev: CanvasData) => ({
            ...prev,
            nodes: prev.nodes.map((n) => {
              const init = d.initialPositions[n.id];
              if (!init) return n;
              const rawY = init.y + dy;
              const newY = curState.snapEnabled ? snapToNearestRow(rawY, curState.snapRows) : rawY;
              return { ...n, x: init.x + dx, y: newY };
            }),
          }),
          pushHistory: false,
        });
      });
      return;
    }
    if (s.panning) {
      const dx = (e.clientX - s.panning.startX) * s.viewBox.zoom;
      const dy = (e.clientY - s.panning.startY) * s.viewBox.zoom;
      dispatch({ type: "SET_STATE", patch: { viewBox: { ...s.viewBox, x: s.panning.vbX - dx, y: s.panning.vbY - dy, zoom: s.viewBox.zoom } } });
    }
    if (lassoRef.current) {
      const coords = getSVGCoords(e);
      if (!coords) return;
      lassoRef.current.curSVG = coords;
      const ldx = coords.x - lassoRef.current.startSVG.x;
      const ldy = coords.y - lassoRef.current.startSVG.y;
      if (!isLassoingRef.current && (Math.abs(ldx) > 6 || Math.abs(ldy) > 6)) {
        isLassoingRef.current = true;
        dispatch({ type: "SET_STATE", patch: { lassoVisible: true } });
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
  }, [getSVGCoords, dispatch, stateRef, rafRef, lassoRef, isLassoingRef, lassoRectRef]);

  const handleMouseUp = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const s = stateRef.current;

    if (draggingRef.current && isDraggingRef.current) {
      const movedIds = new Set(Object.keys(draggingRef.current.initialPositions));
      const preDrag = preDragCanvasRef.current;
      preDragCanvasRef.current = null;
      dispatch({
        type: "UPDATE_CANVAS",
        updater: (prev: CanvasData) => ({
          ...prev,
          nodes: prev.nodes.map((n) => movedIds.has(n.id) ? { ...n, pinned: true } : n),
        }),
        pushHistory: !preDrag ? true : false,
      });
      if (preDrag) {
        dispatch({ type: "SET_STATE", patch: { history: [...s.history.slice(-49), preDrag], future: [] } });
      }
    }

    if (lassoRef.current) {
      if (isLassoingRef.current) {
        const { startSVG, curSVG } = lassoRef.current;
        const x1 = Math.min(startSVG.x, curSVG.x), x2 = Math.max(startSVG.x, curSVG.x);
        const y1 = Math.min(startSVG.y, curSVG.y), y2 = Math.max(startSVG.y, curSVG.y);
        const half = NODE_SIZE / 2;
        const enclosed = s.canvas.nodes.filter(
          (n) => n.x + half >= x1 && n.x - half <= x2 && n.y + half >= y1 && n.y - half <= y2
        );
        dispatch({ type: "SET_STATE", patch: { selectedIds: new Set(enclosed.map((n) => n.id)) } });
      } else {
        dispatch({ type: "SET_STATE", patch: { selectedIds: new Set() } });
      }
    }
    lassoRef.current = null; isLassoingRef.current = false;
    dispatch({ type: "SET_STATE", patch: { lassoVisible: false } });
    if (lassoRectRef.current) lassoRectRef.current.style.display = "none";

    dispatch({ type: "SET_STATE", patch: { dragging: null, isDragging: false, snapRows: [], panning: null } });
    draggingRef.current = null; isDraggingRef.current = false;

    if (s.annDragging) {
      const preDrag = preDragCanvasRef.current;
      preDragCanvasRef.current = null;
      if (preDrag) {
        dispatch({ type: "SET_STATE", patch: { history: [...s.history.slice(-49), preDrag], future: [] } });
      }
      if (canvasRef.current) {
        if (draftEnabledRef.current) {
          try { localStorage.setItem(draftKeyRef.current, JSON.stringify({ canvas: canvasRef.current, at: Date.now() })); } catch {}
        }
      }
      dispatch({ type: "SET_STATE", patch: { annDragging: null } });
    }
  }, [stateRef, dispatch, rafRef, preDragCanvasRef, lassoRef, isLassoingRef, lassoRectRef, canvasRef, draftEnabledRef, draftKeyRef]);

  const handleSVGMouseDown = useCallback((e: React.MouseEvent) => {
    const s = stateRef.current;
    if (e.target !== svgRef.current) return;
    if (e.button === 1 || e.button === 2 || e.altKey || spaceHeldRef.current) {
      e.preventDefault();
      dispatch({
        type: "SET_STATE",
        patch: { panning: { startX: e.clientX, startY: e.clientY, vbX: s.viewBox.x, vbY: s.viewBox.y } },
      });
      return;
    }
    const coords = getSVGCoords(e);
    if (!coords) return;
    lassoRef.current = { startSVG: coords, curSVG: coords };
    isLassoingRef.current = false;
    dispatch({ type: "SET_STATE", patch: { lassoVisible: false } });
    if (lassoRectRef.current) lassoRectRef.current.style.display = "none";
  }, [getSVGCoords, stateRef, dispatch, svgRef, spaceHeldRef, lassoRef, isLassoingRef, lassoRectRef]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const svgW = rect.width, svgH = rect.height;

    const zoomAt = (factor: number) => {
      const s = stateRef.current;
      const newZoom = Math.min(4, Math.max(0.25, s.viewBox.zoom * factor));
      const vbW = 1400 * s.viewBox.zoom, vbH = 900 * s.viewBox.zoom;
      const newVbW = 1400 * newZoom, newVbH = 900 * newZoom;
      const cx = s.viewBox.x + (px / svgW) * vbW;
      const cy = s.viewBox.y + (py / svgH) * vbH;
      dispatch({ type: "SET_STATE", patch: { viewBox: { x: cx - (px / svgW) * newVbW, y: cy - (py / svgH) * newVbH, zoom: newZoom } } });
    };

    if (e.ctrlKey) { zoomAt(Math.pow(0.992, e.deltaY)); return; }
    if (e.shiftKey) {
      const s = stateRef.current;
      dispatch({ type: "SET_STATE", patch: { viewBox: { ...s.viewBox, x: s.viewBox.x + e.deltaY * s.viewBox.zoom * 0.6 } } });
      return;
    }
    const hasHoriz = Math.abs(e.deltaX) > 1;
    const isSmooth = e.deltaMode === 0 && Math.abs(e.deltaY) < 50;
    if (hasHoriz || isSmooth) {
      const s = stateRef.current;
      dispatch({
        type: "SET_STATE",
        patch: {
          viewBox: {
            ...s.viewBox,
            x: s.viewBox.x + e.deltaX * s.viewBox.zoom * 0.8,
            y: s.viewBox.y + e.deltaY * s.viewBox.zoom * 0.8,
          },
        },
      });
      return;
    }
    zoomAt(Math.pow(1.0003, -e.deltaY));
  }, [stateRef, dispatch, svgRef]);

  const fitToScreen = useCallback(() => {
    const s = stateRef.current;
    if (s.canvas.nodes.length === 0) return;
    const pad = NODE_SIZE * 3;
    const xs = s.canvas.nodes.map((n) => n.x), ys = s.canvas.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad + NODE_SIZE;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad + NODE_SIZE;
    const spanX = maxX - minX, spanY = maxY - minY;
    const W = 1400, H = 900;
    const zoom = Math.max(0.2, Math.min(Math.max(spanX / W, spanY / H), 1.5));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    dispatch({ type: "SET_STATE", patch: { viewBox: { x: cx - (W * zoom) / 2, y: cy - (H * zoom) / 2, zoom } } });
  }, [stateRef, dispatch]);

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
