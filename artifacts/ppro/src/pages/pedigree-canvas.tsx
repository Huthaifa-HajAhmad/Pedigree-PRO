import { useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetPedigree } from "@workspace/api-client-react";
import { exportPPRO, exportPDF, exportPPTX, exportClinicalReport, exportPNG, exportSVG, exportJSON } from "@/lib/export-pedigree";
import { PedigreeEditorProvider, usePedigreeEditor } from "@/features/pedigree-editor/context";
import { PedigreeCanvasBody } from "@/features/pedigree-editor/PedigreeCanvasBody";
import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation, CanvasData, DragState } from "@/features/pedigree-editor/canvas/types";
export type { PedigreeNode, PedigreeEdge, PedigreeAnnotation, CanvasData, DragState };
import { TabBar } from "@/features/pedigree-editor/panels/TabBar";
import { RibbonToolbar } from "@/features/pedigree-editor/toolbar/RibbonToolbar";
import { DraftBanner } from "@/features/pedigree-editor/overlay/DraftBanner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { VersionTimeline, FollowMode } from "@/features/collaboration";
import { parseCanvas } from "@/features/pedigree-editor/utils/helpers";
import { buildTemplate, getTemplateOptions } from "@/features/pedigree-editor/utils/templates";

const PEDIGREE_TEMPLATES = getTemplateOptions();

export default function PedigreeCanvas() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const { isLoading } = useGetPedigree(id);

  if (isLoading) return <div className="flex items-center justify-center h-dvh" role="status" aria-live="polite"><div className="text-primary animate-pulse tracking-widest">LOADING...</div></div>;

  return (
    <PedigreeEditorProvider id={id}>
      <PedigreeCanvasInner />
    </PedigreeEditorProvider>
  );
}

