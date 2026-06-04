import { useReducer, useRef, useCallback, useEffect, useMemo, createContext, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPedigree, useUpdatePedigree, useListVersions,
  useSaveVersion, useRestoreVersion, useDeleteVersion, useListProfiles, useListPedigrees, useDeletePedigree, queryKeys,
} from "@workspace/api-client-react";
import { getDefaultAnnotationColor } from "@/lib/theme";
import { validatePedigree } from "@/lib/validate-pedigree";
import { computeAutoLayout } from "@/lib/auto-layout";
import { resolveAllCollisions, resolveAndRecenter } from "@/lib/layout-engine";
import { computeAutoLabels, romanToInt } from "@/lib/pedigree-labels";
import { generateThumbnail } from "@/lib/generate-thumbnail";
import { toast } from "@/hooks/use-toast";
import { usePedigreeTabs } from "@/hooks/use-pedigree-tabs";
import { usePedigreeKeyboard } from "@/hooks/use-pedigree-keyboard";
import { signData, computeHash as cryptoComputeHash, getPublicKeyFromPrivate } from "@workspace/crypto";
import { listProfilePrivateKeys } from "@workspace/browser-backend";
import { usePedigreeDraft } from "@/hooks/use-pedigree-draft";
import { usePedigreeCanvas } from "@/features/pedigree-editor/hooks/use-pedigree-canvas";
import { parseCanvas } from "@/features/pedigree-editor/utils/helpers";
import { getModuleCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
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
  const deletePedigree = useDeletePedigree();
  const saveVersionMutation = useSaveVersion();
  const restoreVersionMutation = useRestoreVersion();
  const deleteVersionMutation = useDeleteVersion();

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
  const pendingAnnDragRef = useRef<{ annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number }; labelBelowHeight: number; stackIndex: number } | null>(null);
  const draftKeyRef = useRef(`ppro_draft_${id}`);
  useEffect(() => { draftKeyRef.current = `ppro_draft_${id}`; }, [id]);
  const initialSyncDoneRef = useRef(false);
  // Reset initial sync when pedigree id changes (M8 fix)
  useEffect(() => { initialSyncDoneRef.current = false; }, [id]);
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
      return { roman: r, y: sorted[Math.floor(ys.length / 2)] ?? 0, genIdx: romanToInt(r) };
    }).sort((a, b) => a.genIdx - b.genIdx);
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
    if (et.has("parent-child")) e.push({ key: "parent-child", label: "Parent-Child" });
    return e;
  }, [state.canvas]);

  const { tabs, openTab, closeTab, reorderTabs, pruneStaleTabs, renameTab: renameTabLocal } = usePedigreeTabs();
  const [, navigate] = useLocation();
  const lastSeenRef = useRef<{ id: number; title: string } | null>(null);
  useEffect(() => {
    if (!pedigree?.title || !id) return;
    const nid = Number(id);
    const seen = lastSeenRef.current;
    if (seen?.id !== nid || seen?.title !== pedigree.title) {
      lastSeenRef.current = { id: nid, title: pedigree.title };
      openTab(nid, pedigree.title);
    }
  }, [pedigree?.title, id, openTab]);

  const { data: allPedigrees } = useListPedigrees({});
  useEffect(() => {
    if (allPedigrees && allPedigrees.length > 0) {
      pruneStaleTabs(new Set(allPedigrees.map((p) => p.id)));
    }
  }, [allPedigrees, pruneStaleTabs]);

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
      onSuccess: (data) => {
        // Only update cache if this response is newer than what's cached (H4 fix)
        const current = queryClient.getQueryData(queryKeys.pedigree(id)) as { updated_at?: string } | undefined;
        if (current?.updated_at && data?.updated_at && new Date(data.updated_at) < new Date(current.updated_at)) return;
        queryClient.setQueryData(queryKeys.pedigree(id), data);
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

  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (draftEnabledRef.current) {
      if (draftSaveTimerRef.current !== null) clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = setTimeout(() => {
        try { localStorage.setItem(draftKeyRef.current, JSON.stringify({ canvas: state.canvas, at: Date.now() })); } catch {}
      }, 500);
    }
    return () => { if (draftSaveTimerRef.current !== null) clearTimeout(draftSaveTimerRef.current); };
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

    // Helper: get unique parent IDs from edges
    const parentIdsFromEdges = useCallback((edges: PedigreeEdge[]): string[] => {
      const ids = edges.map((e) => e.sourceId);
      return [...new Set(ids)];
    }, []);

    // Layout engine helpers removed (now imported from layout-engine.ts)

    const addContextNode = useCallback((rel: "child" | "sibling" | "partner" | "parents") => {
    const sids = stateRef.current.selectedIds; if (sids.size !== 1) {
      toast({ title: "Select a node first (click a symbol)", duration: 2000 });
      return;
    }
    const sid = [...sids][0]; if (!sid) return;
    if (rel === "sibling") {
      dispatch({ type: "SET_STATE", patch: { showAddSiblingDialog: true, siblingSourceId: sid } });
      return;
    }
    if (rel === "child" || rel === "partner") {
      const sourceNode = stateRef.current.canvas.nodes.find((n) => n.id === sid);
      if (sourceNode?.type === "unknown") {
        toast({ title: "Set gender first", description: "Select Male or Female before adding children.", duration: 2500 });
        return;
      }
    }
    const now = Date.now(), nid = `n${now}-${Math.random().toString(36).slice(2, 6)}`;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const s = p.nodes.find((n) => n.id === sid); if (!s) return p;
      if ((rel === "child" || rel === "partner") && s.type === "unknown") return p;
      const SY = GEN_GRID;
      const nd = { affected: false, carrier: false, deceased: false, proband: false, label: "", age: "" };
      let nx: number, ny: number, nt: PedigreeNode["type"]; const ne: PedigreeEdge[] = [];
      if (rel === "child") {
        ny = s.y + SY; nt = "unknown";
        const ce = p.edges.find((e) => (e.type === "couple" || e.type === "consanguinity") && (e.sourceId === sid || e.targetId === sid));
        if (ce) {
          const pid = ce.sourceId === sid ? ce.targetId : ce.sourceId;
          const partnerNode = p.nodes.find((n) => n.id === pid);
          nx = partnerNode ? (s.x + partnerNode.x) / 2 : s.x;

          const existingChildIds = new Set<string>();
          for (const e of p.edges) {
            if (e.type === "parent-child" && (e.sourceId === sid || e.sourceId === pid)) {
              existingChildIds.add(e.targetId);
            }
          }

          const newEdges: PedigreeEdge[] = [
            { id: `e${now}`, type: "parent-child", sourceId: sid, targetId: nid },
            { id: `e${now + 1}`, type: "parent-child", sourceId: pid, targetId: nid }
          ];

          const allNodes = [...p.nodes, { id: nid, type: nt, ...nd, x: nx, y: ny }];
          const allEdges = [...p.edges, ...newEdges];
          const final = resolveAndRecenter(allNodes, allEdges, new Set([nid]));

          return { ...p, nodes: final, edges: allEdges };
        }
        else {
          const mid = `n${now + 100}`;
          const mt: PedigreeNode["type"] = s.type === "female" ? "male" : s.type === "male" ? "female" : "unknown";
          let partnerDir: 1 | -1 = s.type === "female" ? -1 : 1;
          const existingCoupleForChild = p.edges.find(e => (e.type === "couple" || e.type === "consanguinity") && (e.sourceId === sid || e.targetId === sid));
          if (existingCoupleForChild) {
            const partnerId = existingCoupleForChild.sourceId === sid ? existingCoupleForChild.targetId : existingCoupleForChild.sourceId;
            const partnerNode = p.nodes.find(n => n.id === partnerId);
            if (partnerNode) {
              const partnerOnRight = partnerNode.x > s.x;
              const standardIsRight = partnerDir > 0;
              if (partnerOnRight === standardIsRight) partnerDir = partnerDir > 0 ? -1 : 1;
            }
          }
          const gap = existingCoupleForChild ? Math.round(NODE_GAP * 1.5) : NODE_GAP;
          const partnerX = partnerDir > 0 ? s.x + 0.01 : s.x - 0.01;
          const effectiveSourceX = s.x;
          nx = (effectiveSourceX + partnerX) / 2;

          const newPartner = { id: mid, type: mt, ...nd, x: partnerX, y: s.y };
          const newChild = { id: nid, type: nt, ...nd, x: nx, y: ny };
          const newEdges: PedigreeEdge[] = [
            { id: `e${now}`, type: "couple", sourceId: sid, targetId: mid },
            { id: `e${now + 1}`, type: "parent-child", sourceId: sid, targetId: nid },
            { id: `e${now + 2}`, type: "parent-child", sourceId: mid, targetId: nid }
          ];

          const allNodes = [...p.nodes, newPartner, newChild];
          const allEdges = [...p.edges, ...newEdges];
          const resolved = resolveAndRecenter(allNodes, allEdges, new Set([nid, mid]));

          return { ...p, nodes: resolved, edges: allEdges };
        }
      }
      else if (rel === "partner") {
        nt = s.type === "male" ? "female" : s.type === "female" ? "male" : "unknown";
        let dir: 1 | -1 = s.type === "female" ? -1 : 1;
        const existingCouple = p.edges.find(e => (e.type === "couple" || e.type === "consanguinity") && (e.sourceId === sid || e.targetId === sid));
        if (existingCouple) {
          const partnerId = existingCouple.sourceId === sid ? existingCouple.targetId : existingCouple.sourceId;
          const partnerNode = p.nodes.find(n => n.id === partnerId);
          if (partnerNode) {
            const partnerOnRight = partnerNode.x > s.x;
            const standardIsRight = dir > 0;
            if (partnerOnRight === standardIsRight) dir = dir > 0 ? -1 : 1;
          }
        }
        const gap = existingCouple ? Math.round(NODE_GAP * 1.5) : NODE_GAP;
        nx = dir > 0 ? s.x + 0.01 : s.x - 0.01;
        ny = s.y;

        const newPartnerEdge: PedigreeEdge = { id: `e${now}`, type: "couple", sourceId: sid, targetId: nid };
        const allNodes = [...p.nodes, { id: nid, type: nt, ...nd, x: nx, y: ny }];
        const allEdges = [...p.edges, newPartnerEdge];
        const resolved = resolveAndRecenter(allNodes, allEdges, new Set([nid]));

        return { ...p, nodes: resolved, edges: allEdges };
      }
      else if (rel === "parents") {
        const fid = `n${now}`, mid2 = `n${now + 1}`; ny = s.y - SY;
        const fatherX = s.x - NODE_GAP / 2 + 0.01;
        const motherX = s.x + NODE_GAP / 2 - 0.01;

        const newParents: PedigreeNode[] = [
          { id: fid, type: "male", ...nd, x: fatherX, y: ny },
          { id: mid2, type: "female", ...nd, x: motherX, y: ny }
        ];
        const newEdges: PedigreeEdge[] = [
          { id: `e${now}`, type: "couple", sourceId: fid, targetId: mid2 },
          { id: `e${now + 1}`, type: "parent-child", sourceId: fid, targetId: sid },
          { id: `e${now + 2}`, type: "parent-child", sourceId: mid2, targetId: sid }
        ];

        const allNodes = [...p.nodes, ...newParents];
        const allEdges = [...p.edges, ...newEdges];
        const final = resolveAndRecenter(allNodes, allEdges, new Set([fid, mid2]));

        return { ...p, nodes: final, edges: allEdges };
      }
      else { return p; }
      return { ...p, nodes: [...p.nodes, { id: nid, type: nt!, ...nd, x: nx!, y: ny! }], edges: [...p.edges, ...ne] };
    } });
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]) } });
  }, []);

  const toggleNodeProp = useCallback((nid: string, prop: "affected" | "carrier" | "deceased" | "proband") => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: p.nodes.map((n) => n.id === nid ? { ...n, [prop]: typeof n[prop] === "boolean" ? !n[prop] : true } : n) }) });
    dispatch({ type: "SET_STATE", patch: { contextMenu: null } });
  }, []);

  const setNodeType = useCallback((nid: string, type: PedigreeNode["type"]) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const node = p.nodes.find((n) => n.id === nid);
      if (!node) return p;
      const hasChildren = p.edges.some((e) => e.type === "parent-child" && e.sourceId === nid);
      if ((type === "pregnancy" || type === "sab" || type === "unknown") && hasChildren) return p;
      return { ...p, nodes: p.nodes.map((n) => n.id === nid ? { ...n, type } : n) };
    } });
    dispatch({ type: "SET_STATE", patch: { contextMenu: null } });
  }, []);

  const setNodeColor = useCallback((nid: string, color: string | undefined) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: p.nodes.map((n) => n.id === nid ? { ...n, color } : n) }) });
  }, []);

  const handleNodeContextMenu = useCallback((nid: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]), contextMenu: { nodeId: nid, x: e.clientX, y: e.clientY } } });
  }, []);

  const handleNodeDoubleClick = useCallback((nid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (Date.now() - lastDragEndTimeRef.current < 400) return;
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]), editModalNodeId: nid } });
  }, []);

  const deleteSelected = useCallback(() => {
    const ids = stateRef.current.selectedIds; if (!ids.size) return;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const nodes = p.nodes.filter((n) => !ids.has(n.id));
      const edges = p.edges.filter((e) => !ids.has(e.sourceId) && !ids.has(e.targetId));
      const annotations = p.annotations.filter((a) => !ids.has(a.nodeId));
      return { nodes, edges, annotations };
    } });
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
      return { ...p, nodes: p.nodes.map((n) => ids.has(n.id) ? { ...n, [axis]: avg } : n) };
    } });
  }, []);

  const addAnnotation = useCallback((nid: string) => {
    const cfg = getModuleCanvasConfig?.() ?? { annFontSize: 12, annDefaultPos: "below" as const };
    const position = cfg.annDefaultPos as PedigreeAnnotation["position"];
    const a: PedigreeAnnotation = { id: `a${Date.now()}`, nodeId: nid, text: "Note", color: getDefaultAnnotationColor(), fontSize: cfg.annFontSize ?? 12, position };
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
    if (s.twinSelectMode) {
      const newCandidates = new Set(s.twinCandidateIds);
      if (newCandidates.has(nid)) newCandidates.delete(nid);
      else newCandidates.add(nid);
      dispatch({ type: "SET_STATE", patch: { twinCandidateIds: newCandidates } });
      return;
    }
    if (s.linkMode && s.linkSource) {
      if (s.linkSource !== nid) {
        if (s.linkMode === "consanguinity") dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, edges: [...p.edges.filter((ed) => !(ed.type === "couple" && ((ed.sourceId === s.linkSource && ed.targetId === nid) || (ed.sourceId === nid && ed.targetId === s.linkSource)))), { id: `e${Date.now()}`, type: "consanguinity", sourceId: s.linkSource!, targetId: nid }] }) });
        else if (s.linkMode === "parent-child") dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
          const pn = p.nodes.find((n) => n.id === s.linkSource); if (!pn) return p;
          if (p.edges.some((ed) => (ed.type === "couple" || ed.type === "consanguinity") && (ed.sourceId === s.linkSource || ed.targetId === s.linkSource))) {
            const ce = p.edges.find((ed) => (ed.type === "couple" || ed.type === "consanguinity") && (ed.sourceId === s.linkSource || ed.targetId === s.linkSource))!;
            const pid = ce.sourceId === s.linkSource ? ce.targetId : ce.sourceId;
            const now = Date.now();
            return { ...p, edges: [...p.edges, { id: `e${now}`, type: "parent-child", sourceId: s.linkSource!, targetId: nid }, { id: `e${now + 1}`, type: "parent-child", sourceId: pid, targetId: nid }] };
          }
          const mt: PedigreeNode["type"] = pn.type === "male" ? "female" : pn.type === "female" ? "male" : "unknown";
          const ts = Date.now(), mid = `n${ts}-${Math.random().toString(36).slice(2, 6)}_auto`;
          let dir: 1 | -1 = pn.type === "female" ? -1 : 1;
          const existingLinkCouple = p.edges.find(e => (e.type === "couple" || e.type === "consanguinity") && (e.sourceId === s.linkSource! || e.targetId === s.linkSource!));
          if (existingLinkCouple) {
            const partnerId = existingLinkCouple.sourceId === s.linkSource! ? existingLinkCouple.targetId : existingLinkCouple.sourceId;
            const partnerNode = p.nodes.find(n => n.id === partnerId);
            if (partnerNode) {
              const partnerOnRight = partnerNode.x > pn.x;
              const standardIsRight = dir > 0;
              if (partnerOnRight === standardIsRight) dir = dir > 0 ? -1 : 1;
            }
          }
          const startPx = dir > 0 ? pn.x + 0.01 : pn.x - 0.01;
          
          const newPartner = { id: mid, type: mt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: startPx, y: pn.y };
          const allNodes = [...p.nodes, newPartner];
          const newEdges: PedigreeEdge[] = [
            { id: `e${Date.now()}`, type: "parent-child", sourceId: s.linkSource!, targetId: nid },
            { id: `ec${ts}`, type: "couple", sourceId: s.linkSource!, targetId: mid },
            { id: `emc${ts}`, type: "parent-child", sourceId: mid, targetId: nid }
          ];
          const allEdges = [...p.edges, ...newEdges];
          
          const resolvedNodes = resolveAndRecenter(allNodes, allEdges, new Set([mid]));

          return { ...p, nodes: resolvedNodes, edges: allEdges };
        } });
        else if (s.linkMode === "couple") dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, edges: [...p.edges.filter((ed) => !((ed.type === "couple" || ed.type === "consanguinity") && ((ed.sourceId === s.linkSource && ed.targetId === nid) || (ed.sourceId === nid && ed.targetId === s.linkSource)))), { id: `e${Date.now()}`, type: "couple", sourceId: s.linkSource!, targetId: nid }] }) });
        else dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, edges: [...p.edges, { id: `e${Date.now()}`, type: s.linkMode!, sourceId: s.linkSource!, targetId: nid }] }) });
      }
      dispatch({ type: "SET_STATE", patch: { linkMode: null, linkSource: null } }); return;
    }
    if (s.linkMode && !s.linkSource) { dispatch({ type: "SET_STATE", patch: { linkSource: nid } }); return; }
    if (e.metaKey || e.ctrlKey) { const n = new Set(s.selectedIds); n.has(nid) ? n.delete(nid) : n.add(nid); dispatch({ type: "SET_STATE", patch: { selectedIds: n } }); }
    else dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]), showRiskPanel: false, showValidation: false, showVersions: false } });
  }, []);

  const runAutoLayout = useCallback((rp: boolean) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: computeAutoLayout(p.nodes, p.edges, rp) as PedigreeNode[] }) });
  }, []);
  useEffect(() => { if (state.liveLayout && state.canvas.nodes.length > 0) runAutoLayout(true); }, [state.liveLayout, state.canvas.edges.length, state.canvas.nodes.length, runAutoLayout]);

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

  const renameTab = useCallback((tabId: number, newTitle: string) => {
    const prevTitle = tabs.find((t) => t.id === tabId)?.title ?? "";
    renameTabLocal(tabId, newTitle);
    const cached = queryClient.getQueryData(queryKeys.pedigree(tabId)) as Record<string, unknown> | undefined;
    if (cached) {
      queryClient.setQueryData(queryKeys.pedigree(tabId), { ...cached, title: newTitle });
    }
    updatePedigree.mutate({ id: tabId, input: { title: newTitle } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
        queryClient.invalidateQueries({ queryKey: queryKeys.pedigree(tabId) });
      },
      onError: () => {
        renameTabLocal(tabId, prevTitle);
        toast({ title: "Rename failed", description: "Could not update pedigree title.", variant: "destructive" });
      },
    });
  }, [renameTabLocal, updatePedigree, queryClient, tabs, toast]);

  const createConsanguinityEdge = useCallback((sourceId: string, targetId: string) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({
      ...p,
      edges: [
        ...p.edges.filter((ed) => !((ed.type === "couple" || ed.type === "consanguinity") && ((ed.sourceId === sourceId && ed.targetId === targetId) || (ed.sourceId === targetId && ed.targetId === sourceId)))),
        { id: `e${Date.now()}`, type: "consanguinity", sourceId, targetId }
      ]
    }) });
  }, []);

  const createCoupleEdge = useCallback((sourceId: string, targetId: string) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({
      ...p,
      edges: [
        ...p.edges.filter((ed) => !((ed.type === "couple" || ed.type === "consanguinity") && ((ed.sourceId === sourceId && ed.targetId === targetId) || (ed.sourceId === targetId && ed.targetId === sourceId)))),
        { id: `e${Date.now()}`, type: "couple", sourceId, targetId }
      ]
    }) });
  }, []);

  // Helper: parse DOB string (YYYY or YYYY-MM or YYYY-MM-DD) for sorting
  const parseDobYear = (dob?: string): number => {
    if (!dob) return 9999; // Unknown/empty DOB sorts last (youngest)
    const parts = dob.split("-");
    const year = parseInt(parts[0] || "", 10);
    return isNaN(year) ? 9999 : year;
  };

  // Helper: calculate age from DOB string
  const calculateAgeFromDob = (dob?: string): string => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? String(age) : "";
  };

  const addSiblingsBlockedRef = useRef(false);

  const addSiblings = useCallback((sourceId: string, siblings: Array<{ type: PedigreeNode["type"]; dob: string; affected?: boolean; carrier?: boolean; condition?: string; notes?: string }>) => {
    addSiblingsBlockedRef.current = false;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const s = p.nodes.find((n) => n.id === sourceId); if (!s) return p;
      const SY = GEN_GRID;
      // Sort siblings by DOB - older (lower year) first = left
      const sortedSiblings = [...siblings].sort((a, b) => parseDobYear(a.dob) - parseDobYear(b.dob));
      const nd = { affected: false, carrier: false, deceased: false, proband: false, label: "", age: "" };
      const parentEdges = p.edges.filter((e) => e.type === "parent-child" && e.targetId === sourceId);
      let parentIds = parentIdsFromEdges(parentEdges);
      let parents = parentIds.map((id) => p.nodes.find((n) => n.id === id)).filter(Boolean) as PedigreeNode[];
      const now = Date.now();
      let newNodes: PedigreeNode[] = [];
      const newEdges: PedigreeEdge[] = [];

      // If no parents exist, auto-create them above the source node
      if (parentIds.length === 0) {
        const fid = `n${now}_father`;
        const mid = `n${now}_mother`;
        const parentY = s.y - SY;
        const fatherX = Math.max(GEN_GRID, s.x - NODE_GAP / 2 + 0.01);
        const motherX = Math.max(fatherX + NODE_GAP, s.x + NODE_GAP / 2 - 0.01);
        
        newNodes.push(
          { id: fid, type: "male", ...nd, x: fatherX, y: parentY, label: "" },
          { id: mid, type: "female", ...nd, x: motherX, y: parentY, label: "" }
        );
        newEdges.push(
          { id: `e${now}_couple`, type: "couple", sourceId: fid, targetId: mid },
          { id: `e${now}_pf`, type: "parent-child", sourceId: fid, targetId: sourceId },
          { id: `e${now}_pm`, type: "parent-child", sourceId: mid, targetId: sourceId }
        );
        parentIds = [fid, mid];
        parents = newNodes.filter((n) => n.id === fid || n.id === mid);
      }

      const allChildIds = new Set<string>();
      for (const pid of parentIds) {
        for (const e of [...p.edges, ...newEdges]) {
          if (e.type === "parent-child" && e.sourceId === pid) allChildIds.add(e.targetId);
        }
      }
      allChildIds.add(sourceId);

      for (let i = 0; i < sortedSiblings.length; i++) {
        const sb = sortedSiblings[i]!;
        const age = calculateAgeFromDob(sb.dob);
        const nid = `n${now + i}-${Math.random().toString(36).slice(2, 6)}`;
        newNodes.push({
          id: nid, type: sb.type,
          affected: sb.affected ?? false, carrier: sb.carrier ?? false,
          deceased: false, proband: false, label: "", age,
          x: 0, y: s.y,
          dob: sb.dob || undefined, condition: sb.condition || undefined, notes: sb.notes || undefined,
        });
        allChildIds.add(nid);
        for (const pid of parentIds) {
          newEdges.push({ id: `e${now + i}_${parentIds.indexOf(pid)}`, type: "parent-child", sourceId: pid, targetId: nid });
        }
      }

      const allNodes = [...p.nodes, ...newNodes];
      const allEdges = [...p.edges, ...newEdges];
      const childMap = new Map<string, PedigreeNode>();
      for (const n of allNodes) {
        if (allChildIds.has(n.id)) childMap.set(n.id, n);
      }
      const allChildren = [...childMap.values()].sort((a, b) => parseDobYear(a.dob) - parseDobYear(b.dob));

      const parentCenter = parents.length === 2
        ? (parents[0]!.x + parents[1]!.x) / 2
        : parents.length === 1 ? parents[0]!.x : s.x;

      const totalWidth = (allChildren.length - 1) * NODE_GAP;
      let startX = Math.max(GEN_GRID, parentCenter - totalWidth / 2);

      const positionedNodes = allNodes.map((n) => {
        const childIdx = allChildren.findIndex((c) => c.id === n.id);
        if (childIdx !== -1) {
          return { ...n, x: startX + childIdx * NODE_GAP, y: s.y };
        }
        return n;
      });

      const resolved = resolveAllCollisions(positionedNodes, allEdges, allChildIds);
      
      const finalChildIds = allChildren.map((c) => c.id);
      const final = recenterParents(resolved, allEdges, parentIds, finalChildIds, allChildIds);

      return { ...p, nodes: final, edges: allEdges };
    } });

    if (addSiblingsBlockedRef.current) {
      toast({ title: "No free space nearby", description: "Please move existing nodes or use auto-layout to make room for siblings.", duration: 4000 });
      addSiblingsBlockedRef.current = false;
      return;
    }

    dispatch({ type: "SET_STATE", patch: { showAddSiblingDialog: false, siblingSourceId: null } });
  }, [parentIdsFromEdges]);

  const markAsTwins = useCallback((nodeIds: string[], twinType: "m" | "d") => {
    const group = `twins_${Date.now()}`;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const nodeSet = new Set(nodeIds);
      const oldGroups = new Set<string>();
      for (const e of p.edges) {
        if (e.type === "parent-child" && nodeSet.has(e.targetId) && e.twinGroup) {
          oldGroups.add(e.twinGroup);
        }
      }
      const stripped = p.edges.map((e) => {
        if (e.type === "parent-child" && nodeSet.has(e.targetId) && e.twinGroup) {
          const { twinGroup, twinType: _, ...rest } = e;
          return rest as PedigreeEdge;
        }
        return e;
      });
      const groupChildren = new Map<string, Set<string>>();
      for (const e of stripped) {
        if (e.type === "parent-child" && e.twinGroup) {
          if (!groupChildren.has(e.twinGroup)) groupChildren.set(e.twinGroup, new Set());
          groupChildren.get(e.twinGroup)!.add(e.targetId);
        }
      }
      const orphanGroups = new Set<string>();
      for (const [g, children] of groupChildren) {
        if (children.size < 2) orphanGroups.add(g);
      }
      return {
        ...p,
        edges: stripped.map((e) => {
          if (e.type === "parent-child") {
            if (nodeSet.has(e.targetId)) return { ...e, twinGroup: group, twinType };
            if (e.twinGroup && orphanGroups.has(e.twinGroup)) {
              const { twinGroup, twinType: _, ...rest } = e;
              return rest as PedigreeEdge;
            }
          }
          return e;
        }),
      };
    } });
  }, []);

  const unmarkTwins = useCallback((nodeIds: string[]) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const nodeSet = new Set(nodeIds);
      const groupsToStrip = new Set<string>();
      for (const e of p.edges) {
        if (e.type === "parent-child" && nodeSet.has(e.targetId) && e.twinGroup) {
          groupsToStrip.add(e.twinGroup);
        }
      }
      const stripped = p.edges.map((e) => {
        if (e.type === "parent-child" && nodeSet.has(e.targetId) && e.twinGroup && groupsToStrip.has(e.twinGroup)) {
          const { twinGroup, twinType, ...rest } = e;
          return rest as PedigreeEdge;
        }
        return e;
      });
      const groupChildren = new Map<string, Set<string>>();
      for (const e of stripped) {
        if (e.type === "parent-child" && e.twinGroup && groupsToStrip.has(e.twinGroup)) {
          if (!groupChildren.has(e.twinGroup)) groupChildren.set(e.twinGroup, new Set());
          groupChildren.get(e.twinGroup)!.add(e.targetId);
        }
      }
      const orphanGroups = new Set<string>();
      for (const [g, children] of groupChildren) {
        if (children.size < 2) orphanGroups.add(g);
      }
      return {
        ...p,
        edges: orphanGroups.size > 0
          ? stripped.map((e) => {
              if (e.type === "parent-child" && e.twinGroup && orphanGroups.has(e.twinGroup)) {
                const { twinGroup, twinType, ...rest } = e;
                return rest as PedigreeEdge;
              }
              return e;
            })
          : stripped,
      };
    } });
  }, []);

  const removeEdges = useCallback((edgeIds: string[]) => {
    dispatch({ type: "REMOVE_EDGES", edgeIds });
  }, []);

  const updateEdgeType = useCallback((edgeId: string, type: PedigreeEdge["type"]) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({
      ...p,
      edges: p.edges.map((e) => e.id === edgeId ? { ...e, type } : e)
    }) });
  }, []);

  const toggleTwinSelectMode = useCallback(() => {
    const s = stateRef.current;
    if (s.twinSelectMode) {
      dispatch({ type: "SET_STATE", patch: { twinSelectMode: false, twinCandidateIds: new Set<string>() } });
    } else {
      dispatch({ type: "SET_STATE", patch: { twinSelectMode: true, twinCandidateIds: new Set<string>() } });
    }
  }, []);

  const clearTwinCandidates = useCallback(() => {
    dispatch({ type: "SET_STATE", patch: { twinCandidateIds: new Set<string>() } });
  }, []);

  const handleDeletePedigree = useCallback((tabId: number, tabTitle: string) => {
    openConfirm("Delete Pedigree", `Delete "${tabTitle}"? This cannot be undone.`, () => {
      deletePedigree.mutate(tabId, {
        onSuccess: () => {
          handleCloseTab(tabId);
        },
      });
    }, "destructive");
  }, [openConfirm, deletePedigree, handleCloseTab]);

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

  const { getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, fitToScreen, lastDragEndTimeRef } = usePedigreeCanvas({ stateRef, dispatch, svgRef, lassoRef, isLassoingRef, lassoRectRef, spaceHeldRef, preDragCanvasRef, rafRef, pendingAnnDragRef });

  const setShowSearch: Dispatch<SetStateAction<boolean>> = useCallback((v) => { const nv = typeof v === "function" ? v(stateRef.current.showSearch) : v; dispatch({ type: "SET_STATE", patch: { showSearch: nv } }); }, []);
  const setSearchQuery: Dispatch<SetStateAction<string>> = useCallback((q) => { const nq = typeof q === "function" ? q(stateRef.current.searchQuery) : q; dispatch({ type: "SET_STATE", patch: { searchQuery: nq } }); }, []);
  const setSelectedIds: Dispatch<SetStateAction<Set<string>>> = useCallback((ids) => { const n = typeof ids === "function" ? ids(stateRef.current.selectedIds) : ids; dispatch({ type: "SET_STATE", patch: { selectedIds: n } }); }, []);
  const setLinkMode: Dispatch<SetStateAction<"couple" | "parent-child" | "consanguinity" | null>> = useCallback((mode) => { const nm = typeof mode === "function" ? mode(stateRef.current.linkMode) : mode; dispatch({ type: "SET_STATE", patch: { linkMode: nm } }); }, []);
  const setLinkSource: Dispatch<SetStateAction<string | null>> = useCallback((src) => { const ns = typeof src === "function" ? src(stateRef.current.linkSource) : src; dispatch({ type: "SET_STATE", patch: { linkSource: ns } }); }, []);
  const setSelectedAnnotationId: Dispatch<SetStateAction<string | null>> = useCallback((id) => { const n = typeof id === "function" ? id(stateRef.current.selectedAnnotationId) : id; dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: n } }); }, []);
  const setViewBox: Dispatch<SetStateAction<{ x: number; y: number; zoom: number }>> = useCallback((vb) => { const nv = typeof vb === "function" ? vb(stateRef.current.viewBox) : vb; dispatch({ type: "SET_STATE", patch: { viewBox: nv } }); }, []);
  const setSpaceHeld: Dispatch<SetStateAction<boolean>> = useCallback((v) => { const nv = typeof v === "function" ? v(stateRef.current.spaceHeld) : v; dispatch({ type: "SET_STATE", patch: { spaceHeld: nv } }); }, []);

  usePedigreeKeyboard({ deleteSelected, deleteAnnotation, selectedAnnotationId: state.selectedAnnotationId, selectedNode: state.selectedIds.size === 1 ? state.canvas.nodes.find((n) => state.selectedIds.has(n.id)) ?? null : null, updateSelectedNode, addNode, addContextNode, undo, redo, navigateArrow, showSearch: state.showSearch, fitToScreen, runAutoLayout: (rp: boolean) => runAutoLayout(rp), setShowSearch, setSearchQuery, setSelectedIds, setLinkMode, setLinkSource, setSelectedAnnotationId, setViewBox, spaceHeldRef, setSpaceHeld, searchInputRef, twinSelectMode: state.twinSelectMode, setTwinSelectMode: (v) => { const nv = typeof v === "function" ? v(stateRef.current.twinSelectMode) : v; dispatch({ type: "SET_STATE", patch: { twinSelectMode: nv, twinCandidateIds: nv ? stateRef.current.twinCandidateIds : new Set<string>() } }); }, clearTwinCandidates, W, H });

  const handleSaveVersion = () => dispatch({ type: "SET_STATE", patch: { sessionLabel: `Session \u00b7 ${state.canvas.nodes.length} node${state.canvas.nodes.length !== 1 ? "s" : ""} \u00b7 ${new Date().toLocaleDateString()}`, showSaveModal: true } });
  const commitSaveVersion = async () => { const t = generateThumbnail(state.canvas); const canvasData = JSON.stringify(state.canvas); const canvasHash = cryptoComputeHash(canvasData); const keys = await listProfilePrivateKeys(); const activeKey = keys.length > 0 ? keys[0] : null; const saverKey = activeKey ? await getPublicKeyFromPrivate(activeKey.privateKey) : ""; const saverSignature = activeKey ? await signData(canvasHash, activeKey.privateKey) : null; saveVersionMutation.mutate({ pedigreeId: id, input: { canvas_data: canvasData, canvas_hash: canvasHash, label: state.sessionLabel || null, thumbnail: t, saver_key: saverKey, saver_signature: saverSignature } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.versions(id) }); dispatch({ type: "SET_STATE", patch: { showSaveModal: false, sessionLabel: "" } }); } }); };
  const handleDeleteVersion = (versionId: number) => { openConfirm("Delete Version", "Delete this saved session? This cannot be undone.", () => { deleteVersionMutation.mutate({ pedigreeId: id, versionId }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.versions(id) }); } }); }, "destructive"); };
  const handleRestoreVersion = (vid: number) => { openConfirm("Restore Version", "Restore this version? Current canvas will be replaced.", () => { restoreVersionMutation.mutate({ pedigreeId: id, versionId: vid }, { onSuccess: (d) => { const cd = (d as { canvas_data?: string | null }).canvas_data; if (cd) dispatch({ type: "SET_CANVAS", canvas: parseCanvas(cd) }); initialSyncDoneRef.current = true; queryClient.setQueryData(queryKeys.pedigree(id), d); dispatch({ type: "SET_STATE", patch: { showVersions: false } }); } }); }); };

  const onRestoreDraft = useCallback(() => handleRestoreDraft(
    (canvas: CanvasData) => dispatch({ type: "SET_CANVAS", canvas }),
    (history: CanvasData[]) => dispatch({ type: "SET_STATE", patch: { history } }),
    (future: CanvasData[]) => dispatch({ type: "SET_STATE", patch: { future } }),
  ), [handleRestoreDraft]);

  const value = useMemo<PedigreeEditorContextValue>(() => ({
    state, dispatch,
    ops: { updateCanvas, undo, redo, addNode, addContextNode, toggleNodeProp, setNodeType, setNodeColor, handleNodeContextMenu, handleNodeDoubleClick, handleNodeClick, deleteSelected, updateSelectedNode, bulkUpdate, alignSelected, addAnnotation, updateAnnotation, deleteAnnotation, runAutoLayout, bakeEmptyLabels, bakeAllLabels, openConfirm, navigateArrow, handleCloseTab, openTab, reorderTabs, renameTab, fitToScreen, getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, handleSaveVersion, commitSaveVersion, handleDeleteVersion, handleRestoreVersion, createConsanguinityEdge, createCoupleEdge, addSiblings, markAsTwins, unmarkTwins, removeEdges, updateEdgeType, toggleTwinSelectMode, clearTwinCandidates, handleDeletePedigree },
    memo: { autoLabels, validation, searchMatches, generationRailEntries, legendEntries, visibleGenRows, vbW, vbH, MM_W, MM_H, singleSelected: state.selectedIds.size === 1 ? state.canvas.nodes.find((n) => state.selectedIds.has(n.id)) ?? null : null, anySelected: state.selectedIds.size > 0, tabItems },
    refs: { svgRef, canvasRef, preDragCanvasRef, lassoRef, isLassoingRef, lassoRectRef, spaceHeldRef, rafRef, searchInputRef, draftKeyRef, draftEnabledRef, pendingAnnDragRef },
    pedigree, versions, versionsLoading, profiles, saveVersionPending: saveVersionMutation.isPending, showDraftBanner, onRestoreDraft, handleDismissDraft,
  }), [state, updateCanvas, undo, redo, addNode, addContextNode, toggleNodeProp, setNodeType, setNodeColor, handleNodeContextMenu, handleNodeDoubleClick, handleNodeClick, deleteSelected, updateSelectedNode, bulkUpdate, alignSelected, addAnnotation, updateAnnotation, deleteAnnotation, runAutoLayout, bakeEmptyLabels, bakeAllLabels, openConfirm, navigateArrow, openTab, reorderTabs, renameTab, fitToScreen, getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, commitSaveVersion, handleDeleteVersion, handleRestoreVersion, createConsanguinityEdge, createCoupleEdge, addSiblings, markAsTwins, unmarkTwins, removeEdges, toggleTwinSelectMode, clearTwinCandidates, handleDeletePedigree, autoLabels, validation, searchMatches, generationRailEntries, legendEntries, visibleGenRows, vbW, vbH, MM_W, MM_H, tabItems, saveVersionMutation.isPending, deleteVersionMutation.isPending]);

  return <PedigreeEditorContext.Provider value={value}>{children}</PedigreeEditorContext.Provider>;
}
