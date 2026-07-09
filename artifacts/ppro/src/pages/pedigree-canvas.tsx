import { useMemo, useEffect, useState, useContext, useCallback } from "react";
import { useParams } from "wouter";
import { useGetPedigree } from "@workspace/api-client-react";
import { exportPPRO, exportPDF, exportPPTX, exportClinicalReport, exportPNG, exportSVG, exportJSON, exportPED } from "@/lib/export-pedigree";
import { PedigreeEditorProvider, usePedigreeEditor } from "@/features/pedigree-editor/context";
import { PedigreeCanvasBody } from "@/features/pedigree-editor/PedigreeCanvasBody";
import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation, CanvasData, DragState } from "@/features/pedigree-editor/canvas/types";
export type { PedigreeNode, PedigreeEdge, PedigreeAnnotation, CanvasData, DragState };
import { RibbonToolbar } from "@/features/pedigree-editor/toolbar/RibbonToolbar";
import { DraftBanner } from "@/features/pedigree-editor/overlay/DraftBanner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { buildTemplate, getTemplateOptions } from "@/features/pedigree-editor/utils/templates";
import { FeatureTourModal } from "@/components/FeatureTourModal";
import { ThemeContext, THEMES, applyThemeDom } from "@/lib/theme";
import type { ThemeId } from "@/lib/theme";
import { CanvasConfigOverrideProvider } from "@/features/pedigree-editor/context/CanvasConfigContext";
import type { CanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";


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
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("ppro_feature_tour_seen");
    if (seen !== "true") {
      setShowTour(true);
    }
  }, []);

  const toggle = useMemo(() => ({
    setSnapEnabled: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { snapEnabled: typeof v === "function" ? v(state.snapEnabled) : v } }),
    setShowGrid: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showGrid: typeof v === "function" ? v(state.showGrid) : v } }),
    setShowMinimap: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showMinimap: typeof v === "function" ? v(state.showMinimap) : v } }),
    setShowLayoutMenu: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showLayoutMenu: typeof v === "function" ? v(state.showLayoutMenu) : v } }),
    setLiveLayout: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { liveLayout: typeof v === "function" ? v(state.liveLayout) : v } }),
    setShowAutoLabels: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showAutoLabels: typeof v === "function" ? v(state.showAutoLabels) : v } }),
    setShowLabelsMenu: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showLabelsMenu: typeof v === "function" ? v(state.showLabelsMenu) : v } }),
    setShowTemplates: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showTemplates: typeof v === "function" ? v(state.showTemplates) : v } }),
    setShowRiskPanel: (v: React.SetStateAction<boolean>) => {
      const newVal = typeof v === "function" ? v(state.showRiskPanel) : v;
      ctx.dispatch({
        type: "SET_STATE",
        patch: newVal
          ? { showRiskPanel: true, showValidation: false, showVersions: false, showSettings: false }
          : { showRiskPanel: false }
      });
    },
    setShowValidation: (v: React.SetStateAction<boolean>) => {
      const newVal = typeof v === "function" ? v(state.showValidation) : v;
      ctx.dispatch({
        type: "SET_STATE",
        patch: newVal
          ? { showValidation: true, showRiskPanel: false, showVersions: false, showSettings: false }
          : { showValidation: false }
      });
    },
    setShowLegend: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showLegend: typeof v === "function" ? v(state.showLegend) : v } }),
    setShowSaveModal: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showSaveModal: typeof v === "function" ? v(state.showSaveModal) : v } }),
    setSessionLabel: (v: React.SetStateAction<string>) => ctx.dispatch({ type: "SET_STATE", patch: { sessionLabel: typeof v === "function" ? v(state.sessionLabel) : v } }),
    setShowVersions: (v: React.SetStateAction<boolean>) => {
      const newVal = typeof v === "function" ? v(state.showVersions) : v;
      ctx.dispatch({ type: "SET_STATE", patch: { showVersions: newVal, showRiskPanel: false, showValidation: false, showSaveModal: false, showSettings: false } });
    },
    setShowSettings: (v: React.SetStateAction<boolean>) => {
      const newVal = typeof v === "function" ? v(state.showSettings) : v;
      ctx.dispatch({
        type: "SET_STATE",
        patch: newVal
          ? {
              showSettings: true,
              showRiskPanel: false,
              showValidation: false,
              showVersions: false,
              selectedIds: new Set(),
              selectedAnnotationId: null,
            }
          : { showSettings: false }
      });
    },
    setShowShareModal: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showShareModal: typeof v === "function" ? v(state.showShareModal) : v } }),
    setShowExportMenu: (v: React.SetStateAction<boolean>) => ctx.dispatch({ type: "SET_STATE", patch: { showExportMenu: typeof v === "function" ? v(state.showExportMenu) : v } }),
    setViewBox: (vb: React.SetStateAction<{ x: number; y: number; zoom: number }>) => ctx.dispatch({ type: "SET_STATE", patch: { viewBox: typeof vb === "function" ? vb(state.viewBox) : vb } }),
    setLinkMode: (m: React.SetStateAction<"couple" | "parent-child" | "consanguinity" | null>) => ctx.dispatch({ type: "SET_STATE", patch: { linkMode: typeof m === "function" ? m(state.linkMode) : m } }),
    setLinkSource: (s: React.SetStateAction<string | null>) => ctx.dispatch({ type: "SET_STATE", patch: { linkSource: typeof s === "function" ? s(state.linkSource) : s } }),
  }), [ctx, state.snapEnabled, state.showGrid, state.showMinimap, state.showLayoutMenu, state.liveLayout, state.showAutoLabels, state.showLabelsMenu, state.showTemplates, state.showRiskPanel, state.showValidation, state.showLegend, state.showSaveModal, state.sessionLabel, state.showVersions, state.showShareModal, state.showExportMenu, state.viewBox, state.linkMode, state.linkSource, state.showSettings]);

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
    if (!state.showVersions && state.isPreviewMode) {
      ctx.dispatch({ type: "EXIT_PREVIEW" });
    }
  }, [state.showVersions, state.isPreviewMode, ctx.dispatch]);

  const parentThemeCtx = useContext(ThemeContext);
  const localThemeId = state.canvas.settings?.themeId;
  const activeThemeId = useMemo(() => localThemeId || parentThemeCtx.themeId, [localThemeId, parentThemeCtx.themeId]);
  const activeTheme = useMemo(() => THEMES.find((t) => t.id === activeThemeId) || THEMES[0]!, [activeThemeId]);

  useEffect(() => {
    applyThemeDom(activeThemeId, parentThemeCtx.colorPalette);
    return () => {
      applyThemeDom(parentThemeCtx.themeId, parentThemeCtx.colorPalette);
    };
  }, [activeThemeId, parentThemeCtx.themeId, parentThemeCtx.colorPalette]);

  const localThemeValue = useMemo(() => ({
    themeId: activeThemeId,
    theme: activeTheme,
    setTheme: (id: ThemeId) => {
      ops.updateCanvas((prev) => {
        const settings = prev.settings || {};
        return {
          ...prev,
          settings: { ...settings, themeId: id },
        };
      });
    },
    colorPalette: parentThemeCtx.colorPalette,
    setColorPalette: parentThemeCtx.setColorPalette,
    synced: true,
  }), [activeThemeId, activeTheme, parentThemeCtx.colorPalette, parentThemeCtx.setColorPalette, ops.updateCanvas]);

  const handleUpdateLocalConfig = useCallback((patch: Partial<CanvasConfig>) => {
    ops.updateCanvas((prev) => {
      const settings = prev.settings || {};
      const configOverrides = { ...(settings.config || {}) };
      Object.keys(patch).forEach((key) => {
        const val = patch[key as keyof CanvasConfig];
        if (val === undefined) {
          delete configOverrides[key as keyof CanvasConfig];
        } else {
          configOverrides[key as keyof CanvasConfig] = val as any;
        }
      });
      return {
        ...prev,
        settings: {
          ...settings,
          config: configOverrides,
        },
      };
    });
  }, [ops.updateCanvas]);

  return (
    <CanvasConfigOverrideProvider
      localConfig={state.canvas.settings?.config || {}}
      onUpdateConfig={handleUpdateLocalConfig}
    >
      <ThemeContext.Provider value={localThemeValue}>
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
        templates={getTemplateOptions()} buildTemplate={buildTemplate}
        showRiskPanel={state.showRiskPanel} setShowRiskPanel={toggle.setShowRiskPanel}
        showValidation={state.showValidation} setShowValidation={toggle.setShowValidation}
        validation={{ errorCount: memo.validation.errorCount, warningCount: memo.validation.warningCount }}
        showLegend={state.showLegend} setShowLegend={toggle.setShowLegend}
        showSettings={state.showSettings} setShowSettings={toggle.setShowSettings}
        saveStatus={state.saveStatus}
        handleSaveVersion={ops.handleSaveVersion}
        showSaveModal={state.showSaveModal} setShowSaveModal={toggle.setShowSaveModal}
        sessionLabel={state.sessionLabel} setSessionLabel={toggle.setSessionLabel}
        commitSaveVersion={ops.commitSaveVersion} saveVersion={{ isPending: ctx.saveVersionPending }}
        showVersions={state.showVersions} setShowVersions={toggle.setShowVersions}
        setShowShareModal={toggle.setShowShareModal}
        showExportMenu={state.showExportMenu} setShowExportMenu={toggle.setShowExportMenu}
        exportingFormat={state.exportingFormat}
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
        handleExportPED={he(() => exportPED(getExportInfo(), state.canvas), "PED")}
        clearSelection={() => ctx.dispatch({ type: "SET_STATE", patch: { selectedIds: new Set(), selectedAnnotationId: null } })}
        pedigreeTitle={pedigree?.title ?? ""}
        onDeletePedigree={() => ops.handleDeletePedigree(pedigree?.id ?? 0, pedigree?.title ?? "")}
      />

      <PedigreeCanvasBody />

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

      <FeatureTourModal
        open={showTour}
        onClose={() => setShowTour(false)}
      />
        </div>
      </ThemeContext.Provider>
    </CanvasConfigOverrideProvider>
  );
}
