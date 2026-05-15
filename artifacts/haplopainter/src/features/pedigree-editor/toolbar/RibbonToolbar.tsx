import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Save, Trash2, Clock, Download,
  FileJson, Presentation, FileText, Share2, ZoomIn, ZoomOut,
  Baby, AlertTriangle, ShieldCheck, ChevronDown,
  LayoutGrid, Pin, PinOff, BookOpen, Plus,
  Undo2, Redo2, Maximize2, LayoutTemplate, TrendingUp, Hash, Map as MapIcon,
  GitBranch, History, Wifi,
} from "lucide-react";
import { NodeIcon } from "@/features/pedigree-editor/toolbar/NodeIcon";
import type { PedigreeNode, CanvasData } from "@/features/pedigree-editor/canvas/types";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

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
  // Nodes
  addNode: (type: PedigreeNode["type"]) => void;

  // Connect
  linkMode: "couple" | "parent-child" | "consanguinity" | null;
  linkSource: string | null;
  setLinkMode: (mode: "couple" | "parent-child" | "consanguinity" | null) => void;
  setLinkSource: (sourceId: string | null) => void;

  // Edit
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  historyLength: number;
  futureLength: number;
  selectedCount: number;
  anySelected: boolean;

  // View
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

  // Arrange
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

  // Clinical
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

  // Collaboration
  showVersionTimeline: boolean;
  setShowVersionTimeline: React.Dispatch<React.SetStateAction<boolean>>;
  showFollowMode: boolean;
  setShowFollowMode: React.Dispatch<React.SetStateAction<boolean>>;
  setShowLanShare: React.Dispatch<React.SetStateAction<boolean>>;

  // Status spacer
  saveStatus: "idle" | "saving" | "saved";

  // File
  handleSaveVersion: () => void;
  showSaveModal: boolean;
  setShowSaveModal: React.Dispatch<React.SetStateAction<boolean>>;
  sessionLabel: string;
  setSessionLabel: React.Dispatch<React.SetStateAction<string>>;
  commitSaveVersion: () => void;
  saveVersion: { isPending: boolean };
  showVersions: boolean;
  setShowVersions: React.Dispatch<React.SetStateAction<boolean>>;

  // Share
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
}

