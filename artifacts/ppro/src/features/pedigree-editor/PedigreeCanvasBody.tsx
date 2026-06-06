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
import { ContextMenu } from "@/features/pedigree-editor/overlay/ContextMenu";
import { NodeColorPicker } from "@/features/pedigree-editor/overlay/NodeColorPicker";
import { AddSiblingDialog } from "@/features/pedigree-editor/overlay/AddSiblingDialog";
import { PropertiesPanel } from "@/features/pedigree-editor/panels/PropertiesPanel";
import { RiskPanelSidebar } from "@/features/pedigree-editor/panels/RiskCalculatorPanel";
import { VersionHistoryPanel } from "@/features/pedigree-editor/panels/VersionHistoryPanel";
import { ValidationPanelWrapper } from "@/features/pedigree-editor/panels/ValidationPanelWrapper";
import { ShareModal } from "@/components/ShareModal";
import { usePedigreeEditor } from "@/features/pedigree-editor/context/usePedigreeEditor";
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
  onAnnotationClick, onAnnotationDragStart, onAnnotationUpdateText, autoLabels, showAutoLabels, familyYOffsetMap,
}: {
  annotations: CanvasData["annotations"];
  nodes: PedigreeNode[];
  selectedAnnotationId: string | null;
  canvas: CanvasData;
  onAnnotationClick: (annId: string, nodeId: string) => void;
  onAnnotationDragStart: (annId: string, e: React.MouseEvent) => void;
  onAnnotationUpdateText?: (annId: string, text: string) => void;
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
         const node = nodeById.get(ann.nodeId);
         if (!node) return null;
         const stackIndex = stackIndexById.get(ann.id) ?? 0;
         const autoLabel = showAutoLabels ? autoLabels.get(node.id) : undefined;
         const labelBelowHeight = computeLabelBelowHeight(node, autoLabel);
         const offsetY = familyYOffsetMap.get(ann.nodeId) ?? 0;
         return (
           <AnnotationShape key={ann.id} ann={ann}
             nodeX={node.x} nodeY={node.y + offsetY} stackIndex={stackIndex}
             isSelected={selectedAnnotationId === ann.id}
             onClick={() => onAnnotationClick(ann.id, ann.nodeId)}
             onDragStart={(e) => onAnnotationDragStart(ann.id, e)}
             onUpdateText={onAnnotationUpdateText}
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
  const { state, ops, memo, refs, dispatch, pedigree, versions, versionsLoading } = usePedigreeEditor();

  const {
    canvas, selectedIds, linkSource, showAutoLabels, viewBox,
    panning, spaceHeld, lassoVisible,
    editModalNodeId, showSearch, searchQuery, searchMatchIndex,
    showMinimap, showGrid, showLegend, contextMenu, colorPickerNode,
    selectedAnnotationId, riskMode,
    showRiskPanel, showVersions, showValidation, expandedIssueId,
    showShareModal, showAddSiblingDialog, siblingSourceId,
    alignGuides,
    twinSelectMode, twinCandidateIds,
    railX,
  } = state;

  const {
    updateCanvas, addAnnotation, updateAnnotation, deleteAnnotation,
    setNodeType, setNodeColor, toggleNodeProp, addContextNode, deleteSelected,
    updateSelectedNode, bulkUpdate, alignSelected,
    handleNodeClick, handleNodeDoubleClick, handleNodeContextMenu, handleDragStart,
    handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, updateEdgeType,
    getSVGCoords, handleSaveVersion, handleRestoreVersion, handleDeleteVersion,
    addSiblings, markAsTwins, unmarkTwins,
  } = ops;

  const {
    autoLabels, validation, searchMatches, generationRailEntries, legendEntries,
    visibleGenRows, vbW, vbH, MM_W, MM_H, anySelected,
  } = memo;

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
    if (!showRiskPanel && !showValidation && !showVersions) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch({ type: "SET_STATE", patch: { showRiskPanel: false, showValidation: false, showVersions: false } });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showRiskPanel, showValidation, showVersions, dispatch]);

  const handleCloseContextMenu = useCallback(() => dispatch({ type: "SET_STATE", patch: { contextMenu: null } }), [dispatch]);

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
    dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: selectedAnnotationId === annId ? null : annId, selectedIds: new Set([nodeId]) } });
  }, [selectedAnnotationId]);

  const handleAnnotationDragStart = useCallback((annId: string, e: React.MouseEvent) => {
    const coords = getSVGCoords(e);
    if (!coords) return;
    preDragCanvasRef.current = canvas;
    const ann = canvas.annotations.find((a) => a.id === annId);
    const node = ann ? canvas.nodes.find((n) => n.id === ann.nodeId) : undefined;
    const autoLabel = ann && showAutoLabels ? autoLabels.get(ann.nodeId) : undefined;
    const labelBelowHeight = node ? computeLabelBelowHeight(node, autoLabel) : 0;
    const stackIndex = (() => {
      const grouped = new Map<string, string[]>();
      for (const a of canvas.annotations) {
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
    pendingAnnDragRef.current = { annId, startSVG: coords, initOffset: { x: ann?.offsetX ?? 0, y: ann?.offsetY ?? 0 }, labelBelowHeight, stackIndex };
  }, [getSVGCoords, canvas, preDragCanvasRef, showAutoLabels, autoLabels]);

  const handleAnnotationUpdateText = useCallback((annId: string, text: string) => {
    updateAnnotation(annId, { text });
  }, [updateAnnotation]);

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
        const familyMap = computeFamilyChildYOffset(fam.parentIds, fam.childIds, canvas.nodes, canvas.annotations, NODE_SIZE, showAutoLabels, autoLabels, offsets, canvas.edges);
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
  }, [canvas.nodes, canvas.edges, canvas.annotations, showAutoLabels, autoLabels]);

  return (
    <div className="flex flex-1 overflow-hidden" data-print-area>
      <div className={`flex-1 overflow-hidden relative ${showGrid ? "grid-bg" : ""}`} style={{ touchAction: "none", overscrollBehavior: "none" }}>
        {twinSelectMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-medium shadow-md pointer-events-none">
            Twin select: {twinCandidateIds.size} node{twinCandidateIds.size !== 1 ? "s" : ""}
          </div>
        )}
        <svg
          ref={svgRef}
          data-canvas-svg="true"
          data-pedigree-canvas
          className="w-full h-full"
          viewBox={`${viewBox.x} ${viewBox.y} ${vbW} ${vbH}`}
          onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseDown={handleSVGMouseDown}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          style={{ touchAction: "none", cursor: panning ? "grabbing" : spaceHeld ? "grab" : lassoVisible ? "crosshair" : "default" }}
        >
          {visibleGenRows.map((row) => (
            <line key={row} x1={viewBox.x} y1={row} x2={viewBox.x + vbW} y2={row}
              stroke={"hsl(var(--primary) / 0.5)"} strokeWidth={0.8} strokeDasharray="8 5" opacity={0.4}
            />
          ))}

          {generationRailEntries.length > 0 && (() => {
            // Enforce minimum 24px vertical spacing between rail entries
            const spacedEntries = generationRailEntries.reduce<{ roman: string; y: number }[]>((acc, entry) => {
              if (acc.length === 0) return [{ roman: entry.roman, y: entry.y }];
              const last = acc[acc.length - 1]!;
              const minGap = 24;
              acc.push({ roman: entry.roman, y: Math.max(entry.y, last.y + minGap) });
              return acc;
            }, []);
            return (
              <g>
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
              />
            ))}
          </g>

          <AnnotationLayer
            annotations={canvas.annotations}
            nodes={canvas.nodes}
            selectedAnnotationId={selectedAnnotationId}
            canvas={canvas}
            onAnnotationClick={handleAnnotationClick}
            onAnnotationDragStart={handleAnnotationDragStart}
            onAnnotationUpdateText={handleAnnotationUpdateText}
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
          singleSelected={selectedIds.size === 1}
          showRiskPanel={showRiskPanel}
          showValidation={showValidation}
          showVersions={showVersions}
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

        {anySelected && !showRiskPanel && !showValidation && !showVersions && (
          <PropertiesPanel
            selectedIds={selectedIds}
            canvasNodes={canvas.nodes} canvasEdges={canvas.edges}
            canvasAnnotations={canvas.annotations}
            selectedAnnotationId={selectedAnnotationId}
            onUpdateSelectedNode={updateSelectedNode} onBulkUpdate={bulkUpdate}
            onDeleteSelected={deleteSelected}
            onAddAnnotation={addAnnotation} onUpdateAnnotation={updateAnnotation}
            onDeleteAnnotation={deleteAnnotation}
            onSelectAnnotation={(annId: string | null) => dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: annId } })}
            onAlignSelected={alignSelected}
            onMarkAsTwins={markAsTwins}
            onUnmarkTwins={unmarkTwins}
            onRemoveEdges={ops.removeEdges}
            onUpdateEdgeType={updateEdgeType}
            onCreateCoupleEdge={ops.createCoupleEdge}
            onCreateConsanguinityEdge={ops.createConsanguinityEdge}
            onCreateCoupleAndChild={ops.createCoupleAndChild}
          />
        )}

        {showRiskPanel && (
          <div className="absolute right-0 top-0 bottom-0 z-30 overflow-hidden rounded-l-lg h-full shadow-[-4px_0_12px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08)]">
            <RiskPanelSidebar canvas={canvas} mode={riskMode}
              onModeChange={(m) => dispatch({ type: "SET_STATE", patch: { riskMode: m } })}
              onClose={() => dispatch({ type: "SET_STATE", patch: { showRiskPanel: false } })}
            />
          </div>
        )}

        {showValidation && (
          <div className="absolute right-0 top-0 bottom-0 z-30 overflow-hidden shadow-[-4px_0_12px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08)]">
            <ValidationPanelWrapper
              validation={validation} expandedIssueId={expandedIssueId}
              onToggleIssue={(id) => dispatch({ type: "SET_STATE", patch: { expandedIssueId: expandedIssueId === id ? null : id } })}
              onFocusIssue={(nodeIds) => {
                if (nodeIds.length > 0) { dispatch({ type: "SET_STATE", patch: { selectedIds: new Set(nodeIds), showValidation: true } }); }
              }}
              nodes={canvas.nodes}
              onClose={() => dispatch({ type: "SET_STATE", patch: { showValidation: false } })}
            />
          </div>
        )}
      </div>

      {showVersions && (
        <VersionHistoryPanel
          versions={versions ?? []} versionsLoading={versionsLoading}
          onSave={handleSaveVersion} onRestore={handleRestoreVersion}
          onDelete={handleDeleteVersion}
        />
      )}

      {showShareModal && pedigree && (
        <ShareModal pedigreeId={pedigree.id} pedigreeTitle={pedigree.title}
          onClose={() => dispatch({ type: "SET_STATE", patch: { showShareModal: false } })}
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
