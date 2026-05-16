import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { NodeGroup } from "@/features/pedigree-editor/toolbar/groups/NodeGroup";
import { ConnectGroup } from "@/features/pedigree-editor/toolbar/groups/ConnectGroup";
import { EditGroup } from "@/features/pedigree-editor/toolbar/groups/EditGroup";
import { ViewGroup } from "@/features/pedigree-editor/toolbar/groups/ViewGroup";
import { ArrangeGroup } from "@/features/pedigree-editor/toolbar/groups/ArrangeGroup";
import { ClinicalGroup } from "@/features/pedigree-editor/toolbar/groups/ClinicalGroup";
import { CollaborationGroup } from "@/features/pedigree-editor/toolbar/groups/CollaborationGroup";
import { FileGroup } from "@/features/pedigree-editor/toolbar/groups/FileGroup";
import { ShareGroup } from "@/features/pedigree-editor/toolbar/groups/ShareGroup";
import { useToolbarLayout } from "@/features/pedigree-editor/toolbar/hooks/useToolbarLayout";

import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

interface TemplateOption {
  key: string;
  name: string;
  desc: string;
}

interface ValidationSummary {
  errorCount: number;
  warningCount: number;
}

export interface RibbonToolbarProps {
  addNode: (type: PedigreeNode["type"]) => void;
  linkMode: "couple" | "parent-child" | "consanguinity" | null;
  linkSource: string | null;
  setLinkMode: (mode: "couple" | "parent-child" | "consanguinity" | null) => void;
  setLinkSource: (sourceId: string | null) => void;
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  historyLength: number;
  futureLength: number;
  selectedCount: number;
  anySelected: boolean;
  viewBox: { x: number; y: number; zoom: number };
  setViewBox: React.Dispatch<React.SetStateAction<{ x: number; y: number; zoom: number }>>;
  snapEnabled: boolean;
  setSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  showMinimap: boolean;
  setShowMinimap: React.Dispatch<React.SetStateAction<boolean>>;
  fitToScreen: () => void;
  W: number;
  H: number;
  canvasNodes: CanvasData["nodes"];
  canvasEdges: CanvasData["edges"];
  showLayoutMenu: boolean;
  setShowLayoutMenu: React.Dispatch<React.SetStateAction<boolean>>;
  liveLayout: boolean;
  setLiveLayout: React.Dispatch<React.SetStateAction<boolean>>;
  runAutoLayout: (respectPinned: boolean) => void;
  showAutoLabels: boolean;
  setShowAutoLabels: React.Dispatch<React.SetStateAction<boolean>>;
  showLabelsMenu: boolean;
  setShowLabelsMenu: React.Dispatch<React.SetStateAction<boolean>>;
  bakeEmptyLabels: () => void;
  bakeAllLabels: () => void;
  updateCanvas: (updater: (prev: CanvasData) => CanvasData) => void;
  showTemplates: boolean;
  setShowTemplates: React.Dispatch<React.SetStateAction<boolean>>;
  templates: readonly TemplateOption[];
  buildTemplate: (key: string) => CanvasData;
  showRiskPanel: boolean;
  setShowRiskPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showValidation: boolean;
  setShowValidation: React.Dispatch<React.SetStateAction<boolean>>;
  validation: ValidationSummary;
  showLegend: boolean;
  setShowLegend: React.Dispatch<React.SetStateAction<boolean>>;
  showVersionTimeline: boolean;
  setShowVersionTimeline: React.Dispatch<React.SetStateAction<boolean>>;
  showFollowMode: boolean;
  setShowFollowMode: React.Dispatch<React.SetStateAction<boolean>>;
  setShowLanShare: React.Dispatch<React.SetStateAction<boolean>>;
  saveStatus: "idle" | "saving" | "saved";
  handleSaveVersion: () => void;
  showSaveModal: boolean;
  setShowSaveModal: React.Dispatch<React.SetStateAction<boolean>>;
  sessionLabel: string;
  setSessionLabel: React.Dispatch<React.SetStateAction<string>>;
  commitSaveVersion: () => void;
  saveVersion: { isPending: boolean };
  showVersions: boolean;
  setShowVersions: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShareModal: React.Dispatch<React.SetStateAction<boolean>>;
  showExportMenu: boolean;
  setShowExportMenu: React.Dispatch<React.SetStateAction<boolean>>;
  exportingFormat: string | null;
  handleExportReport: () => void;
  handleExportPDF: () => void;
  handleExportPPTX: () => void;
  handleExportPNG: () => void;
  handleExportSVG: () => void;
  handleExportJSON: () => void;
  handleExportPPRO: () => void;
}

