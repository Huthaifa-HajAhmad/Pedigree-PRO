import { type Dispatch, type SetStateAction, type RefObject, useEffect } from "react";
import { NodeShape } from "@/features/pedigree-editor/canvas/NodeShape";
import { EdgeLine } from "@/features/pedigree-editor/canvas/EdgeLine";
import { SibshipGroup } from "@/features/pedigree-editor/canvas/SibshipGroup";
import { AnnotationShape } from "@/features/pedigree-editor/canvas/AnnotationShape";
import { Minimap } from "@/features/pedigree-editor/overlay/Minimap";
import { FindBar } from "@/features/pedigree-editor/overlay/FindBar";
import { KeyboardShortcutHint } from "@/features/pedigree-editor/overlay/KeyboardShortcutHint";
import { LegendPanel } from "@/features/pedigree-editor/overlay/LegendPanel";
import { NodeEditModal } from "@/features/pedigree-editor/modals/NodeEditModal";
import { ContextMenu } from "@/features/pedigree-editor/overlay/ContextMenu";
import { PropertiesPanel } from "@/features/pedigree-editor/panels/PropertiesPanel";
import { RiskPanelSidebar } from "@/features/pedigree-editor/panels/RiskCalculatorPanel";
import { VersionHistoryPanel } from "@/features/pedigree-editor/panels/VersionHistoryPanel";
import { ValidationPanelWrapper } from "@/features/pedigree-editor/panels/ValidationPanelWrapper";
import { ShareModal } from "@/components/ShareModal";
import type { PedigreeNode, CanvasData } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";
import { type InheritanceMode } from "@/lib/risk-calculator";


export interface PedigreeCanvasBodyProps {
  svgRef: RefObject<SVGSVGElement | null>;
  canvas: CanvasData;
  selectedIds: Set<string>;
  linkSource: string | null;
  showAutoLabels: boolean;
  autoLabels: Map<string, string>;
  validation: ReturnType<typeof import("@/lib/validate-pedigree").validatePedigree>;
  viewBox: { x: number; y: number; zoom: number };
  vbW: number;
  vbH: number;
  W: number;
  H: number;
  MM_W: number;
  MM_H: number;
  panning: { startX: number; startY: number; vbX: number; vbY: number } | null;
  spaceHeld: boolean;
  lassoVisible: boolean;
  isDragging: boolean;
  annDragging: { annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number } } | null;
  lassoRectRef: RefObject<SVGRectElement | null>;
  visibleGenRows: number[];
  generationRailEntries: Array<{ roman: string; y: number }>;
  searchMatches: string[];
  searchMatchIndex: number;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleSVGMouseDown: (e: React.MouseEvent) => void;
  handleWheel: (e: React.WheelEvent) => void;
  handleNodeClick: (nodeId: string, e: React.MouseEvent) => void;
  handleDragStart: (e: React.MouseEvent, nodeId: string) => void;
  handleNodeContextMenu: (nodeId: string, e: React.MouseEvent) => void;
  handleNodeDoubleClick: (nodeId: string, e: React.MouseEvent) => void;
  getSVGCoords: (e: { clientX: number; clientY: number }) => { x: number; y: number } | null;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedAnnotationId: Dispatch<SetStateAction<string | null>>;
  setAnnDragging: Dispatch<SetStateAction<{ annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number } } | null>>;
  preDragCanvasRef: React.MutableRefObject<CanvasData | null>;
  showSearch: boolean;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSearchMatchIndex: Dispatch<SetStateAction<number>>;
  setShowSearch: Dispatch<SetStateAction<boolean>>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  showMinimap: boolean;
  setViewBox: Dispatch<SetStateAction<{ x: number; y: number; zoom: number }>>;
  showGrid: boolean;
  showLegend: boolean;
  legendEntries: Array<{ key: string; label: string }>;
  editModalNodeId: string | null;
  setEditModalNodeId: Dispatch<SetStateAction<string | null>>;
  updateCanvas: (updater: (prev: CanvasData) => CanvasData, opts?: { skipHistory?: boolean }) => void;
  addAnnotation: (nodeId: string) => void;
  updateAnnotation: (annId: string, updates: Partial<import("@/features/pedigree-editor/canvas/types").PedigreeAnnotation>) => void;
  deleteAnnotation: (annId: string) => void;
  contextMenu: { nodeId: string; x: number; y: number } | null;
  setContextMenu: Dispatch<SetStateAction<{ nodeId: string; x: number; y: number } | null>>;
  setNodeType: (nodeId: string, type: PedigreeNode["type"]) => void;
  toggleNodeProp: (nodeId: string, prop: "affected" | "carrier" | "deceased" | "proband") => void;
  addContextNode: (rel: "child" | "sibling" | "partner") => void;
  deleteSelected: () => void;
  setLinkMode: Dispatch<SetStateAction<"couple" | "parent-child" | "consanguinity" | null>>;
  setLinkSource: Dispatch<SetStateAction<string | null>>;
  anySelected: boolean;
  selectedAnnotationId: string | null;
  riskMode: InheritanceMode;
  showRiskCalc: boolean;
  setShowRiskCalc: Dispatch<SetStateAction<boolean>>;
  setRiskMode: Dispatch<SetStateAction<InheritanceMode>>;
  updateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  bulkUpdate: (updates: Partial<PedigreeNode>) => void;
  alignSelected: (axis: "x" | "y") => void;
  showRiskPanel: boolean;
  setShowRiskPanel: Dispatch<SetStateAction<boolean>>;
  showVersions: boolean;
  versions: Array<{ id: number; canvas_data: string; label: string | null; version_number: number; created_at: string; thumbnail: string | null; saver_key?: string | null }> | undefined;
  versionsLoading: boolean;
  handleSaveVersion: () => void;
  handleRestoreVersion: (versionId: number) => void;
  handleDeleteVersion: (versionId: number) => void;
  showValidation: boolean;
  expandedIssueId: string | null;
  setExpandedIssueId: Dispatch<SetStateAction<string | null>>;
  setShowValidation: Dispatch<SetStateAction<boolean>>;
  showShareModal: boolean;
  setShowShareModal: Dispatch<SetStateAction<boolean>>;
  pedigree: { id: number; title: string } | undefined;
}