function PedigreeCanvasInner() {
  const ctx = usePedigreeEditor();
  const { state, ops, memo, pedigree, profiles, showDraftBanner, onRestoreDraft, handleDismissDraft } = ctx;
  const [, navigate] = useLocation();

  const toggle = useMemo(() => ({
    setSnapEnabled: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { snapEnabled: typeof v === "function" ? v(state.snapEnabled) : v } }),
    setShowGrid: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showGrid: typeof v === "function" ? v(state.showGrid) : v } }),
    setShowMinimap: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showMinimap: typeof v === "function" ? v(state.showMinimap) : v } }),
    setShowLayoutMenu: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showLayoutMenu: typeof v === "function" ? v(state.showLayoutMenu) : v } }),
    setLiveLayout: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { liveLayout: typeof v === "function" ? v(state.liveLayout) : v } }),
    setShowAutoLabels: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showAutoLabels: typeof v === "function" ? v(state.showAutoLabels) : v } }),
    setShowLabelsMenu: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showLabelsMenu: typeof v === "function" ? v(state.showLabelsMenu) : v } }),
    setShowTemplates: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showTemplates: typeof v === "function" ? v(state.showTemplates) : v } }),
    setShowRiskPanel: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showRiskPanel: typeof v === "function" ? v(state.showRiskPanel) : v } }),
    setShowValidation: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showValidation: typeof v === "function" ? v(state.showValidation) : v } }),
    setShowLegend: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showLegend: typeof v === "function" ? v(state.showLegend) : v } }),
    setShowSaveModal: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showSaveModal: typeof v === "function" ? v(state.showSaveModal) : v } }),
    setSessionLabel: (v: React.SetStateAction<string>) => ctx.dispatch({ type: "SET_STATE", patch: { sessionLabel: typeof v === "function" ? v(state.sessionLabel) : v } }),
    setShowVersions: (v: React.SetStateAction<boolean>) => {
      const newVal = typeof v === "function" ? v(state.showVersions) : v;
      ctx.dispatch({ type: "SET_STATE", patch: { showVersions: newVal, showRiskPanel: false, showValidation: false, showSaveModal: false } });
    },
    setShowShareModal: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showShareModal: typeof v === "function" ? v(state.showShareModal) : v } }),
    setShowExportMenu: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showExportMenu: typeof v === "function" ? v(state.showExportMenu) : v } }),
    setShowVersionTimeline: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showVersionTimeline: typeof v === "function" ? v(state.showVersionTimeline) : v } }),
    setShowFollowMode: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showFollowMode: typeof v === "function" ? v(state.showFollowMode) : v } }),
    setViewBox: (vb: React.SetStateAction<{ x: number; y: number; zoom: number }>) => ctx.dispatch({ type: "SET_STATE", patch: { viewBox: typeof vb === "function" ? vb(state.viewBox) : vb } }),
    setLinkMode: (m: React.SetStateAction<"couple" | "parent-child" | "consanguinity" | null>) => ctx.dispatch({ type: "SET_STATE", patch: { linkMode: typeof m === "function" ? m(state.linkMode) : m } }),
    setLinkSource: (s: React.SetStateAction<string | null>) => ctx.dispatch({ type: "SET_STATE", patch: { linkSource: typeof s === "function" ? s(state.linkSource) : s } }),
    setFollowIndex: (i: React.SetStateAction<number>) => ctx.dispatch({ type: "SET_STATE", patch: { followIndex: typeof i === "function" ? i(state.followIndex) : i } }),
  }), [ctx, state.snapEnabled, state.showGrid, state.showMinimap, state.showLayoutMenu, state.liveLayout, state.showAutoLabels, state.showLabelsMenu, state.showTemplates, state.showRiskPanel, state.showValidation, state.showLegend, state.showSaveModal, state.sessionLabel, state.showVersions, state.showShareModal, state.showExportMenu, state.showVersionTimeline, state.showFollowMode, state.viewBox, state.linkMode, state.linkSource, state.followIndex]);

  const he = (fn: (args?: any) => void | Promise<void>, fmt: string) => async (args?: any) => {
    ctx.dispatch({ type: "SET_STATE", patch: { showExportMenu: false, exportingFormat: fmt } });
    try {
      if (ops.backgroundSaveVersion) {
        await ops.backgroundSaveVersion(`Auto-saved before ${fmt} Export`);
      }
      await fn(args);
    } finally {
      ctx.dispatch({ type: "SET_STATE", patch: { exportingFormat: null } });
    }
  };

  const getExportInfo = () => ({
    title: pedigree?.title ?? "Pedigree",
    patientId: pedigree?.patient_id ?? null,
    notes: pedigree?.notes ?? null,
  });

  useEffect(() => {
    if (!state.showVersionTimeline && !state.showFollowMode && state.isPreviewMode) {
      ctx.dispatch({ type: "EXIT_PREVIEW" });
    }
  }, [state.showVersionTimeline, state.showFollowMode, state.isPreviewMode, ctx.dispatch]);

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <h1 className="sr-only">Pedigree Editor — {pedigree?.title ?? "Untitled"}</h1>
      {showDraftBanner && (
        <DraftBanner onRestore={onRestoreDraft} onDismiss={handleDismissDraft} />
      )}

      <RibbonToolbar
        addNode={ops.addNode}
        linkMode={state.linkMode} linkSource={state.linkSource}
        setLinkMode={toggle.setLinkMode}
        setLinkSource={toggle.setLinkSource}
        selectedIds={state.selectedIds}
        createConsanguinityEdge={ops.createConsanguinityEdge}
        createCoupleEdge={ops.createCoupleEdge}
        undo={ops.undo} redo={ops.redo} deleteSelected={ops.deleteSelected}
        historyLength={state.history.length} futureLength={state.future.length}
        selectedCount={state.selectedIds.size} anySelected={memo.anySelected}
        viewBox={state.viewBox} setViewBox={toggle.setViewBox}
        snapEnabled={state.snapEnabled} setSnapEnabled={toggle.setSnapEnabled}
        showGrid={state.showGrid} setShowGrid={toggle.setShowGrid}
        showMinimap={state.showMinimap} setShowMinimap={toggle.setShowMinimap}
        fitToScreen={ops.fitToScreen} W={1400} H={900}
        canvasNodes={state.canvas.nodes} canvasEdges={state.canvas.edges}
        showLayoutMenu={state.showLayoutMenu} setShowLayoutMenu={toggle.setShowLayoutMenu}
        liveLayout={state.liveLayout} setLiveLayout={toggle.setLiveLayout}
        runAutoLayout={ops.runAutoLayout}
        showAutoLabels={state.showAutoLabels} setShowAutoLabels={toggle.setShowAutoLabels}
        showLabelsMenu={state.showLabelsMenu} setShowLabelsMenu={toggle.setShowLabelsMenu}
        bakeEmptyLabels={ops.bakeEmptyLabels} bakeAllLabels={ops.bakeAllLabels}
        updateCanvas={ops.updateCanvas}
        showTemplates={state.showTemplates} setShowTemplates={toggle.setShowTemplates}
        templates={PEDIGREE_TEMPLATES} buildTemplate={buildTemplate}
        showRiskPanel={state.showRiskPanel} setShowRiskPanel={toggle.setShowRiskPanel}
        showValidation={state.showValidation} setShowValidation={toggle.setShowValidation}
        validation={{ errorCount: memo.validation.errorCount, warningCount: memo.validation.warningCount }}
        showLegend={state.showLegend} setShowLegend={toggle.setShowLegend}
        saveStatus={state.saveStatus}
        handleSaveVersion={ops.handleSaveVersion}
        showSaveModal={state.showSaveModal} setShowSaveModal={toggle.setShowSaveModal}
        sessionLabel={state.sessionLabel} setSessionLabel={toggle.setSessionLabel}
        commitSaveVersion={ops.commitSaveVersion} saveVersion={{ isPending: ctx.saveVersionPending }}
        showVersions={state.showVersions} setShowVersions={toggle.setShowVersions}
        setShowShareModal={toggle.setShowShareModal}
        showExportMenu={state.showExportMenu} setShowExportMenu={toggle.setShowExportMenu}
        exportingFormat={state.exportingFormat}
        showVersionTimeline={state.showVersionTimeline} setShowVersionTimeline={toggle.setShowVersionTimeline}
        showFollowMode={state.showFollowMode} setShowFollowMode={toggle.setShowFollowMode}
        twinSelectMode={state.twinSelectMode}
        twinCandidateIds={state.twinCandidateIds}
        toggleTwinSelectMode={ops.toggleTwinSelectMode}
        clearTwinCandidates={ops.clearTwinCandidates}
        markAsTwins={ops.markAsTwins}
        handleExportReport={he(() => exportClinicalReport(getExportInfo(), state.canvas), "Report")}
        handleExportPDF={he(() => exportPDF(getExportInfo(), state.canvas), "PDF")}
        handleExportPPTX={he(() => exportPPTX(getExportInfo(), state.canvas), "PPTX")}
        handleExportPNG={he((opts) => exportPNG(getExportInfo(), state.canvas, opts), "PNG")}
        handleExportSVG={he((opts) => exportSVG(getExportInfo(), state.canvas, opts), "SVG")}
        handleExportPPRO={he(async () => {
          const firstProfile = profiles && profiles.length > 0 ? profiles[0] : null;
          const exporterKey = firstProfile ? firstProfile.public_key : "";
          await exportPPRO(pedigree?.id ?? 0, exporterKey, getExportInfo().title);
        }, "PPRO")}
        handleExportJSON={he(() => exportJSON(getExportInfo(), state.canvas), "JSON")}
        clearSelection={() => ctx.dispatch({ type: "SET_STATE", patch: { selectedIds: new Set(), selectedAnnotationId: null } })}
        pedigreeTitle={pedigree?.title ?? ""}
        onDeletePedigree={() => ops.handleDeletePedigree(pedigree?.id ?? 0, pedigree?.title ?? "")}
      />

      <TabBar
        tabs={memo.tabItems}
        currentId={pedigree?.id ?? 0}
        showTabPicker={state.showTabPicker}
        onToggleTabPicker={() => ctx.dispatch({ type: "SET_STATE", patch: { showTabPicker: !state.showTabPicker } })}
        onCloseTabPicker={() => ctx.dispatch({ type: "SET_STATE", patch: { showTabPicker: false } })}
        onCloseTab={ops.handleCloseTab}
        onRenameTab={ops.renameTab}
        onNavigate={navigate}
        onOpenTab={(tid, title) => { ops.openTab(tid, title); navigate(`/pedigrees/${tid}`); }}
        onReorderTab={ops.reorderTabs}
        onDeletePedigree={ops.handleDeletePedigree}
        saveStatus={state.saveStatus}
      />

      <PedigreeCanvasBody />

      {state.showVersionTimeline && ctx.versions && (
        <VersionTimeline
          pedigreeId={pedigree?.id ?? 0}
          currentCanvas={JSON.stringify(state.canvas)}
          onPreview={(data, vid) => ctx.dispatch({ type: "ENTER_PREVIEW", canvas: parseCanvas(data), versionId: vid })}
          onRestoreRequest={ops.handleRestoreVersion}
        />
      )}

      {state.showFollowMode && ctx.versions && (
        <FollowMode
          versions={ctx.versions}
          currentIndex={state.followIndex}
          onChangeIndex={toggle.setFollowIndex}
          onPreview={(data) => {
            const currentVersionId = ctx.versions ? ctx.versions[state.followIndex]?.id || null : null;
            ctx.dispatch({ type: "ENTER_PREVIEW", canvas: parseCanvas(data), versionId: currentVersionId });
          }}
          onClose={() => {
            ctx.dispatch({ type: "EXIT_PREVIEW" });
            ctx.dispatch({ type: "SET_STATE", patch: { showFollowMode: false } });
          }}
        />
      )}



      {state.confirmProps && (
        <ConfirmDialog
          open={state.confirmOpen}
          title={state.confirmProps.title}
          message={state.confirmProps.message}
          variant={state.confirmProps.variant || "default"}
          onConfirm={() => { ctx.dispatch({ type: "SET_STATE", patch: { confirmOpen: false } }); state.confirmProps!.onConfirm(); }}
          onCancel={() => ctx.dispatch({ type: "SET_STATE", patch: { confirmOpen: false } })}
        />
      )}
    </div>
  );
}