export function RibbonToolbar(props: RibbonToolbarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const { mode, ref: toolbarRef } = useToolbarLayout();

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmProps({ title, message, onConfirm });
    setConfirmOpen(true);
  };

  const hideLabels = mode === "minimal" || mode === "overflow";
  const compactSecondaries = mode === "compact";

  return (
    <div
      ref={toolbarRef}
      data-print-hidden
      className="flex items-stretch border-b border-border bg-card flex-shrink-0 h-[72px] overflow-hidden"
    >
      {/* Nav */}
      <div className="flex items-center px-2 border-r border-border flex-shrink-0">
        <Link href="/pedigrees">
          <button type="button"
            data-testid="button-back"
            title="Back to pedigrees"
            aria-label="Back to pedigrees"
            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-accent transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
      </div>

      <NodeGroup addNode={props.addNode} labelHidden={hideLabels} />
      <ConnectGroup linkMode={props.linkMode} setLinkMode={props.setLinkMode} setLinkSource={props.setLinkSource} labelHidden={hideLabels} />
      <EditGroup undo={props.undo} redo={props.redo} deleteSelected={props.deleteSelected}
        historyLength={props.historyLength} futureLength={props.futureLength}
        selectedCount={props.selectedCount} anySelected={props.anySelected} labelHidden={hideLabels} />
      <ViewGroup viewBox={props.viewBox} setViewBox={props.setViewBox}
        snapEnabled={props.snapEnabled} setSnapEnabled={props.setSnapEnabled}
        showGrid={props.showGrid} setShowGrid={props.setShowGrid}
        showMinimap={props.showMinimap} setShowMinimap={props.setShowMinimap}
        fitToScreen={props.fitToScreen} W={props.W} H={props.H}
        canvasNodesLength={props.canvasNodes.length} labelHidden={hideLabels || compactSecondaries} />
      <ArrangeGroup showLayoutMenu={props.showLayoutMenu} setShowLayoutMenu={props.setShowLayoutMenu}
        showLabelsMenu={props.showLabelsMenu} setShowLabelsMenu={props.setShowLabelsMenu}
        liveLayout={props.liveLayout} setLiveLayout={props.setLiveLayout}
        showAutoLabels={props.showAutoLabels} setShowAutoLabels={props.setShowAutoLabels}
        runAutoLayout={props.runAutoLayout} bakeEmptyLabels={props.bakeEmptyLabels}
        bakeAllLabels={props.bakeAllLabels} updateCanvas={props.updateCanvas}
        canvasNodesLength={props.canvasNodes.length} labelHidden={hideLabels || compactSecondaries} />
      <ClinicalGroup showTemplates={props.showTemplates} setShowTemplates={props.setShowTemplates}
        showRiskPanel={props.showRiskPanel} setShowRiskPanel={props.setShowRiskPanel}
        showValidation={props.showValidation} setShowValidation={props.setShowValidation}
        showLegend={props.showLegend} setShowLegend={props.setShowLegend}
        validation={props.validation} templates={props.templates}
        buildTemplate={props.buildTemplate} updateCanvas={props.updateCanvas}
        canvasNodesLength={props.canvasNodes.length} openConfirm={openConfirm} labelHidden={hideLabels || compactSecondaries} />
      <CollaborationGroup showVersionTimeline={props.showVersionTimeline} setShowVersionTimeline={props.setShowVersionTimeline}
        showFollowMode={props.showFollowMode} setShowFollowMode={props.setShowFollowMode}
        setShowLanShare={props.setShowLanShare} labelHidden={hideLabels || compactSecondaries} />

      {/* Status spacer */}
      <div className="flex-1 flex items-center justify-center px-3 min-w-0">
        <span className="sr-only" aria-live="polite">
          {props.saveStatus === "saving" ? "Saving pedigree" : props.saveStatus === "saved" ? "Pedigree saved" : ""}
        </span>
        {props.linkMode && (
          <span className="text-xs text-primary animate-pulse whitespace-nowrap">
            {props.linkSource ? "Click target node" : `Click source — ${props.linkMode}`}
          </span>
        )}
        {!props.linkMode && props.saveStatus === "saving" && <span className="text-xs text-muted-foreground" aria-hidden="true">Saving…</span>}
        {!props.linkMode && props.saveStatus === "saved" && <span className="text-xs font-medium text-primary" aria-hidden="true">Saved ✓</span>}
        {!props.linkMode && props.saveStatus !== "saving" && props.saveStatus !== "saved" && props.selectedCount > 1 && (
          <span className="text-xs text-primary">{props.selectedCount} selected</span>
        )}
      </div>

      <FileGroup handleSaveVersion={props.handleSaveVersion}
        showSaveModal={props.showSaveModal} setShowSaveModal={props.setShowSaveModal}
        sessionLabel={props.sessionLabel} setSessionLabel={props.setSessionLabel}
        commitSaveVersion={props.commitSaveVersion} saveVersion={props.saveVersion}
        showVersions={props.showVersions} setShowVersions={props.setShowVersions}
        canvasNodesLength={props.canvasNodes.length} canvasEdgesLength={props.canvasEdges.length} labelHidden={hideLabels || compactSecondaries} />
      <ShareGroup setShowShareModal={props.setShowShareModal}
        showExportMenu={props.showExportMenu} setShowExportMenu={props.setShowExportMenu}
        exportingFormat={props.exportingFormat}
        handleExportReport={props.handleExportReport}
        handleExportPDF={props.handleExportPDF}
        handleExportPPTX={props.handleExportPPTX}
        handleExportPNG={props.handleExportPNG}
        handleExportSVG={props.handleExportSVG}
        handleExportJSON={props.handleExportJSON}
        handleExportPPRO={props.handleExportPPRO} labelHidden={hideLabels || compactSecondaries} />

      {confirmProps && (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmProps.title}
          message={confirmProps.message}
          variant="destructive"
          confirmLabel="Replace"
          onConfirm={() => { setConfirmOpen(false); confirmProps.onConfirm(); }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
