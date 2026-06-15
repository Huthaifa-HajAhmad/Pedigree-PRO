import { useMemo, useCallback, useEffect, useRef } from "react";

const EMPTY_SET: Set<string> = new Set();
import { NodeShape } from "@/features/pedigree-editor/canvas/NodeShape";
import { EdgeLine } from "@/features/pedigree-editor/canvas/EdgeLine";
import { SibshipGroup, computeFamilyChildYOffset } from "@/features/pedigree-editor/canvas/SibshipGroup";
import { AnnotationShape } from "@/features/pedigree-editor/canvas/AnnotationShape";
import { CanvasOverlayManager } from "@/features/pedigree-editor/overlay/CanvasOverlayManager";
import { FindBar } from "@/features/pedigree-editor/overlay/FindBar";
import { useCanvasTouch } from "@/features/pedigree-editor/hooks/use-canvas-touch";
import { NodeQuickEditPopover } from "@/features/pedigree-editor/overlay/NodeQuickEditPopover";
import { AnnotationQuickEditPopover } from "@/features/pedigree-editor/overlay/AnnotationQuickEditPopover";
import { ContextMenu } from "@/features/pedigree-editor/overlay/ContextMenu";
import { NodeColorPicker } from "@/features/pedigree-editor/overlay/NodeColorPicker";
import { AddSiblingDialog } from "@/features/pedigree-editor/overlay/AddSiblingDialog";
import { PropertiesPanel } from "@/features/pedigree-editor/panels/PropertiesPanel";
import { RiskPanelSidebar } from "@/features/pedigree-editor/panels/RiskCalculatorPanel";
import { VersionHistoryPanel } from "@/features/pedigree-editor/panels/VersionHistoryPanel";
import { ValidationPanelWrapper } from "@/features/pedigree-editor/panels/ValidationPanelWrapper";
import { SettingsPanel } from "@/features/pedigree-editor/panels/SettingsPanel";
import { TabBar } from "@/features/pedigree-editor/panels/TabBar";
import { useLocation } from "wouter";
import { ShareModal } from "@/components/ShareModal";
import { usePedigreeEditor } from "@/features/pedigree-editor/context/usePedigreeEditor";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { parseCanvas } from "@/features/pedigree-editor/utils/helpers";
import type { PedigreeNode, CanvasData } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";

function computeLabelBelowHeight(node: PedigreeNode, autoLabel?: string): number {
  let h = 0;
  if (autoLabel) h = 13;
  if (node.label) h = autoLabel ? 24 : 14;
  if (node.age || node.dob) h += 11;
  if (node.condition) h += 11;
  return h;
}

