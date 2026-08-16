import React from "react";
import { PropertiesPanel } from "@/features/pedigree-editor/panels/PropertiesPanel";
import { RiskPanelSidebar } from "@/features/pedigree-editor/panels/RiskCalculatorPanel";
import { VersionHistoryPanel } from "@/features/pedigree-editor/panels/VersionHistoryPanel";
import { ValidationPanelWrapper } from "@/features/pedigree-editor/panels/ValidationPanelWrapper";
import { SettingsPanel } from "@/features/pedigree-editor/panels/SettingsPanel";
import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation, CanvasData } from "@/features/pedigree-editor/canvas/types";

export function SidePanelDrawer({
  sidePanelWidth,
  onResizeMouseDown,
  isPropertiesPanelOpen,
  showSettings,
  showRiskPanel,
  showValidation,
  showVersions,
  selectedIds,
  canvasNodes,
  canvasEdges,
  canvasAnnotations,
  selectedAnnotationId,
  onUpdateSelectedNode,
  onBulkUpdate,
  onDeleteSelected,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onSelectAnnotation,
  onReorderAnnotations,
  onAlignSelected,
  onDistributeSelected,
  onMarkAsTwins,
  onUnmarkTwins,
  onRemoveEdges,
  onUpdateEdgeType,
  onToggleCoupleInverted,
  onCreateCoupleEdge,
  onCreateConsanguinityEdge,
  onCreateCoupleAndChild,
  onCreateParentsForGroup,
  onCloseSettings,
  canvas,
  riskMode,
  onRiskModeChange,
  onCloseRiskPanel,
  validation,
  expandedIssueId,
  onToggleIssue,
  onFocusIssue,
  onCloseValidation,
  onCloseVersions,
}: {
  sidePanelWidth: number;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  isPropertiesPanelOpen: boolean;
  showSettings: boolean;
  showRiskPanel: boolean;
  showValidation: boolean;
  showVersions: boolean;
  selectedIds: Set<string>;
  canvasNodes: PedigreeNode[];
  canvasEdges: PedigreeEdge[];
  canvasAnnotations: PedigreeAnnotation[];
  selectedAnnotationId: string | null;
  onUpdateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  onBulkUpdate: (updates: Partial<PedigreeNode> | ((node: PedigreeNode) => Partial<PedigreeNode>)) => void;
  onDeleteSelected: () => void;
  onAddAnnotation: (nodeId: string) => void;
  onUpdateAnnotation: (annId: string, updates: Partial<PedigreeAnnotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
  onSelectAnnotation: (annId: string | null) => void;
  onReorderAnnotations?: (annId: string, direction: "up" | "down") => void;
  onAlignSelected: (axis: "x" | "y") => void;
  onDistributeSelected: (axis: "x" | "y") => void;
  onMarkAsTwins?: (nodeIds: string[], twinType: "m" | "d") => void;
  onUnmarkTwins?: (nodeIds: string[]) => void;
  onRemoveEdges?: (edgeIds: string[]) => void;
  onUpdateEdgeType?: (edgeId: string, type: PedigreeEdge["type"]) => void;
  onToggleCoupleInverted?: (edgeId: string) => void;
  onCreateCoupleEdge?: (sourceId: string, targetId: string) => void;
  onCreateConsanguinityEdge?: (sourceId: string, targetId: string) => void;
  onCreateCoupleAndChild?: (maleId: string, femaleId: string) => void;
  onCreateParentsForGroup?: (nodeIds: string[]) => void;
  onCloseSettings: () => void;
  canvas: CanvasData;
  riskMode: any;
  onRiskModeChange: (mode: any) => void;
  onCloseRiskPanel: () => void;
  validation: any;
  expandedIssueId: string | null;
  onToggleIssue: (id: string) => void;
  onFocusIssue: (nodeIds: string[]) => void;
  onCloseValidation: () => void;
  onCloseVersions: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-30 flex h-full select-none"
      style={{ width: `${sidePanelWidth}px` }}
    >
      {/* Resize Handler / Drag Handle */}
      <div
        className="w-1.5 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors flex items-center justify-center flex-shrink-0 relative group"
        onMouseDown={onResizeMouseDown}
      >
        <div className="w-[2px] h-8 rounded bg-border group-hover:bg-primary/50 group-active:bg-primary" />
      </div>

      {/* Panel Container */}
      <div className="flex-1 h-full overflow-hidden bg-background shadow-[-4px_0_12px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08)] rounded-l-lg select-text flex flex-col">
        {isPropertiesPanelOpen && (
          <PropertiesPanel
            selectedIds={selectedIds}
            canvasNodes={canvasNodes}
            canvasEdges={canvasEdges}
            canvasAnnotations={canvasAnnotations}
            selectedAnnotationId={selectedAnnotationId}
            onUpdateSelectedNode={onUpdateSelectedNode}
            onBulkUpdate={onBulkUpdate}
            onDeleteSelected={onDeleteSelected}
            onAddAnnotation={onAddAnnotation}
            onUpdateAnnotation={onUpdateAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
            onSelectAnnotation={onSelectAnnotation}
            onReorderAnnotations={onReorderAnnotations}
            onAlignSelected={onAlignSelected}
            onDistributeSelected={onDistributeSelected}
            onMarkAsTwins={onMarkAsTwins}
            onUnmarkTwins={onUnmarkTwins}
            onRemoveEdges={onRemoveEdges}
            onUpdateEdgeType={onUpdateEdgeType}
            onToggleCoupleInverted={onToggleCoupleInverted}
            onCreateCoupleEdge={onCreateCoupleEdge}
            onCreateConsanguinityEdge={onCreateConsanguinityEdge}
            onCreateCoupleAndChild={onCreateCoupleAndChild}
            onCreateParentsForGroup={onCreateParentsForGroup}
          />
        )}

        {showSettings && (
          <SettingsPanel onClose={onCloseSettings} />
        )}

        {showRiskPanel && (
          <RiskPanelSidebar
            canvas={canvas}
            mode={riskMode}
            onModeChange={onRiskModeChange}
            onClose={onCloseRiskPanel}
            width="w-full"
          />
        )}

        {showValidation && (
          <ValidationPanelWrapper
            validation={validation}
            expandedIssueId={expandedIssueId}
            onToggleIssue={onToggleIssue}
            onFocusIssue={onFocusIssue}
            nodes={canvasNodes}
            onClose={onCloseValidation}
          />
        )}

        {showVersions && (
          <VersionHistoryPanel onClose={onCloseVersions} />
        )}
      </div>
    </div>
  );
}
