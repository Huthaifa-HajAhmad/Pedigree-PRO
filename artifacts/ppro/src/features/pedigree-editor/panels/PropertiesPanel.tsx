import React from "react";
import { MessageSquare } from "lucide-react";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { AnnotationEditorPanel } from "@/features/pedigree-editor/panels/AnnotationEditorPanel";
import type { PropertiesPanelProps } from "./properties/types";
import { BulkSelectionSection } from "./properties/BulkSelectionSection";
import { SingleNodeSection } from "./properties/SingleNodeSection";

export function PropertiesPanel({
  selectedIds, canvasNodes, canvasEdges, canvasAnnotations,
  selectedAnnotationId,
  onUpdateSelectedNode,
  onBulkUpdate, onDeleteSelected, onAddAnnotation,
  onUpdateAnnotation, onDeleteAnnotation, onSelectAnnotation,
  onReorderAnnotations,
  onAlignSelected, onDistributeSelected, onMarkAsTwins, onUnmarkTwins, onRemoveEdges,
  onUpdateEdgeType, onToggleCoupleInverted,
  onCreateCoupleEdge, onCreateConsanguinityEdge, onCreateCoupleAndChild,
  onCreateParentsForGroup,
}: PropertiesPanelProps) {
  const singleSelected = selectedIds.size === 1 ? canvasNodes.find((n) => selectedIds.has(n.id)) ?? null : null;

  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      {selectedIds.size > 1 ? (
        <BulkSelectionSection
          selectedIds={selectedIds}
          canvasNodes={canvasNodes}
          canvasEdges={canvasEdges}
          onUpdateSelectedNode={onUpdateSelectedNode}
          onBulkUpdate={onBulkUpdate}
          onDeleteSelected={onDeleteSelected}
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
      ) : singleSelected ? (
        <SingleNodeSection
          singleSelected={singleSelected}
          canvasAnnotations={canvasAnnotations}
          selectedAnnotationId={selectedAnnotationId}
          onUpdateSelectedNode={onUpdateSelectedNode}
          onDeleteSelected={onDeleteSelected}
          onAddAnnotation={onAddAnnotation}
          onUpdateAnnotation={onUpdateAnnotation}
          onDeleteAnnotation={onDeleteAnnotation}
          onSelectAnnotation={onSelectAnnotation}
          onReorderAnnotations={onReorderAnnotations}
        />
      ) : selectedAnnotationId && selectedIds.size === 0 ? (() => {
        const ann = canvasAnnotations.find((a) => a.id === selectedAnnotationId);
        if (!ann) return null;
        return (
          <PanelShell title="Text Note" icon={<MessageSquare className="w-3.5 h-3.5" />} width="w-full">
            <PanelSection title="Edit Text Note" icon={<MessageSquare className="w-3 h-3" />} defaultOpen={true}>
              <AnnotationEditorPanel
                annotation={ann}
                isSelected={true}
                onSelect={() => {}}
                onUpdate={(updates) => onUpdateAnnotation(ann.id, updates)}
                onDelete={() => onDeleteAnnotation(ann.id)}
              />
            </PanelSection>
          </PanelShell>
        );
      })() : null}
    </div>
  );
}