function AnnotationLayer({
  annotations, nodes, selectedAnnotationId, canvas,
  onAnnotationClick, onAnnotationDragStart, onAnnotationDoubleClick, autoLabels, showAutoLabels, familyYOffsetMap,
}: {
  annotations: CanvasData["annotations"];
  nodes: PedigreeNode[];
  selectedAnnotationId: string | null;
  canvas: CanvasData;
  onAnnotationClick: (annId: string, nodeId: string) => void;
  onAnnotationDragStart: (annId: string, e: React.MouseEvent) => void;
  onAnnotationDoubleClick?: (annId: string) => void;
  autoLabels: Map<string, string>;
  showAutoLabels: boolean;
  familyYOffsetMap: Map<string, number>;
}) {
  const nodeById = useMemo(() => {
    const map = new Map<string, PedigreeNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const stackIndexById = useMemo(() => {
    const map = new Map<string, number>();
    const grouped = new Map<string, string[]>();
    for (const a of annotations) {
      if (!a.nodeId) continue;
      const key = `${a.nodeId}|${a.position}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(a.id);
    }
    for (const ids of grouped.values()) {
      ids.forEach((id, idx) => map.set(id, idx));
    }
    return map;
  }, [annotations]);

  return (
    <g>
      {annotations.map((ann) => {
         const isFree = !ann.nodeId;
         const node = isFree ? null : nodeById.get(ann.nodeId);
         if (!isFree && !node) return null;
         const stackIndex = isFree ? 0 : (stackIndexById.get(ann.id) ?? 0);
         const autoLabel = (node && showAutoLabels) ? autoLabels.get(node.id) : undefined;
         const labelBelowHeight = node ? computeLabelBelowHeight(node, autoLabel) : 0;
         const offsetY = node ? (familyYOffsetMap.get(ann.nodeId) ?? 0) : 0;
         const nodeX = node ? node.x : (ann.x ?? 0);
         const nodeY = node ? node.y + offsetY : (ann.y ?? 0);
         return (
           <AnnotationShape key={ann.id} ann={ann}
             nodeX={nodeX} nodeY={nodeY} stackIndex={stackIndex}
             isSelected={selectedAnnotationId === ann.id}
             onClick={() => onAnnotationClick(ann.id, ann.nodeId)}
             onDragStart={(e) => onAnnotationDragStart(ann.id, e)}
             onDoubleClick={() => onAnnotationDoubleClick?.(ann.id)}
             labelBelowHeight={labelBelowHeight}
           />
         );
      })}
    </g>
  );
}

function SibshipLayer({ edges, nodes, invalidEdgeIds, annotations = [], showAutoLabels, autoLabels, familyOffsets }: {
  edges: CanvasData["edges"];
  nodes: PedigreeNode[];
  invalidEdgeIds: Set<string>;
  annotations?: CanvasData["annotations"];
  showAutoLabels?: boolean;
  autoLabels?: Map<string, string>;
  familyOffsets?: Map<string, number>;
  childOffsets?: Map<string, number>;
}) {
  const groups = useMemo(() => {
    const pcEdges = edges.filter((e) => e.type === "parent-child");
    const childParents = new Map<string, string[]>();
    for (const e of pcEdges) {
      if (!childParents.has(e.targetId)) childParents.set(e.targetId, []);
      childParents.get(e.targetId)!.push(e.sourceId);
    }
    const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
    for (const [childId, pIds] of childParents) {
      const key = [...pIds].sort().join("|");
      if (!families.has(key)) families.set(key, { parentIds: [...pIds].sort(), childIds: [] });
      families.get(key)!.childIds.push(childId);
    }
    return [...families.entries()].map(([key, { parentIds, childIds }]) => {
      const allEdges = pcEdges.filter(
        (e) => parentIds.includes(e.sourceId) && childIds.includes(e.targetId)
      );
      const coupleEdge = edges.find(
        (e) => (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") &&
          parentIds.includes(e.sourceId) && parentIds.includes(e.targetId)
      );
      return {
        key: `family-${key}`,
        parentIds,
        childIds,
        nodes,
        invalid: allEdges.some((e) => invalidEdgeIds.has(e.id)),
        edgeType: (coupleEdge?.type as "couple" | "consanguinity" | "divorced" | "separated") ?? "couple",
      };
    });
  }, [edges, nodes, invalidEdgeIds]);

  return (
    <g>
      {groups.map((g) => (
        <SibshipGroup
          key={g.key}
          parentIds={g.parentIds}
          childIds={g.childIds}
          nodes={g.nodes}
          edges={edges}
          invalid={g.invalid}
          edgeType={g.edgeType}
          annotations={annotations}
          showAutoLabels={showAutoLabels}
          autoLabels={autoLabels}
          parentOffsets={familyOffsets}
          childOffsets={familyOffsets}
        />
      ))}
    </g>
  );
}

export function PedigreeCanvasBody() {
  const ctx = usePedigreeEditor();
  const [, navigate] = useLocation();
  const {
    state, ops, memo, refs, dispatch, pedigree, versions } = ctx;
  const { config } = useCanvasConfig();

  const {
    canvas, selectedIds, linkSource, showAutoLabels, viewBox,
    panning, spaceHeld, lassoVisible,
    editModalNodeId, editAnnotationId, showSearch, searchQuery, searchMatchIndex,
    showMinimap, showGrid, showLegend, contextMenu, colorPickerNode,
    selectedAnnotationId, riskMode,
    showRiskPanel, showVersions, showValidation, expandedIssueId,
    showSettings,
    showShareModal, showAddSiblingDialog, siblingSourceId,
    alignGuides,
    twinSelectMode, twinCandidateIds,
    railX,
    showGenerationRail,
  } = state;

  const {
    updateCanvas, addAnnotation, addFreeAnnotation, updateAnnotation, deleteAnnotation,
    setNodeType, setNodeColor, toggleNodeProp, addContextNode, deleteSelected,
    updateSelectedNode, bulkUpdate, alignSelected,
    handleNodeClick, handleNodeDoubleClick, handleNodeContextMenu, handleDragStart,
    handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, updateEdgeType,
    getSVGCoords, handleRestoreVersion,
    addSiblings, markAsTwins, unmarkTwins,
  } = ops;

  const {
    autoLabels, validation, searchMatches, generationRailEntries, legendEntries,
    visibleGenRows, vbW, vbH, MM_W, MM_H, anySelected,
  } = memo;

  const isPropertiesPanelOpen = (anySelected || selectedAnnotationId !== null) && !showRiskPanel && !showValidation && !showVersions && !showSettings && !editModalNodeId;
  const isSidePanelOpen = isPropertiesPanelOpen || showSettings || showRiskPanel || showValidation || showVersions;

  const {
    svgRef, preDragCanvasRef, lassoRectRef, searchInputRef,
    pendingAnnDragRef,
  } = refs;

  const fakeMouseEvent = useCallback((clientX: number, clientY: number): React.MouseEvent => ({
    clientX, clientY,
    metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, button: 0,
    preventDefault: () => {}, stopPropagation: () => {},
  } as unknown as React.MouseEvent), []);

  useEffect(() => {
    if (!showRiskPanel && !showValidation && !showVersions && !showSettings) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch({ type: "SET_STATE", patch: { showRiskPanel: false, showValidation: false, showVersions: false, showSettings: false } });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showRiskPanel, showValidation, showVersions, showSettings, dispatch]);

  const handleCloseContextMenu = useCallback(() => dispatch({ type: "SET_STATE", patch: { contextMenu: null } }), [dispatch]);

  const handleReorderAnnotations = useCallback((annId: string, direction: "up" | "down") => {
    updateCanvas((prev) => {
      const anns = [...prev.annotations];
      const idx = anns.findIndex((a) => a.id === annId);
      if (idx === -1) return prev;
      const currentAnn = anns[idx];
      if (!currentAnn) return prev;
      const nodeId = currentAnn.nodeId;

      // Find the indices of annotations that belong to the SAME node
      const nodeAnnIndices = anns
        .map((a, i) => ({ a, i }))
        .filter((item) => item.a.nodeId === nodeId)
        .map((item) => item.i);

      const relativeIdx = nodeAnnIndices.indexOf(idx);
      if (relativeIdx === -1) return prev;

      if (direction === "up" && relativeIdx > 0) {
        const targetIdx = nodeAnnIndices[relativeIdx - 1];
        if (targetIdx === undefined) return prev;
        const temp = anns[idx];
        const targetAnn = anns[targetIdx];
        if (!temp || !targetAnn) return prev;
        anns[idx] = targetAnn;
        anns[targetIdx] = temp;
        return { ...prev, annotations: anns };
      } else if (direction === "down" && relativeIdx < nodeAnnIndices.length - 1) {
        const targetIdx = nodeAnnIndices[relativeIdx + 1];
        if (targetIdx === undefined) return prev;
        const temp = anns[idx];
        const targetAnn = anns[targetIdx];
        if (!temp || !targetAnn) return prev;
        anns[idx] = targetAnn;
        anns[targetIdx] = temp;
        return { ...prev, annotations: anns };
      }
      return prev;
    });
  }, [updateCanvas]);


  // ── Generation rail drag state ──────────────────────────────────
  const railDraggingRef = useRef(false);
  const railDragStartXRef = useRef(0);
  const railDragStartRailXRef = useRef(44);

const RAIL_HIT_W = 30;
const RAIL_MIN_X = 0;
const RAIL_MAX_X = 400;

  const handleRailPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    railDraggingRef.current = true;
    railDragStartXRef.current = e.clientX;
    railDragStartRailXRef.current = railX;
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [railX]);

  const handleRailPointerMove = useCallback((e: React.PointerEvent) => {
    if (!railDraggingRef.current) return;
    e.stopPropagation();
    const dx = (e.clientX - railDragStartXRef.current) * viewBox.zoom;
    const newRailX = Math.max(RAIL_MIN_X, Math.min(RAIL_MAX_X, railDragStartRailXRef.current + dx));
    dispatch({ type: "SET_STATE", patch: { railX: newRailX } });
  }, [dispatch, viewBox.zoom]);

  const handleRailPointerUp = useCallback((e: React.PointerEvent) => {
    railDraggingRef.current = false;
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, []);

  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasTouch({
    getSVGCoords,
    setViewBox: (vb) => dispatch({ type: "SET_STATE", patch: { viewBox: typeof vb === "function" ? vb(viewBox) : vb } }),
    viewBox,
    W: 1400,
    H: 900,
    canvasNodes: canvas.nodes,
    onNodeTap: useCallback((nid: string) => { handleNodeClick(nid, fakeMouseEvent(0, 0)); }, [handleNodeClick, fakeMouseEvent]),
    onNodeDoubleTap: useCallback((nid: string) => { handleNodeDoubleClick(nid, fakeMouseEvent(0, 0)); }, [handleNodeDoubleClick, fakeMouseEvent]),
    onNodeContextMenu: useCallback((nid: string, clientX: number, clientY: number) => { handleNodeContextMenu(nid, fakeMouseEvent(clientX, clientY)); }, [handleNodeContextMenu, fakeMouseEvent]),
  });

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
      if (!svgEl.contains(e.target as Node)) return;
      e.preventDefault();
      handleWheel(e as unknown as React.WheelEvent);
    };
    document.addEventListener("wheel", handler, { passive: false });
    return () => document.removeEventListener("wheel", handler);
  }, [handleWheel]);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI__" in window)) return;
    const vv = window.visualViewport;
    if (!vv) return;
    let lastScale = vv.scale;
    const handler = () => {
      const currentScale = vv.scale;
      const delta = currentScale - lastScale;
      lastScale = currentScale;
      if (Math.abs(delta) > 0.005) {
        const factor = 1 + delta * 3;
        handleWheel({
          ctrlKey: true,
          deltaY: -Math.log(factor) / Math.log(0.95),
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2,
        } as unknown as React.WheelEvent);
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke("reset_zoom").catch(() => {});
        });
      }
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, [handleWheel]);

  const handleAnnotationClick = useCallback((annId: string, nodeId: string) => {
    dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: selectedAnnotationId === annId ? null : annId, selectedIds: nodeId ? new Set([nodeId]) : new Set(), showSettings: false } });
  }, [selectedAnnotationId]);

  const handleAnnotationDragStart = useCallback((annId: string, e: React.MouseEvent) => {
    const coords = getSVGCoords(e);
    if (!coords) return;
    preDragCanvasRef.current = canvas;
    const ann = canvas.annotations.find((a) => a.id === annId);
    if (!ann) return;
    const isFree = !ann.nodeId;
    const node = isFree ? null : canvas.nodes.find((n) => n.id === ann.nodeId);
    const autoLabel = node && showAutoLabels ? autoLabels.get(ann.nodeId) : undefined;
    const labelBelowHeight = node ? computeLabelBelowHeight(node, autoLabel) : 0;
    const stackIndex = isFree ? 0 : (() => {
      const grouped = new Map<string, string[]>();
      for (const a of canvas.annotations) {
        if (!a.nodeId) continue;
        const key = `${a.nodeId}|${a.position}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(a.id);
      }
      for (const ids of grouped.values()) {
        const idx = ids.indexOf(annId);
        if (idx >= 0) return idx;
      }
      return 0;
    })();
    const initOffset = isFree
      ? { x: ann.x ?? 0, y: ann.y ?? 0 }
      : { x: ann.offsetX ?? 0, y: ann.offsetY ?? 0 };
    pendingAnnDragRef.current = { annId, startSVG: coords, initOffset, labelBelowHeight, stackIndex };
  }, [getSVGCoords, canvas, preDragCanvasRef, showAutoLabels, autoLabels]);

  const nodeIdsWithEdges = useMemo(() => {
    const ids = new Set<string>();
    for (const e of canvas.edges) { ids.add(e.sourceId); ids.add(e.targetId); }
    return ids;
  }, [canvas.edges]);

  const familyOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    const pcEdges = canvas.edges.filter((e) => e.type === "parent-child");
    const childParents = new Map<string, string[]>();
    for (const e of pcEdges) {
      if (!childParents.has(e.targetId)) childParents.set(e.targetId, []);
      childParents.get(e.targetId)!.push(e.sourceId);
    }
    const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
    for (const [childId, pIds] of childParents) {
      const key = [...pIds].sort().join("|");
      if (!families.has(key)) families.set(key, { parentIds: [...pIds].sort(), childIds: [] });
      families.get(key)!.childIds.push(childId);
    }
    const nodeMap = new Map(canvas.nodes.map((n) => [n.id, n]));
    const sortedFamilies = [...families.entries()].sort((a, b) => {
      const aParent = a[1].parentIds[0] ? nodeMap.get(a[1].parentIds[0]) : null;
      const bParent = b[1].parentIds[0] ? nodeMap.get(b[1].parentIds[0]) : null;
      return (aParent?.y ?? 0) - (bParent?.y ?? 0);
    });
    // Group sorted families by parent Y coordinate
    const familiesByRow = new Map<number, { parentIds: string[]; childIds: string[] }[]>();
    for (const [, fam] of sortedFamilies) {
      const parentNode = fam.parentIds[0] ? nodeMap.get(fam.parentIds[0]) : null;
      const py = parentNode?.y ?? 0;
      if (!familiesByRow.has(py)) familiesByRow.set(py, []);
      familiesByRow.get(py)!.push(fam);
    }

    const sortedRowYs = [...familiesByRow.keys()].sort((a, b) => a - b);
    for (const py of sortedRowYs) {
      const rowFamilies = familiesByRow.get(py)!;
      for (const fam of rowFamilies) {
        const familyMap = computeFamilyChildYOffset(
          fam.parentIds,
          fam.childIds,
          canvas.nodes,
          canvas.annotations,
          config.nodeSize,
          showAutoLabels,
          autoLabels,
          offsets,
          canvas.edges,
          config
        );
        for (const [nid, delta] of familyMap) offsets.set(nid, delta);
      }

      // Align couple offsets on the child generation row
      const coupleEdges = canvas.edges.filter(
        (e) => e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated"
      );
      for (let pass = 0; pass < 2; pass++) {
        for (const e of coupleEdges) {
          const uNode = nodeMap.get(e.sourceId);
          const vNode = nodeMap.get(e.targetId);
          if (uNode && vNode && Math.abs(uNode.y - vNode.y) < 30) {
            const uOff = offsets.get(e.sourceId) ?? 0;
            const vOff = offsets.get(e.targetId) ?? 0;
            if (uOff !== vOff) {
              const maxOff = Math.max(uOff, vOff);
              offsets.set(e.sourceId, maxOff);
              offsets.set(e.targetId, maxOff);
            }
          }
        }
      }
    }
    return offsets;
  }, [canvas.nodes, canvas.edges, canvas.annotations, showAutoLabels, autoLabels, config.genotypeFontSize, config.genotypeOffset, config.showGenotypes, config.nodeSize]);

  const diffs = useMemo(() => {
    if (!state.isPreviewMode || !state.showVisualDiff || !state.liveCanvasCache) {
      return { added: new Set<string>(), deleted: new Set<string>(), modified: new Set<string>() };
    }
    const liveNodes = state.liveCanvasCache.nodes;
    const previewNodes = canvas.nodes;

    const liveNodeIds = new Set(liveNodes.map(n => n.id));
    const previewNodeIds = new Set(previewNodes.map(n => n.id));

    const added = new Set<string>();
    const deleted = new Set<string>();
    const modified = new Set<string>();

    for (const id of liveNodeIds) {
      if (!previewNodeIds.has(id)) {
        added.add(id);
      }
    }

    const liveNodeMap = new Map(liveNodes.map(n => [n.id, n]));
    for (const pn of previewNodes) {
      if (!liveNodeIds.has(pn.id)) {
        deleted.add(pn.id);
      } else {
        const ln = liveNodeMap.get(pn.id);
        if (ln) {
          if (
            ln.type !== pn.type ||
            ln.affected !== pn.affected ||
            ln.carrier !== pn.carrier ||
            ln.deceased !== pn.deceased ||
            ln.proband !== pn.proband ||
            ln.label !== pn.label ||
            ln.age !== pn.age
          ) {
            modified.add(pn.id);
          }
        }
      }
    }

    return { added, deleted, modified };
  }, [state.isPreviewMode, state.showVisualDiff, state.liveCanvasCache, canvas.nodes]);

  const previewVersion = useMemo(() => {
    if (!state.previewVersionId || !versions) return null;
    return versions.find(v => v.id === state.previewVersionId) || null;
  }, [state.previewVersionId, versions]);

  const handleSVGDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).getAttribute("data-canvas-svg") === "true") {
      const coords = getSVGCoords(e);
      if (!coords) return;
      addFreeAnnotation(coords.x, coords.y);
    }
  }, [getSVGCoords, addFreeAnnotation]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative" data-print-area>
      <div className="flex-1 overflow-hidden relative canvas-spared flex items-center justify-center pt-2 pb-4 px-4" style={{ touchAction: "none", overscrollBehavior: "none" }}>
        {twinSelectMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-medium shadow-md pointer-events-none">
            Twin select: {twinCandidateIds.size} node{twinCandidateIds.size !== 1 ? "s" : ""}
          </div>
        )}
        {state.isPreviewMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-4 py-2 border border-border rounded-lg shadow-lg bg-background/90 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-semibold text-foreground">
                Viewing: {previewVersion ? (previewVersion.label || `Version ${previewVersion.version_number}`) : "Historical Version"}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded font-bold">
                Read-Only
              </span>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={state.showVisualDiff}
                onChange={(e) => dispatch({ type: "TOGGLE_VISUAL_DIFF", enabled: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground font-medium">Highlight Changes</span>
            </label>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleRestoreVersion(state.previewVersionId || 0)}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "EXIT_PREVIEW" })}
                className="px-2.5 py-1 text-xs font-semibold rounded border border-border hover:bg-accent transition-colors"
              >
                Exit Preview
              </button>
            </div>
          </div>
        )}
        <div
          className="flex flex-col flex-shrink-0 relative overflow-visible"
          style={{ aspectRatio: "14 / 9", width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", margin: "auto" }}
        >
          <TabBar
            tabs={memo.tabItems}
            currentId={pedigree?.id ?? 0}
            showTabPicker={state.showTabPicker}
            onToggleTabPicker={() => dispatch({ type: "SET_STATE", patch: { showTabPicker: !state.showTabPicker } })}
            onCloseTabPicker={() => dispatch({ type: "SET_STATE", patch: { showTabPicker: false } })}
            onCloseTab={ops.handleCloseTab}
            onRenameTab={ops.renameTab}
            onNavigate={navigate}
            onOpenTab={(tid, title) => { ops.openTab(tid, title); navigate(`/pedigrees/${tid}`); }}
            onReorderTab={ops.reorderTabs}
            onDeletePedigree={ops.handleDeletePedigree}
            saveStatus={state.saveStatus}
          />
          <div
            className="flex-1 relative skeuo-page border border-black/10 rounded-lg overflow-hidden flex flex-col"
          >
            <svg
              ref={svgRef}
              data-canvas-svg="true"
              data-pedigree-canvas
              className="w-full h-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${vbW} ${vbH}`}
              onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
              onMouseDown={handleSVGMouseDown}
              onDoubleClick={handleSVGDoubleClick}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
              style={{ touchAction: "none", cursor: panning ? "grabbing" : spaceHeld ? "grab" : lassoVisible ? "crosshair" : "default" }}
            >
              <defs>
                <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={config.gridOpacity ?? 0.10} />
                </pattern>
              </defs>
              <rect x={viewBox.x} y={viewBox.y} width={vbW} height={vbH} fill="transparent" data-canvas-background="true" />
              {showGrid && (
                <rect x={viewBox.x} y={viewBox.y} width={vbW} height={vbH} fill="url(#grid-pattern)" pointerEvents="none" />
              )}
          {visibleGenRows.map((row) => (
            <line key={row} x1={viewBox.x} y1={row} x2={viewBox.x + vbW} y2={row}
              stroke={"hsl(var(--primary) / 0.5)"} strokeWidth={0.8} strokeDasharray="8 5" opacity={0.4}
            />
          ))}

          {showGenerationRail && generationRailEntries.length > 0 && (() => {
            // Enforce minimum 24px vertical spacing between rail entries
            const spacedEntries = generationRailEntries.reduce<{ roman: string; y: number }[]>((acc, entry) => {
              if (acc.length === 0) return [{ roman: entry.roman, y: entry.y }];
              const last = acc[acc.length - 1]!;
              const minGap = 24;
              acc.push({ roman: entry.roman, y: Math.max(entry.y, last.y + minGap) });
              return acc;
            }, []);
            return (
              <g data-generation-rail="true">
                <rect
                  x={viewBox.x + railX - RAIL_HIT_W / 2} y={viewBox.y + 30}
                  width={RAIL_HIT_W} height={vbH - 60}
                  fill="transparent" style={{ cursor: "ew-resize" }}
                  onPointerDown={handleRailPointerDown}
                  onPointerMove={handleRailPointerMove}
                  onPointerUp={handleRailPointerUp}
                />
                <line
                  x1={viewBox.x + railX} y1={viewBox.y + 30} x2={viewBox.x + railX} y2={viewBox.y + vbH - 30}
                  stroke={"hsl(var(--primary))"} strokeWidth={0.75} opacity={0.12}
                  style={{ pointerEvents: "none" }}
                />
                {spacedEntries.map(({ roman, y }) => (
                  <text key={roman} x={viewBox.x + railX - 34} y={y + 5} fontSize={14} fontWeight="700"
                    fontFamily="JetBrains Mono, monospace" fill="hsl(var(--foreground) / 0.35)"
                    style={{ userSelect: "none", letterSpacing: "0.05em", pointerEvents: "none" }}
                  >{roman}</text>
                ))}
              </g>
            );
          })()}

          {alignGuides.length > 0 && (
            <g style={{ pointerEvents: "none" }}>
              {alignGuides.map((g, i) => {
                const isSnap = g.strength === "snap";
                const sw = isSnap ? 1.5 : 0.75;
                const opacity = isSnap ? 0.85 : 0.5;
                const dash = isSnap ? undefined : "4 4";
                return g.axis === "x" ? (
                  <line key={i} x1={g.pos} y1={viewBox.y} x2={g.pos} y2={viewBox.y + vbH}
                    stroke="hsl(var(--primary))" strokeWidth={sw} strokeDasharray={dash} opacity={opacity} />
                ) : (
                  <line key={i} x1={viewBox.x} y1={g.pos} x2={viewBox.x + vbW} y2={g.pos}
                    stroke="hsl(var(--primary))" strokeWidth={sw} strokeDasharray={dash} opacity={opacity} />
                );
              })}
              {alignGuides.filter(g => g.strength === "snap").map((g, i) =>
                g.axis === "x" ? (
                  <polygon key={`d${i}`} points={`${g.pos},${viewBox.y + 10} ${g.pos + 4},${viewBox.y + 16} ${g.pos},${viewBox.y + 22} ${g.pos - 4},${viewBox.y + 16}`}
                    fill="hsl(var(--primary))" opacity={0.6} />
                ) : (
                  <polygon key={`d${i}`} points={`${viewBox.x + 10},${g.pos} ${viewBox.x + 16},${g.pos - 4} ${viewBox.x + 22},${g.pos} ${viewBox.x + 16},${g.pos + 4}`}
                    fill="hsl(var(--primary))" opacity={0.6} />
                )
              )}
            </g>
          )}

          <rect ref={lassoRectRef}
            data-lasso="true"
            fill="hsl(var(--primary) / 0.08)" stroke={"hsl(var(--primary))"} strokeWidth={1.5}
            strokeDasharray="8 4" style={{ display: lassoVisible ? "" : "none", pointerEvents: "none" }}
          />

          {searchMatches.length > 0 && (
            <g>
              {canvas.nodes.filter((n) => searchMatches.includes(n.id)).map((n) => {
                const isActive = searchMatches[Math.min(searchMatchIndex, searchMatches.length - 1)] === n.id;
                return (
                  <circle key={`search-${n.id}`} cx={n.x} cy={n.y} r={NODE_SIZE / 2 + 11}
                    fill="none" stroke={"hsl(var(--primary))"} strokeWidth={isActive ? 2.5 : 1.5}
                    strokeDasharray={isActive ? undefined : "5 4"} opacity={isActive ? 1 : 0.45}
                  />
                );
              })}
            </g>
          )}

          <g>
            {canvas.edges.filter((e) => e.type !== "parent-child").map((edge) => (
              <EdgeLine key={edge.id} edge={edge} nodes={canvas.nodes}
                invalid={showValidation && validation.invalidEdgeIds.has(edge.id)}
                renderOffsets={familyOffsets}
                annotations={canvas.annotations}
                edges={canvas.edges}
                showAutoLabels={showAutoLabels}
                autoLabels={autoLabels}
              />
            ))}
          </g>

          <SibshipLayer edges={canvas.edges} nodes={canvas.nodes} invalidEdgeIds={showValidation ? validation.invalidEdgeIds : EMPTY_SET} annotations={canvas.annotations} showAutoLabels={showAutoLabels} autoLabels={autoLabels} familyOffsets={familyOffsets} />

          <g>
            {canvas.nodes.map((node) => (
              <NodeShape key={node.id} node={node}
                selected={selectedIds.has(node.id)} isLinkSource={linkSource === node.id}
                isTwinCandidate={twinCandidateIds.has(node.id)}
                invalid={showValidation && validation.invalidNodeIds.has(node.id)}
                autoLabel={showAutoLabels ? autoLabels.get(node.id) : undefined}
                hasEdges={nodeIdsWithEdges.has(node.id)}
                renderOffsetY={familyOffsets.get(node.id) ?? 0}
                onClick={(e) => handleNodeClick(node.id, e)}
                onDragStart={(e) => handleDragStart(e, node.id)}
                onContextMenu={(e) => handleNodeContextMenu(node.id, e)}
                onDoubleClick={(e) => handleNodeDoubleClick(node.id, e)}
                diffStatus={state.isPreviewMode && state.showVisualDiff ? (diffs.deleted.has(node.id) ? "deleted" : diffs.modified.has(node.id) ? "modified" : null) : null}
              />
            ))}
          </g>

          {state.isPreviewMode && state.showVisualDiff && state.liveCanvasCache && (
            <g opacity={0.35}>
              {state.liveCanvasCache.nodes.filter(n => diffs.added.has(n.id)).map((node) => (
                <NodeShape key={`ghost-${node.id}`} node={node}
                  selected={false} isLinkSource={false}
                  isTwinCandidate={false}
                  invalid={false}
                  autoLabel={showAutoLabels ? autoLabels.get(node.id) : undefined}
                  hasEdges={false}
                  renderOffsetY={0}
                  onClick={() => {}}
                  onDragStart={() => {}}
                  onContextMenu={() => {}}
                  onDoubleClick={() => {}}
                  diffStatus="added"
                />
              ))}
            </g>
          )}

          <AnnotationLayer
            annotations={canvas.annotations}
            nodes={canvas.nodes}
            selectedAnnotationId={selectedAnnotationId}
            canvas={canvas}
            onAnnotationClick={handleAnnotationClick}
            onAnnotationDragStart={handleAnnotationDragStart}
            onAnnotationDoubleClick={(annId) => dispatch({ type: "SET_STATE", patch: { editAnnotationId: annId } })}
            autoLabels={autoLabels}
            showAutoLabels={showAutoLabels}
            familyYOffsetMap={familyOffsets}
          />

          {canvas.nodes.length === 0 && (
            <text x={viewBox.x + vbW / 2} y={viewBox.y + vbH / 2} textAnchor="middle"
              fill="rgba(255,255,255,0.12)" fontSize={13}
              style={{ fontFamily: "JetBrains Mono, monospace" }}>
              Use toolbar to add nodes · M F U P keys for quick-add
            </text>
          )}
        </svg>
        </div>
        </div>

        {showSearch && (
          <FindBar
            searchQuery={searchQuery}
            onSearchQueryChange={(q) => { dispatch({ type: "SET_STATE", patch: { searchQuery: q, searchMatchIndex: 0 } }); }}
            searchMatchesCount={searchMatches.length} searchMatchIndex={searchMatchIndex}
            onPrevMatch={() => searchMatches.length > 0 && dispatch({ type: "SET_STATE", patch: { searchMatchIndex: (searchMatchIndex - 1 + searchMatches.length) % searchMatches.length } })}
            onNextMatch={() => searchMatches.length > 0 && dispatch({ type: "SET_STATE", patch: { searchMatchIndex: (searchMatchIndex + 1) % searchMatches.length } })}
            onClose={() => { dispatch({ type: "SET_STATE", patch: { showSearch: false, searchQuery: "" } }); }}
            inputRef={searchInputRef}
            onEnterKey={(shiftKey) => {
              if (searchMatches.length === 0) return;
              if (shiftKey) dispatch({ type: "SET_STATE", patch: { searchMatchIndex: (searchMatchIndex - 1 + searchMatches.length) % searchMatches.length } });
              else dispatch({ type: "SET_STATE", patch: { searchMatchIndex: (searchMatchIndex + 1) % searchMatches.length } });
            }}
          />
        )}

        <CanvasOverlayManager
          showMinimap={showMinimap}
          minimapNodes={canvas.nodes}
          minimapEdges={canvas.edges}
          viewBox={{ x: viewBox.x, y: viewBox.y }}
          vbW={vbW} vbH={vbH} mmW={MM_W} mmH={MM_H}
          nodeCount={canvas.nodes.length}
          onMinimapPan={(cx, cy) => dispatch({ type: "SET_STATE", patch: { viewBox: { ...viewBox, x: cx - vbW / 2, y: cy - vbH / 2 } } })}
          showLegend={showLegend}
          legendEntries={legendEntries}
          panelOpen={isSidePanelOpen}
        />

        {editModalNodeId && (() => {
          const editNode = canvas.nodes.find((n) => n.id === editModalNodeId);
          if (!editNode) return null;
          return (
            <NodeQuickEditPopover
              key={editModalNodeId}
              node={editNode}
              svgRef={svgRef}
              onClose={() => dispatch({ type: "SET_STATE", patch: { editModalNodeId: null } })}
              onUpdateNode={(updates) => updateCanvas((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) => n.id === editModalNodeId ? { ...n, ...updates } : n),
              }))}
              onOpenSidebar={() => {
                dispatch({ type: "SET_STATE", patch: { editModalNodeId: null } });
                // Sidepanel auto-opens when a node is selected, which is already true
              }}
            />
          );
        })()}

        {editAnnotationId && (() => {
          const editAnn = canvas.annotations.find((a) => a.id === editAnnotationId);
          if (!editAnn) return null;
          return (
            <AnnotationQuickEditPopover
              key={editAnnotationId}
              annotation={editAnn}
              svgRef={svgRef}
              canvasNodes={canvas.nodes}
              onClose={() => dispatch({ type: "SET_STATE", patch: { editAnnotationId: null } })}
              onUpdateAnnotation={(updates) => updateAnnotation(editAnn.id, updates)}
              onDeleteAnnotation={() => deleteAnnotation(editAnn.id)}
            />
          );
        })()}

        {contextMenu && (() => {
          const ctxNode = canvas.nodes.find((n) => n.id === contextMenu.nodeId);
          if (!ctxNode) return null;
          return (
            <ContextMenu ctxNode={ctxNode}
              canvasEdges={canvas.edges} canvasNodes={canvas.nodes}
              position={{ x: contextMenu.x, y: contextMenu.y }}
              onClose={handleCloseContextMenu}
              onSetNodeType={setNodeType} onToggleNodeProp={toggleNodeProp}
              onAddContextNode={addContextNode} onDeleteSelected={deleteSelected}
              onSetLinkMode={(mode, sourceId) => { dispatch({ type: "SET_STATE", patch: { linkMode: mode, linkSource: sourceId } }); }}
              onOpenColorPicker={(nodeId) => dispatch({ type: "SET_STATE", patch: { colorPickerNode: nodeId } })}
              selectedIds={selectedIds}
              onMarkAsTwins={markAsTwins}
              onUnmarkTwins={unmarkTwins}
            />
          );
        })()}

        {colorPickerNode && (() => {
          const cpNode = canvas.nodes.find((n) => n.id === colorPickerNode);
          if (!cpNode) return null;
          return (
            <NodeColorPicker
              node={cpNode}
              svgRef={svgRef}
              onSetColor={setNodeColor}
              onClose={() => dispatch({ type: "SET_STATE", patch: { colorPickerNode: null } })}
            />
          );
        })()}
      </div>

      {(anySelected || selectedAnnotationId !== null) && !showRiskPanel && !showValidation && !showVersions && !showSettings && !editModalNodeId && (
        <PropertiesPanel
            selectedIds={selectedIds}
            canvasNodes={canvas.nodes} canvasEdges={canvas.edges}
            canvasAnnotations={canvas.annotations}
            selectedAnnotationId={selectedAnnotationId}
            onUpdateSelectedNode={updateSelectedNode} onBulkUpdate={bulkUpdate}
            onDeleteSelected={deleteSelected}
            onAddAnnotation={addAnnotation} onUpdateAnnotation={updateAnnotation}
            onDeleteAnnotation={deleteAnnotation}
            onSelectAnnotation={(annId: string | null) => {
              dispatch({
                type: "SET_STATE",
                patch: {
                  selectedAnnotationId: annId,
                  editAnnotationId: annId,
                },
              });
            }}
            onReorderAnnotations={handleReorderAnnotations}
            onAlignSelected={alignSelected}
            onMarkAsTwins={markAsTwins}
            onUnmarkTwins={unmarkTwins}
            onRemoveEdges={ops.removeEdges}
            onUpdateEdgeType={updateEdgeType}
            onCreateCoupleEdge={ops.createCoupleEdge}
            onCreateConsanguinityEdge={ops.createConsanguinityEdge}
            onCreateCoupleAndChild={ops.createCoupleAndChild}
            onCreateParentsForGroup={ops.createParentsForGroup}
          />
        )}

        {showSettings && (
          <div className="absolute right-0 top-0 bottom-0 z-30 overflow-hidden shadow-[-4px_0_12px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08)]">
            <SettingsPanel
              onClose={() => dispatch({ type: "SET_STATE", patch: { showSettings: false } })}
            />
          </div>
        )}

        {showRiskPanel && (
          <div className="absolute right-0 top-0 bottom-0 z-30 overflow-hidden rounded-l-lg h-full shadow-[-4px_0_12px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08)]">
            <RiskPanelSidebar canvas={canvas} mode={riskMode}
              onModeChange={(m) => dispatch({ type: "SET_STATE", patch: { riskMode: m } })}
              onClose={() => dispatch({ type: "SET_STATE", patch: { showRiskPanel: false } })}
              width="w-80"
            />
          </div>
        )}

        {showValidation && (
          <div className="absolute right-0 top-0 bottom-0 z-30 overflow-hidden shadow-[-4px_0_12px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08)]">
            <ValidationPanelWrapper
              validation={validation} expandedIssueId={expandedIssueId}
              onToggleIssue={(id) => dispatch({ type: "SET_STATE", patch: { expandedIssueId: expandedIssueId === id ? null : id } })}
              onFocusIssue={(nodeIds) => {
                if (nodeIds.length > 0) {
                  dispatch({
                    type: "SET_STATE",
                    patch: {
                      selectedIds: new Set(nodeIds),
                      showValidation: true,
                      showRiskPanel: false,
                      showVersions: false,
                    },
                  });
                }
              }}
              nodes={canvas.nodes}
              onClose={() => dispatch({ type: "SET_STATE", patch: { showValidation: false } })}
            />
          </div>
        )}

      {showVersions && (
        <VersionHistoryPanel
          onClose={() => dispatch({ type: "SET_STATE", patch: { showVersions: false } })}
        />
      )}

      {showShareModal && pedigree && (
        <ShareModal
          pedigreeId={pedigree.id}
          pedigreeTitle={pedigree.title}
          pedigreeData={JSON.stringify(canvas)}
          canvasNodes={canvas.nodes}
          canvasEdges={canvas.edges}
          onPedigreeReceived={async (data) => {
            if (ops.backgroundSaveVersion) {
              await ops.backgroundSaveVersion("Auto-saved before Data Merge");
            }
            dispatch({ type: "SET_CANVAS", canvas: typeof data === 'string' ? parseCanvas(data) : data as CanvasData });
          }}
          onClose={() => dispatch({ type: "SET_STATE", patch: { showShareModal: false } })}
          backgroundSaveVersion={ops.backgroundSaveVersion}
        />
      )}

      {showAddSiblingDialog && siblingSourceId && (() => {
        const srcNode = canvas.nodes.find((n) => n.id === siblingSourceId);
        if (!srcNode) return null;
        return (
          <AddSiblingDialog sourceNode={srcNode}
            autoLabel={showAutoLabels ? autoLabels.get(siblingSourceId) : undefined}
            onConfirm={(siblings) => addSiblings(siblingSourceId, siblings)}
            onCancel={() => dispatch({ type: "SET_STATE", patch: { showAddSiblingDialog: false, siblingSourceId: null } })}
          />
        );
      })()}
    </div>
  );
}