export function RibbonToolbar(props: RibbonToolbarProps) {
  const [showMoreNodes, setShowMoreNodes] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmProps({ title, message, onConfirm });
    setConfirmOpen(true);
  };

  return (
    <div
      className="flex items-stretch border-b border-border bg-card flex-shrink-0"
      style={{ height: "72px", minHeight: "72px", position: "relative", zIndex: 20 }}
    >
      {/* ── Nav ── */}
      <div className="flex items-center px-2 border-r border-border flex-shrink-0">
        <Link href="/pedigrees">
          <button
            data-testid="button-back"
            title="Back to pedigrees"
            aria-label="Back to pedigrees"
            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-accent transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
      </div>

      {/* ── NODES group ── */}
      <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
        <div className="flex items-center gap-0.5">
          {(["male", "female", "unknown"] as const).map((t) => (
            <button
              key={t}
              data-testid={`button-add-${t}`}
              onClick={() => props.addNode(t)}
              title={`Add ${t} (${t[0].toUpperCase()})`}
              aria-label={`Add ${t} node`}
              className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {t === "male" && <NodeIcon type="male" />}
              {t === "female" && <NodeIcon type="female" />}
              {t === "unknown" && <NodeIcon type="unknown" />}
              <span className="text-[9px] capitalize leading-none">{t}</span>
            </button>
          ))}
          <div className="relative">
            <button
              onClick={() => setShowMoreNodes((v) => !v)}
              title="More node types (Pregnancy, SAB)"
              aria-label="More node types"
              className={`flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${showMoreNodes ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <Plus className="w-3 h-3" />
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showMoreNodes && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreNodes(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 border border-border rounded-md shadow-lg overflow-hidden w-44" style={{ background: "hsl(var(--popover))" }}>
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border">Rare types</div>
                  <button onClick={() => { props.addNode("pregnancy"); setShowMoreNodes(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left">
                    <Baby className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div><div className="font-medium">Pregnancy</div><div className="text-[10px] text-muted-foreground">Shortcut: P</div></div>
                  </button>
                  <button onClick={() => { props.addNode("sab"); setShowMoreNodes(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left border-t border-border">
                    <NodeIcon type="sab" />
                    <div><div className="font-medium">SAB / Stillbirth</div><div className="text-[10px] text-muted-foreground">Shortcut: S</div></div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Nodes</div>
      </div>

      {/* ── CONNECT group ── */}
      <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            data-testid="button-link-couple"
            onClick={() => { props.setLinkMode(props.linkMode === "couple" ? null : "couple"); props.setLinkSource(null); }}
            title="Draw couple link — click two nodes"
            aria-label="Draw couple link"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.linkMode === "couple" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <svg width="26" height="13" viewBox="0 0 26 13">
              <rect x="1" y="2.5" width="7.5" height="7.5" rx="3.75" fill="none" stroke="currentColor" strokeWidth="1.1" />
              <line x1="8.5" y1="6.25" x2="17.5" y2="6.25" stroke="currentColor" strokeWidth="1.1" />
              <rect x="17.5" y="2.5" width="7.5" height="7.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            <span>Couple</span>
          </button>
          <button
            data-testid="button-link-child"
            onClick={() => { props.setLinkMode(props.linkMode === "parent-child" ? null : "parent-child"); props.setLinkSource(null); }}
            title="Draw parent to child link"
            aria-label="Draw parent to child link"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.linkMode === "parent-child" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <svg width="18" height="14" viewBox="0 0 18 14">
              <circle cx="9" cy="3" r="3" fill="none" stroke="currentColor" strokeWidth="1.1" />
              <line x1="9" y1="6" x2="9" y2="10" stroke="currentColor" strokeWidth="1.1" />
              <rect x="5.5" y="10" width="7" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            <span>P→Child</span>
          </button>
          <button
            data-testid="button-link-consanguinity"
            onClick={() => { props.setLinkMode(props.linkMode === "consanguinity" ? null : "consanguinity"); props.setLinkSource(null); }}
            title="Draw consanguinity link (double bar) — K"
            aria-label="Draw consanguinity link"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.linkMode === "consanguinity" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <svg width="26" height="12" viewBox="0 0 26 12">
              <line x1="0" y1="3.5" x2="26" y2="3.5" stroke="currentColor" strokeWidth="1.1" />
              <line x1="0" y1="8.5" x2="26" y2="8.5" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            <span>Consang.</span>
          </button>
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Connect</div>
      </div>

      {/* ── EDIT group ── */}
      <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
        <div className="flex items-center gap-0.5">
          <button onClick={props.undo} disabled={props.historyLength === 0} title="Undo (Ctrl+Z)" aria-label="Undo"
            className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <Undo2 className="w-4 h-4" />
            <span className="text-[9px] leading-none">Undo</span>
          </button>
          <button onClick={props.redo} disabled={props.futureLength === 0} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"
            className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <Redo2 className="w-4 h-4" />
            <span className="text-[9px] leading-none">Redo</span>
          </button>
          <div className="w-px self-stretch bg-border mx-0.5 my-1" />
          <button data-testid="button-delete-node" onClick={props.deleteSelected} disabled={!props.anySelected} title="Delete selected (Del)" aria-label="Delete selected"
            className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <Trash2 className="w-4 h-4" />
            <span className="text-[9px] leading-none">{props.selectedCount > 1 ? `Del (${props.selectedCount})` : "Delete"}</span>
          </button>
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Edit</div>
      </div>

      {/* ── VIEW group ── */}
      <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
        <div className="flex items-center gap-0.5">
          <button data-testid="button-zoom-in" title="Zoom in (Numpad+)" aria-label="Zoom in"
            onClick={() => props.setViewBox((v) => { const nz = Math.max(0.25, v.zoom * 0.82); const cx = v.x + props.W * v.zoom / 2; const cy = v.y + props.H * v.zoom / 2; return { x: cx - props.W * nz / 2, y: cy - props.H * nz / 2, zoom: nz }; })}
            className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <ZoomIn className="w-4 h-4" />
            <span className="text-[9px] leading-none">In</span>
          </button>
          <button data-testid="button-fit" onClick={props.fitToScreen} disabled={props.canvasNodes.length === 0} title="Fit all (Numpad0)" aria-label="Fit all"
            className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <Maximize2 className="w-4 h-4" />
            <span className="text-[9px] leading-none">Fit</span>
          </button>
          <button data-testid="button-zoom-out" title="Zoom out (Numpad-)" aria-label="Zoom out"
            onClick={() => props.setViewBox((v) => { const nz = Math.min(4, v.zoom * 1.22); const cx = v.x + props.W * v.zoom / 2; const cy = v.y + props.H * v.zoom / 2; return { x: cx - props.W * nz / 2, y: cy - props.H * nz / 2, zoom: nz }; })}
            className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <ZoomOut className="w-4 h-4" />
            <span className="text-[9px] leading-none">Out</span>
          </button>
          <div className="w-px self-stretch bg-border mx-0.5 my-1" />
          <button data-testid="button-snap" onClick={() => props.setSnapEnabled((s) => !s)} title="Toggle generation row snapping" aria-label="Toggle generation row snapping"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${props.snapEnabled ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            <Pin className="w-4 h-4" />
            <span className="text-[9px] leading-none">Snap</span>
          </button>
          <button data-testid="button-grid" onClick={() => props.setShowGrid((g) => !g)} title="Toggle background grid" aria-label="Toggle background grid"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${props.showGrid ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            <LayoutGrid className="w-4 h-4" />
            <span className="text-[9px] leading-none">Grid</span>
          </button>
          <button data-testid="button-minimap" onClick={() => props.setShowMinimap((m) => !m)} title="Toggle minimap" aria-label="Toggle minimap"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${props.showMinimap ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            <MapIcon className="w-4 h-4" />
            <span className="text-[9px] leading-none">Map</span>
          </button>
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">View</div>
      </div>

      {/* ── ARRANGE group ── */}
      <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
        <div className="flex items-center gap-0.5">
          {/* Layout dropdown */}
          <div className="relative">
            <button data-testid="button-layout" onClick={() => props.setShowLayoutMenu((v) => !v)} title="Auto-arrange nodes" aria-label="Auto-arrange nodes"
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${props.showLayoutMenu ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <div className="flex items-center gap-0.5"><LayoutGrid className="w-4 h-4" /><ChevronDown className="w-2.5 h-2.5" /></div>
              <span className="text-[9px] leading-none">Layout</span>
            </button>
            {/* Labels dropdown */}
            <div className="relative">
              <button data-testid="button-labels" onClick={() => { props.setShowLabelsMenu((v) => !v); props.setShowLayoutMenu(false); }} title="Generation labels" aria-label="Generation labels"
                className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${props.showLabelsMenu || props.showAutoLabels ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                <div className="flex items-center gap-0.5"><Hash className="w-4 h-4" /><ChevronDown className="w-2.5 h-2.5" /></div>
                <span className="text-[9px] leading-none">Labels</span>
              </button>
            {props.showLayoutMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => props.setShowLayoutMenu(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-56 border border-border rounded-lg shadow-xl overflow-hidden" style={{ background: "hsl(var(--popover))" }}>
                  <div className="px-3 py-2 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest">Auto Layout</div>
                  <button onClick={() => { props.setLiveLayout((v) => !v); if (!props.liveLayout) props.runAutoLayout(true); }}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 transition-colors text-left ${props.liveLayout ? "bg-primary/10" : "hover:bg-accent"}`}>
                    <div className={`w-4 h-4 mt-0.5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${props.liveLayout ? "border-primary bg-primary/30" : "border-muted-foreground"}`}>
                      {props.liveLayout && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <div className={`text-xs font-medium ${props.liveLayout ? "text-primary" : ""}`}>Live Layout {props.liveLayout ? "ON" : "OFF"}</div>
                      <div className="text-xs text-muted-foreground">Auto-arrange as you add connections</div>
                    </div>
                  </button>
                  <button onClick={() => { props.runAutoLayout(true); props.setShowLayoutMenu(false); }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border">
                    <LayoutGrid className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                    <div>
                      <div className="text-xs font-medium">Auto-arrange <span className="text-muted-foreground font-normal">(L)</span></div>
                      <div className="text-xs text-muted-foreground">Arrange unpinned nodes; pinned stay</div>
                    </div>
                  </button>
                  <button onClick={() => { props.runAutoLayout(false); props.setShowLayoutMenu(false); }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border">
                    <LayoutGrid className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-400" />
                    <div>
                      <div className="text-xs font-medium">Force layout all</div>
                      <div className="text-xs text-muted-foreground">Ignore pinning — rearrange everything</div>
                    </div>
                  </button>
                  <button onClick={() => { props.updateCanvas((prev) => ({ ...prev, nodes: prev.nodes.map((n) => ({ ...n, pinned: false })) })); props.setShowLayoutMenu(false); }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border">
                    <PinOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium">Unpin all</div>
                      <div className="text-xs text-muted-foreground">Remove all manual pin locks</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
            {props.showLabelsMenu && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl min-w-[220px]"
                onMouseLeave={() => props.setShowLabelsMenu(false)}>
                <div className="px-3 py-2 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest">Generation Labels</div>
                <button onClick={() => { props.setShowAutoLabels((v) => !v); props.setShowLabelsMenu(false); }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left">
                  <div>
                    <div className="text-xs font-medium text-foreground">{props.showAutoLabels ? "Hide labels" : "Show labels"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{props.showAutoLabels ? "Turn off overlay" : "Show I:1, II:3 … above each node"}</div>
                  </div>
                  <div className={`w-8 h-4 rounded-full flex-shrink-0 transition-colors ${props.showAutoLabels ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-all ${props.showAutoLabels ? "ml-4" : "ml-0.5"}`} />
                  </div>
                </button>
                <button onClick={props.bakeEmptyLabels} disabled={props.canvasNodes.length === 0}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border disabled:opacity-40">
                  <Hash className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                  <div>
                    <div className="text-xs font-medium text-foreground">Fill unlabeled nodes</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Write I:1, II:3 … into nodes without a name</div>
                  </div>
                </button>
                <button onClick={props.bakeAllLabels} disabled={props.canvasNodes.length === 0}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border disabled:opacity-40">
                  <Hash className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <div className="text-xs font-medium text-foreground">Apply to all nodes</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Overwrite every label with generated identifier</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Arrange</div>
      </div>

      {/* ── CLINICAL group ── */}
      <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
        <div className="flex items-center gap-0.5">
          {/* Templates */}
          <div className="relative">
            <button data-testid="button-templates"
              onClick={() => { props.setShowTemplates((v) => !v); props.setShowLayoutMenu(false); props.setShowLabelsMenu(false); }}
              title="Pedigree templates"
              aria-label="Pedigree templates"
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.showTemplates ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <LayoutTemplate className="w-4 h-4" />
              <span>Templates</span>
            </button>
            {/* Risk */}
            <button data-testid="button-risk" onClick={() => props.setShowRiskPanel((v) => !v)} title="Risk calculator panel" aria-label="Risk calculator panel"
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.showRiskPanel ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <TrendingUp className="w-4 h-4" />
              <span>Risk</span>
            </button>
            {/* Validation */}
            <button data-testid="button-validate" onClick={() => props.setShowValidation((v) => !v)} title="Pedigree validation" aria-label="Pedigree validation"
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${
                props.showValidation ? "bg-primary/10 text-primary"
                : props.validation.errorCount > 0 ? "text-red-400 bg-red-500/10"
                : props.validation.warningCount > 0 ? "text-yellow-400 bg-yellow-500/10"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}>
              {props.validation.errorCount > 0 ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{props.validation.errorCount > 0 ? `${props.validation.errorCount} Err` : props.validation.warningCount > 0 ? `${props.validation.warningCount} Warn` : "Valid"}</span>
            </button>
            {/* Legend */}
            <button data-testid="button-legend" onClick={() => props.setShowLegend((v) => !v)} title="Toggle legend panel" aria-label="Toggle legend panel"
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.showLegend ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <BookOpen className="w-4 h-4" />
              <span>Legend</span>
            </button>
            {props.showTemplates && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl min-w-[240px]"
                onMouseLeave={() => props.setShowTemplates(false)}>
                <div className="px-3 py-2 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest">Start from template</div>
                {props.templates.map((tpl) => (
                  <button key={tpl.key}
                    onClick={() => {
                      if (props.canvasNodes.length === 0) {
                        const data = props.buildTemplate(tpl.key);
                        props.updateCanvas(() => data);
                        props.setShowTemplates(false);
                        return;
                      }
                      openConfirm("Replace Pedigree", "Replace current pedigree with template?", () => {
                        const data = props.buildTemplate(tpl.key);
                        props.updateCanvas(() => data);
                        props.setShowTemplates(false);
                      });
                    }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border first:border-0">
                    <LayoutTemplate className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                    <div>
                      <div className="text-xs font-medium">{tpl.name}</div>
                      <div className="text-xs text-muted-foreground">{tpl.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Clinical</div>
      </div>

      {/* ── COLLABORATION group ── */}
      <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
        <div className="flex items-center gap-0.5">
          <button
            data-testid="button-timeline"
            onClick={() => props.setShowVersionTimeline((v) => !v)}
            title="Version timeline"
            aria-label="Version timeline"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.showVersionTimeline ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Timeline</span>
          </button>
          <button
            data-testid="button-follow"
            onClick={() => props.setShowFollowMode((v) => !v)}
            title="Follow history playback"
            aria-label="Follow history playback"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.showFollowMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <History className="w-4 h-4" />
            <span>Follow</span>
          </button>
          <button
            data-testid="button-lan-share"
            onClick={() => props.setShowLanShare(true)}
            title="LAN share (direct P2P)"
            aria-label="LAN share"
            className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Wifi className="w-4 h-4" />
            <span>LAN</span>
          </button>
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Collab</div>
      </div>

      {/* ── Status spacer ── */}
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
        {!props.linkMode && props.saveStatus === "saved" && <span className="text-xs font-medium" style={{ color: "hsl(var(--primary))" }} aria-hidden="true">Saved ✓</span>}
        {!props.linkMode && props.saveStatus !== "saving" && props.saveStatus !== "saved" && props.selectedCount > 1 && (
          <span className="text-xs" style={{ color: "hsl(var(--primary))" }}>{props.selectedCount} selected</span>
        )}
      </div>

      {/* ── FILE group ── */}
      <div className="flex flex-col justify-between border-l border-border flex-shrink-0 px-2 pt-2 pb-2">
        <div className="flex items-center gap-0.5">
          {/* Save session button + modal anchor */}
          <div className="relative">
            <button data-testid="button-save-version" onClick={props.handleSaveVersion} title="Save session snapshot to database" aria-label="Save session snapshot"
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.showSaveModal ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button data-testid="button-history" onClick={() => props.setShowVersions(!props.showVersions)} title="Browse saved sessions" aria-label="Browse saved sessions"
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.showVersions ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <Clock className="w-4 h-4" />
              <span>Sessions</span>
            </button>
            {props.showSaveModal && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => props.setShowSaveModal(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-72 border border-border rounded-lg shadow-xl overflow-hidden" style={{ background: "hsl(var(--popover))" }}>
                  <div className="px-3 py-2 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest">Save Session</div>
                  <div className="p-3 space-y-2">
                    <div className="text-[10px] text-muted-foreground">Label for this snapshot:</div>
                    <input
                      autoFocus
                      value={props.sessionLabel}
                      onChange={(e) => props.setSessionLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") props.commitSaveVersion(); if (e.key === "Escape") props.setShowSaveModal(false); }}
                      className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
                      placeholder="Session name…"
                    />
                    <div className="text-[9px] text-muted-foreground">{props.canvasNodes.length} nodes · {props.canvasEdges.length} connections</div>
                    <div className="flex gap-2">
                      <button onClick={props.commitSaveVersion} disabled={props.saveVersion.isPending}
                        className="flex-1 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                        {props.saveVersion.isPending ? "Saving…" : "Save Session"}
                      </button>
                      <button onClick={() => props.setShowSaveModal(false)} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors">Cancel</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <button data-testid="button-history" onClick={() => props.setShowVersions(!props.showVersions)} title="Browse saved sessions"
            className={`flex flex-col items-center gap-1 w-[48px] py-1.5 rounded text-[10px] leading-none transition-colors ${props.showVersions ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            <Clock className="w-4 h-4" />
            <span>Sessions</span>
          </button>
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">File</div>
      </div>

      {/* ── SHARE group ── */}
      <div className="flex flex-col justify-between border-l border-border flex-shrink-0 px-2 pt-2 pb-2">
        <div className="flex items-center gap-0.5">
          <button data-testid="button-share" onClick={() => props.setShowShareModal(true)} title="Share this pedigree" aria-label="Share this pedigree"
            className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
          <div className="relative">
            <button data-testid="button-export" onClick={() => props.setShowExportMenu(!props.showExportMenu)} title="Export pedigree" aria-label="Export pedigree"
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-[10px] leading-none transition-colors ${props.showExportMenu ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <div className="flex items-center gap-0.5"><Download className="w-4 h-4" /><ChevronDown className="w-2.5 h-2.5" /></div>
              <span>{props.exportingFormat ? "…" : "Export"}</span>
            </button>
            {props.showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => props.setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 border border-border rounded-lg shadow-xl overflow-hidden" style={{ background: "hsl(var(--popover))" }}>
                  <div className="px-3 py-2 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest">Export As</div>
                  {([
                    { id: "report", label: "Clinical Report (PDF)", sub: "Pedigree + risk + validation", icon: <ShieldCheck className="w-4 h-4 text-green-400" />, fn: props.handleExportReport },
                    { id: "pdf", label: "Pedigree Diagram (PDF)", sub: "Landscape diagram only", icon: <FileText className="w-4 h-4 text-red-400" />, fn: props.handleExportPDF },
                    { id: "pptx", label: "PowerPoint (.pptx)", sub: "Editable shapes", icon: <Presentation className="w-4 h-4 text-orange-400" />, fn: props.handleExportPPTX },
                    { id: "svg", label: "SVG Image (.svg)", sub: "Scalable vector graphic", icon: <FileText className="w-4 h-4 text-purple-400" />, fn: props.handleExportSVG },
                    { id: "png", label: "PNG Image (.png)", sub: "High-resolution bitmap (2x)", icon: <FileJson className="w-4 h-4 text-cyan-400" />, fn: props.handleExportPNG },
                    { id: "json", label: "JSON", sub: "Raw canvas data", icon: <FileJson className="w-4 h-4 text-blue-400" />, fn: props.handleExportJSON },
                  ] as const).map((item, i) => (
                    <button key={item.id} data-testid={`button-export-${item.id}`}
                      onClick={item.fn} disabled={!!props.exportingFormat}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors disabled:opacity-40 text-left ${i > 0 ? "border-t border-border" : ""}`}>
                      {item.icon}
                      <div>
                        <div className="text-xs font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Share</div>
      </div>

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