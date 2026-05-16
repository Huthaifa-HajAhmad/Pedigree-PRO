import { useReducer, useRef, useCallback, useEffect, useMemo, createContext, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPedigree, useUpdatePedigree, useListVersions,
  useSaveVersion, useRestoreVersion, useListProfiles, queryKeys,
} from "@workspace/api-client-react";
import { getAccentHex } from "@/lib/theme";
import { validatePedigree } from "@/lib/validate-pedigree";
import { computeAutoLayout } from "@/lib/auto-layout";
import { computeAutoLabels } from "@/lib/pedigree-labels";
import { generateThumbnail } from "@/lib/generate-thumbnail";
import { toast } from "@/hooks/use-toast";
import { usePedigreeTabs } from "@/hooks/use-pedigree-tabs";
import { usePedigreeKeyboard } from "@/hooks/use-pedigree-keyboard";
import { signData, computeHash as cryptoComputeHash, getPublicKeyFromPrivate } from "@workspace/crypto";
import { listProfilePrivateKeys } from "@workspace/browser-backend";
import { usePedigreeDraft } from "@/hooks/use-pedigree-draft";
import { usePedigreeCanvas } from "@/features/pedigree-editor/hooks/use-pedigree-canvas";
import { parseCanvas } from "@/features/pedigree-editor/utils/helpers";
import { pedigreeEditorReducer } from "./reducer";
import { INITIAL_STATE, type PedigreeEditorContextValue } from "./types";
import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation, CanvasData } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE, NODE_GAP, GEN_GRID } from "@/features/pedigree-editor/canvas/types";

const W = 1400;
const H = 900;

export const PedigreeEditorContext = createContext<PedigreeEditorContextValue | null>(null);