export function PedigreeCanvasBody(props: PedigreeCanvasBodyProps) {
  const {
    svgRef, canvas, selectedIds, linkSource, showAutoLabels, autoLabels,
    validation, viewBox, vbW, vbH, W, H, MM_W, MM_H,
    panning, spaceHeld, lassoVisible, isDragging, annDragging,
    lassoRectRef, visibleGenRows, generationRailEntries,
    searchMatches, searchMatchIndex,
    handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel,
    handleNodeClick, handleDragStart, handleNodeContextMenu, handleNodeDoubleClick,
    getSVGCoords, setSelectedIds, setSelectedAnnotationId, setAnnDragging,
    preDragCanvasRef,
    showSearch, searchQuery, setSearchQuery, setSearchMatchIndex,
    setShowSearch, searchInputRef,
    showMinimap, setViewBox, showGrid, showLegend, legendEntries,
    editModalNodeId, setEditModalNodeId, updateCanvas,
    addAnnotation, updateAnnotation, deleteAnnotation,
    contextMenu, setContextMenu, setNodeType, toggleNodeProp,
    addContextNode, deleteSelected, setLinkMode, setLinkSource,
    anySelected, selectedAnnotationId, riskMode, showRiskCalc,
    setShowRiskCalc, setRiskMode, updateSelectedNode, bulkUpdate,
    alignSelected,
    showRiskPanel, setShowRiskPanel,
    showVersions, versions, versionsLoading,
    handleSaveVersion, handleRestoreVersion, handleDeleteVersion,
    showValidation, expandedIssueId, setExpandedIssueId, setShowValidation,
    showShareModal, setShowShareModal, pedigree,
  } = props;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => { e.preventDefault(); handleWheel(e as unknown as React.WheelEvent); };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [handleWheel, svgRef]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className={`flex-1 overflow-hidden relative ${showGrid ? "grid-bg" : ""}`}>
        <svg
          ref={svgRef}
          data-canvas-svg="true"
          className="w-full h-full"
          viewBox={`${viewBox.x} ${viewBox.y} ${vbW} ${vbH}`}
          onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseDown={handleSVGMouseDown}
          style={{ cursor: panning ? "grabbing" : spaceHeld ? "grab" : lassoVisible ? "crosshair" : "default" }}
        >
          {visibleGenRows.map((row) => (
            <line key={row} x1={viewBox.x} y1={row} x2={viewBox.x + vbW} y2={row}
              stroke={"hsl(var(--primary))"} strokeWidth={0.5} strokeDasharray="6 4" opacity={0.25}
            />
          ))}

          {generationRailEntries.length > 0 && (
            <g style={{ pointerEvents: "none" }}>
              <line x1={viewBox.x + 44} y1={viewBox.y + 30} x2={viewBox.x + 44} y2={viewBox.y + vbH - 30}
                stroke={"hsl(var(--primary))"} strokeWidth={0.75} opacity={0.12}
              />
              {generationRailEntries.map(({ roman, y }) => (
                <text key={roman} x={viewBox.x + 10} y={y + 5} fontSize={14} fontWeight="700"
                  fontFamily="JetBrains Mono, monospace" fill="hsl(var(--foreground) / 0.35)"
                  style={{ userSelect: "none", letterSpacing: "0.05em" }}
                >{roman}</text>
              ))}
            </g>
          )}

          <rect ref={lassoRectRef} x={0} y={0} width={0} height={0}
            fill="hsl(var(--primary) / 0.08)" stroke={"hsl(var(--primary))"} strokeWidth={1.5}
            strokeDasharray="8 4" style={{ display: "none", pointerEvents: "none" }}
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
                invalid={validation.invalidEdgeIds.has(edge.id)}
              />
            ))}
          </g>

          <g>
            {(() => {
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
              return [...families.entries()].map(([key, { parentIds, childIds }]) => {
                const allEdges = pcEdges.filter(
                  (e) => parentIds.includes(e.sourceId) && childIds.includes(e.targetId)
                );
                return (
                  <SibshipGroup key={`family-${key}`}
                    parentIds={parentIds} childIds={childIds} nodes={canvas.nodes}
                    invalid={allEdges.some((e) => validation.invalidEdgeIds.has(e.id))}
                  />
                );
              });
            })()}
          </g>

          <g>
            {canvas.nodes.map((node) => (
              <NodeShape key={node.id} node={node}
                selected={selectedIds.has(node.id)} isLinkSource={linkSource === node.id}
                invalid={validation.invalidNodeIds.has(node.id)}
                autoLabel={showAutoLabels ? autoLabels.get(node.id) : undefined}
                onClick={(e) => handleNodeClick(node.id, e)}
                onDragStart={(e) => handleDragStart(e, node.id)}
                onContextMenu={(e) => handleNodeContextMenu(node.id, e)}
                onDoubleClick={(e) => handleNodeDoubleClick(node.id, e)}
                animated={!isDragging && !annDragging}
              />
            ))}
          </g>

          <g>
            {canvas.annotations.map((ann) => {
              const node = canvas.nodes.find((n) => n.id === ann.nodeId);
              if (!node) return null;
              const siblings = canvas.annotations.filter(
                (a) => a.nodeId === ann.nodeId && a.position === ann.position
              );
              const stackIndex = siblings.findIndex((a) => a.id === ann.id);
              return (
                <AnnotationShape key={ann.id} ann={ann}
                  nodeX={node.x} nodeY={node.y} stackIndex={stackIndex}
                  isSelected={selectedAnnotationId === ann.id}
                  onClick={() => {
                    setSelectedAnnotationId((prev) => prev === ann.id ? null : ann.id);
                    setSelectedIds(new Set([ann.nodeId]));
                  }}
                  onDragStart={(e) => {
                    const coords = getSVGCoords(e);
                    if (!coords) return;
                    setSelectedAnnotationId(ann.id);
                    preDragCanvasRef.current = canvas;
                    setAnnDragging({
                      annId: ann.id, startSVG: coords,
                      initOffset: { x: ann.offsetX ?? 0, y: ann.offsetY ?? 0 },
                    });
                  }}
                />
              );
            })}
          </g>

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
            onSearchQueryChange={(q) => { setSearchQuery(q); setSearchMatchIndex(0); }}
            searchMatchesCount={searchMatches.length} searchMatchIndex={searchMatchIndex}
            onPrevMatch={() => searchMatches.length > 0 && setSearchMatchIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length)}
            onNextMatch={() => searchMatches.length > 0 && setSearchMatchIndex((i) => (i + 1) % searchMatches.length)}
            onClose={() => { setShowSearch(false); setSearchQuery(""); }}
            inputRef={searchInputRef}
            onEnterKey={(shiftKey) => {
              if (searchMatches.length === 0) return;
              if (shiftKey) setSearchMatchIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length);
              else setSearchMatchIndex((i) => (i + 1) % searchMatches.length);
            }}
          />
        )}

        {showMinimap && canvas.nodes.length > 0 && (
          <Minimap nodes={canvas.nodes} edges={canvas.edges}
            viewBox={{ x: viewBox.x, y: viewBox.y }} vbW={vbW} vbH={vbH}
            mmW={MM_W} mmH={MM_H}
            onPan={(fx, fy) => setViewBox((prev) => ({
              ...prev, x: fx * W - vbW / 2, y: fy * H - vbH / 2,
            }))}
          />
        )}

        <KeyboardShortcutHint singleSelected={selectedIds.size === 1} />

        {showLegend && <LegendPanel entries={legendEntries} />}

        {editModalNodeId && (() => {
          const editNode = canvas.nodes.find((n) => n.id === editModalNodeId);
          if (!editNode) return null;
          const nodeAnnotations = canvas.annotations.filter((a) => a.nodeId === editModalNodeId);
          const nodeAutoLabel = showAutoLabels ? autoLabels.get(editModalNodeId) : undefined;
          return (
            <NodeEditModal key={editModalNodeId}
              node={editNode} autoLabel={nodeAutoLabel} annotations={nodeAnnotations}
              onClose={() => setEditModalNodeId(null)}
              onUpdateNode={(updates) => updateCanvas((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) => n.id === editModalNodeId ? { ...n, ...updates } : n),
              }))}
              onAddAnnotation={addAnnotation}
              onUpdateAnnotation={updateAnnotation}
              onDeleteAnnotation={deleteAnnotation}
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
              onClose={() => setContextMenu(null)}
              onSetNodeType={setNodeType} onToggleNodeProp={toggleNodeProp}
              onAddContextNode={addContextNode} onDeleteSelected={deleteSelected}
              onSetLinkMode={(mode, sourceId) => { setLinkMode(mode); setLinkSource(sourceId); }}
            />
          );
        })()}

        {anySelected && (
          <PropertiesPanel
            selectedIds={selectedIds}
            canvasNodes={canvas.nodes} canvasEdges={canvas.edges}
            canvasAnnotations={canvas.annotations}
            selectedAnnotationId={selectedAnnotationId}
            riskMode={riskMode} showRiskCalc={showRiskCalc}
            onShowRiskCalc={setShowRiskCalc} onRiskModeChange={setRiskMode}
            onUpdateSelectedNode={updateSelectedNode} onBulkUpdate={bulkUpdate}
            onDeleteSelected={deleteSelected}
            onAddAnnotation={addAnnotation} onUpdateAnnotation={updateAnnotation}
            onDeleteAnnotation={deleteAnnotation}
            onSelectAnnotation={(annId: string | null) => setSelectedAnnotationId(annId)}
            onAlignSelected={alignSelected}
          />
        )}
      </div>

      {showRiskPanel && (
        <RiskPanelSidebar canvas={canvas} mode={riskMode}
          onModeChange={setRiskMode} onClose={() => setShowRiskPanel(false)}
        />
      )}

      {showVersions && (
        <VersionHistoryPanel
          versions={(versions as any) ?? []} versionsLoading={versionsLoading}
          onSave={handleSaveVersion} onRestore={handleRestoreVersion}
          onDelete={handleDeleteVersion}
        />
      )}

      {showValidation && (
        <ValidationPanelWrapper
          validation={validation} expandedIssueId={expandedIssueId}
          onToggleIssue={(id) => setExpandedIssueId(expandedIssueId === id ? null : id)}
          onFocusIssue={(nodeIds) => {
            if (nodeIds.length > 0) { setSelectedIds(new Set(nodeIds)); setShowValidation(true); }
          }}
          nodes={canvas.nodes}
        />
      )}

      {showShareModal && pedigree && (
        <ShareModal pedigreeId={pedigree.id} pedigreeTitle={pedigree.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}