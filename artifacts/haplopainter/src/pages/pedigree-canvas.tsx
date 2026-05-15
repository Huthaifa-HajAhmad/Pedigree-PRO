import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetPedigree, useUpdatePedigree, useListVersions,
  useSaveVersion, useRestoreVersion, queryKeys,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { exportJSON, exportPDF, exportPPTX, exportClinicalReport, exportPNG, exportSVG } from "@/lib/export-pedigree";
import { getAccentHex } from "@/lib/theme";
import { validatePedigree } from "@/lib/validate-pedigree";
import { computeAutoLayout } from "@/lib/auto-layout";
import { computeAutoLabels } from "@/lib/pedigree-labels";
import { generateThumbnail } from "@/lib/generate-thumbnail";
import { type InheritanceMode } from "@/lib/risk-calculator";
import { usePedigreeTabs } from "@/hooks/use-pedigree-tabs";
import { usePedigreeKeyboard } from "@/hooks/use-pedigree-keyboard";
import { usePedigreeDraft } from "@/hooks/use-pedigree-draft";
import { usePedigreeCanvas } from "@/features/pedigree-editor/hooks/use-pedigree-canvas";
import { PedigreeCanvasBody } from "@/features/pedigree-editor/PedigreeCanvasBody";

import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation, CanvasData, DragState } from "@/features/pedigree-editor/canvas/types";
export type { PedigreeNode, PedigreeEdge, PedigreeAnnotation, CanvasData, DragState };
import { NODE_SIZE, NODE_GAP, GEN_GRID } from "@/features/pedigree-editor/canvas/types";
import { DEFAULT_CANVAS, parseCanvas } from "@/features/pedigree-editor/utils/helpers";
import { buildTemplate, getTemplateOptions } from "@/features/pedigree-editor/utils/templates";
import { TabBar } from "@/features/pedigree-editor/panels/TabBar";
import { RibbonToolbar } from "@/features/pedigree-editor/toolbar/RibbonToolbar";
import { DraftBanner } from "@/features/pedigree-editor/overlay/DraftBanner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { VersionTimeline, FollowMode, LanShare } from "@/features/collaboration";

const PEDIGREE_TEMPLATES = getTemplateOptions();

