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

  const pointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; vbX: number; vbY: number; zoom: number } | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; vbX: number; vbY: number } | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimeRef = useRef(0);
  const lastTapNodeIdRef = useRef<string | null>(null);
  const movedRef = useRef(false);
  const startTimeRef = useRef(0);

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

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);

    pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    startTimeRef.current = Date.now();
    movedRef.current = false;

    if (longPressTimeoutRef.current !== null) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    const pointers = pointersRef.current;
    if (pointers.size === 1) {
      const p = paramsRef.current;
      panStartRef.current = { clientX: e.clientX, clientY: e.clientY, vbX: p.viewBox.x, vbY: p.viewBox.y };
      pinchStartRef.current = null;

      const nid = findNodeAt(e.clientX, e.clientY);
      if (nid) {
        longPressTimeoutRef.current = setTimeout(() => {
          const pp = paramsRef.current;
          pp.onNodeContextMenu(nid, e.clientX, e.clientY);
          longPressTimeoutRef.current = null;
        }, 500);
      }
    }

    if (pointers.size === 2) {
      const p = paramsRef.current;
      const pts = Array.from(pointers.values());
      const dx = pts[1]!.clientX - pts[0]!.clientX;
      const dy = pts[1]!.clientY - pts[0]!.clientY;
      const dist = Math.hypot(dx, dy);
      pinchStartRef.current = { dist, vbX: p.viewBox.x, vbY: p.viewBox.y, zoom: p.viewBox.zoom };
      panStartRef.current = null;

      if (longPressTimeoutRef.current !== null) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    }
  }, [findNodeAt]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    if (!pointersRef.current.has(e.pointerId)) return;
    e.preventDefault();

    pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    const p = paramsRef.current;
    const pointers = pointersRef.current;

    if (pointers.size === 1 && panStartRef.current) {
      const dx = (e.clientX - panStartRef.current.clientX) * p.viewBox.zoom;
      const dy = (e.clientY - panStartRef.current.clientY) * p.viewBox.zoom;
      if (longPressTimeoutRef.current !== null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      movedRef.current = movedRef.current || Math.abs(dx) > 3 || Math.abs(dy) > 3;
      p.setViewBox({ x: panStartRef.current.vbX - dx, y: panStartRef.current.vbY - dy, zoom: p.viewBox.zoom });
    }

    if (pointers.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointers.values());
      const cx = (pts[0]!.clientX + pts[1]!.clientX) / 2;
      const cy = (pts[0]!.clientY + pts[1]!.clientY) / 2;
      const dx = pts[1]!.clientX - pts[0]!.clientX;
      const dy = pts[1]!.clientY - pts[0]!.clientY;
      const newDist = Math.hypot(dx, dy);
      const scale = newDist / pinchStartRef.current.dist;
      const newZoom = Math.min(4, Math.max(0.25, pinchStartRef.current.zoom * scale));

      const vbAtStartW = p.W * pinchStartRef.current.zoom;
      const vbAtStartH = p.H * pinchStartRef.current.zoom;
      const newVbW = p.W * newZoom;
      const newVbH = p.H * newZoom;
      const fx = cx / window.innerWidth;
      const fy = cy / window.innerHeight;
      const cxWorld = pinchStartRef.current.vbX + fx * vbAtStartW;
      const cyWorld = pinchStartRef.current.vbY + fy * vbAtStartH;

      p.setViewBox({
        x: cxWorld - fx * newVbW,
        y: cyWorld - fy * newVbH,
        zoom: newZoom,
      });
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pointersRef.current.delete(e.pointerId);

    if (longPressTimeoutRef.current !== null) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    const pointers = pointersRef.current;
    if (pointers.size === 0 && !movedRef.current) {
      const nid = findNodeAt(e.clientX, e.clientY);
      const elapsed = Date.now() - startTimeRef.current;

      if (elapsed < 300) {
        e.preventDefault();
        const timeSinceLastTap = Date.now() - lastTapTimeRef.current;
        if (timeSinceLastTap < 500 && nid && lastTapNodeIdRef.current === nid) {
          paramsRef.current.onNodeDoubleTap(nid);
          lastTapTimeRef.current = 0;
          lastTapNodeIdRef.current = null;
        } else {
          if (nid) {
            paramsRef.current.onNodeTap(nid);
          }
          lastTapTimeRef.current = nid ? Date.now() : 0;
          lastTapNodeIdRef.current = nid;
        }
      }
    }

    panStartRef.current = null;
    pinchStartRef.current = null;
  }, [findNodeAt]);

  return { onPointerDown, onPointerMove, onPointerUp };
}
