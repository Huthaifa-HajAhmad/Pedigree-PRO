import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Settings } from "lucide-react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { NodeGroup } from "@/features/pedigree-editor/toolbar/groups/NodeGroup";
import { ConnectGroup } from "@/features/pedigree-editor/toolbar/groups/ConnectGroup";
import { EditGroup } from "@/features/pedigree-editor/toolbar/groups/EditGroup";
import { ViewGroup } from "@/features/pedigree-editor/toolbar/groups/ViewGroup";
import { ArrangeGroup } from "@/features/pedigree-editor/toolbar/groups/ArrangeGroup";
import { ClinicalGroup } from "@/features/pedigree-editor/toolbar/groups/ClinicalGroup";
import { FileGroup } from "@/features/pedigree-editor/toolbar/groups/FileGroup";
import { ShareGroup } from "@/features/pedigree-editor/toolbar/groups/ShareGroup";
import { HelpGroup } from "@/features/pedigree-editor/toolbar/groups/HelpGroup";
import { useToolbarLayout } from "@/features/pedigree-editor/toolbar/hooks/useToolbarLayout";

import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

import { TemplateOption } from "@/features/pedigree-editor/utils/templates";

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
  createCoupleEdge: (sourceId: string, targetId: string) => void;
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
  runAutoLayout: (respectPinned: boolean, isManual?: boolean) => void;
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
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;

  twinSelectMode: boolean;
  twinCandidateIds: Set<string>;
  toggleTwinSelectMode: () => void;
  clearTwinCandidates: () => void;
  markAsTwins: (nodeIds: string[], twinType: "m" | "d") => void;
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
  handleExportPPRO: () => void;
  handleExportJSON: () => void;
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
        <ConnectGroup
          linkMode={props.linkMode} setLinkMode={props.setLinkMode} setLinkSource={props.setLinkSource}
          selectedIds={props.selectedIds} canvasNodes={props.canvasNodes} canvasEdges={props.canvasEdges}
          createConsanguinityEdge={props.createConsanguinityEdge}
          createCoupleEdge={props.createCoupleEdge}
          twinSelectMode={props.twinSelectMode} twinCandidateIds={props.twinCandidateIds}
          toggleTwinSelectMode={props.toggleTwinSelectMode} clearTwinCandidates={props.clearTwinCandidates}
          markAsTwins={props.markAsTwins}
          labelHidden={hideLabels}
        />
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
          canvasNodes={props.canvasNodes} openConfirm={openConfirm} labelHidden={hideLabels || compactSecondaries}
          onClearSelection={props.clearSelection} />

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
          handleExportPPRO={props.handleExportPPRO}
          handleExportJSON={props.handleExportJSON}
          pedigreeTitle={props.pedigreeTitle}
          canvasNodes={props.canvasNodes}
          canvasEdges={props.canvasEdges}
          labelHidden={hideLabels || compactSecondaries} />

        <div className="w-px self-stretch bg-border mx-1 flex-shrink-0" />

        <HelpGroup labelHidden={hideLabels || compactSecondaries}>
          <button
            type="button"
            data-testid="button-settings"
            onClick={() => props.setShowSettings(!props.showSettings)}
            title="Canvas settings"
            aria-label="Canvas settings"
            aria-pressed={props.showSettings}
            className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${
              props.showSettings ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[11px] leading-tight font-medium">Settings</span>
          </button>
        </HelpGroup>
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
