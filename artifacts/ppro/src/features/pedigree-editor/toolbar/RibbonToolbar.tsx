import { useState, useEffect, useRef } from "react";
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
import { CollaborateGroup } from "@/features/pedigree-editor/toolbar/groups/CollaborateGroup";
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
  selectedIds: Set<string>;
  createConsanguinityEdge: (sourceId: string, targetId: string) => void;
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
  pedigreeTitle: string;
  onDeletePedigree: () => void;
  clearSelection?: () => void;
}

export function RibbonToolbar(props: RibbonToolbarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const { mode } = useToolbarLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setShowLeftFade(el.scrollLeft > 4);
      setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmProps({ title, message, onConfirm });
    setConfirmOpen(true);
  };

  const hideLabels = mode === "minimal" || mode === "overflow";
  const compactSecondaries = mode === "compact";

  return (
    <div className="relative flex-shrink-0" data-print-hidden>
      {/* Left fade */}
      <div className={`ribbon-fade-left ${showLeftFade ? "visible" : ""}`} />
      {/* Right fade */}
      <div className={`ribbon-fade-right ${showRightFade ? "visible" : ""}`} />

      <div
        ref={scrollRef}
        role="toolbar"
        aria-orientation="horizontal"
        aria-label="Pedigree editor toolbar"
        className="ribbon-scroll flex items-center flex-nowrap border-b border-border bg-card h-[88px] overflow-x-auto"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, [role='button']")) {
            props.clearSelection?.();
          }
        }}
      >
        {/* Nav */}
        <div className="flex items-center px-2 border-r border-border flex-shrink-0 self-stretch">
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
        <ConnectGroup linkMode={props.linkMode} setLinkMode={props.setLinkMode} setLinkSource={props.setLinkSource} selectedIds={props.selectedIds} canvasNodes={props.canvasNodes} createConsanguinityEdge={props.createConsanguinityEdge} labelHidden={hideLabels} />
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
          canvasNodesLength={props.canvasNodes.length} openConfirm={openConfirm} labelHidden={hideLabels || compactSecondaries}
          onClearSelection={props.clearSelection} />
        <CollaborateGroup showVersionTimeline={props.showVersionTimeline} setShowVersionTimeline={props.setShowVersionTimeline}
          showFollowMode={props.showFollowMode} setShowFollowMode={props.setShowFollowMode}
          setShowLanShare={props.setShowLanShare} labelHidden={hideLabels || compactSecondaries} />

        <div className="w-px self-stretch bg-border mx-1 flex-shrink-0" />

        <FileGroup handleSaveVersion={props.handleSaveVersion}
          showSaveModal={props.showSaveModal} setShowSaveModal={props.setShowSaveModal}
          sessionLabel={props.sessionLabel} setSessionLabel={props.setSessionLabel}
          commitSaveVersion={props.commitSaveVersion} saveVersion={props.saveVersion}
          showVersions={props.showVersions} setShowVersions={props.setShowVersions}
          canvasNodesLength={props.canvasNodes.length} canvasEdgesLength={props.canvasEdges.length}
          pedigreeTitle={props.pedigreeTitle} onDeletePedigree={props.onDeletePedigree}
          labelHidden={hideLabels || compactSecondaries} />

        <div className="w-px self-stretch bg-border mx-1 flex-shrink-0" />

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
      </div>

      {/* Hidden live region for save status announcements */}
      <span className="sr-only" aria-live="polite">
        {props.saveStatus === "saving" ? "Saving pedigree" : props.saveStatus === "saved" ? "Pedigree saved" : ""}
      </span>

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
