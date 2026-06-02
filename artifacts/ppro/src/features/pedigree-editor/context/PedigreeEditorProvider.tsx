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

    // Helper: find position by shifting existing nodes to make room
    // Returns { x: placement X, shifts: Map<nodeId, newX> } and also shiftCount for smart push
    const insertAndShiftRight = useCallback((p: CanvasData, startX: number, y: number, direction: 1 | -1 = 1, excludeIds?: Set<string>): { x: number; shifts: Map<string, number>; shiftCount: number } => {
      const shifts = new Map<string, number>();
      const GAP = NODE_GAP;
      const Y_TOLERANCE = NODE_SIZE;

      const collidesAt = (x: number) =>
        p.nodes.some((n) => !excludeIds?.has(n.id) && !shifts.has(n.id) && Math.abs(n.x - x) < GAP && Math.abs(n.y - y) < Y_TOLERANCE);

      let targetX = startX;
      while (collidesAt(targetX)) {
        targetX += direction * GAP;
      }

      if (targetX === startX) {
        return { x: startX, shifts, shiftCount: 0 };
      }

      const rowNodes = [...p.nodes]
        .filter((n) => !excludeIds?.has(n.id) && Math.abs(n.y - y) < Y_TOLERANCE)
        .sort((a, b) => a.x - b.x);

      if (direction > 0) {
        for (const n of rowNodes) {
          if (n.x >= startX - GAP / 2) {
            const prevShiftedX = shifts.size > 0
              ? Math.max(...Array.from(shifts.values()))
              : startX - GAP;
            const newX = Math.max(n.x + GAP, prevShiftedX + GAP);
            shifts.set(n.id, newX);
          }
        }
      } else {
        for (const n of [...rowNodes].reverse()) {
          if (n.x <= startX + GAP / 2) {
            const prevShiftedX = shifts.size > 0
              ? Math.min(...Array.from(shifts.values()))
              : startX + GAP;
            const newX = Math.min(n.x - GAP, prevShiftedX - GAP);
            shifts.set(n.id, newX);
          }
        }
      }

      return { x: startX, shifts, shiftCount: shifts.size };
    }, []);

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
          nx = (s.x + (p.nodes.find((n) => n.id === pid)?.x ?? s.x)) / 2;
          // Collision check: if the midpoint is occupied by another node at the same Y level,
          // search for a free position using insertAndShiftRight
          const collides = p.nodes.some((n) =>
            n.id !== nid && n.id !== sid && n.id !== pid &&
            Math.abs(n.x - nx) < NODE_GAP * 0.9 && Math.abs(n.y - ny) < NODE_SIZE
          );
          if (collides) {
            const res = insertAndShiftRight(p, nx, ny, 1, new Set([nid, sid, pid]));
            nx = res.x;
            const shiftedNodes = p.nodes.map((n) => {
              const newX = res.shifts.get(n.id);
              return newX !== undefined ? { ...n, x: newX } : n;
            });
            ne.push(
              { id: `e${now}`, type: "parent-child", sourceId: sid, targetId: nid },
              { id: `e${now + 1}`, type: "parent-child", sourceId: pid, targetId: nid }
            );
            return { ...p, nodes: [...shiftedNodes, { id: nid, type: nt, ...nd, x: nx, y: ny }], edges: [...p.edges, ...ne] };
          }
          ne.push({ id: `e${now}`, type: "parent-child", sourceId: sid, targetId: nid }, { id: `e${now + 1}`, type: "parent-child", sourceId: pid, targetId: nid });
        }
        else {
          // Auto-create partner for child - use insertAndShiftRight
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
          const partnerStartX = partnerDir > 0 ? s.x + NODE_GAP : s.x - NODE_GAP;
          const defaultPartnerRes = insertAndShiftRight(p, partnerStartX, s.y, partnerDir, new Set([sid]));
          // Smart push: if pushing in default direction displaces more nodes than
          // pushing the source node oppositely, prefer moving the source instead
          const oppositePartnerDir: 1 | -1 = partnerDir > 0 ? -1 : 1;
          const sourceShiftX = oppositePartnerDir > 0 ? s.x + NODE_GAP : s.x - NODE_GAP;
          const sourcePartnerRes = insertAndShiftRight(p, sourceShiftX, s.y, oppositePartnerDir, new Set([sid, mid]));
          let partnerX: number;
          let sourceNewX: number | null = null;
          let partnerShifts: Map<string, number>;
          if (defaultPartnerRes.shiftCount > 0 && sourcePartnerRes.shiftCount < defaultPartnerRes.shiftCount) {
            sourceNewX = sourcePartnerRes.x;
            partnerX = partnerDir > 0 ? sourceNewX + NODE_GAP : sourceNewX - NODE_GAP;
            partnerShifts = sourcePartnerRes.shifts;
          } else {
            partnerX = defaultPartnerRes.x;
            partnerShifts = defaultPartnerRes.shifts;
          }
          const shiftedNodes = p.nodes.map((n) => {
            if (sourceNewX !== null && n.id === sid) return { ...n, x: sourceNewX };
            const newX = partnerShifts.get(n.id);
            return newX !== undefined ? { ...n, x: newX } : n;
          });
          // Child is placed at the midpoint between the two parents
          // Use sourceNewX if source was shifted, otherwise s.x
          const effectiveSourceX = sourceNewX ?? s.x;
          nx = (effectiveSourceX + partnerX) / 2;
          return {
            ...p,
            nodes: [...shiftedNodes, { id: mid, type: mt, ...nd, x: partnerX, y: s.y }, { id: nid, type: nt, ...nd, x: nx, y: ny }],
            edges: [...p.edges, { id: `e${now}`, type: "couple", sourceId: sid, targetId: mid }, { id: `e${now + 1}`, type: "parent-child", sourceId: sid, targetId: nid }, { id: `e${now + 2}`, type: "parent-child", sourceId: mid, targetId: nid }]
          };
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
        const startX = dir > 0 ? s.x + NODE_GAP : s.x - NODE_GAP;
        const defaultRes = insertAndShiftRight(p, startX, s.y, dir, new Set([sid]));
        // Smart push: if pushing in the default direction displaces more nodes than
        // pushing the source node in the opposite direction, prefer moving the source instead
        const oppositeDir: 1 | -1 = dir > 0 ? -1 : 1;
        const sourceShiftX = oppositeDir > 0 ? s.x + NODE_GAP : s.x - NODE_GAP;
        const sourceRes = insertAndShiftRight(p, sourceShiftX, s.y, oppositeDir, new Set([sid, nid]));
        if (defaultRes.shiftCount > 0 && sourceRes.shiftCount < defaultRes.shiftCount) {
          // Pushing the source node displaces fewer nodes: shift source, place partner at source's original spot
          const sourceNewX = sourceRes.x;
          const partnerX = dir > 0 ? sourceNewX + NODE_GAP : sourceNewX - NODE_GAP;
          nx = partnerX; ny = s.y;
          const shiftedNodes = p.nodes.map((n) => {
            if (n.id === sid) return { ...n, x: sourceNewX };
            const newX = sourceRes.shifts.get(n.id);
            return newX !== undefined ? { ...n, x: newX } : n;
          });
          ne.push({ id: `e${now}`, type: "couple", sourceId: sid, targetId: nid });
          return { ...p, nodes: [...shiftedNodes, { id: nid, type: nt, ...nd, x: nx, y: ny }], edges: [...p.edges, ...ne] };
        }
        nx = defaultRes.x; ny = s.y;
        const shiftedNodes = p.nodes.map((n) => {
          const newX = defaultRes.shifts.get(n.id);
          return newX !== undefined ? { ...n, x: newX } : n;
        });
        ne.push({ id: `e${now}`, type: "couple", sourceId: sid, targetId: nid });
        return { ...p, nodes: [...shiftedNodes, { id: nid, type: nt, ...nd, x: nx, y: ny }], edges: [...p.edges, ...ne] };
      }
      else if (rel === "parents") {
        const fid = `n${now}`, mid2 = `n${now + 1}`; ny = s.y - SY;
        // Center parents above the child, excluding the child node from collision
        const resLeft = insertAndShiftRight(p, s.x - NODE_GAP / 2, ny, -1, new Set([sid]));
        // Apply left shifts before calculating right to avoid double-shifting
        const afterLeftShifts = p.nodes.map((n) => ({
          ...n,
          x: resLeft.shifts.get(n.id) ?? n.x
        }));
        const resRight = insertAndShiftRight({ ...p, nodes: afterLeftShifts }, s.x + NODE_GAP / 2, ny, 1, new Set([sid]));
        // Combine shifts from both directions
        const allShifts = new Map<string, number>(resLeft.shifts);
        resRight.shifts.forEach((x, id) => {
          const existing = allShifts.get(id);
          // Take the shift that moves the node furthest (handles nodes caught between both parents)
          if (existing === undefined || (x > 0 && x > existing) || (x < 0 && x < existing)) {
            allShifts.set(id, x);
          }
        });
        // Apply shifts
        const shiftedNodes = p.nodes.map((n) => {
          const newX = allShifts.get(n.id);
          return newX !== undefined ? { ...n, x: newX } : n;
        });
        return {
          ...p,
          nodes: [...shiftedNodes, { id: fid, type: "male", ...nd, x: resLeft.x, y: ny }, { id: mid2, type: "female", ...nd, x: resRight.x, y: ny }],
          edges: [...p.edges, { id: `e${now}`, type: "couple", sourceId: fid, targetId: mid2 }, { id: `e${now + 1}`, type: "parent-child", sourceId: fid, targetId: sid }, { id: `e${now + 2}`, type: "parent-child", sourceId: mid2, targetId: sid }]
        };
      }
      else { return p; }
      return { ...p, nodes: [...p.nodes, { id: nid, type: nt!, ...nd, x: nx!, y: ny! }], edges: [...p.edges, ...ne] };
    } });
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]) } });
  }, [insertAndShiftRight]);

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
          if (p.edges.some((ed) => (ed.type === "couple" || ed.type === "consanguinity") && (ed.sourceId === s.linkSource || ed.targetId === s.linkSource))) return { ...p, edges: [...p.edges, { id: `e${Date.now()}`, type: "parent-child", sourceId: s.linkSource!, targetId: nid }] };
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
          const startPx = dir > 0 ? pn.x + NODE_GAP : pn.x - NODE_GAP;
          const defaultLinkRes = insertAndShiftRight(p, startPx, pn.y, dir, new Set([s.linkSource!]));
          // Smart push: prefer moving source node if it displaces fewer nodes
          const oppositeLinkDir: 1 | -1 = dir > 0 ? -1 : 1;
          const sourceLinkShiftX = oppositeLinkDir > 0 ? pn.x + NODE_GAP : pn.x - NODE_GAP;
          const sourceLinkRes = insertAndShiftRight(p, sourceLinkShiftX, pn.y, oppositeLinkDir, new Set([s.linkSource!, mid]));
          let linkPartnerX: number;
          let linkSourceNewX: number | null = null;
          let linkShifts: Map<string, number>;
          if (defaultLinkRes.shiftCount > 0 && sourceLinkRes.shiftCount < defaultLinkRes.shiftCount) {
            linkSourceNewX = sourceLinkRes.x;
            linkPartnerX = dir > 0 ? linkSourceNewX + NODE_GAP : linkSourceNewX - NODE_GAP;
            linkShifts = sourceLinkRes.shifts;
          } else {
            linkPartnerX = defaultLinkRes.x;
            linkShifts = defaultLinkRes.shifts;
          }
          const linkShiftedNodes = p.nodes.map((n) => {
            if (linkSourceNewX !== null && n.id === s.linkSource!) return { ...n, x: linkSourceNewX };
            const newX = linkShifts.get(n.id);
            return newX !== undefined ? { ...n, x: newX } : n;
          });
          return { ...p, nodes: [...linkShiftedNodes, { id: mid, type: mt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: linkPartnerX, y: pn.y }], edges: [...p.edges, { id: `e${Date.now()}`, type: "parent-child", sourceId: s.linkSource!, targetId: nid }, { id: `ec${ts}`, type: "couple", sourceId: s.linkSource!, targetId: mid }, { id: `emc${ts}`, type: "parent-child", sourceId: mid, targetId: nid }] };
        } });
        else if (s.linkMode === "couple") dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, edges: [...p.edges.filter((ed) => !((ed.type === "couple" || ed.type === "consanguinity") && ((ed.sourceId === s.linkSource && ed.targetId === nid) || (ed.sourceId === nid && ed.targetId === s.linkSource)))), { id: `e${Date.now()}`, type: "couple", sourceId: s.linkSource!, targetId: nid }] }) });
        else dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, edges: [...p.edges, { id: `e${Date.now()}`, type: s.linkMode!, sourceId: s.linkSource!, targetId: nid }] }) });
      }
      dispatch({ type: "SET_STATE", patch: { linkMode: null, linkSource: null } }); return;
    }
    if (s.linkMode && !s.linkSource) { dispatch({ type: "SET_STATE", patch: { linkSource: nid } }); return; }
    if (e.metaKey || e.ctrlKey) { const n = new Set(s.selectedIds); n.has(nid) ? n.delete(nid) : n.add(nid); dispatch({ type: "SET_STATE", patch: { selectedIds: n } }); }
    else dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]), showRiskPanel: false, showValidation: false, showVersions: false } });
  }, [insertAndShiftRight]);

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
      let allShifts = new Map<string, number>();

      // If no parents exist, auto-create them above the source node
      if (parentIds.length === 0) {
        const fid = `n${now}_father`;
        const mid = `n${now}_mother`;
        const parentY = s.y - SY;

        // Position parents centered above the source node, clamped to GEN_GRID
        const fatherStartX = Math.max(GEN_GRID, s.x - NODE_GAP / 2);
        const motherStartX = Math.max(fatherStartX + NODE_GAP, s.x + NODE_GAP / 2);
        const fatherRes = insertAndShiftRight(p, fatherStartX, parentY, -1, new Set([s.id]));
        const motherRes = insertAndShiftRight(p, motherStartX, parentY, 1, new Set([s.id]));

        // Merge parent shifts
        fatherRes.shifts.forEach((x, id) => allShifts.set(id, x));
        motherRes.shifts.forEach((x, id) => allShifts.set(id, x));

        // Create parent nodes
        newNodes.push(
          { id: fid, type: "male", ...nd, x: fatherRes.x, y: parentY, label: "" },
          { id: mid, type: "female", ...nd, x: motherRes.x, y: parentY, label: "" }
        );

        // Create couple edge between parents
        newEdges.push({ id: `e${now}_couple`, type: "couple", sourceId: fid, targetId: mid });
        // Create parent-child edges
        newEdges.push({ id: `e${now}_pf`, type: "parent-child", sourceId: fid, targetId: sourceId });
        newEdges.push({ id: `e${now}_pm`, type: "parent-child", sourceId: mid, targetId: sourceId });

        // Update parentIds for sibling connections
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
          id: nid,
          type: sb.type,
          affected: sb.affected ?? false,
          carrier: sb.carrier ?? false,
          deceased: false,
          proband: false,
          label: "",
          age,
          x: 0,
          y: s.y,
          dob: sb.dob || undefined,
          condition: sb.condition || undefined,
          notes: sb.notes || undefined,
        });
        allChildIds.add(nid);
        for (let pi = 0; pi < parentIds.length; pi++) {
          const pid = parentIds[pi]!;
          newEdges.push({
            id: `e${now + i}_${pi}`,
            type: "parent-child",
            sourceId: pid,
            targetId: nid,
          });
        }
      }

      const allNodes = [...p.nodes, ...newNodes];
      const childMap = new Map<string, PedigreeNode>();
      for (const n of allNodes) {
        if (allChildIds.has(n.id)) childMap.set(n.id, n);
      }
      const allChildren = [...childMap.values()];
      allChildren.sort((a, b) => parseDobYear(a.dob) - parseDobYear(b.dob));

      // ── Helpers for collision checks ──
      const rowY = s.y;
      const Y_TOLERANCE = NODE_SIZE;
      const HALF_S = NODE_SIZE / 2;

      const linesIntersect = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): boolean => {
        const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
        if (d === 0) return false;
        const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
        const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
      };

      const lineIntersectsRect = (x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number): boolean => {
        const pointInRect = (px: number, py: number) =>
          px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
        if (pointInRect(x1, y1) || pointInRect(x2, y2)) return true;
        const edges: [number, number, number, number][] = [[rx, ry, rx, ry + rh], [rx + rw, ry, rx + rw, ry + rh], [rx, ry, rx + rw, ry], [rx, ry + rh, rx + rw, ry + rh]];
        for (const [ex1, ey1, ex2, ey2] of edges) {
          if (linesIntersect(x1, y1, x2, y2, ex1, ey1, ex2, ey2)) return true;
        }
        return false;
      };

      // Check if a candidate position is free (no node collision, no edge intersection, minimum X boundary)
      const isPositionFree = (x: number, y: number, excludeIds: Set<string>) => {
        if (x < GEN_GRID) return false;
        if (p.nodes.some((n) => !excludeIds.has(n.id) && Math.abs(n.x - x) < NODE_GAP && Math.abs(n.y - y) < Y_TOLERANCE)) {
          return false;
        }
        for (const edge of p.edges) {
          const src = p.nodes.find((n) => n.id === edge.sourceId);
          const tgt = p.nodes.find((n) => n.id === edge.targetId);
          if (!src || !tgt) continue;
          if (edge.type === "parent-child" && allChildIds.has(edge.targetId)) continue;
          if ((edge.type === "couple" || edge.type === "consanguinity") && (allChildIds.has(edge.sourceId) || allChildIds.has(edge.targetId))) continue;
          if (lineIntersectsRect(src.x, src.y, tgt.x, tgt.y, x - HALF_S, y - HALF_S, NODE_SIZE, NODE_SIZE)) {
            return false;
          }
        }
        return true;
      };

      const existingChildren = allChildren.filter((c) => !newNodes.some((nn) => nn.id === c.id));

      // ── Placement strategy ──
      const finalPositions = new Map<string, number>();
      let parentShift = 0;

      const parentCenter = parents.length === 2
        ? (parents[0]!.x + parents[1]!.x) / 2
        : parents.length === 1 ? parents[0]!.x : s.x;

      if (existingChildren.length === 0) {
        // No existing children — center the whole sibship evenly under parents
        const totalWidth = (allChildren.length - 1) * NODE_GAP;
        let startX = parentCenter - totalWidth / 2;
        startX = Math.max(GEN_GRID, startX);

        const hasCollision = (sx: number) => {
          for (let i = 0; i < allChildren.length; i++) {
            if (!isPositionFree(sx + i * NODE_GAP, rowY, allChildIds)) return true;
          }
          return false;
        };

        if (hasCollision(startX)) {
          let found = false;
          for (let k = 1; k <= 20; k++) {
            for (const dir of [1, -1] as const) {
              const tryX = startX + dir * k * NODE_GAP;
              if (!hasCollision(tryX)) { startX = tryX; found = true; break; }
            }
            if (found) break;
          }
          if (!found) {
            addSiblingsBlockedRef.current = true;
            return p;
          }
        }

        allChildren.forEach((child, i) => finalPositions.set(child.id, startX + i * NODE_GAP));
      } else {
        existingChildren.forEach((c) => finalPositions.set(c.id, c.x));

        const totalWidth = (allChildren.length - 1) * NODE_GAP;

        const computeDisplacement = (startX: number) => {
          if (existingChildren.length === 0) return 0;
          return Math.max(
            ...existingChildren.map((c) => {
              const idx = allChildren.findIndex((child) => child.id === c.id);
              return Math.abs(c.x - (startX + idx * NODE_GAP));
            })
          );
        };

        const allPositionsFree = (startX: number) =>
          allChildren.every((_, i) => isPositionFree(startX + i * NODE_GAP, rowY, allChildIds));

        const applyPlacement = (startX: number) => {
          allChildren.forEach((child, i) => {
            finalPositions.set(child.id, startX + i * NODE_GAP);
          });
        };

        type Candidate = { startX: number; maxDisp: number; centerDist: number; collisionFree: boolean };
        const candidates: Candidate[] = [];

        const addCandidates = (baseX: number, maxSteps: number, maxDispThreshold: number) => {
          for (let step = 0; step <= maxSteps; step++) {
            const tryX = Math.max(GEN_GRID, baseX) + step * NODE_GAP;
            const collisionFree = allPositionsFree(tryX);
            const maxDisp = computeDisplacement(tryX);
            const sibCenter = tryX + totalWidth / 2;
            candidates.push({ startX: tryX, maxDisp, centerDist: Math.abs(sibCenter - parentCenter), collisionFree });
            if (collisionFree && maxDisp <= maxDispThreshold) break;
          }
        };

        const anchorStartXs: number[] = [];
        for (let i = 0; i < allChildren.length; i++) {
          const child = allChildren[i]!;
          if (existingChildren.some((c) => c.id === child.id)) {
            anchorStartXs.push(child.x - i * NODE_GAP);
          }
        }
        if (anchorStartXs.length > 0) {
          anchorStartXs.sort((a, b) => a - b);
          const medianAnchor = anchorStartXs[Math.floor(anchorStartXs.length / 2)]!;
          addCandidates(Math.round(medianAnchor / NODE_GAP) * NODE_GAP, 20, NODE_GAP);
        }

        const centeredBaseX = Math.round((parentCenter - totalWidth / 2) / NODE_GAP) * NODE_GAP;
        addCandidates(centeredBaseX, allChildren.length + 2, NODE_GAP * 2);

        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            const aTier = a.collisionFree && a.maxDisp <= NODE_GAP ? 0 : a.maxDisp <= NODE_GAP * 2 ? 1 : 2;
            const bTier = b.collisionFree && b.maxDisp <= NODE_GAP ? 0 : b.maxDisp <= NODE_GAP * 2 ? 1 : 2;
            if (aTier !== bTier) return aTier - bTier;
            if (a.collisionFree !== b.collisionFree) return a.collisionFree ? -1 : 1;
            return a.centerDist - b.centerDist;
          });
          applyPlacement(candidates[0]!.startX);
        }

        if (finalPositions.size < allChildren.length) {
          const placedXs = [...finalPositions.values()];
          if (placedXs.length > 0) {
            let rightmostX = Math.max(...placedXs);
            for (const child of allChildren) {
              if (finalPositions.has(child.id)) continue;
              rightmostX += NODE_GAP;
              finalPositions.set(child.id, rightmostX);
            }
          }
        }
      }

      // ── Collision cleanup: push unrelated nodes that ended up too close ──
      const nodeShifts = new Map<string, number>();
      const placedXs = [...finalPositions.values()];
      const placedMinX = Math.min(...placedXs);
      const placedMaxX = Math.max(...placedXs);

      // Helper: get the nuclear family (child+siblings+parents, or parent+partner+children)
      const getFamilyGroup = (nodeId: string): Set<string> => {
        const group = new Set<string>([nodeId]);

        // Case 1: node is a child → include siblings, parents, and parents' partners
        const parentIdsOfNode = p.edges
          .filter((e) => e.type === "parent-child" && e.targetId === nodeId)
          .map((e) => e.sourceId);
        if (parentIdsOfNode.length > 0) {
          parentIdsOfNode.forEach((pid) => group.add(pid));
          for (const e of p.edges) {
            if (e.type === "parent-child" && parentIdsOfNode.includes(e.sourceId)) {
              group.add(e.targetId);
            }
          }
          for (const e of p.edges) {
            if ((e.type === "couple" || e.type === "consanguinity")) {
              if (parentIdsOfNode.includes(e.sourceId)) group.add(e.targetId);
              if (parentIdsOfNode.includes(e.targetId)) group.add(e.sourceId);
            }
          }
          return group;
        }

        // Case 2: node is a parent → include partner(s) and children
        const childIdsOfNode = p.edges
          .filter((e) => e.type === "parent-child" && e.sourceId === nodeId)
          .map((e) => e.targetId);
        if (childIdsOfNode.length > 0) {
          for (const e of p.edges) {
            if ((e.type === "couple" || e.type === "consanguinity") && (e.sourceId === nodeId || e.targetId === nodeId)) {
              const partnerId = e.sourceId === nodeId ? e.targetId : e.sourceId;
              group.add(partnerId);
            }
          }
          childIdsOfNode.forEach((cid) => group.add(cid));
          return group;
        }

        // Case 3: orphan
        return group;
      };

      for (const n of p.nodes) {
        if (allChildIds.has(n.id)) continue; // Skip our own sibship
        if (parentIds.includes(n.id)) continue; // Skip our parents
        if (Math.abs(n.y - rowY) >= Y_TOLERANCE) continue; // Different row

        const distToGroup = Math.min(
          ...placedXs.map((px) => Math.abs(px - n.x))
        );
        if (distToGroup >= NODE_GAP) continue; // Far enough

        // Determine push direction: push away from the sibling group center
        const pushDir = n.x >= placedMinX && n.x <= placedMaxX
          ? (n.x >= (placedMinX + placedMaxX) / 2 ? 1 : -1) // Inside group span → push to nearest edge
          : (n.x > placedMaxX ? 1 : -1); // Outside → push away from group

        const deficit = NODE_GAP - distToGroup;
        const pushAmount = Math.ceil(deficit / NODE_GAP) * NODE_GAP;

        const family = getFamilyGroup(n.id);
        for (const memberId of family) {
          if (allChildIds.has(memberId)) continue;
          if (parentIds.includes(memberId)) continue;
          const currentShift = nodeShifts.get(memberId) ?? 0;
          const newShift = pushDir > 0
            ? Math.max(currentShift, pushAmount)
            : Math.min(currentShift, -pushAmount);
          nodeShifts.set(memberId, newShift);
        }
      }

      // Merge collision shifts into finalPositions so they get applied together
      for (const [id, shift] of nodeShifts) {
        const currentX = finalPositions.get(id) ?? p.nodes.find((n) => n.id === id)?.x;
        if (currentX !== undefined) {
          finalPositions.set(id, Math.max(GEN_GRID, currentX + shift));
        }
      }

      // Recenter parents over children if safe
      const childXs = allChildren.map((c) => finalPositions.get(c.id) ?? c.x).sort((a, b) => a - b);
      const childGroupCenter = childXs.length >= 2
        ? (childXs[0]! + childXs[childXs.length - 1]!) / 2
        : childXs[0] ?? parentCenter;

      const candidateParentShift = childGroupCenter - parentCenter;

      const parentIdsSetForShift = new Set(parentIds);
      const parentShiftSafe = parents.every((par) => {
        const shiftedParX = par.x + candidateParentShift;
        for (const n of [...p.nodes, ...newNodes]) {
          if (parentIdsSetForShift.has(n.id)) continue;
          if (allChildIds.has(n.id)) continue;
          const effectiveX = finalPositions.get(n.id) ?? n.x;
          if (Math.abs(effectiveX - shiftedParX) < NODE_GAP && Math.abs(n.y - par.y) < Y_TOLERANCE) return false;
        }
        return true;
      });

      if (parentShiftSafe) {
        const minParentX = Math.min(...parents.map((p) => p.x + candidateParentShift));
        parentShift = minParentX >= GEN_GRID ? candidateParentShift : candidateParentShift + (GEN_GRID - minParentX);
      }

      const parentIdsSet = new Set(parentIds);

      const shiftedNodes = p.nodes.map((n) => {
        const newX = allShifts.get(n.id) ?? finalPositions.get(n.id);
        if (newX !== undefined) {
          const extra = parentIdsSet.has(n.id) ? parentShift : 0;
          return { ...n, x: newX + extra };
        }
        if (parentIdsSet.has(n.id)) {
          return { ...n, x: n.x + parentShift };
        }
        return n;
      });

      newNodes = newNodes.map((n) => {
        const newX = finalPositions.get(n.id);
        if (newX !== undefined) {
          const extra = parentIdsSet.has(n.id) ? parentShift : 0;
          return { ...n, x: newX + extra };
        }
        if (parentIdsSet.has(n.id)) {
          return { ...n, x: n.x + parentShift };
        }
        return n;
      });

      return { ...p, nodes: [...shiftedNodes, ...newNodes], edges: [...p.edges, ...newEdges] };
    } });

    if (addSiblingsBlockedRef.current) {
      toast({ title: "No free space nearby", description: "Please move existing nodes or use auto-layout to make room for siblings.", duration: 4000 });
      addSiblingsBlockedRef.current = false;
      return;
    }

    dispatch({ type: "SET_STATE", patch: { showAddSiblingDialog: false, siblingSourceId: null } });
  }, [insertAndShiftRight, parentIdsFromEdges]);

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

  usePedigreeKeyboard({ deleteSelected, deleteAnnotation, selectedAnnotationId: state.selectedAnnotationId, addNode, addContextNode, undo, redo, navigateArrow, showSearch: state.showSearch, fitToScreen, runAutoLayout: (rp: boolean) => runAutoLayout(rp), setShowSearch, setSearchQuery, setSelectedIds, setLinkMode, setLinkSource, setSelectedAnnotationId, setViewBox, spaceHeldRef, setSpaceHeld, searchInputRef, twinSelectMode: state.twinSelectMode, setTwinSelectMode: (v) => { const nv = typeof v === "function" ? v(stateRef.current.twinSelectMode) : v; dispatch({ type: "SET_STATE", patch: { twinSelectMode: nv, twinCandidateIds: nv ? stateRef.current.twinCandidateIds : new Set<string>() } }); }, clearTwinCandidates, W, H });

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
    ops: { updateCanvas, undo, redo, addNode, addContextNode, toggleNodeProp, setNodeType, setNodeColor, handleNodeContextMenu, handleNodeDoubleClick, handleNodeClick, deleteSelected, updateSelectedNode, bulkUpdate, alignSelected, addAnnotation, updateAnnotation, deleteAnnotation, runAutoLayout, bakeEmptyLabels, bakeAllLabels, openConfirm, navigateArrow, handleCloseTab, openTab, reorderTabs, renameTab, fitToScreen, getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, handleSaveVersion, commitSaveVersion, handleDeleteVersion, handleRestoreVersion, createConsanguinityEdge, createCoupleEdge, addSiblings, markAsTwins, unmarkTwins, removeEdges, toggleTwinSelectMode, clearTwinCandidates, handleDeletePedigree },
    memo: { autoLabels, validation, searchMatches, generationRailEntries, legendEntries, visibleGenRows, vbW, vbH, MM_W, MM_H, singleSelected: state.selectedIds.size === 1 ? state.canvas.nodes.find((n) => state.selectedIds.has(n.id)) ?? null : null, anySelected: state.selectedIds.size > 0, tabItems },
    refs: { svgRef, canvasRef, preDragCanvasRef, lassoRef, isLassoingRef, lassoRectRef, spaceHeldRef, rafRef, searchInputRef, draftKeyRef, draftEnabledRef, pendingAnnDragRef },
    pedigree, versions, versionsLoading, profiles, saveVersionPending: saveVersionMutation.isPending, showDraftBanner, onRestoreDraft, handleDismissDraft,
  }), [state, updateCanvas, undo, redo, addNode, addContextNode, toggleNodeProp, setNodeType, setNodeColor, handleNodeContextMenu, handleNodeDoubleClick, handleNodeClick, deleteSelected, updateSelectedNode, bulkUpdate, alignSelected, addAnnotation, updateAnnotation, deleteAnnotation, runAutoLayout, bakeEmptyLabels, bakeAllLabels, openConfirm, navigateArrow, openTab, reorderTabs, renameTab, fitToScreen, getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, commitSaveVersion, handleDeleteVersion, handleRestoreVersion, createConsanguinityEdge, createCoupleEdge, addSiblings, markAsTwins, unmarkTwins, removeEdges, toggleTwinSelectMode, clearTwinCandidates, handleDeletePedigree, autoLabels, validation, searchMatches, generationRailEntries, legendEntries, visibleGenRows, vbW, vbH, MM_W, MM_H, tabItems, saveVersionMutation.isPending, deleteVersionMutation.isPending]);

  return <PedigreeEditorContext.Provider value={value}>{children}</PedigreeEditorContext.Provider>;
}
