import { useRef, useCallback } from "react";
import type { CanvasData, DragState } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE, NODE_GAP } from "@/features/pedigree-editor/canvas/types";
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
  pendingAnnDragRef: React.MutableRefObject<{ annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number }; labelBelowHeight: number; stackIndex: number } | null>;
  justCtrlSelectedNodeIdRef: React.MutableRefObject<string | null>;
}

export function usePedigreeCanvas(params: UsePedigreeCanvasParams) {
  const {
    stateRef, dispatch,
    svgRef, lassoRef, isLassoingRef, lassoRectRef,
    spaceHeldRef, preDragCanvasRef, rafRef, pendingAnnDragRef,
    justCtrlSelectedNodeIdRef,
  } = params;

  const draggingRef = useRef<DragState | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartTimeRef = useRef<number>(0);
  const snapTargetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const initialSnapPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const lassoCTMInverseRef = useRef<DOMMatrix | null>(null);
  const lastDragEndTimeRef = useRef(0);

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
    if (s.isPreviewMode) return;
    if (s.linkMode) return;
    const coords = getSVGCoords(e);
    if (!coords) return;

    const ctrlHeld = e.ctrlKey || e.metaKey;
    const isSelected = s.selectedIds.has(nodeId);

    let movingIds = isSelected ? s.selectedIds : new Set([nodeId]);
    if (!isSelected) {
      if (ctrlHeld) {
        movingIds = new Set(s.selectedIds);
        movingIds.add(nodeId);
        justCtrlSelectedNodeIdRef.current = nodeId;
      } else {
        movingIds = new Set([nodeId]);
        justCtrlSelectedNodeIdRef.current = null;
      }
      dispatch({ type: "SET_STATE", patch: { selectedIds: movingIds } });
    } else {
      justCtrlSelectedNodeIdRef.current = null;
    }
    const rows = computeSnapRows(s.canvas.nodes, movingIds);
    const initialPositions: Record<string, { x: number; y: number }> = {};
    for (const n of s.canvas.nodes) {
      if (movingIds.has(n.id)) initialPositions[n.id] = { x: n.x, y: n.y };
    }
    const partnerIds = new Set<string>();
    const parentIdsToMove = new Set<string>();
    if (!ctrlHeld) {
      for (const mid of movingIds) {
        const ce = s.canvas.edges.find((e) => (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") && (e.sourceId === mid || e.targetId === mid));
        if (ce) {
          const pid = ce.sourceId === mid ? ce.targetId : ce.sourceId;
          if (!movingIds.has(pid)) partnerIds.add(pid);
        }
      }
      for (const mid of movingIds) {
        const parentEdges = s.canvas.edges.filter((e) => e.type === "parent-child" && e.targetId === mid);
        for (const pe of parentEdges) {
          if (!movingIds.has(pe.sourceId)) parentIdsToMove.add(pe.sourceId);
        }
      }
    }
    for (const pid of partnerIds) {
      const pn = s.canvas.nodes.find((n) => n.id === pid);
      if (pn) initialPositions[pid] = { x: pn.x, y: pn.y };
    }
    for (const pid of parentIdsToMove) {
      const pn = s.canvas.nodes.find((n) => n.id === pid);
      if (pn) initialPositions[pid] = { x: pn.x, y: pn.y };
    }
    const allMovingIds = new Set(Object.keys(initialPositions));
    const snapTargets: Record<string, { x: number; y: number }> = {};
    for (const n of s.canvas.nodes) {
      if (!allMovingIds.has(n.id)) snapTargets[n.id] = { x: n.x, y: n.y };
    }
    snapTargetsRef.current = snapTargets;
    initialSnapPositionsRef.current = initialPositions;
    preDragCanvasRef.current = {
      nodes: s.canvas.nodes,
      edges: s.canvas.edges,
      annotations: JSON.parse(JSON.stringify(s.canvas.annotations)),
    };
    const d: DragState = { primaryNodeId: nodeId, startSVG: coords, initialPositions };
    draggingRef.current = d;
    isDraggingRef.current = false;
    dragStartTimeRef.current = Date.now();
    dispatch({ type: "SET_STATE", patch: { dragging: d, isDragging: false, snapRows: rows } });
  }, [getSVGCoords, dispatch, stateRef, preDragCanvasRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const s = stateRef.current;
    if (s.annDragging) {
      if (e.buttons !== undefined && e.buttons !== 1) {
        dispatch({ type: "SET_STATE", patch: { annDragging: null } });
        return;
      }
      const coords = getSVGCoords(e);
      if (!coords) return;
      const dx = coords.x - s.annDragging.startSVG.x;
      const dy = coords.y - s.annDragging.startSVG.y;
      if (!s.annDragging.hasMoved && (Math.abs(dx) < 3 && Math.abs(dy) < 3)) return;
      if (!s.annDragging.hasMoved) {
        dispatch({ type: "SET_STATE", patch: { annDragging: { ...s.annDragging, hasMoved: true } } });
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const curState = stateRef.current;
        const ad = curState.annDragging;
        if (!ad) return;
        const annId = ad.annId;
        const newOffsetX = ad.initOffset.x + dx;
        const newOffsetY = ad.initOffset.y + dy;
        dispatch({
          type: "UPDATE_CANVAS",
          updater: (prev: CanvasData) => {
            const ann = prev.annotations.find(a => a.id === annId);
            if (!ann) return prev;

            const isFree = !ann.nodeId;
            if (isFree) {
              let finalX = newOffsetX;
              let finalY = newOffsetY;
              if (curState.snapEnabled) {
                const snapSize = 20;
                finalX = Math.round(newOffsetX / snapSize) * snapSize;
                finalY = Math.round(newOffsetY / snapSize) * snapSize;
              }
              return {
                ...prev,
                annotations: prev.annotations.map((a) =>
                  a.id === annId
                    ? { ...a, x: finalX, y: finalY }
                    : a
                ),
              };
            }

            const node = prev.nodes.find(n => n.id === ann.nodeId);
            if (!node) return prev;

            let finalOffsetX = newOffsetX;
            let finalOffsetY = newOffsetY;

            // Gentle offset snap: if offset is very close to zero, snap it back
            const OFFSET_SNAP = 6;
            if (Math.abs(newOffsetX) < OFFSET_SNAP && Math.abs(newOffsetY) < OFFSET_SNAP) {
              finalOffsetX = 0;
              finalOffsetY = 0;
            }

            return {
              ...prev,
              annotations: prev.annotations.map((a) =>
                a.id === annId
                  ? { ...a, offsetX: finalOffsetX, offsetY: finalOffsetY }
                  : a
              ),
            };
          },
          pushHistory: false,
        });
      });
      return;
    }
    const pending = pendingAnnDragRef.current;
    if (pending) {
      if (e.buttons !== undefined && e.buttons !== 1) {
        pendingAnnDragRef.current = null;
        return;
      }
      const coords = getSVGCoords(e);
      if (!coords) return;
      const dx = coords.x - pending.startSVG.x;
      const dy = coords.y - pending.startSVG.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      dispatch({ type: "SET_STATE", patch: { annDragging: { annId: pending.annId, startSVG: pending.startSVG, initOffset: pending.initOffset, hasMoved: false, labelBelowHeight: pending.labelBelowHeight, stackIndex: pending.stackIndex } } });
      pendingAnnDragRef.current = null;
      return;
    }
    const d = draggingRef.current;
    if (d) {
      if ((e.buttons !== undefined && e.buttons !== 1) || (!isDraggingRef.current && Date.now() - dragStartTimeRef.current > 1000)) {
        draggingRef.current = null;
        isDraggingRef.current = false;
        dispatch({ type: "SET_STATE", patch: { dragging: null, isDragging: false } });
        return;
      }
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
        const SNAP_THRESHOLD = 16;
        const NEAR_THRESHOLD = 32;
        const alignGuides: Array<{ axis: "x" | "y"; pos: number; strength: "near" | "snap" }> = [];
        const targets = snapTargetsRef.current;

        const movingIds = new Set(Object.keys(d.initialPositions));
        const coupleEdges = curState.canvas.edges.filter(e => (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") && (movingIds.has(e.sourceId) || movingIds.has(e.targetId)));

        dispatch({
          type: "UPDATE_CANVAS",
          updater: (prev: CanvasData) => {
            const primaryId = d.primaryNodeId;
            const initPn = d.initialPositions[primaryId];
            if (!initPn) return prev;

            const rawPnX = initPn.x + dx;
            const rawPnY = initPn.y + dy;

            // Calculate moving group center on the primary node's row
            const rowMovingNodes = Object.entries(d.initialPositions)
              .filter(([, pos]) => Math.abs(pos.y - initPn.y) < 1)
              .map(([id, pos]) => ({ id, x: pos.x, y: pos.y }));
            
            const rowMovingInitCenterX = rowMovingNodes.reduce((sum, n) => sum + n.x, 0) / rowMovingNodes.length;
            const rowMovingRawCenterX = rowMovingInitCenterX + dx;

            // Targets on the same row as primary node
            const rowTargets = Object.values(targets)
              .filter(tpos => Math.abs(tpos.y - initPn.y) < 1)
              .sort((a, b) => a.x - b.x);

            // Midpoints between adjacent non-moving nodes on this row
            const adjacentMidpoints: number[] = [];
            if (rowTargets.length >= 2) {
              for (let i = 0; i < rowTargets.length - 1; i++) {
                const t1 = rowTargets[i];
                const t2 = rowTargets[i+1];
                if (t1 && t2) {
                  adjacentMidpoints.push((t1.x + t2.x) / 2);
                }
              }
            }

            const xCandidates: Array<{
              type: string;
              targetX: number;
              offset: number;
              dist: number;
              strength: "snap" | "near";
            }> = [];

            // Populate X candidates
            if (curState.snapEnabled) {
              // 1. Group Center Target Snaps
              for (const tpos of rowTargets) {
                const dist = Math.abs(rowMovingRawCenterX - tpos.x);
                const offset = tpos.x - rowMovingInitCenterX;
                if (dist < SNAP_THRESHOLD) {
                  xCandidates.push({ type: "group_center_target", targetX: tpos.x, offset, dist, strength: "snap" });
                } else if (dist < NEAR_THRESHOLD) {
                  xCandidates.push({ type: "group_center_target", targetX: tpos.x, offset, dist, strength: "near" });
                }
              }

              // 2. Group Center Midpoint Snaps
              for (const midX of adjacentMidpoints) {
                const dist = Math.abs(rowMovingRawCenterX - midX);
                const offset = midX - rowMovingInitCenterX;
                if (dist < SNAP_THRESHOLD) {
                  xCandidates.push({ type: "group_center_midpoint", targetX: midX, offset, dist, strength: "snap" });
                } else if (dist < NEAR_THRESHOLD) {
                  xCandidates.push({ type: "group_center_midpoint", targetX: midX, offset, dist, strength: "near" });
                }
              }

              // 3. Primary Node Target Snaps
              for (const tpos of rowTargets) {
                const dist = Math.abs(rawPnX - tpos.x);
                const offset = tpos.x - initPn.x;
                if (dist < SNAP_THRESHOLD) {
                  xCandidates.push({ type: "primary_target", targetX: tpos.x, offset, dist, strength: "snap" });
                } else if (dist < NEAR_THRESHOLD) {
                  xCandidates.push({ type: "primary_target", targetX: tpos.x, offset, dist, strength: "near" });
                }
              }

              // 4. Primary Node Spacing Snaps
              for (const tpos of rowTargets) {
                for (const k of [-3, -2, -1, 1, 2, 3]) {
                  const targetX = tpos.x + k * NODE_GAP;
                  const dist = Math.abs(rawPnX - targetX);
                  const offset = targetX - initPn.x;
                  if (dist < SNAP_THRESHOLD) {
                    xCandidates.push({ type: "primary_spacing", targetX, offset, dist, strength: "snap" });
                  } else if (dist < NEAR_THRESHOLD) {
                    xCandidates.push({ type: "primary_spacing", targetX, offset, dist, strength: "near" });
                  }
                }
              }

              // 5. Primary Node Midpoint Snaps
              for (const midX of adjacentMidpoints) {
                const dist = Math.abs(rawPnX - midX);
                const offset = midX - initPn.x;
                if (dist < SNAP_THRESHOLD) {
                  xCandidates.push({ type: "primary_midpoint", targetX: midX, offset, dist, strength: "snap" });
                } else if (dist < NEAR_THRESHOLD) {
                  xCandidates.push({ type: "primary_midpoint", targetX: midX, offset, dist, strength: "near" });
                }
              }

              // 6. Parent Midpoint Snap (X-axis only)
              const parentIds = prev.edges
                .filter(e => e.type === "parent-child" && e.targetId === primaryId)
                .map(e => e.sourceId);
              const parentsAreMoving = parentIds.some(pid => movingIds.has(pid));
              const parentXs = parentsAreMoving
                ? []
                : parentIds.length > 0
                  ? parentIds.map(pid => prev.nodes.find(nn => nn.id === pid)?.x).filter((x): x is number => x !== undefined)
                  : [];
              if (parentXs.length >= 1) {
                const midX = parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
                const dist = Math.abs(rawPnX - midX);
                const offset = midX - initPn.x;
                if (dist < SNAP_THRESHOLD) {
                  xCandidates.push({ type: "parent_midpoint", targetX: midX, offset, dist, strength: "snap" });
                } else if (dist < NEAR_THRESHOLD) {
                  xCandidates.push({ type: "parent_midpoint", targetX: midX, offset, dist, strength: "near" });
                }
              }

              // 7. Child Midpoint Snap (X-axis only)
              const childIds = prev.edges
                .filter(e => e.type === "parent-child" && e.sourceId === primaryId)
                .map(e => e.targetId);
              const childrenAreMoving = childIds.some(cid => movingIds.has(cid));
              const childXs = childrenAreMoving
                ? []
                : childIds.map(cid => prev.nodes.find(nn => nn.id === cid)?.x).filter((x): x is number => x !== undefined);
              if (childXs.length >= 1) {
                const midX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
                const dist = Math.abs(rawPnX - midX);
                const offset = midX - initPn.x;
                if (dist < SNAP_THRESHOLD) {
                  xCandidates.push({ type: "child_midpoint", targetX: midX, offset, dist, strength: "snap" });
                } else if (dist < NEAR_THRESHOLD) {
                  xCandidates.push({ type: "child_midpoint", targetX: midX, offset, dist, strength: "near" });
                }
              }
            }

            // 8. Initial snap X
            const initSnap = initialSnapPositionsRef.current[primaryId];
            if (initSnap) {
              const dist = Math.abs(rawPnX - initSnap.x);
              const offset = initSnap.x - initPn.x;
              if (dist < SNAP_THRESHOLD) {
                xCandidates.push({ type: "init_snap_x", targetX: initSnap.x, offset, dist, strength: "snap" });
              } else if (dist < NEAR_THRESHOLD) {
                xCandidates.push({ type: "init_snap_x", targetX: initSnap.x, offset, dist, strength: "near" });
              }
            }

            // Evaluate Y candidates
            const yCandidates: Array<{
              type: string;
              targetY: number;
              offset: number;
              dist: number;
              strength: "snap" | "near";
            }> = [];

            // Spouse Y-alignment
            for (const edge of coupleEdges) {
              if (edge.sourceId === primaryId || edge.targetId === primaryId) {
                const partnerId = edge.sourceId === primaryId ? edge.targetId : edge.sourceId;
                const tp = targets[partnerId];
                const movingP = d.initialPositions[partnerId];
                const py = tp ? tp.y : (movingP ? movingP.y + dy : undefined);
                if (py !== undefined) {
                  const dist = Math.abs(rawPnY - py);
                  const offset = py - initPn.y;
                  if (dist < SNAP_THRESHOLD) {
                    yCandidates.push({ type: "spouse_y", targetY: py, offset, dist, strength: "snap" });
                  } else if (dist < NEAR_THRESHOLD) {
                    yCandidates.push({ type: "spouse_y", targetY: py, offset, dist, strength: "near" });
                  }
                }
              }
            }

            // Target Y-alignment
            for (const [, tpos] of Object.entries(targets)) {
              if (Math.abs(rawPnX - tpos.x) < SNAP_THRESHOLD) {
                const dist = Math.abs(rawPnY - tpos.y);
                const offset = tpos.y - initPn.y;
                if (dist < SNAP_THRESHOLD) {
                  yCandidates.push({ type: "target_y", targetY: tpos.y, offset, dist, strength: "snap" });
                } else if (dist < NEAR_THRESHOLD) {
                  yCandidates.push({ type: "target_y", targetY: tpos.y, offset, dist, strength: "near" });
                }
              }
            }

            // Initial snap Y
            if (initSnap) {
              const dist = Math.abs(rawPnY - initSnap.y);
              const offset = initSnap.y - initPn.y;
              if (dist < SNAP_THRESHOLD) {
                yCandidates.push({ type: "init_snap_y", targetY: initSnap.y, offset, dist, strength: "snap" });
              } else if (dist < NEAR_THRESHOLD) {
                yCandidates.push({ type: "init_snap_y", targetY: initSnap.y, offset, dist, strength: "near" });
              }
            }

            // Determine effective offsets
            let effectiveDx = dx;
            const snapXCandidates = xCandidates.filter(c => c.strength === "snap");
            if (snapXCandidates.length > 0) {
              snapXCandidates.sort((a, b) => a.dist - b.dist);
              const bestX = snapXCandidates[0]!;
              effectiveDx = bestX.offset;
              alignGuides.push({ axis: "x", pos: bestX.targetX, strength: "snap" });
            } else {
              const nearXCandidates = xCandidates.filter(c => c.strength === "near");
              for (const c of nearXCandidates) {
                if (!alignGuides.some(g => g.axis === "x" && Math.abs(g.pos - c.targetX) < 1)) {
                  alignGuides.push({ axis: "x", pos: c.targetX, strength: "near" });
                }
              }
            }

            let effectiveDy = dy;
            const basePnY = curState.snapEnabled ? snapToNearestRow(rawPnY, curState.snapRows) : rawPnY;
            effectiveDy = basePnY - initPn.y;

            const snapYCandidates = yCandidates.filter(c => c.strength === "snap");
            if (snapYCandidates.length > 0) {
              snapYCandidates.sort((a, b) => a.dist - b.dist);
              const bestY = snapYCandidates[0]!;
              effectiveDy = bestY.offset;
              alignGuides.push({ axis: "y", pos: bestY.targetY, strength: "snap" });
            } else {
              const nearYCandidates = yCandidates.filter(c => c.strength === "near");
              for (const c of nearYCandidates) {
                if (!alignGuides.some(g => g.axis === "y" && Math.abs(g.pos - c.targetY) < 1)) {
                  alignGuides.push({ axis: "y", pos: c.targetY, strength: "near" });
                }
              }
            }

            return {
              ...prev,
              nodes: prev.nodes.map((n) => {
                const init = d.initialPositions[n.id];
                if (!init) return n;
                return {
                  ...n,
                  x: init.x + effectiveDx,
                  y: init.y + effectiveDy,
                };
              }),
            };
          },
          pushHistory: false,
        });
        const deduped = alignGuides.filter((g, i, arr) =>
          !arr.some((g2, j) => j < i && g2.axis === g.axis && Math.abs(g2.pos - g.pos) < 1)
        );
        dispatch({ type: "SET_STATE", patch: { alignGuides: deduped } });
      });
      return;
    }
    if (s.panning) {
      const dx = (e.clientX - s.panning.startX) * s.viewBox.zoom;
      const dy = (e.clientY - s.panning.startY) * s.viewBox.zoom;
      dispatch({ type: "SET_STATE", patch: { viewBox: { ...s.viewBox, x: s.panning.vbX - dx, y: s.panning.vbY - dy, zoom: s.viewBox.zoom } } });
    }
    if (lassoRef.current) {
      const ctmInv = lassoCTMInverseRef.current;
      if (!ctmInv) return;
      const pt = new DOMPoint(e.clientX, e.clientY);
      const coords = pt.matrixTransform(ctmInv);
      lassoRef.current.curSVG = { x: coords.x, y: coords.y };
      const ldx = coords.x - lassoRef.current.startSVG.x;
      const ldy = coords.y - lassoRef.current.startSVG.y;
      if (!isLassoingRef.current && (Math.abs(ldx) > 6 || Math.abs(ldy) > 6)) {
        isLassoingRef.current = true;
        dispatch({ type: "SET_STATE", patch: { lassoVisible: true } });
      }
      if (isLassoingRef.current && lassoRectRef.current) {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (!lassoRectRef.current || !lassoRef.current) return;
          const x1 = Math.min(lassoRef.current.startSVG.x, lassoRef.current.curSVG.x);
          const y1 = Math.min(lassoRef.current.startSVG.y, lassoRef.current.curSVG.y);
          const w  = Math.abs(lassoRef.current.curSVG.x - lassoRef.current.startSVG.x);
          const h  = Math.abs(lassoRef.current.curSVG.y - lassoRef.current.startSVG.y);
          lassoRectRef.current.setAttribute("x", String(x1));
          lassoRectRef.current.setAttribute("y", String(y1));
          lassoRectRef.current.setAttribute("width",  String(w));
          lassoRectRef.current.setAttribute("height", String(h));
        });
      }
    }
  }, [getSVGCoords, dispatch, stateRef, rafRef, lassoRef, isLassoingRef, lassoRectRef, lassoCTMInverseRef]);

  const handleMouseUp = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const s = stateRef.current;

    if (draggingRef.current && isDraggingRef.current) {
      const preDrag = preDragCanvasRef.current;
      preDragCanvasRef.current = null;
      lastDragEndTimeRef.current = Date.now();
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
        const newSelectedIds = new Set(enclosed.map((n) => n.id));
        if (s.twinSelectMode) {
          const newCandidates = new Set(s.twinCandidateIds);
          for (const n of enclosed) {
            if (newCandidates.has(n.id)) newCandidates.delete(n.id);
            else newCandidates.add(n.id);
          }
          dispatch({ type: "SET_STATE", patch: { twinCandidateIds: newCandidates } });
          lassoRef.current = null; isLassoingRef.current = false; lassoCTMInverseRef.current = null;
          dispatch({ type: "SET_STATE", patch: { lassoVisible: false } });
          dispatch({ type: "SET_STATE", patch: { dragging: null, isDragging: false, snapRows: [], panning: null, alignGuides: [] } });
          draggingRef.current = null; isDraggingRef.current = false;
          return;
        }

        if (s.linkMode === "consanguinity" && enclosed.length === 2) {
          const nA = enclosed[0]!, nB = enclosed[1]!;
          if ((nA.type === "male" && nB.type === "female") || (nA.type === "female" && nB.type === "male")) {
            dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({
              ...p,
              edges: [
                ...p.edges.filter((ed) => !((ed.type === "couple" || ed.type === "consanguinity") && ((ed.sourceId === nA.id && ed.targetId === nB.id) || (ed.sourceId === nB.id && ed.targetId === nA.id)))),
                { id: `e${Date.now()}`, type: "consanguinity", sourceId: nA.id, targetId: nB.id }
              ]
            }) });
            dispatch({ type: "SET_STATE", patch: { selectedIds: newSelectedIds, linkMode: null, linkSource: null } });
            lassoRef.current = null; isLassoingRef.current = false; lassoCTMInverseRef.current = null;
            dispatch({ type: "SET_STATE", patch: { lassoVisible: false } });
    dispatch({ type: "SET_STATE", patch: { dragging: null, isDragging: false, snapRows: [], panning: null, alignGuides: [] } });
            draggingRef.current = null; isDraggingRef.current = false;
            return;
          }
        }
        if (s.linkMode === "couple" && enclosed.length === 2) {
          const nA = enclosed[0]!, nB = enclosed[1]!;
          dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({
            ...p,
            edges: [
              ...p.edges.filter((ed) => !((ed.type === "couple" || ed.type === "consanguinity") && ((ed.sourceId === nA.id && ed.targetId === nB.id) || (ed.sourceId === nB.id && ed.targetId === nA.id)))),
              { id: `e${Date.now()}`, type: "couple", sourceId: nA.id, targetId: nB.id }
            ]
          }) });
          dispatch({ type: "SET_STATE", patch: { selectedIds: newSelectedIds, linkMode: null, linkSource: null } });
          lassoRef.current = null; isLassoingRef.current = false; lassoCTMInverseRef.current = null;
          dispatch({ type: "SET_STATE", patch: { lassoVisible: false } });
          dispatch({ type: "SET_STATE", patch: { dragging: null, isDragging: false, snapRows: [], panning: null, alignGuides: [] } });
          draggingRef.current = null; isDraggingRef.current = false;
          return;
        }
        dispatch({ type: "SET_STATE", patch: { selectedIds: newSelectedIds } });
      } else {
        dispatch({ type: "SET_STATE", patch: { selectedIds: new Set(), selectedAnnotationId: null, showRiskPanel: false, showValidation: false, showVersions: false } });
      }
    }
    lassoRef.current = null; isLassoingRef.current = false; lassoCTMInverseRef.current = null;
    dispatch({ type: "SET_STATE", patch: { lassoVisible: false } });

    dispatch({ type: "SET_STATE", patch: { dragging: null, isDragging: false, snapRows: [], panning: null, alignGuides: [] } });
    draggingRef.current = null; isDraggingRef.current = false;
    pendingAnnDragRef.current = null;

    if (s.annDragging) {
      const preDrag = preDragCanvasRef.current;
      preDragCanvasRef.current = null;
      if (preDrag) {
        dispatch({ type: "SET_STATE", patch: { history: [...s.history.slice(-49), preDrag], future: [] } });
      }
      // Draft save is handled by PedigreeEditorProvider's debounced effect (L8 consolidation)
      dispatch({ type: "SET_STATE", patch: { annDragging: null } });
    }
  }, [stateRef, dispatch, rafRef, preDragCanvasRef, lassoRef, isLassoingRef, lassoRectRef]);

  const handleSVGMouseDown = useCallback((e: React.MouseEvent) => {
    const s = stateRef.current;
    const isBackground = e.target === svgRef.current || (e.target instanceof SVGElement && e.target.getAttribute("data-canvas-background") === "true");
    if (!isBackground) return;

    if (s.isPreviewMode) {
      if (e.button === 1 || e.button === 2 || e.altKey || spaceHeldRef.current) {
        e.preventDefault();
        dispatch({
          type: "SET_STATE",
          patch: { panning: { startX: e.clientX, startY: e.clientY, vbX: s.viewBox.x, vbY: s.viewBox.y } },
        });
      }
      return;
    }
    if (e.button === 1 || e.button === 2 || e.altKey || spaceHeldRef.current) {
      e.preventDefault();
      dispatch({
        type: "SET_STATE",
        patch: { panning: { startX: e.clientX, startY: e.clientY, vbX: s.viewBox.x, vbY: s.viewBox.y } },
      });
      return;
    }

    // Clear selection on background left click (closes properties panels)
    if (e.button === 0) {
      dispatch({ type: "SET_STATE", patch: { selectedIds: new Set(), selectedAnnotationId: null } });
    }

    const coords = getSVGCoords(e);
    if (!coords) return;
    const svg = svgRef.current;
    if (svg) {
      const ctm = svg.getScreenCTM();
      if (ctm) lassoCTMInverseRef.current = ctm.inverse();
    }
    lassoRef.current = { startSVG: coords, curSVG: coords };
    isLassoingRef.current = false;
    dispatch({ type: "SET_STATE", patch: { lassoVisible: false } });
    if (lassoRectRef.current) lassoRectRef.current.style.display = "none";
  }, [getSVGCoords, stateRef, dispatch, svgRef, spaceHeldRef, lassoRef, isLassoingRef, lassoRectRef]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
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

    if (e.ctrlKey || e.metaKey) { zoomAt(Math.pow(0.98, e.deltaY)); return; }
    if (e.shiftKey) {
      const s = stateRef.current;
      dispatch({ type: "SET_STATE", patch: { viewBox: { ...s.viewBox, x: s.viewBox.x + e.deltaY * s.viewBox.zoom * 0.6 } } });
      return;
    }
    if (e.deltaMode === 0) {
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
    const W = 1400, H = 900;
    const pad = NODE_SIZE * 0.5;
    const xs = s.canvas.nodes.map((n) => n.x), ys = s.canvas.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad + NODE_SIZE;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad + NODE_SIZE;
    const spanX = maxX - minX, spanY = maxY - minY;
    const zoom = Math.max(0.7, Math.min(4.0, Math.max(spanX / (W * 0.88), spanY / (H * 0.88))));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    dispatch({ type: "SET_STATE", patch: { viewBox: { x: cx - (W * zoom) / 2, y: cy - (H * zoom) / 2, zoom } } });
  }, [stateRef, dispatch, svgRef]);

  return {
    getSVGCoords,
    handleDragStart,
    handleMouseMove,
    handleMouseUp,
    handleSVGMouseDown,
    handleWheel,
    fitToScreen,
    lastDragEndTimeRef,
  };
}