export function PedigreeEditorProvider({ id, children }: { id: number; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: pedigree } = useGetPedigree(id);
  const { data: versions, isLoading: versionsLoading } = useListVersions(id);
  const { data: profiles } = useListProfiles();
  const updatePedigree = useUpdatePedigree();
  const saveVersionMutation = useSaveVersion();
  const restoreVersionMutation = useRestoreVersion();

  const [state, dispatch] = useReducer(pedigreeEditorReducer, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<CanvasData | null>(state.canvas);
  const preDragCanvasRef = useRef<CanvasData | null>(null);
  useEffect(() => { canvasRef.current = state.canvas; }, [state.canvas]);
  const lassoRef = useRef<{ startSVG: { x: number; y: number }; curSVG: { x: number; y: number } } | null>(null);
  const isLassoingRef = useRef(false);
  const lassoRectRef = useRef<SVGRectElement>(null);
  const spaceHeldRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const draftKeyRef = useRef(`ppro_draft_${id}`);
  useEffect(() => { draftKeyRef.current = `ppro_draft_${id}`; }, [id]);
  const initialSyncDoneRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { showDraftBanner, draftEnabledRef, handleRestoreDraft, handleDismissDraft } = usePedigreeDraft({
    id, pedigreeData: pedigree ?? null, canvasRef, draftKeyRef,
  });

  useEffect(() => {
    if (pedigree?.canvas_data !== undefined && !initialSyncDoneRef.current) {
      dispatch({ type: "SET_CANVAS", canvas: parseCanvas(pedigree.canvas_data) });
      initialSyncDoneRef.current = true;
    }
  }, [pedigree?.canvas_data]);

  const autoLabels = useMemo(
    () => computeAutoLabels(state.canvas.nodes, state.canvas.edges),
    [state.canvas.nodes, state.canvas.edges],
  );
  const validation = useMemo(() => validatePedigree(state.canvas), [state.canvas]);

  const searchMatches = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return [] as string[];
    return state.canvas.nodes.filter((n) =>
      (n.label || "").toLowerCase().includes(q) || (n.age || "").toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
    ).map((n) => n.id);
  }, [state.canvas.nodes, state.searchQuery]);

  useEffect(() => {
    if (searchMatches.length > 0) {
      const m = searchMatches[Math.min(state.searchMatchIndex, searchMatches.length - 1)];
      if (m) dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([m]) } });
    }
  }, [searchMatches, state.searchMatchIndex]);

  const generationRailEntries = useMemo(() => {
    if (!state.showAutoLabels || state.canvas.nodes.length === 0) return [];
    const groups = new Map<string, number[]>();
    for (const n of state.canvas.nodes) {
      const l = autoLabels.get(n.id); if (!l) continue;
      const r = l.split(":")[0]; if (!r) continue;
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(n.y);
    }
    return [...groups.entries()].map(([r, ys]) => {
      const sorted = [...ys].sort((a, b) => a - b);
      return { roman: r, y: sorted[Math.floor(ys.length / 2)] ?? 0 };
    }).sort((a, b) => a.y - b.y);
  }, [state.canvas.nodes, autoLabels, state.showAutoLabels]);

  const legendEntries = useMemo(() => {
    const e: Array<{ key: string; label: string }> = [];
    const nt = new Set(state.canvas.nodes.map((n) => n.type));
    const et = new Set(state.canvas.edges.map((ed) => ed.type));
    if (nt.has("male")) e.push({ key: "male", label: "Male" });
    if (nt.has("female")) e.push({ key: "female", label: "Female" });
    if (nt.has("unknown")) e.push({ key: "unknown", label: "Unknown sex" });
    if (nt.has("pregnancy")) e.push({ key: "pregnancy", label: "Pregnancy" });
    if (nt.has("sab")) e.push({ key: "sab", label: "SAB" });
    if (state.canvas.nodes.some((n) => n.affected)) e.push({ key: "affected", label: "Affected" });
    if (state.canvas.nodes.some((n) => n.carrier && !n.affected)) e.push({ key: "carrier", label: "Carrier" });
    if (state.canvas.nodes.some((n) => n.deceased)) e.push({ key: "deceased", label: "Deceased" });
    if (state.canvas.nodes.some((n) => n.proband)) e.push({ key: "proband", label: "Proband" });
    if (et.has("couple")) e.push({ key: "couple", label: "Partners" });
    if (et.has("consanguinity")) e.push({ key: "consanguinity", label: "Consanguineous" });
    if (et.has("parent-child")) e.push({ key: "parent-child", label: "Parent–Child" });
    return e;
  }, [state.canvas]);

  const { tabs, openTab, closeTab } = usePedigreeTabs();
  const [, navigate] = useLocation();
  useEffect(() => { if (pedigree?.title && id) openTab(id, pedigree.title); }, [pedigree?.title, id, openTab]);

  const tabItems = useMemo(() => tabs.map((t) => ({ id: t.id, title: t.title })), [tabs]);

  const vbW = W * state.viewBox.zoom;
  const vbH = H * state.viewBox.zoom;
  const MM_W = 180;
  const MM_H = Math.round(MM_W * H / W);

  const visibleGenRows = useMemo(() => {
    if (!state.isDragging || !state.snapEnabled) return [];
    const r: number[] = [];
    for (const row of state.snapRows) { if (row >= state.viewBox.y - 40 && row <= state.viewBox.y + vbH + 40) r.push(row); }
    return r;
  }, [state.isDragging, state.snapEnabled, state.snapRows, state.viewBox.y, vbH]);

  const autoSaveRef = useRef<(newCanvas: CanvasData) => void>(() => {});
  const autoSave = useCallback((newCanvas: CanvasData) => {
    dispatch({ type: "SET_STATE", patch: { saveStatus: "saving" } });
    updatePedigree.mutate({ id, input: { canvas_data: JSON.stringify(newCanvas) } }, {
      onSuccess: () => {
        queryClient.setQueryData(queryKeys.pedigree(id), (old: { canvas_data?: string } | undefined) => old ? { ...old, canvas_data: JSON.stringify(newCanvas), canvas_hash: undefined } : old);
        dispatch({ type: "SET_STATE", patch: { saveStatus: "saved" } });
        setTimeout(() => dispatch({ type: "SET_STATE", patch: { saveStatus: "idle" } }), 2000);
        try { localStorage.removeItem(`ppro_draft_${id}`); } catch {}
      },
      onError: () => {
        dispatch({ type: "SET_STATE", patch: { saveStatus: "idle" } });
        toast({ title: "Save failed", description: "Changes could not be saved. Your draft is preserved locally.", variant: "destructive" });
      },
    });
  }, [id, updatePedigree, queryClient]);
  autoSaveRef.current = autoSave;

  useEffect(() => {
    if (autoSaveTimerRef.current !== null) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => autoSaveRef.current(state.canvas), 500);
    return () => { if (autoSaveTimerRef.current !== null) clearTimeout(autoSaveTimerRef.current); };
  }, [state.canvas]);

  useEffect(() => {
    if (draftEnabledRef.current) {
      try { localStorage.setItem(draftKeyRef.current, JSON.stringify({ canvas: state.canvas, at: Date.now() })); } catch {}
    }
  }, [state.canvas]);

  useEffect(() => { return () => { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } }; }, []);

  const updateCanvas = useCallback((updater: (prev: CanvasData) => CanvasData, opts?: { skipHistory?: boolean }) => {
    dispatch({ type: "UPDATE_CANVAS", updater, pushHistory: !opts?.skipHistory });
  }, []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  const addNode = useCallback((type: PedigreeNode["type"]) => {
    const cn = canvasRef.current; if (!cn) return;
    const en = cn.nodes;
    const { viewBox } = stateRef.current;
    const vbW = W * viewBox.zoom, vbH = H * viewBox.zoom;
    const fp = (): { x: number; y: number } => {
      if (!en.length) return { x: viewBox.x + vbW / 2, y: viewBox.y + vbH / 2 };
      const v = en.filter((n) => n.y >= viewBox.y - NODE_SIZE && n.y <= viewBox.y + vbH + NODE_SIZE) || en;
      const rows = Math.round(Math.max(...v.map((n) => n.y)) / GEN_GRID) * GEN_GRID;
      const rx = Math.max(...en.filter((n) => Math.abs(n.y - rows) < NODE_GAP / 2).map((n) => n.x), viewBox.x) + NODE_GAP;
      for (let ro = 0; ro <= 3; ro++) for (let co = 0; co < 12; co++) {
        const cx = rx + co * NODE_GAP, cy = rows + ro * GEN_GRID;
        if (en.every((n) => Math.hypot(n.x - cx, n.y - cy) >= NODE_GAP)) return { x: cx, y: cy };
      }
      return { x: viewBox.x + vbW / 2, y: Math.max(...en.map((n) => n.y)) + GEN_GRID };
    };
    const { x, y } = fp();
    const nid = `n${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: [...p.nodes, { id: nid, type, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x, y }] }) });
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]) } });
  }, []);

  const addContextNode = useCallback((rel: "child" | "sibling" | "partner") => {
    const sids = stateRef.current.selectedIds; if (sids.size !== 1) return;
    const sid = [...sids][0]; if (!sid) return;
    const now = Date.now(), nid = `n${now}-${Math.random().toString(36).slice(2, 6)}`;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const s = p.nodes.find((n) => n.id === sid); if (!s) return p;
      const SX = 110, SY = 150;
      let nx: number, ny: number, nt: PedigreeNode["type"]; const ne: PedigreeEdge[] = [];
      if (rel === "child") { ny = s.y + SY; nt = "unknown";
        const ce = p.edges.find((e) => e.type === "couple" && (e.sourceId === sid || e.targetId === sid));
        if (ce) { const pid = ce.sourceId === sid ? ce.targetId : ce.sourceId; nx = (s.x + (p.nodes.find((n) => n.id === pid)?.x ?? s.x)) / 2; ne.push({ id: `e${now}`, type: "parent-child", sourceId: sid, targetId: nid }, { id: `e${now + 1}`, type: "parent-child", sourceId: pid, targetId: nid }); }
        else { const mid = `n${now + 100}`; const mt: PedigreeNode["type"] = s.type === "female" ? "male" : s.type === "male" ? "female" : "unknown"; nx = s.x + SX / 2;
          return { ...p, nodes: [...p.nodes, { id: mid, type: mt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: s.x + SX, y: s.y }, { id: nid, type: nt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: nx, y: ny }], edges: [...p.edges, { id: `e${now}`, type: "couple", sourceId: sid, targetId: mid }, { id: `e${now + 1}`, type: "parent-child", sourceId: sid, targetId: nid }, { id: `e${now + 2}`, type: "parent-child", sourceId: mid, targetId: nid }] }; } }
      else if (rel === "partner") { nt = s.type === "male" ? "female" : s.type === "female" ? "male" : "unknown"; nx = s.x + SX; ny = s.y; ne.push({ id: `e${now}`, type: "couple", sourceId: sid, targetId: nid }); }
      else { nt = (s.type === "sab" || s.type === "pregnancy") ? "unknown" : s.type; ny = s.y; nx = s.x + SX; }
      return { ...p, nodes: [...p.nodes, { id: nid, type: nt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: nx, y: ny }], edges: [...p.edges, ...ne] };
    } });
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]) } });
  }, []);

  const toggleNodeProp = useCallback((nid: string, prop: "affected" | "carrier" | "deceased" | "proband") => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: p.nodes.map((n) => n.id === nid ? { ...n, [prop]: typeof n[prop] === "boolean" ? !n[prop] : true } : n) }) });
    dispatch({ type: "SET_STATE", patch: { contextMenu: null } });
  }, []);

  const setNodeType = useCallback((nid: string, type: PedigreeNode["type"]) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: p.nodes.map((n) => n.id === nid ? { ...n, type } : n) }) });
    dispatch({ type: "SET_STATE", patch: { contextMenu: null } });
  }, []);

  const handleNodeContextMenu = useCallback((nid: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]), contextMenu: { nodeId: nid, x: e.clientX, y: e.clientY } } });
  }, []);

  const handleNodeDoubleClick = useCallback((nid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]), editModalNodeId: nid } });
  }, []);

  const deleteSelected = useCallback(() => {
    const ids = stateRef.current.selectedIds; if (!ids.size) return;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: p.nodes.filter((n) => !ids.has(n.id)), edges: p.edges.filter((e) => !ids.has(e.sourceId) && !ids.has(e.targetId)), annotations: p.annotations.filter((a) => !ids.has(a.nodeId)) }) });
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set(), selectedAnnotationId: null } });
  }, []);

  const updateSelectedNode = useCallback((u: Partial<PedigreeNode>) => {
    const sids = stateRef.current.selectedIds; if (sids.size !== 1) return;
    const id = [...sids][0]; if (!id) return;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: p.nodes.map((n) => n.id === id ? { ...n, ...u } : n) }) });
  }, []);

  const bulkUpdate = useCallback((u: Partial<PedigreeNode>) => {
    const ids = stateRef.current.selectedIds; if (!ids.size) return;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: p.nodes.map((n) => ids.has(n.id) ? { ...n, ...u } : n) }) });
  }, []);

  const alignSelected = useCallback((axis: "x" | "y") => {
    const ids = stateRef.current.selectedIds; if (ids.size < 2) return;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const s = p.nodes.filter((n) => ids.has(n.id));
      const avg = s.reduce((a, n) => a + n[axis], 0) / s.length;
      return { ...p, nodes: p.nodes.map((n) => ids.has(n.id) ? { ...n, [axis]: avg, pinned: true } : n) };
    } });
  }, []);

  const addAnnotation = useCallback((nid: string) => {
    const a: PedigreeAnnotation = { id: `a${Date.now()}`, nodeId: nid, text: "Note", color: getAccentHex(), fontSize: 12, position: "above" };
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, annotations: [...p.annotations, a] }) });
    dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: a.id } });
  }, []);

  const updateAnnotation = useCallback((aid: string, u: Partial<PedigreeAnnotation>) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, annotations: p.annotations.map((a) => a.id === aid ? { ...a, ...u } : a) }) });
  }, []);

  const deleteAnnotation = useCallback((aid: string) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, annotations: p.annotations.filter((a) => a.id !== aid) }) });
    dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: null } });
  }, []);

  const handleNodeClick = useCallback((nid: string, e: React.MouseEvent) => {
    const s = stateRef.current;
    if (s.linkMode && s.linkSource) {
      if (s.linkSource !== nid) {
        if (s.linkMode === "consanguinity") dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, edges: [...p.edges.filter((ed) => !(ed.type === "couple" && ((ed.sourceId === s.linkSource && ed.targetId === nid) || (ed.sourceId === nid && ed.targetId === s.linkSource)))), { id: `e${Date.now()}`, type: "consanguinity", sourceId: s.linkSource!, targetId: nid }] }) });
        else if (s.linkMode === "parent-child") dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
          const pn = p.nodes.find((n) => n.id === s.linkSource); if (!pn) return p;
          if (p.edges.some((ed) => (ed.type === "couple" || ed.type === "consanguinity") && (ed.sourceId === s.linkSource || ed.targetId === s.linkSource))) return { ...p, edges: [...p.edges, { id: `e${Date.now()}`, type: "parent-child", sourceId: s.linkSource!, targetId: nid }] };
          const mt: PedigreeNode["type"] = pn.type === "male" ? "female" : pn.type === "female" ? "male" : "unknown";
          const ts = Date.now(), mid = `n${ts}-${Math.random().toString(36).slice(2, 6)}_auto`;
          return { ...p, nodes: [...p.nodes, { id: mid, type: mt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: pn.type === "female" ? pn.x - NODE_GAP : pn.x + NODE_GAP, y: pn.y, pinned: true }], edges: [...p.edges, { id: `e${Date.now()}`, type: "parent-child", sourceId: s.linkSource!, targetId: nid }, { id: `ec${ts}`, type: "couple", sourceId: s.linkSource!, targetId: mid }, { id: `emc${ts}`, type: "parent-child", sourceId: mid, targetId: nid }] };
        } });
        else dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, edges: [...p.edges, { id: `e${Date.now()}`, type: s.linkMode!, sourceId: s.linkSource!, targetId: nid }] }) });
      }
      dispatch({ type: "SET_STATE", patch: { linkMode: null, linkSource: null } }); return;
    }
    if (s.linkMode && !s.linkSource) { dispatch({ type: "SET_STATE", patch: { linkSource: nid } }); return; }
    if (e.metaKey || e.ctrlKey) { const n = new Set(s.selectedIds); n.has(nid) ? n.delete(nid) : n.add(nid); dispatch({ type: "SET_STATE", patch: { selectedIds: n } }); }
    else dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]) } });
  }, []);

  const runAutoLayout = useCallback((rp: boolean) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: computeAutoLayout(p.nodes, p.edges, rp) as PedigreeNode[] }) });
  }, []);
  useEffect(() => { if (state.liveLayout && state.canvas.nodes.length > 0) runAutoLayout(true); }, [state.liveLayout, state.canvas.edges, state.canvas.nodes.length, runAutoLayout]);

  const bakeEmptyLabels = useCallback(() => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: p.nodes.map((n) => { if (n.label) return n; const c = computeAutoLabels(p.nodes, p.edges).get(n.id); return c ? { ...n, label: c } : n; }) }) });
    dispatch({ type: "SET_STATE", patch: { showLabelsMenu: false } });
  }, []);

  const openConfirm = useCallback((title: string, message: string, onConfirm: () => void, variant?: "default" | "destructive") => {
    dispatch({ type: "SET_STATE", patch: { confirmProps: { title, message, onConfirm, variant }, confirmOpen: true } });
  }, []);

  const bakeAllLabels = useCallback(() => {
    openConfirm("Overwrite Labels", "Overwrite all node labels?", () => {
      dispatch({ type: "UPDATE_CANVAS", updater: (p) => { const c = computeAutoLabels(p.nodes, p.edges); return { ...p, nodes: p.nodes.map((n) => ({ ...n, label: c.get(n.id) ?? n.label })) }; } });
      dispatch({ type: "SET_STATE", patch: { showLabelsMenu: false } });
    });
  }, [openConfirm]);

  const handleCloseTab = useCallback((tid: number) => {
    closeTab(tid);
    if (tid === id) {
      const r = tabs.filter((t) => t.id !== tid);
      if (r.length) { const idx = Math.max(0, tabs.findIndex((t) => t.id === tid) - (tabs.findIndex((t) => t.id === tid) >= r.length ? 1 : 0)); const target = r[idx]; if (target) navigate(`/pedigrees/${target.id}`); }
      else navigate("/pedigrees");
    }
  }, [closeTab, id, tabs, navigate]);

  const navigateArrow = useCallback((dir: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => {
    const nodes = stateRef.current.canvas.nodes; if (!nodes.length) return;
    const single = stateRef.current.selectedIds.size === 1 ? nodes.find((n) => stateRef.current.selectedIds.has(n.id)) ?? null : null;
    if (!single) { const first = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x)[0]; if (first) dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([first.id]) } }); return; }
    const { x, y } = single;
    const others = nodes.filter((n) => n.id !== single.id);
    const candidates = dir === "ArrowRight" ? others.filter((n) => n.x > x + 5) : dir === "ArrowLeft" ? others.filter((n) => n.x < x - 5) : dir === "ArrowDown" ? others.filter((n) => n.y > y + 5) : others.filter((n) => n.y < y - 5);
    if (!candidates.length) return;
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([candidates.reduce((b, n) => (n.x - x) ** 2 + (n.y - y) ** 2 < (b.x - x) ** 2 + (b.y - y) ** 2 ? n : b).id]) } });
  }, []);

  const { getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, fitToScreen } = usePedigreeCanvas({ stateRef, dispatch, svgRef, lassoRef, isLassoingRef, lassoRectRef, spaceHeldRef, preDragCanvasRef, rafRef, canvasRef, draftEnabledRef, draftKeyRef });

  const setShowSearch: Dispatch<SetStateAction<boolean>> = useCallback((v) => { const nv = typeof v === "function" ? v(stateRef.current.showSearch) : v; dispatch({ type: "SET_STATE", patch: { showSearch: nv } }); }, []);
  const setSearchQuery: Dispatch<SetStateAction<string>> = useCallback((q) => { const nq = typeof q === "function" ? q(stateRef.current.searchQuery) : q; dispatch({ type: "SET_STATE", patch: { searchQuery: nq } }); }, []);
  const setSelectedIds: Dispatch<SetStateAction<Set<string>>> = useCallback((ids) => { const n = typeof ids === "function" ? ids(stateRef.current.selectedIds) : ids; dispatch({ type: "SET_STATE", patch: { selectedIds: n } }); }, []);
  const setLinkMode: Dispatch<SetStateAction<"couple" | "parent-child" | "consanguinity" | null>> = useCallback((mode) => { const nm = typeof mode === "function" ? mode(stateRef.current.linkMode) : mode; dispatch({ type: "SET_STATE", patch: { linkMode: nm } }); }, []);
  const setLinkSource: Dispatch<SetStateAction<string | null>> = useCallback((src) => { const ns = typeof src === "function" ? src(stateRef.current.linkSource) : src; dispatch({ type: "SET_STATE", patch: { linkSource: ns } }); }, []);
  const setSelectedAnnotationId: Dispatch<SetStateAction<string | null>> = useCallback((id) => { const n = typeof id === "function" ? id(stateRef.current.selectedAnnotationId) : id; dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: n } }); }, []);
  const setViewBox: Dispatch<SetStateAction<{ x: number; y: number; zoom: number }>> = useCallback((vb) => { const nv = typeof vb === "function" ? vb(stateRef.current.viewBox) : vb; dispatch({ type: "SET_STATE", patch: { viewBox: nv } }); }, []);
  const setSpaceHeld: Dispatch<SetStateAction<boolean>> = useCallback((v) => { const nv = typeof v === "function" ? v(stateRef.current.spaceHeld) : v; dispatch({ type: "SET_STATE", patch: { spaceHeld: nv } }); }, []);

  usePedigreeKeyboard({ deleteSelected, addNode, addContextNode, undo, redo, navigateArrow, showSearch: state.showSearch, fitToScreen, runAutoLayout: (rp: boolean) => runAutoLayout(rp), setShowSearch, setSearchQuery, setSelectedIds, setLinkMode, setLinkSource, setSelectedAnnotationId, setViewBox, spaceHeldRef, setSpaceHeld, searchInputRef, W, H });

  const handleSaveVersion = () => dispatch({ type: "SET_STATE", patch: { sessionLabel: `Session \u00b7 ${state.canvas.nodes.length} node${state.canvas.nodes.length !== 1 ? "s" : ""} \u00b7 ${new Date().toLocaleDateString()}`, showSaveModal: true } });
  const commitSaveVersion = async () => { const t = generateThumbnail(state.canvas); const canvasData = JSON.stringify(state.canvas); const canvasHash = cryptoComputeHash(canvasData); const keys = await listProfilePrivateKeys(); const activeKey = keys.length > 0 ? keys[0] : null; const saverKey = activeKey ? await getPublicKeyFromPrivate(activeKey.privateKey) : ""; const saverSignature = activeKey ? await signData(canvasHash, activeKey.privateKey) : null; saveVersionMutation.mutate({ pedigreeId: id, input: { canvas_data: canvasData, canvas_hash: canvasHash, label: state.sessionLabel || null, thumbnail: t, saver_key: saverKey, saver_signature: saverSignature } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.versions(id) }); dispatch({ type: "SET_STATE", patch: { showSaveModal: false, sessionLabel: "" } }); } }); };
  const handleDeleteVersion = () => { toast({ title: "Coming soon", description: "Version deletion will be available in v0.2." }); };
  const handleRestoreVersion = (vid: number) => { openConfirm("Restore Version", "Restore this version? Current canvas will be replaced.", () => { restoreVersionMutation.mutate({ pedigreeId: id, versionId: vid }, { onSuccess: (d) => { const cd = (d as { canvas_data?: string | null }).canvas_data; if (cd) dispatch({ type: "SET_CANVAS", canvas: parseCanvas(cd) }); initialSyncDoneRef.current = true; queryClient.setQueryData(queryKeys.pedigree(id), d); dispatch({ type: "SET_STATE", patch: { showVersions: false } }); } }); }); };

  const onRestoreDraft = useCallback(() => handleRestoreDraft(
    (canvas: CanvasData) => dispatch({ type: "SET_CANVAS", canvas }),
    (history: CanvasData[]) => dispatch({ type: "SET_STATE", patch: { history } }),
    (future: CanvasData[]) => dispatch({ type: "SET_STATE", patch: { future } }),
  ), [handleRestoreDraft]);

  const value = useMemo<PedigreeEditorContextValue>(() => ({
    state, dispatch,
    ops: { updateCanvas, undo, redo, addNode, addContextNode, toggleNodeProp, setNodeType, handleNodeContextMenu, handleNodeDoubleClick, handleNodeClick, deleteSelected, updateSelectedNode, bulkUpdate, alignSelected, addAnnotation, updateAnnotation, deleteAnnotation, runAutoLayout, bakeEmptyLabels, bakeAllLabels, openConfirm, navigateArrow, handleCloseTab, fitToScreen, getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, handleSaveVersion, commitSaveVersion, handleDeleteVersion, handleRestoreVersion },
    memo: { autoLabels, validation, searchMatches, generationRailEntries, legendEntries, visibleGenRows, vbW, vbH, MM_W, MM_H, singleSelected: state.selectedIds.size === 1 ? state.canvas.nodes.find((n) => state.selectedIds.has(n.id)) ?? null : null, anySelected: state.selectedIds.size > 0, tabItems },
    refs: { svgRef, canvasRef, preDragCanvasRef, lassoRef, isLassoingRef, lassoRectRef, spaceHeldRef, rafRef, searchInputRef, draftKeyRef, draftEnabledRef },
    pedigree, versions, versionsLoading, profiles, saveVersionPending: saveVersionMutation.isPending, showDraftBanner, onRestoreDraft, handleDismissDraft,
  }), [state, updateCanvas, undo, redo, addNode, addContextNode, toggleNodeProp, setNodeType, handleNodeContextMenu, handleNodeDoubleClick, handleNodeClick, deleteSelected, updateSelectedNode, bulkUpdate, alignSelected, addAnnotation, updateAnnotation, deleteAnnotation, runAutoLayout, bakeEmptyLabels, bakeAllLabels, openConfirm, navigateArrow, fitToScreen, getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, commitSaveVersion, handleRestoreVersion, autoLabels, validation, searchMatches, generationRailEntries, legendEntries, visibleGenRows, vbW, vbH, MM_W, MM_H, tabItems, saveVersionMutation.isPending]);

  return <PedigreeEditorContext.Provider value={value}>{children}</PedigreeEditorContext.Provider>;
}
