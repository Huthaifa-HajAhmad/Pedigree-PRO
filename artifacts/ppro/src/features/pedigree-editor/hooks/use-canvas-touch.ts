import { useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";

interface UseCanvasTouchParams {
  getSVGCoords: (e: { clientX: number; clientY: number }) => { x: number; y: number } | null;
  setViewBox: Dispatch<SetStateAction<{ x: number; y: number; zoom: number }>>;
  viewBox: { x: number; y: number; zoom: number };
  W: number;
  H: number;
  canvasNodes: PedigreeNode[];
  onNodeTap: (nodeId: string) => void;
  onNodeDoubleTap: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string, clientX: number, clientY: number) => void;
}

export function useCanvasTouch(params: UseCanvasTouchParams) {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const touchStateRef = useRef<{
    touchCount: number;
    startTime: number;
    lastTapTime: number;
    lastTapNodeId: string | null;
    panStart: { clientX: number; clientY: number; vbX: number; vbY: number } | null;
    pinchStart: { dist: number; vbX: number; vbY: number; zoom: number } | null;
    longPressTimeout: ReturnType<typeof setTimeout> | null;
    moved: boolean;
    startSVG: { x: number; y: number } | null;
  }>({
    touchCount: 0,
    startTime: 0,
    lastTapTime: 0,
    lastTapNodeId: null,
    panStart: null,
    pinchStart: null,
    longPressTimeout: null,
    moved: false,
    startSVG: null,
  });

  const findNodeAt = useCallback((clientX: number, clientY: number): string | null => {
    const p = paramsRef.current;
    const coords = p.getSVGCoords({ clientX, clientY });
    if (!coords) return null;
    const half = NODE_SIZE / 2 + 4;
    for (const n of p.canvasNodes) {
      if (Math.abs(n.x - coords.x) <= half && Math.abs(n.y - coords.y) <= half) {
        return n.id;
      }
    }
    return null;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const p = paramsRef.current;
    const touches = e.touches;
    const ts = touchStateRef.current;

    ts.touchCount = touches.length;
    ts.startTime = Date.now();
    ts.moved = false;

    if (ts.longPressTimeout !== null) {
      clearTimeout(ts.longPressTimeout);
      ts.longPressTimeout = null;
    }

    if (touches.length === 1) {
      e.preventDefault();
      const t = touches[0];
      if (!t) return;
      const coords = p.getSVGCoords({ clientX: t.clientX, clientY: t.clientY });
      ts.startSVG = coords;
      ts.panStart = { clientX: t.clientX, clientY: t.clientY, vbX: p.viewBox.x, vbY: p.viewBox.y };
      ts.pinchStart = null;

      const nid = findNodeAt(t.clientX, t.clientY);
      if (nid) {
        ts.longPressTimeout = setTimeout(() => {
          const pp = paramsRef.current;
          pp.onNodeContextMenu(nid, t.clientX, t.clientY);
          ts.longPressTimeout = null;
        }, 500);
      }
    }

    if (touches.length === 2) {
      e.preventDefault();
      const t0 = touches[0];
      const t1 = touches[1];
      if (!t0 || !t1) return;
      if (ts.longPressTimeout !== null) {
        clearTimeout(ts.longPressTimeout);
        ts.longPressTimeout = null;
      }
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.hypot(dx, dy);
      ts.pinchStart = { dist, vbX: p.viewBox.x, vbY: p.viewBox.y, zoom: p.viewBox.zoom };
      ts.panStart = null;
      ts.startSVG = null;
    }
  }, [findNodeAt]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const p = paramsRef.current;
    const touches = e.touches;
    const ts = touchStateRef.current;

    if (touches.length === 1 && ts.panStart) {
      e.preventDefault();
      const t = touches[0];
      if (!t) return;
      const dx = (t.clientX - ts.panStart.clientX) * p.viewBox.zoom;
      const dy = (t.clientY - ts.panStart.clientY) * p.viewBox.zoom;
      if (ts.longPressTimeout !== null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        clearTimeout(ts.longPressTimeout);
        ts.longPressTimeout = null;
      }
      ts.moved = ts.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3;
      p.setViewBox({ x: ts.panStart.vbX - dx, y: ts.panStart.vbY - dy, zoom: p.viewBox.zoom });
    }

    if (touches.length === 2 && ts.pinchStart) {
      e.preventDefault();
      const t0 = touches[0];
      const t1 = touches[1];
      if (!t0 || !t1) return;
      const cx = (t0.clientX + t1.clientX) / 2;
      const cy = (t0.clientY + t1.clientY) / 2;
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const newDist = Math.hypot(dx, dy);
      const scale = newDist / ts.pinchStart.dist;
      const newZoom = Math.min(4, Math.max(0.25, ts.pinchStart.zoom * scale));

      const vbAtStartW = p.W * ts.pinchStart.zoom;
      const vbAtStartH = p.H * ts.pinchStart.zoom;
      const newVbW = p.W * newZoom;
      const newVbH = p.H * newZoom;
      const fx = (cx) / window.innerWidth;
      const fy = (cy) / window.innerHeight;
      const cxWorld = ts.pinchStart.vbX + fx * vbAtStartW;
      const cyWorld = ts.pinchStart.vbY + fy * vbAtStartH;

      p.setViewBox({
        x: cxWorld - fx * newVbW,
        y: cyWorld - fy * newVbH,
        zoom: newZoom,
      });
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const p = paramsRef.current;
    const ts = touchStateRef.current;

    if (ts.longPressTimeout !== null) {
      clearTimeout(ts.longPressTimeout);
      ts.longPressTimeout = null;
    }

    if (ts.touchCount === 1 && !ts.moved) {
      const changed = e.changedTouches[0];
      if (!changed) { ts.panStart = null; ts.startSVG = null; return; }
      const nid = findNodeAt(changed.clientX, changed.clientY);
      const elapsed = Date.now() - ts.startTime;

      if (elapsed < 300) {
        e.preventDefault();
        const timeSinceLastTap = Date.now() - ts.lastTapTime;
        if (timeSinceLastTap < 500 && nid && ts.lastTapNodeId === nid) {
          p.onNodeDoubleTap(nid);
          ts.lastTapTime = 0;
          ts.lastTapNodeId = null;
        } else {
          if (nid) {
            p.onNodeTap(nid);
          }
          ts.lastTapTime = nid ? Date.now() : 0;
          ts.lastTapNodeId = nid;
        }
      }
    }

    ts.panStart = null;
    ts.pinchStart = null;
    ts.startSVG = null;
    ts.touchCount = 0;
  }, [findNodeAt]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