export default function PedigreeCanvas() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const queryClient = useQueryClient();
  const { data: pedigree, isLoading } = useGetPedigree(id);
  const { data: versions, isLoading: versionsLoading } = useListVersions(id);
  const updatePedigree = useUpdatePedigree();
  const saveVersion = useSaveVersion();
  const restoreVersion = useRestoreVersion();

  // ── Core state ──────────────────────────────────────────────────────────
  const [canvas, setCanvas] = useState<CanvasData>(DEFAULT_CANVAS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<CanvasData[]>([]);
  const [future, setFuture] = useState<CanvasData[]>([]);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, zoom: 1 });
  const [panning, setPanning] = useState<{ startX: number; startY: number; vbX: number; vbY: number } | null>(null);
  const W = 1400; const H = 900;

  // ── UI toggle state ─────────────────────────────────────────────────────
  const [showVersions, setShowVersions] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [sessionLabel, setSessionLabel] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState<"couple" | "parent-child" | "consanguinity" | null>(null);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapRows, setSnapRows] = useState<number[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [liveLayout, setLiveLayout] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [annDragging, setAnnDragging] = useState<{ annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number } } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [riskMode, setRiskMode] = useState<InheritanceMode>("AR");
  const [showRiskCalc, setShowRiskCalc] = useState(false);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [showAutoLabels, setShowAutoLabels] = useState(true);
  const [showLabelsMenu, setShowLabelsMenu] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [editModalNodeId, setEditModalNodeId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [showTabPicker, setShowTabPicker] = useState(false);

  // ── Collaboration state ───────────────────────────────────────────────────
  const [showVersionTimeline, setShowVersionTimeline] = useState(false);
  const [showFollowMode, setShowFollowMode] = useState(false);
  const [showLanShare, setShowLanShare] = useState(false);
  const [followIndex, setFollowIndex] = useState(0);

  // ── Confirm dialog state ────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; variant?: "default" | "destructive"; onConfirm: () => void } | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<CanvasData>(canvas);
  const preDragCanvasRef = useRef<CanvasData | null>(null);
  useEffect(() => { canvasRef.current = canvas; }, [canvas]);
  const lassoRef = useRef<{ startSVG: { x: number; y: number }; curSVG: { x: number; y: number } } | null>(null);
  const isLassoingRef = useRef(false);
  const lassoRectRef = useRef<SVGRectElement>(null);
  const [lassoVisible, setLassoVisible] = useState(false);
  const spaceHeldRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const rafRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Tabs ────────────────────────────────────────────────────────────────
  const [, navigate] = useLocation();
  const { tabs, openTab, closeTab } = usePedigreeTabs();

  // ── Draft persistence ───────────────────────────────────────────────────
  const draftKeyRef = useRef(`haplopainter_draft_${id}`);
  useEffect(() => { draftKeyRef.current = `haplopainter_draft_${id}`; }, [id]);
  const { showDraftBanner, draftEnabledRef, handleRestoreDraft, handleDismissDraft } = usePedigreeDraft({ id, pedigreeData: pedigree, canvasRef, draftKeyRef });
  const onRestoreDraft = useCallback(() => handleRestoreDraft(setCanvas, setHistory, setFuture), [handleRestoreDraft]);

  // ── API sync + tab registration ─────────────────────────────────────────
  const initialSyncDoneRef = useRef(false);
  useEffect(() => {
    if (pedigree?.canvas_data !== undefined && !initialSyncDoneRef.current) {
      setCanvas(parseCanvas(pedigree.canvas_data));
      initialSyncDoneRef.current = true;
    }
  }, [pedigree?.canvas_data]);
  useEffect(() => { if (pedigree?.title && id) openTab(id, pedigree.title); }, [pedigree?.title, id, openTab]);

  // ── Derived data ────────────────────────────────────────────────────────
  const autoLabels = useMemo(() => computeAutoLabels(canvas.nodes, canvas.edges), [canvas.nodes, canvas.edges]);
  const validation = useMemo(() => validatePedigree(canvas), [canvas]);
  const singleSelected = selectedIds.size === 1 ? canvas.nodes.find((n) => selectedIds.has(n.id)) ?? null : null;
  const anySelected = selectedIds.size > 0;

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as string[];
    return canvas.nodes.filter((n) => (n.label || "").toLowerCase().includes(q) || (n.age || "").toLowerCase().includes(q) || n.type.toLowerCase().includes(q)).map((n) => n.id);
  }, [canvas.nodes, searchQuery]);
  useEffect(() => { if (searchMatches.length > 0) setSelectedIds(new Set([searchMatches[Math.min(searchMatchIndex, searchMatches.length - 1)]])); }, [searchMatches, searchMatchIndex]);

  const generationRailEntries = useMemo(() => {
    if (!showAutoLabels || canvas.nodes.length === 0) return [];
    const groups = new Map<string, number[]>();
    for (const n of canvas.nodes) { const l = autoLabels.get(n.id); if (!l) continue; const r = l.split(":")[0]; if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(n.y); }
    return [...groups.entries()].map(([r, ys]) => ({ roman: r, y: [...ys].sort((a, b) => a - b)[Math.floor(ys.length / 2)] })).sort((a, b) => a.y - b.y);
  }, [canvas.nodes, autoLabels, showAutoLabels]);
  const legendEntries = useMemo(() => {
    const e: Array<{ key: string; label: string }> = [];
    const nt = new Set(canvas.nodes.map((n) => n.type));
    const et = new Set(canvas.edges.map((ed) => ed.type));
    if (nt.has("male")) e.push({ key: "male", label: "Male" });
    if (nt.has("female")) e.push({ key: "female", label: "Female" });
    if (nt.has("unknown")) e.push({ key: "unknown", label: "Unknown sex" });
    if (nt.has("pregnancy")) e.push({ key: "pregnancy", label: "Pregnancy" });
    if (nt.has("sab")) e.push({ key: "sab", label: "SAB" });
    if (canvas.nodes.some((n) => n.affected)) e.push({ key: "affected", label: "Affected" });
    if (canvas.nodes.some((n) => n.carrier && !n.affected)) e.push({ key: "carrier", label: "Carrier" });
    if (canvas.nodes.some((n) => n.deceased)) e.push({ key: "deceased", label: "Deceased" });
    if (canvas.nodes.some((n) => n.proband)) e.push({ key: "proband", label: "Proband" });
    if (et.has("couple")) e.push({ key: "couple", label: "Partners" });
    if (et.has("consanguinity")) e.push({ key: "consanguinity", label: "Consanguineous" });
    if (et.has("parent-child")) e.push({ key: "parent-child", label: "Parent–Child" });
    return e;
  }, [canvas]);

  // ── Auto-save ───────────────────────────────────────────────────────────
  const autoSaveRef = useRef<(newCanvas: CanvasData) => void>(() => {});
  const autoSave = useCallback((newCanvas: CanvasData) => {
    setSaveStatus("saving");
    updatePedigree.mutate({ id, input: { canvas_data: JSON.stringify(newCanvas) } }, {
      onSuccess: () => {
        queryClient.setQueryData(queryKeys.pedigree(id), (old: any) => old ? { ...old, canvas_data: JSON.stringify(newCanvas), canvas_hash: undefined } : old);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
        try { localStorage.removeItem(`haplopainter_draft_${id}`); } catch {}
      },
      onError: () => {
        setSaveStatus("idle");
        toast({ title: "Save failed", description: "Changes could not be saved. Your draft is preserved locally.", variant: "destructive" });
      },
    });
  }, [id, updatePedigree, queryClient]);
  autoSaveRef.current = autoSave;

  const saveDraft = useCallback((data: CanvasData) => {
    if (draftEnabledRef.current) {
      try { localStorage.setItem(draftKeyRef.current, JSON.stringify({ canvas: data, at: Date.now() })); } catch {}
    }
  }, []);

  const updateCanvas = useCallback((updater: (prev: CanvasData) => CanvasData, opts?: { skipHistory?: boolean }) => {
    setCanvas((prev) => { const next = updater(prev); if (!opts?.skipHistory) { setHistory((h) => [...h.slice(-49), prev]); setFuture([]); } saveDraft(next); return next; });
  }, [saveDraft]);

  // Auto-save on canvas change (debounced, outside state updater)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoSaveTimerRef.current !== null) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => autoSaveRef.current(canvas), 500);
    return () => { if (autoSaveTimerRef.current !== null) clearTimeout(autoSaveTimerRef.current); };
  }, [canvas]);

  // ── Business operations ─────────────────────────────────────────────────
  const undo = useCallback(() => setHistory((h) => { if (!h.length) return h; const t = h[h.length - 1]; setCanvas((c) => { setFuture((f) => [...f.slice(-49), c]); saveDraft(t); return t; }); return h.slice(0, -1); }), [saveDraft]);
  const redo = useCallback(() => setFuture((f) => { if (!f.length) return f; const t = f[f.length - 1]; setCanvas((c) => { setHistory((h) => [...h.slice(-49), c]); saveDraft(t); return t; }); return f.slice(0, -1); }), [saveDraft]);

  const addNode = useCallback((type: PedigreeNode["type"]) => {
    const en = canvasRef.current!.nodes;
    const vbW = W * viewBox.zoom, vbH = H * viewBox.zoom;
    const fp = (): { x: number; y: number } => {
      if (!en.length) return { x: viewBox.x + vbW / 2, y: viewBox.y + vbH / 2 };
      const v = en.filter((n) => n.y >= viewBox.y - NODE_SIZE && n.y <= viewBox.y + vbH + NODE_SIZE) || en;
      const rows = Math.round(Math.max(...v.map((n) => n.y)) / GEN_GRID) * GEN_GRID;
      const rx = Math.max(...en.filter((n) => Math.abs(n.y - rows) < NODE_GAP / 2).map((n) => n.x), viewBox.x) + NODE_GAP;
      for (let ro = 0; ro <= 3; ro++) for (let co = 0; co < 12; co++) { const cx = rx + co * NODE_GAP, cy = rows + ro * GEN_GRID; if (en.every((n) => Math.hypot(n.x - cx, n.y - cy) >= NODE_GAP)) return { x: cx, y: cy }; }
      return { x: viewBox.x + vbW / 2, y: Math.max(...en.map((n) => n.y)) + GEN_GRID };
    };
    const { x, y } = fp();
    const nid = `n${Date.now()}`;
    updateCanvas((p) => ({ ...p, nodes: [...p.nodes, { id: nid, type, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x, y }] }));
    setSelectedIds(new Set([nid]));
  }, [updateCanvas, viewBox]);

  const addContextNode = useCallback((rel: "child" | "sibling" | "partner") => {
    if (selectedIds.size !== 1) return;
    const [sid] = selectedIds;
    const now = Date.now(), nid = `n${now}`;
    updateCanvas((p) => {
      const s = p.nodes.find((n) => n.id === sid);
      if (!s) return p;
      const SX = 110, SY = 150;
      let nx: number, ny: number, nt: PedigreeNode["type"];
      const ne: PedigreeEdge[] = [];
      if (rel === "child") { ny = s.y + SY; nt = "unknown"; const ce = p.edges.find((e) => e.type === "couple" && (e.sourceId === sid || e.targetId === sid)); if (ce) { const pid = ce.sourceId === sid ? ce.targetId : ce.sourceId; nx = (s.x + (p.nodes.find((n) => n.id === pid)?.x ?? s.x)) / 2; ne.push({ id: `e${now}`, type: "parent-child", sourceId: sid, targetId: nid }, { id: `e${now + 1}`, type: "parent-child", sourceId: pid, targetId: nid }); } else { const mid = `n${now + 100}`; const mt = s.type === "female" ? "male" : "female"; nx = s.x + SX / 2; return { ...p, nodes: [...p.nodes, { id: mid, type: mt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: s.x + SX, y: s.y }, { id: nid, type: nt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: nx, y: ny }], edges: [...p.edges, { id: `e${now}`, type: "couple", sourceId: sid, targetId: mid }, { id: `e${now + 1}`, type: "parent-child", sourceId: sid, targetId: nid }, { id: `e${now + 2}`, type: "parent-child", sourceId: mid, targetId: nid }] }; } } else if (rel === "partner") { nt = s.type === "male" ? "female" : s.type === "female" ? "male" : "unknown"; nx = s.x + SX; ny = s.y; ne.push({ id: `e${now}`, type: "couple", sourceId: sid, targetId: nid }); } else { nt = (s.type === "sab" || s.type === "pregnancy") ? "unknown" : s.type; ny = s.y; nx = s.x + SX; }
      return { ...p, nodes: [...p.nodes, { id: nid, type: nt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: nx, y: ny }], edges: [...p.edges, ...ne] };
    });
    setSelectedIds(new Set([nid]));
  }, [selectedIds, updateCanvas]);

  const toggleNodeProp = useCallback((nid: string, prop: "affected" | "carrier" | "deceased" | "proband") => { updateCanvas((p) => ({ ...p, nodes: p.nodes.map((n) => n.id === nid ? { ...n, [prop]: typeof n[prop] === 'boolean' ? !n[prop] : true } : n) })); setContextMenu(null); }, [updateCanvas]);
  const setNodeType = useCallback((nid: string, type: PedigreeNode["type"]) => { updateCanvas((p) => ({ ...p, nodes: p.nodes.map((n) => n.id === nid ? { ...n, type } : n) })); setContextMenu(null); }, [updateCanvas]);
  const handleNodeContextMenu = useCallback((nid: string, e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setSelectedIds(new Set([nid])); setContextMenu({ nodeId: nid, x: e.clientX, y: e.clientY }); }, []);
  const handleNodeDoubleClick = useCallback((nid: string, e: React.MouseEvent) => { e.stopPropagation(); setSelectedIds(new Set([nid])); setEditModalNodeId(nid); }, []);
  const deleteSelected = useCallback(() => { if (!selectedIds.size) return; const ids = selectedIds; updateCanvas((p) => ({ ...p, nodes: p.nodes.filter((n) => !ids.has(n.id)), edges: p.edges.filter((e) => !ids.has(e.sourceId) && !ids.has(e.targetId)), annotations: p.annotations.filter((a) => !ids.has(a.nodeId)) })); setSelectedIds(new Set()); setSelectedAnnotationId(null); }, [selectedIds, updateCanvas]);
  const updateSelectedNode = useCallback((u: Partial<PedigreeNode>) => { if (selectedIds.size !== 1) return; const [id] = selectedIds; updateCanvas((p) => ({ ...p, nodes: p.nodes.map((n) => n.id === id ? { ...n, ...u } : n) })); }, [selectedIds, updateCanvas]);
  const bulkUpdate = useCallback((u: Partial<PedigreeNode>) => { if (!selectedIds.size) return; const ids = selectedIds; updateCanvas((p) => ({ ...p, nodes: p.nodes.map((n) => ids.has(n.id) ? { ...n, ...u } : n) })); }, [selectedIds, updateCanvas]);
  const alignSelected = useCallback((axis: "x" | "y") => { if (selectedIds.size < 2) return; const ids = selectedIds; updateCanvas((p) => { const s = p.nodes.filter((n) => ids.has(n.id)); const avg = s.reduce((a, n) => a + n[axis], 0) / s.length; return { ...p, nodes: p.nodes.map((n) => ids.has(n.id) ? { ...n, [axis]: avg, pinned: true } : n) }; }); }, [selectedIds, updateCanvas]);
  const addAnnotation = useCallback((nid: string) => { const a = { id: `a${Date.now()}`, nodeId: nid, text: "Note", color: getAccentHex(), fontSize: 12, position: "above" } as PedigreeAnnotation; updateCanvas((p) => ({ ...p, annotations: [...p.annotations, a] })); setSelectedAnnotationId(a.id); }, [updateCanvas]);
  const updateAnnotation = useCallback((aid: string, u: Partial<PedigreeAnnotation>) => { updateCanvas((p) => ({ ...p, annotations: p.annotations.map((a) => a.id === aid ? { ...a, ...u } : a) })); }, [updateCanvas]);
  const deleteAnnotation = useCallback((aid: string) => { updateCanvas((p) => ({ ...p, annotations: p.annotations.filter((a) => a.id !== aid) })); setSelectedAnnotationId(null); }, [updateCanvas]);
  const handleNodeClick = useCallback((nid: string, e: React.MouseEvent) => {
    if (linkMode && linkSource) { if (linkSource !== nid) { if (linkMode === "consanguinity") updateCanvas((p) => ({ ...p, edges: [...p.edges.filter((ed) => !(ed.type === "couple" && ((ed.sourceId === linkSource && ed.targetId === nid) || (ed.sourceId === nid && ed.targetId === linkSource)))), { id: `e${Date.now()}`, type: "consanguinity", sourceId: linkSource, targetId: nid }] })); else if (linkMode === "parent-child") updateCanvas((p) => { const pn = p.nodes.find((n) => n.id === linkSource); if (!pn) return p; const hp = p.edges.some((ed) => (ed.type === "couple" || ed.type === "consanguinity") && (ed.sourceId === linkSource || ed.targetId === linkSource)); if (hp) return { ...p, edges: [...p.edges, { id: `e${Date.now()}`, type: "parent-child", sourceId: linkSource, targetId: nid }] }; const mt = pn.type === "male" ? "female" : pn.type === "female" ? "male" : "unknown"; const ts = Date.now(), mid = `n${ts}_auto`; return { ...p, nodes: [...p.nodes, { id: mid, type: mt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: pn.type === "female" ? pn.x - NODE_GAP : pn.x + NODE_GAP, y: pn.y, pinned: true }], edges: [...p.edges, { id: `e${Date.now()}`, type: "parent-child", sourceId: linkSource, targetId: nid }, { id: `ec${ts}`, type: "couple", sourceId: linkSource, targetId: mid }, { id: `emc${ts}`, type: "parent-child", sourceId: mid, targetId: nid }] }; }); else updateCanvas((p) => ({ ...p, edges: [...p.edges, { id: `e${Date.now()}`, type: linkMode, sourceId: linkSource, targetId: nid }] })); } setLinkMode(null); setLinkSource(null); return; }
    if (linkMode && !linkSource) { setLinkSource(nid); return; }
    if (e.metaKey || e.ctrlKey) setSelectedIds((p) => { const n = new Set(p); n.has(nid) ? n.delete(nid) : n.add(nid); return n; });
    else setSelectedIds(new Set([nid]));
  }, [linkMode, linkSource, updateCanvas]);

  const runAutoLayout = useCallback((rp: boolean) => { updateCanvas((p) => ({ ...p, nodes: computeAutoLayout(p.nodes, p.edges, rp) as PedigreeNode[] })); }, [updateCanvas]);
  useEffect(() => { if (liveLayout && canvas.nodes.length > 0) runAutoLayout(true); }, [liveLayout, canvas.edges, canvas.nodes.length]);
  const bakeEmptyLabels = useCallback(() => { updateCanvas((p) => ({ ...p, nodes: p.nodes.map((n) => { if (n.label) return n; const c = computeAutoLabels(p.nodes, p.edges).get(n.id); return c ? { ...n, label: c } : n; }) })); setShowLabelsMenu(false); }, [updateCanvas]);
  const openConfirm = useCallback((title: string, message: string, onConfirm: () => void, variant?: "default" | "destructive") => {
    setConfirmProps({ title, message, onConfirm, variant });
    setConfirmOpen(true);
  }, []);

  const bakeAllLabels = useCallback(() => {
    openConfirm("Overwrite Labels", "Overwrite all node labels?", () => {
      updateCanvas((p) => { const c = computeAutoLabels(p.nodes, p.edges); return { ...p, nodes: p.nodes.map((n) => ({ ...n, label: c.get(n.id) ?? n.label })) }; });
      setShowLabelsMenu(false);
    });
  }, [updateCanvas, openConfirm]);
  const handleCloseTab = useCallback((tid: number) => { closeTab(tid); if (tid === id) { const r = tabs.filter((t) => t.id !== tid); r.length ? navigate(`/pedigrees/${r[Math.max(0, tabs.findIndex((t) => t.id === tid) - (tabs.findIndex((t) => t.id === tid) >= r.length ? 1 : 0))].id}`) : navigate("/pedigrees"); } }, [closeTab, id, tabs, navigate]);
  const navigateArrow = useCallback((dir: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => {
    if (!canvas.nodes.length) return;
    if (!singleSelected) { setSelectedIds(new Set([[...canvas.nodes].sort((a, b) => a.y - b.y || a.x - b.x)[0].id])); return; }
    const { x, y } = singleSelected;
    const others = canvas.nodes.filter((n) => n.id !== singleSelected.id);
    const candidates = dir === "ArrowRight" ? others.filter((n) => n.x > x + 5) : dir === "ArrowLeft" ? others.filter((n) => n.x < x - 5) : dir === "ArrowDown" ? others.filter((n) => n.y > y + 5) : others.filter((n) => n.y < y - 5);
    if (!candidates.length) return;
    setSelectedIds(new Set([candidates.reduce((b, n) => ((n.x - x) ** 2 + (n.y - y) ** 2 < (b.x - x) ** 2 + (b.y - y) ** 2 ? n : b)).id]));
  }, [canvas.nodes, singleSelected]);

  // ── Canvas interaction (extracted hook) ─────────────────────────────────
  const { getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, fitToScreen } = usePedigreeCanvas({
    svgRef, canvasNodes: canvas.nodes, canvasAnnotations: canvas.annotations, canvasEdges: canvas.edges,
    selectedIds, setSelectedIds, setCanvas, dragging, setDragging, isDragging, setIsDragging,
    viewBox, setViewBox, panning, setPanning, snapEnabled, snapRows, setSnapRows,
    annDragging, setAnnDragging, linkMode,
    lassoRef, isLassoingRef, lassoRectRef, spaceHeldRef, setLassoVisible,
    preDragCanvasRef, rafRef, W, H, setHistory, setFuture, updateCanvas, autoSave,
    canvasRef, draftEnabledRef, draftKeyRef,
  });

  // ── Keyboard shortcuts (extracted hook) ─────────────────────────────────
  usePedigreeKeyboard({ deleteSelected, addNode, addContextNode, undo, redo, navigateArrow, showSearch, fitToScreen, runAutoLayout: (rp: boolean) => runAutoLayout(rp), setShowSearch, setSearchQuery, setSelectedIds, setLinkMode, setLinkSource, setSelectedAnnotationId, setViewBox, spaceHeldRef, setSpaceHeld, searchInputRef, W, H });

  // ── Version management ──────────────────────────────────────────────────
  const handleSaveVersion = () => { setSessionLabel(`Session · ${canvas.nodes.length} node${canvas.nodes.length !== 1 ? "s" : ""} · ${new Date().toLocaleDateString()}`); setShowSaveModal(true); };
  const commitSaveVersion = () => { const t = generateThumbnail(canvas); saveVersion.mutate({ pedigreeId: id, input: { canvas_data: JSON.stringify(canvas), label: sessionLabel || null, thumbnail: t, saver_key: "" } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.versions(id) }); setShowSaveModal(false); setSessionLabel(""); } }); };
  const handleDeleteVersion = () => {
    toast({ title: "Coming soon", description: "Version deletion will be available in v0.2." });
  };
  const handleRestoreVersion = (vid: number) => {
    openConfirm("Restore Version", "Restore this version? Current canvas will be replaced.", () => {
      restoreVersion.mutate({ pedigreeId: id, versionId: vid }, { onSuccess: (d: any) => { setCanvas(parseCanvas(d.canvas_data)); initialSyncDoneRef.current = true; queryClient.setQueryData(queryKeys.pedigree(id), d); setShowVersions(false); } });
    });
  };

  // ── Export ──────────────────────────────────────────────────────────────
  const getExportInfo = () => ({ title: pedigree?.title ?? "Pedigree", patient_id: pedigree?.patient_id ?? null, notes: pedigree?.notes ?? null });
  const he = (fn: Function, fmt: string) => async () => { setShowExportMenu(false); setExportingFormat(fmt); try { await fn(getExportInfo(), canvas); } finally { setExportingFormat(null); } };

  const vbW = W * viewBox.zoom, vbH = H * viewBox.zoom, MM_W = 180, MM_H = Math.round(MM_W * H / W);
  const visibleGenRows = useMemo(() => {
    if (!isDragging || !snapEnabled) return [];
    const result: number[] = [];
    for (const r of snapRows) {
      if (r >= viewBox.y - 40 && r <= viewBox.y + vbH + 40) result.push(r);
    }
    return result;
  }, [isDragging, snapEnabled, snapRows, viewBox.y, vbH]);

  if (isLoading) return <div className="flex items-center justify-center h-screen" role="status" aria-live="polite"><div className="text-primary animate-pulse tracking-widest">LOADING...</div></div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TabBar
        tabs={tabs.map((t: any) => ({ id: t.id, title: t.title }))}
        currentId={id}
        showTabPicker={showTabPicker}
        onToggleTabPicker={() => setShowTabPicker((v) => !v)}
        onCloseTab={handleCloseTab}
        onNavigate={navigate}
        onOpenTab={openTab}
      />

      {showDraftBanner && (
        <DraftBanner onRestore={onRestoreDraft} onDismiss={handleDismissDraft} />
      )}

      <RibbonToolbar
        addNode={addNode}
        linkMode={linkMode} linkSource={linkSource}
        setLinkMode={setLinkMode} setLinkSource={setLinkSource}
        undo={undo} redo={redo} deleteSelected={deleteSelected}
        historyLength={history.length} futureLength={future.length}
        selectedCount={selectedIds.size} anySelected={anySelected}
        viewBox={viewBox} setViewBox={setViewBox}
        snapEnabled={snapEnabled} setSnapEnabled={setSnapEnabled}
        showGrid={showGrid} setShowGrid={setShowGrid}
        showMinimap={showMinimap} setShowMinimap={setShowMinimap}
        fitToScreen={fitToScreen} W={W} H={H}
        canvasNodes={canvas.nodes} canvasEdges={canvas.edges}
        showLayoutMenu={showLayoutMenu} setShowLayoutMenu={setShowLayoutMenu}
        liveLayout={liveLayout} setLiveLayout={setLiveLayout}
        runAutoLayout={runAutoLayout}
        showAutoLabels={showAutoLabels} setShowAutoLabels={setShowAutoLabels}
        showLabelsMenu={showLabelsMenu} setShowLabelsMenu={setShowLabelsMenu}
        bakeEmptyLabels={bakeEmptyLabels} bakeAllLabels={bakeAllLabels}
        updateCanvas={updateCanvas as any}
        showTemplates={showTemplates} setShowTemplates={setShowTemplates}
        templates={PEDIGREE_TEMPLATES} buildTemplate={buildTemplate}
        showRiskPanel={showRiskPanel} setShowRiskPanel={setShowRiskPanel}
        showValidation={showValidation} setShowValidation={setShowValidation}
        validation={{ errorCount: validation.errorCount, warningCount: validation.warningCount }}
        showLegend={showLegend} setShowLegend={setShowLegend}
        saveStatus={saveStatus}
        handleSaveVersion={handleSaveVersion}
        showSaveModal={showSaveModal} setShowSaveModal={setShowSaveModal}
        sessionLabel={sessionLabel} setSessionLabel={setSessionLabel}
        commitSaveVersion={commitSaveVersion} saveVersion={saveVersion as any}
        showVersions={showVersions} setShowVersions={setShowVersions}
        setShowShareModal={setShowShareModal}
        showExportMenu={showExportMenu} setShowExportMenu={setShowExportMenu}
        exportingFormat={exportingFormat}
        showVersionTimeline={showVersionTimeline} setShowVersionTimeline={setShowVersionTimeline}
        showFollowMode={showFollowMode} setShowFollowMode={setShowFollowMode}
        setShowLanShare={setShowLanShare}
        handleExportReport={he(exportClinicalReport, "Report")}
        handleExportPDF={he(exportPDF, "PDF")}
        handleExportPPTX={he(exportPPTX, "PPTX")}
        handleExportPNG={he(exportPNG, "PNG")}
        handleExportSVG={he(exportSVG, "SVG")}
        handleExportJSON={() => { exportJSON(getExportInfo(), canvas); setShowExportMenu(false); }}
      />

      <PedigreeCanvasBody
        svgRef={svgRef}
        canvas={canvas}
        selectedIds={selectedIds}
        linkSource={linkSource}
        showAutoLabels={showAutoLabels}
        autoLabels={autoLabels}
        validation={validation}
        viewBox={viewBox}
        vbW={vbW}
        vbH={vbH}
        W={W}
        H={H}
        MM_W={MM_W}
        MM_H={MM_H}
        panning={panning}
        spaceHeld={spaceHeld}
        lassoVisible={lassoVisible}
        isDragging={isDragging}
        annDragging={annDragging}
        lassoRectRef={lassoRectRef}
        visibleGenRows={visibleGenRows}
        generationRailEntries={generationRailEntries}
        searchMatches={searchMatches}
        searchMatchIndex={searchMatchIndex}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        handleSVGMouseDown={handleSVGMouseDown}
        handleWheel={handleWheel}
        handleNodeClick={handleNodeClick}
        handleDragStart={handleDragStart}
        handleNodeContextMenu={handleNodeContextMenu}
        handleNodeDoubleClick={handleNodeDoubleClick}
        getSVGCoords={getSVGCoords}
        setSelectedIds={setSelectedIds}
        setSelectedAnnotationId={setSelectedAnnotationId}
        setAnnDragging={setAnnDragging}
        preDragCanvasRef={preDragCanvasRef}
        showSearch={showSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setSearchMatchIndex={setSearchMatchIndex}
        setShowSearch={setShowSearch}
        searchInputRef={searchInputRef}
        showMinimap={showMinimap}
        setViewBox={setViewBox}
        showGrid={showGrid}
        showLegend={showLegend}
        legendEntries={legendEntries}
        editModalNodeId={editModalNodeId}
        setEditModalNodeId={setEditModalNodeId}
        updateCanvas={updateCanvas}
        addAnnotation={addAnnotation}
        updateAnnotation={updateAnnotation}
        deleteAnnotation={deleteAnnotation}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        setNodeType={setNodeType}
        toggleNodeProp={toggleNodeProp}
        addContextNode={addContextNode}
        deleteSelected={deleteSelected}
        setLinkMode={setLinkMode}
        setLinkSource={setLinkSource}
        anySelected={anySelected}
        selectedAnnotationId={selectedAnnotationId}
        riskMode={riskMode}
        showRiskCalc={showRiskCalc}
        setShowRiskCalc={setShowRiskCalc}
        setRiskMode={setRiskMode}
        updateSelectedNode={updateSelectedNode}
        bulkUpdate={bulkUpdate}
        alignSelected={alignSelected}
        showRiskPanel={showRiskPanel}
        setShowRiskPanel={setShowRiskPanel}
        showVersions={showVersions}
        versions={versions ?? undefined}
        versionsLoading={versionsLoading}
        handleSaveVersion={handleSaveVersion}
        handleRestoreVersion={handleRestoreVersion}
        handleDeleteVersion={handleDeleteVersion}
        showValidation={showValidation}
        expandedIssueId={expandedIssueId}
        setExpandedIssueId={setExpandedIssueId}
        setShowValidation={setShowValidation}
        showShareModal={showShareModal}
        setShowShareModal={setShowShareModal}
        pedigree={pedigree ?? undefined}
      />

      {/* ── Collaboration overlays ──────────────────────────────────────────── */}
      {showVersionTimeline && versions && (
        <VersionTimeline
          pedigreeId={id}
          currentCanvas={JSON.stringify(canvas)}
          onPreview={(data) => setCanvas(parseCanvas(data))}
          onRestore={(data) => setCanvas(parseCanvas(data))}
        />
      )}

      {showFollowMode && versions && (
        <FollowMode
          versions={versions}
          currentIndex={followIndex}
          onChangeIndex={setFollowIndex}
          onPreview={(data) => setCanvas(parseCanvas(data))}
          onClose={() => setShowFollowMode(false)}
        />
      )}

      {showLanShare && (
        <LanShare
          pedigreeData={JSON.stringify(canvas)}
          onClose={() => setShowLanShare(false)}
          onPedigreeReceived={(data) => {
            setCanvas(typeof data === 'string' ? parseCanvas(data) : data as CanvasData);
            initialSyncDoneRef.current = true;
          }}
        />
      )}

      {confirmProps && (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmProps.title}
          message={confirmProps.message}
          variant={confirmProps.variant || "default"}
          onConfirm={() => { setConfirmOpen(false); confirmProps.onConfirm(); }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}