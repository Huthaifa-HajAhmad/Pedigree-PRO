import { useReducer, useRef, useCallback, useEffect, useMemo, createContext, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPedigree, useUpdatePedigree, useListVersions,
  useSaveVersion, useRestoreVersion, useDeleteVersion, useListProfiles, useDeletePedigree, queryKeys,
} from "@workspace/api-client-react";
import { validatePedigree } from "@/lib/validate-pedigree";
import { computeAutoLayout } from "@/lib/auto-layout";
import { resolveAndRecenter, buildGenerations, makeSpaceAtX, resolveAllCollisions } from "@/lib/layout-engine";
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
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { pedigreeEditorReducer } from "./reducer";
import { INITIAL_STATE, type PedigreeEditorContextValue, type PedigreeEditorAction } from "./types";
import type { PedigreeNode, CanvasData } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE, NODE_GAP, GEN_GRID } from "@/features/pedigree-editor/canvas/types";

import { usePedigreeMutations } from "../hooks/use-pedigree-mutations";
import { usePedigreeGraphOperations } from "../hooks/use-pedigree-graph-operations";
import { usePedigreeAnnotations } from "../hooks/use-pedigree-annotations";
import { usePedigreeAlignment } from "../hooks/use-pedigree-alignment";

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

  const [state, rawDispatch] = useReducer(pedigreeEditorReducer, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const { config } = useCanvasConfig();
  const configRef = useRef(config);
  configRef.current = config;

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<CanvasData | null>(state.canvas);
  const preDragCanvasRef = useRef<CanvasData | null>(null);
  useEffect(() => { canvasRef.current = state.canvas; }, [state.canvas]);
  const lassoRef = useRef<{ startSVG: { x: number; y: number }; curSVG: { x: number; y: number } } | null>(null);
  const isLassoingRef = useRef(false);
  const lassoRectRef = useRef<SVGRectElement>(null);
  const spaceHeldRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const mouseCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingAnnDragRef = useRef<{ annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number }; labelBelowHeight: number; stackIndex: number } | null>(null);
  const draftKeyRef = useRef(`ppro_draft_${id}`);
  useEffect(() => { draftKeyRef.current = `ppro_draft_${id}`; }, [id]);
  const initialSyncDoneRef = useRef(false);
  useEffect(() => { initialSyncDoneRef.current = false; }, [id]);
  const lastNodesLengthRef = useRef(state.canvas.nodes.length);
  const lastEdgesLengthRef = useRef(state.canvas.edges.length);
  const skipLiveLayoutRef = useRef(false);

  const dispatch = useCallback((action: PedigreeEditorAction) => {
    if (
      action.type === "UNDO" ||
      action.type === "REDO" ||
      action.type === "SET_CANVAS" ||
      action.type === "ENTER_PREVIEW" ||
      action.type === "EXIT_PREVIEW"
    ) {
      skipLiveLayoutRef.current = true;
    }
    rawDispatch(action);
  }, []);

  const { showDraftBanner, draftEnabledRef, clearDraft, handleRestoreDraft, handleDismissDraft } = usePedigreeDraft({
    id, pedigreeData: pedigree ?? null, canvasRef, draftKeyRef,
  });

  const backgroundSaveVersion = useCallback(async (label: string, customCanvas?: CanvasData) => {
    try {
      const targetCanvas = customCanvas ?? stateRef.current.canvas;
      const t = generateThumbnail(targetCanvas);
      const canvasData = JSON.stringify(targetCanvas);
      const canvasHash = cryptoComputeHash(canvasData);
      const keys = await listProfilePrivateKeys();
      const activeKey = keys.length > 0 ? keys[0] : null;
      const saverKey = activeKey ? await getPublicKeyFromPrivate(activeKey.privateKey) : "";
      const saverSignature = activeKey ? await signData(canvasHash, activeKey.privateKey) : null;
      await saveVersionMutation.mutateAsync({
        pedigreeId: id,
        input: {
          canvas_data: canvasData,
          canvas_hash: canvasHash,
          label,
          thumbnail: t,
          saver_key: saverKey,
          saver_signature: saverSignature
        }
      });
      clearDraft();
      queryClient.invalidateQueries({ queryKey: queryKeys.versions(id) });
    } catch (e) {
      console.error("Auto-checkpoint save failed", e);
    }
  }, [id, queryClient, saveVersionMutation, clearDraft]);

  useEffect(() => {
    if (pedigree?.canvas_data !== undefined && !initialSyncDoneRef.current) {
      const parsed = parseCanvas(pedigree.canvas_data);
      skipLiveLayoutRef.current = true;
      dispatch({ type: "SET_CANVAS", canvas: parsed });
      initialSyncDoneRef.current = true;
      if (parsed.nodes.length > 0) {
        const pad = 40 * 0.5;
        const xs = parsed.nodes.map((n) => n.x);
        const ys = parsed.nodes.map((n) => n.y);
        const minX = Math.min(...xs) - pad;
        const maxX = Math.max(...xs) + pad + 40;
        const minY = Math.min(...ys) - pad;
        const maxY = Math.max(...ys) + pad + 40;
        const spanX = maxX - minX;
        const spanY = maxY - minY;
        const zoom = Math.max(0.7, Math.min(4.0, Math.max(spanX / (W * 0.88), spanY / (H * 0.88))));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        dispatch({
          type: "SET_STATE",
          patch: {
            viewBox: { x: cx - (W * zoom) / 2, y: cy - (H * zoom) / 2, zoom }
          }
        });
      }
    }
  }, [pedigree?.canvas_data, dispatch]);

  const autoLabels = useMemo(
    () => computeAutoLabels(state.canvas.nodes, state.canvas.edges),
    [state.canvas.nodes, state.canvas.edges],
  );

  const validation = useMemo(() => validatePedigree(state.canvas), [state.canvas]);

  const searchMatches = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return [];
    return state.canvas.nodes
      .filter((n) => {
        const autoLabel = autoLabels.get(n.id) ?? "";
        return (
          (n.label && n.label.toLowerCase().includes(q)) ||
          autoLabel.toLowerCase().includes(q) ||
          (n.condition && n.condition.toLowerCase().includes(q)) ||
          (n.notes && n.notes.toLowerCase().includes(q))
        );
      })
      .map((n) => n.id);
  }, [state.canvas.nodes, state.searchQuery, autoLabels]);

  const generationRailEntries = useMemo(() => {
    const nodes = state.canvas.nodes;
    if (nodes.length === 0) return [];

    const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of state.canvas.edges) {
      if (adj.has(e.sourceId) && adj.has(e.targetId)) {
        adj.get(e.sourceId)!.push(e.targetId);
        adj.get(e.targetId)!.push(e.sourceId);
      }
    }

    const visited = new Set<string>();
    const components: PedigreeNode[][] = [];
    for (const n of nodes) {
      if (!visited.has(n.id)) {
        const comp: PedigreeNode[] = [];
        const queue = [n.id];
        visited.add(n.id);
        let head = 0;
        while (head < queue.length) {
          const currId = queue[head]!;
          head++;
          const currNode = nodes.find(node => node.id === currId);
          if (currNode) comp.push(currNode);
          for (const neighbor of adj.get(currId) || []) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
        components.push(comp);
      }
    }

    const genMap = buildGenerations(nodes, state.canvas.edges);

    return components.map((compNodes, famIdx) => {
      const rowMap = new Map<number, number[]>();
      for (const n of compNodes) {
        const genIdx = genMap.get(n.id) ?? Math.round(n.y / GEN_GRID);
        if (!rowMap.has(genIdx)) rowMap.set(genIdx, []);
        rowMap.get(genIdx)!.push(n.y);
      }

      const famMinX = Math.min(...compNodes.map(n => n.x));
      const sortedGenIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);

      const entries = sortedGenIndices.map((genIdx, relIdx) => {
        const ys = rowMap.get(genIdx)!;
        const avgY = ys.reduce((sum, val) => sum + val, 0) / ys.length;
        const roman = ROMAN[relIdx] ?? `G${relIdx + 1}`;
        return { roman, y: avgY, genIdx: relIdx + 1 };
      });

      return {
        id: `fam_${famIdx}`,
        minX: famMinX,
        entries
      };
    });
  }, [state.canvas.nodes, state.canvas.edges]);

  const legendEntries = useMemo(() => {
    const nt = new Set(state.canvas.nodes.map((n) => n.type));
    const et = new Set(state.canvas.edges.map((e) => e.type));
    const list: Array<{ key: string; label: string }> = [];

    if (nt.has("male")) list.push({ key: "male", label: "Male" });
    if (nt.has("female")) list.push({ key: "female", label: "Female" });
    if (nt.has("unknown")) list.push({ key: "unknown", label: "Unknown sex" });
    if (nt.has("pregnancy")) list.push({ key: "pregnancy", label: "Pregnancy" });
    if (nt.has("sab")) list.push({ key: "sab", label: "Spontaneous Abortion (SAB)" });
    if (state.canvas.nodes.some(n => n.stillbirth)) list.push({ key: "stillbirth", label: "Stillbirth (SB)" });

    if (state.canvas.nodes.some((n) => n.affected && (!n.shading || n.shading === "solid") && !n.condition)) {
      list.push({ key: "affected", label: "Affected" });
    }
    if (state.canvas.nodes.some((n) => n.carrier && !n.affected)) list.push({ key: "carrier", label: "Carrier" });
    if (state.canvas.nodes.some((n) => n.deceased)) list.push({ key: "deceased", label: "Deceased" });
    if (state.canvas.nodes.some((n) => n.proband)) list.push({ key: "proband", label: "Proband" });
    if (et.has("consanguinity")) list.push({ key: "consanguinity", label: "Consanguineous union" });

    const shadingLabels = new Map<string, string>();
    state.canvas.nodes.forEach((n) => {
      if (n.shading) {
        if (n.shading === "solid" && !n.condition) return;
        const cond = n.condition || "";
        if (cond) {
          shadingLabels.set(n.shading, cond);
        } else if (!shadingLabels.has(n.shading)) {
          shadingLabels.set(n.shading, "...");
        }
      }
    });

    shadingLabels.forEach((label, shadingKey) => {
      list.push({ key: `shading-${shadingKey}`, label });
    });

    return list;
  }, [state.canvas.nodes, state.canvas.edges]);

  const setLocation = useLocation()[1];
  const { tabs, openTab, closeTab, reorderTabs, renameTab: renameTabLocal } = usePedigreeTabs();

  const tabItems = useMemo(() => tabs.map((t) => ({ id: t.id, title: t.title })), [tabs]);

  const visibleGenRows = useMemo(() => {
    const set = new Set<number>();
    for (const n of state.canvas.nodes) {
      set.add(Math.round(n.y / GEN_GRID) * GEN_GRID);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [state.canvas.nodes]);


  const runAutoLayout = useCallback((preservePositions: boolean, isManual = false) => {
    const layoutConfig = stateRef.current.canvas.settings?.config ?? configRef.current;

    if (preservePositions) {
      dispatch({
        type: "UPDATE_CANVAS",
        updater: (p) => {
          const localConfig = p.settings?.config;
          const annFs = localConfig?.annFontSize ?? configRef.current.annFontSize ?? 12;
          const genoFs = localConfig?.genotypeFontSize ?? configRef.current.genotypeFontSize ?? 12;
          const fontScale = 1.0 + Math.max(0, Math.max(annFs, genoFs) - 12) * 0.05;
          const cfgNodeGap = (localConfig?.nodeGap ?? configRef.current.nodeGap ?? NODE_GAP) * fontScale;
          const cfgGenGrid = localConfig?.genGrid ?? configRef.current.genGrid ?? GEN_GRID;
          const cfgTwinGapMono = (localConfig?.twinGapMono ?? configRef.current.twinGapMono ?? (NODE_SIZE * 0.55)) * fontScale;
          const cfgTwinGapDizygotic = (localConfig?.twinGapDizygotic ?? configRef.current.twinGapDizygotic ?? (NODE_SIZE * 0.8)) * fontScale;

          const genIndexOf = buildGenerations(p.nodes, p.edges);
          const resolved = resolveAndRecenter(
            p.nodes,
            p.edges,
            undefined,
            genIndexOf,
            undefined,
            undefined,
            cfgNodeGap,
            cfgGenGrid,
            cfgTwinGapMono,
            cfgTwinGapDizygotic,
            configRef.current.crossingMinimizationSweeps
          );
          return { ...p, nodes: resolved };
        }
      });
      return;
    }

    const newNodes = computeAutoLayout(
      stateRef.current.canvas.nodes,
      stateRef.current.canvas.edges,
      false,
      layoutConfig,
      W
    );
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: newNodes }) });

    if (isManual) {
      const currentNodes = stateRef.current.canvas.nodes;
      if (currentNodes.length > 0) {
        const pad = 40 * 0.5;
        const xs = currentNodes.map((n) => n.x);
        const ys = currentNodes.map((n) => n.y);
        const minX = Math.min(...xs) - pad;
        const maxX = Math.max(...xs) + pad + 40;
        const minY = Math.min(...ys) - pad;
        const maxY = Math.max(...ys) + pad + 40;
        const spanX = maxX - minX;
        const spanY = maxY - minY;
        const zoom = Math.max(0.7, Math.min(4.0, Math.max(spanX / (W * 0.88), spanY / (H * 0.88))));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        dispatch({
          type: "SET_STATE",
          patch: {
            viewBox: { x: cx - (W * zoom) / 2, y: cy - (H * zoom) / 2, zoom }
          }
        });
      }
    }
  }, [configRef, dispatch]);

  useEffect(() => {
    const curNodesLen = state.canvas.nodes.length;
    const curEdgesLen = state.canvas.edges.length;

    if (skipLiveLayoutRef.current) {
      skipLiveLayoutRef.current = false;
      lastNodesLengthRef.current = curNodesLen;
      lastEdgesLengthRef.current = curEdgesLen;
      return;
    }

    lastNodesLengthRef.current = curNodesLen;
    lastEdgesLengthRef.current = curEdgesLen;
  }, [state.canvas]);

  const updateCanvas = useCallback((updater: (prev: CanvasData) => CanvasData, opts?: { skipHistory?: boolean }) => {
    dispatch({ type: "UPDATE_CANVAS", updater, pushHistory: !opts?.skipHistory });
  }, [dispatch]);

  const undo = useCallback(() => {
    skipLiveLayoutRef.current = true;
    dispatch({ type: "UNDO" });
  }, [dispatch]);

  const redo = useCallback(() => {
    skipLiveLayoutRef.current = true;
    dispatch({ type: "REDO" });
  }, [dispatch]);

  const bakeEmptyLabels = useCallback(() => {
    dispatch({
      type: "UPDATE_CANVAS",
      updater: (p) => {
        const labelsMap = computeAutoLabels(p.nodes, p.edges);
        return {
          ...p,
          nodes: p.nodes.map((n) => {
            if (n.label && n.label.trim() !== "") return n;
            const computed = labelsMap.get(n.id) ?? "";
            return { ...n, label: computed };
          })
        };
      }
    });
  }, [dispatch]);

  const openConfirm = useCallback((title: string, message: string, onConfirm: () => void, variant?: "default" | "destructive") => {
    dispatch({
      type: "SET_STATE",
      patch: {
        confirmOpen: true,
        confirmProps: { title, message, variant: variant ?? "default", onConfirm }
      }
    });
  }, [dispatch]);

  const bakeAllLabels = useCallback(() => {
    dispatch({
      type: "UPDATE_CANVAS",
      updater: (p) => {
        const labelsMap = computeAutoLabels(p.nodes, p.edges);
        return {
          ...p,
          nodes: p.nodes.map((n) => ({ ...n, label: labelsMap.get(n.id) ?? "" }))
        };
      }
    });
  }, [dispatch]);

  const handleCloseTab = useCallback(async (tid: number) => {
    closeTab(tid);
    if (tabs.length <= 1) {
      setLocation("/pedigrees");
    }
  }, [closeTab, tabs.length, setLocation]);

  const renameTab = useCallback((tabId: number, newTitle: string) => {
    renameTabLocal(tabId, newTitle);
    updatePedigree.mutate({ id: tabId, input: { title: newTitle } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.pedigree(tabId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
      },
      onError: (err) => {
        console.error("Failed to rename pedigree on server:", err);
        toast({ title: "Failed to save title", description: "The title update could not be persisted.", variant: "destructive" });
      }
    });
  }, [renameTabLocal, updatePedigree, queryClient]);

  const justCtrlSelectedNodeIdRef = useRef<string | null>(null);
  const { getSVGCoords, handleDragStart, handleMouseMove, handleMouseUp, handleSVGMouseDown, handleWheel, fitToScreen, lastDragEndTimeRef } = usePedigreeCanvas({
    stateRef, dispatch, svgRef, lassoRef, isLassoingRef, lassoRectRef,
    spaceHeldRef, preDragCanvasRef, rafRef, pendingAnnDragRef,
    justCtrlSelectedNodeIdRef,
  });

  // Hook 1: Mutations (node CRUD, copy/paste, selection update)
  const {
    addNode,
    addContextNode,
    toggleNodeProp,
    copySelectedNodes,
    pasteNodes,
    setNodeType,
    setNodeColor,
    handleNodeContextMenu,
    handleNodeDoubleClick,
    deleteSelected,
    updateSelectedNode,
    bulkUpdate,
  } = usePedigreeMutations(
    stateRef,
    configRef,
    canvasRef,
    mouseCoordsRef,
    lastDragEndTimeRef,
    dispatch
  );

  // Hook 2: Graph Operations (edges, couples, parents, siblings, twins)
  const {
    createConsanguinityEdge,
    createCoupleEdge,
    createParentsForGroup,
    createCoupleAndChild,
    addSiblings,
    markAsTwins,
    unmarkTwins,
    removeEdges,
    updateEdgeType,
    toggleCoupleInverted,
  } = usePedigreeGraphOperations(
    configRef,
    dispatch
  );

  // Hook 3: Annotations (text & freeform notes)
  const {
    addAnnotation,
    addFreeAnnotation,
    updateAnnotation,
    deleteAnnotation,
  } = usePedigreeAnnotations(
    dispatch
  );

  // Hook 4: Alignment & Distribution
  const {
    alignSelected,
    distributeSelected,
  } = usePedigreeAlignment(
    stateRef,
    dispatch
  );

  const handleNodeClick = useCallback((nid: string, e: React.MouseEvent) => {
    if (Date.now() - lastDragEndTimeRef.current < 300) {
      justCtrlSelectedNodeIdRef.current = null;
      return;
    }
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
        if (s.linkMode === "consanguinity") {
          dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, edges: [...p.edges.filter((ed) => !(ed.type === "couple" && ((ed.sourceId === s.linkSource && ed.targetId === nid) || (ed.sourceId === nid && ed.targetId === s.linkSource)))), { id: `e${Date.now()}`, type: "consanguinity", sourceId: s.linkSource!, targetId: nid }] }) });
        } else if (s.linkMode === "parent-child") {
          dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
            const localConfig = p.settings?.config;
            const annFs = localConfig?.annFontSize ?? configRef.current.annFontSize ?? 12;
            const genoFs = localConfig?.genotypeFontSize ?? configRef.current.genotypeFontSize ?? 12;
            const fontScale = 1.0 + Math.max(0, Math.max(annFs, genoFs) - 12) * 0.05;
            const cfgNodeGap = (localConfig?.nodeGap ?? configRef.current.nodeGap ?? NODE_GAP) * fontScale;
            const cfgGenGrid = localConfig?.genGrid ?? configRef.current.genGrid ?? GEN_GRID;
            const cfgTwinGapMono = (localConfig?.twinGapMono ?? configRef.current.twinGapMono ?? (NODE_SIZE * 0.55)) * fontScale;
            const cfgTwinGapDizygotic = (localConfig?.twinGapDizygotic ?? configRef.current.twinGapDizygotic ?? (NODE_SIZE * 0.8)) * fontScale;

            const pn = p.nodes.find((n) => n.id === s.linkSource); if (!pn) return p;
            if (p.edges.some((ed) => (ed.type === "couple" || ed.type === "consanguinity") && (ed.sourceId === s.linkSource || ed.targetId === s.linkSource))) {
              const ce = p.edges.find((ed) => (ed.type === "couple" || ed.type === "consanguinity") && (ed.sourceId === s.linkSource || ed.targetId === s.linkSource))!;
              const pid = ce.sourceId === s.linkSource ? ce.targetId : ce.sourceId;
              const now = Date.now();
              return { ...p, edges: [...p.edges, { id: `e${now}`, type: "parent-child" as const, sourceId: s.linkSource!, targetId: nid }, { id: `e${now + 1}`, type: "parent-child" as const, sourceId: pid, targetId: nid }] };
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
            const gap = existingLinkCouple ? Math.round(cfgNodeGap * 1.5) : cfgNodeGap;
            const insertX = dir > 0 ? pn.x + gap : pn.x;
            const shiftedNodes = makeSpaceAtX(p.nodes, insertX, gap);

            const partnerX = insertX;
            const newPartner = { id: mid, type: mt, affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: partnerX, y: pn.y };
            
            const nodesWithPartner = [...shiftedNodes, newPartner];
            const edgesWithPartner = [...p.edges, { id: `e${ts}`, type: "couple" as const, sourceId: s.linkSource!, targetId: mid }];
            
            const genIndexOf = buildGenerations(nodesWithPartner, edgesWithPartner);
            let resolved = resolveAllCollisions(nodesWithPartner, edgesWithPartner, undefined, cfgNodeGap, cfgGenGrid, genIndexOf, undefined, cfgTwinGapMono, cfgTwinGapDizygotic);
            
            const allEdges = [...edgesWithPartner, 
              { id: `e${ts + 1}`, type: "parent-child" as const, sourceId: s.linkSource!, targetId: nid },
              { id: `e${ts + 2}`, type: "parent-child" as const, sourceId: mid, targetId: nid }
            ];

            return { ...p, nodes: resolved, edges: allEdges };
          } });
        } else if (s.linkMode === "couple") {
          dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, edges: [...p.edges.filter((ed) => !(ed.type === "consanguinity" && ((ed.sourceId === s.linkSource && ed.targetId === nid) || (ed.sourceId === nid && ed.targetId === s.linkSource)))), { id: `e${Date.now()}`, type: "couple", sourceId: s.linkSource!, targetId: nid }] }) });
        }
        dispatch({ type: "SET_STATE", patch: { linkMode: null, linkSource: null } });
        return;
      }
    }
    const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
    let newSelected: Set<string>;
    if (isMulti) {
      newSelected = new Set(s.selectedIds);
      if (newSelected.has(nid)) {
        newSelected.delete(nid);
      } else {
        newSelected.add(nid);
        justCtrlSelectedNodeIdRef.current = nid;
      }
    } else {
      newSelected = new Set([nid]);
    }
    dispatch({ type: "SET_STATE", patch: { selectedIds: newSelected, selectedAnnotationId: null } });
  }, [configRef, dispatch, lastDragEndTimeRef]);

  const toggleTwinSelectMode = useCallback(() => {
    const s = stateRef.current;
    if (s.twinSelectMode) {
      dispatch({ type: "SET_STATE", patch: { twinSelectMode: false, twinCandidateIds: new Set<string>() } });
    } else {
      dispatch({ type: "SET_STATE", patch: { twinSelectMode: true, twinCandidateIds: new Set<string>() } });
    }
  }, [dispatch]);

  const clearTwinCandidates = useCallback(() => {
    dispatch({ type: "SET_STATE", patch: { twinCandidateIds: new Set<string>() } });
  }, [dispatch]);

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
  }, [dispatch]);

  const handleMouseMoveWithCoords = useCallback((e: React.MouseEvent) => {
    const coords = getSVGCoords(e);
    if (coords) {
      mouseCoordsRef.current = coords;
    }
    handleMouseMove(e);
  }, [getSVGCoords, handleMouseMove]);

  const setShowSearch: Dispatch<SetStateAction<boolean>> = useCallback((v) => { const nv = typeof v === "function" ? v(stateRef.current.showSearch) : v; dispatch({ type: "SET_STATE", patch: { showSearch: nv } }); }, [dispatch]);
  const setSearchQuery: Dispatch<SetStateAction<string>> = useCallback((q) => { const nq = typeof q === "function" ? q(stateRef.current.searchQuery) : q; dispatch({ type: "SET_STATE", patch: { searchQuery: nq } }); }, [dispatch]);
  const setSelectedIds: Dispatch<SetStateAction<Set<string>>> = useCallback((ids) => { const n = typeof ids === "function" ? ids(stateRef.current.selectedIds) : ids; dispatch({ type: "SET_STATE", patch: { selectedIds: n } }); }, [dispatch]);
  const setLinkMode: Dispatch<SetStateAction<"couple" | "parent-child" | "consanguinity" | null>> = useCallback((mode) => { const nm = typeof mode === "function" ? mode(stateRef.current.linkMode) : mode; dispatch({ type: "SET_STATE", patch: { linkMode: nm } }); }, [dispatch]);
  const setLinkSource: Dispatch<SetStateAction<string | null>> = useCallback((src) => { const ns = typeof src === "function" ? src(stateRef.current.linkSource) : src; dispatch({ type: "SET_STATE", patch: { linkSource: ns } }); }, [dispatch]);
  const setSelectedAnnotationId: Dispatch<SetStateAction<string | null>> = useCallback((id) => { const n = typeof id === "function" ? id(stateRef.current.selectedAnnotationId) : id; dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: n, editAnnotationId: n === null ? null : stateRef.current.editAnnotationId } }); }, [dispatch]);
  const setViewBox: Dispatch<SetStateAction<{ x: number; y: number; zoom: number }>> = useCallback((vb) => { const nv = typeof vb === "function" ? vb(stateRef.current.viewBox) : vb; dispatch({ type: "SET_STATE", patch: { viewBox: nv } }); }, [dispatch]);
  const setSpaceHeld: Dispatch<SetStateAction<boolean>> = useCallback((v) => { const nv = typeof v === "function" ? v(stateRef.current.spaceHeld) : v; dispatch({ type: "SET_STATE", patch: { spaceHeld: nv } }); }, [dispatch]);

  usePedigreeKeyboard({ deleteSelected, deleteAnnotation, selectedAnnotationId: state.selectedAnnotationId, selectedNode: state.selectedIds.size === 1 ? state.canvas.nodes.find((n) => state.selectedIds.has(n.id)) ?? null : null, updateSelectedNode, addNode, addContextNode, undo, redo, navigateArrow, showSearch: state.showSearch, fitToScreen, runAutoLayout: (rp: boolean, isManual?: boolean) => runAutoLayout(rp, isManual), setShowSearch, setSearchQuery, setSelectedIds, setLinkMode, setLinkSource, setSelectedAnnotationId, setViewBox, spaceHeldRef, setSpaceHeld, searchInputRef, twinSelectMode: state.twinSelectMode, setTwinSelectMode: (v) => { const nv = typeof v === "function" ? v(stateRef.current.twinSelectMode) : v; dispatch({ type: "SET_STATE", patch: { twinSelectMode: nv, twinCandidateIds: nv ? stateRef.current.twinCandidateIds : new Set<string>() } }); }, clearTwinCandidates, selectedIds: state.selectedIds, canvasNodes: state.canvas.nodes, createCoupleAndChild, createCoupleEdge, createConsanguinityEdge, W, H, isPreviewMode: state.isPreviewMode, copySelectedNodes, pasteNodes });

  const handleSaveVersion = () => dispatch({ type: "SET_STATE", patch: { sessionLabel: `Session \u00b7 ${state.canvas.nodes.length} node${state.canvas.nodes.length !== 1 ? "s" : ""} \u00b7 ${new Date().toLocaleDateString()}`, showSaveModal: true } });
  const commitSaveVersion = async () => { const t = generateThumbnail(state.canvas); const canvasData = JSON.stringify(state.canvas); const canvasHash = cryptoComputeHash(canvasData); const keys = await listProfilePrivateKeys(); const activeKey = keys.length > 0 ? keys[0] : null; const saverKey = activeKey ? await getPublicKeyFromPrivate(activeKey.privateKey) : ""; const saverSignature = activeKey ? await signData(canvasHash, activeKey.privateKey) : null; saveVersionMutation.mutate({ pedigreeId: id, input: { canvas_data: canvasData, canvas_hash: canvasHash, label: state.sessionLabel || null, thumbnail: t, saver_key: saverKey, saver_signature: saverSignature } }, { onSuccess: () => { clearDraft(); queryClient.invalidateQueries({ queryKey: queryKeys.versions(id) }); dispatch({ type: "SET_STATE", patch: { showSaveModal: false, sessionLabel: "" } }); } }); };
  const handleDeleteVersion = (versionId: number) => { openConfirm("Delete Version", "Delete this saved session? This cannot be undone.", () => { deleteVersionMutation.mutate({ pedigreeId: id, versionId }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.versions(id) }); } }); }, "destructive"); };
  const handleRestoreVersion = (vid: number) => { openConfirm("Restore Version", "Restore this version? Current canvas will be replaced.", () => { restoreVersionMutation.mutate({ pedigreeId: id, versionId: vid }, { onSuccess: (d) => { const cd = (d as { canvas_data?: string | null }).canvas_data; if (cd) { skipLiveLayoutRef.current = true; dispatch({ type: "SET_CANVAS", canvas: parseCanvas(cd) }); } initialSyncDoneRef.current = true; queryClient.setQueryData(queryKeys.pedigree(id), d); dispatch({ type: "SET_STATE", patch: { showVersions: false, isPreviewMode: false, liveCanvasCache: null, showVisualDiff: false, previewVersionId: null } }); } }); }); };

  const onRestoreDraft = useCallback(() => {
    skipLiveLayoutRef.current = true;
    handleRestoreDraft(
      (canvas: CanvasData) => dispatch({ type: "SET_CANVAS", canvas }),
      (history: CanvasData[]) => dispatch({ type: "SET_STATE", patch: { history } }),
      (future: CanvasData[]) => dispatch({ type: "SET_STATE", patch: { future } }),
    );
  }, [handleRestoreDraft, dispatch]);

  const vbW = W * state.viewBox.zoom;
  const vbH = H * state.viewBox.zoom;
  const MM_W = 140;
  const MM_H = 90;

  const value = useMemo<PedigreeEditorContextValue>(() => ({
    state, dispatch,
    ops: { updateCanvas, undo, redo, addNode, addContextNode, toggleNodeProp, setNodeType, setNodeColor, handleNodeContextMenu, handleNodeDoubleClick, handleNodeClick, deleteSelected, updateSelectedNode, bulkUpdate, alignSelected, distributeSelected, addAnnotation, addFreeAnnotation, updateAnnotation, deleteAnnotation, runAutoLayout, bakeEmptyLabels, bakeAllLabels, openConfirm, navigateArrow, handleCloseTab, openTab, reorderTabs, renameTab, fitToScreen, getSVGCoords, handleDragStart, handleMouseMove: handleMouseMoveWithCoords, handleMouseUp, handleSVGMouseDown, handleWheel, handleSaveVersion, commitSaveVersion, handleDeleteVersion, handleRestoreVersion, createConsanguinityEdge, createCoupleEdge, createCoupleAndChild, createParentsForGroup, addSiblings, markAsTwins, unmarkTwins, removeEdges, updateEdgeType, toggleCoupleInverted, toggleTwinSelectMode, clearTwinCandidates, handleDeletePedigree, backgroundSaveVersion, copySelectedNodes, pasteNodes },
    memo: { autoLabels, validation, searchMatches, generationRailEntries, legendEntries, visibleGenRows, vbW, vbH, MM_W, MM_H, singleSelected: state.selectedIds.size === 1 ? state.canvas.nodes.find((n) => state.selectedIds.has(n.id)) ?? null : null, anySelected: state.selectedIds.size > 0, tabItems },
    refs: { svgRef, canvasRef, preDragCanvasRef, lassoRef, isLassoingRef, lassoRectRef, spaceHeldRef, rafRef, searchInputRef, draftKeyRef, draftEnabledRef, pendingAnnDragRef },
    pedigree, versions, versionsLoading, profiles, saveVersionPending: saveVersionMutation.isPending, showDraftBanner, onRestoreDraft, handleDismissDraft,
  }), [state, updateCanvas, undo, redo, addNode, addContextNode, toggleNodeProp, setNodeType, setNodeColor, handleNodeContextMenu, handleNodeDoubleClick, handleNodeClick, deleteSelected, updateSelectedNode, bulkUpdate, alignSelected, distributeSelected, addAnnotation, addFreeAnnotation, updateAnnotation, deleteAnnotation, runAutoLayout, bakeEmptyLabels, bakeAllLabels, openConfirm, navigateArrow, handleCloseTab, openTab, reorderTabs, renameTab, fitToScreen, getSVGCoords, handleDragStart, handleMouseMoveWithCoords, handleMouseUp, handleSVGMouseDown, handleWheel, commitSaveVersion, handleDeleteVersion, handleRestoreVersion, createConsanguinityEdge, createCoupleEdge, createCoupleAndChild, createParentsForGroup, addSiblings, markAsTwins, unmarkTwins, removeEdges, updateEdgeType, toggleCoupleInverted, toggleTwinSelectMode, clearTwinCandidates, handleDeletePedigree, backgroundSaveVersion, autoLabels, validation, searchMatches, generationRailEntries, legendEntries, visibleGenRows, vbW, vbH, MM_W, MM_H, tabItems, saveVersionMutation.isPending, deleteVersionMutation.isPending, copySelectedNodes, pasteNodes]);

  return <PedigreeEditorContext.Provider value={value}>{children}</PedigreeEditorContext.Provider>;
}
