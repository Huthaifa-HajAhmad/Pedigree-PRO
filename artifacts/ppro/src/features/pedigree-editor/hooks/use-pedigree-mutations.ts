import { useCallback } from "react";
import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation, CanvasData } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE, NODE_GAP, GEN_GRID } from "@/features/pedigree-editor/canvas/types";
import { resolveAllCollisions, recenterAllFamilies, resolveAndRecenter, makeSpaceAtX, buildGenerations } from "@/lib/layout-engine";
import { toast } from "@/hooks/use-toast";
import type { PedigreeEditorAction, PedigreeEditorState } from "../context/types";
import type { CanvasConfig } from "../context/CanvasConfigContext";

const W = 1400;
const H = 900;

export function usePedigreeMutations(
  stateRef: React.MutableRefObject<PedigreeEditorState>,
  configRef: React.MutableRefObject<CanvasConfig>,
  canvasRef: React.MutableRefObject<CanvasData | null>,
  mouseCoordsRef: React.MutableRefObject<{ x: number; y: number } | null>,
  lastDragEndTimeRef: React.MutableRefObject<number>,
  dispatch: (action: PedigreeEditorAction) => void
) {
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
  }, [canvasRef, stateRef, dispatch]);

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
      const localConfig = p.settings?.config;
      const annFs = localConfig?.annFontSize ?? configRef.current.annFontSize ?? 12;
      const genoFs = localConfig?.genotypeFontSize ?? configRef.current.genotypeFontSize ?? 12;
      const fontScale = 1.0 + Math.max(0, Math.max(annFs, genoFs) - 12) * 0.05;
      const cfgNodeGap = (localConfig?.nodeGap ?? configRef.current.nodeGap ?? NODE_GAP) * fontScale;
      const cfgGenGrid = localConfig?.genGrid ?? configRef.current.genGrid ?? GEN_GRID;
      const cfgTwinGapMono = (localConfig?.twinGapMono ?? configRef.current.twinGapMono ?? (NODE_SIZE * 0.55)) * fontScale;
      const cfgTwinGapDizygotic = (localConfig?.twinGapDizygotic ?? configRef.current.twinGapDizygotic ?? (NODE_SIZE * 0.8)) * fontScale;
      const SY = cfgGenGrid;
      const nd = { affected: false, carrier: false, deceased: false, proband: false, label: "", age: "" };
      let nx: number, ny: number, nt: PedigreeNode["type"]; const ne: PedigreeEdge[] = [];
      if (rel === "child") {
        ny = s.y + SY; nt = "unknown";
        const ce = p.edges.find((e) => (e.type === "couple" || e.type === "consanguinity") && (e.sourceId === sid || e.targetId === sid));
        if (ce) {
          const pid = ce.sourceId === sid ? ce.targetId : ce.sourceId;
          const partnerNode = p.nodes.find((n) => n.id === pid);
          nx = partnerNode ? (s.x + partnerNode.x) / 2 : s.x;

          const newEdges: PedigreeEdge[] = [
            { id: `e${now}`, type: "parent-child", sourceId: sid, targetId: nid },
            { id: `e${now + 1}`, type: "parent-child" as const, sourceId: pid, targetId: nid }
          ];

          const genIndexOf1 = buildGenerations(p.nodes, p.edges);
          let resolved = resolveAllCollisions(p.nodes, p.edges, undefined, cfgNodeGap, cfgGenGrid, genIndexOf1, undefined, cfgTwinGapMono, cfgTwinGapDizygotic);
          const rS = resolved.find(n => n.id === sid)!;
          const rP = resolved.find(n => n.id === pid)!;
          const trueChildX = (rS.x + rP.x) / 2;
          
          const newChildObj = { id: nid, type: nt, ...nd, x: trueChildX, y: ny };
          resolved = [...resolved, newChildObj];
          const allEdges = [...p.edges, ...newEdges];
          
          const genIndexOf2 = buildGenerations(resolved, allEdges);
          resolved = resolveAllCollisions(resolved, allEdges, undefined, cfgNodeGap, cfgGenGrid, genIndexOf2, undefined, cfgTwinGapMono, cfgTwinGapDizygotic);
          resolved = recenterAllFamilies(resolved, allEdges, undefined, cfgNodeGap, cfgGenGrid, genIndexOf2, undefined, cfgTwinGapMono, cfgTwinGapDizygotic);

          return { ...p, nodes: resolved, edges: allEdges };
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
          const gap = existingCoupleForChild ? Math.round(cfgNodeGap * 1.5) : cfgNodeGap;
          
          const insertX = partnerDir > 0 ? s.x + gap : s.x;
          const shiftedNodes = makeSpaceAtX(p.nodes, insertX, gap);
          
          const partnerX = insertX;
          const newPartner = { id: mid, type: mt, ...nd, x: partnerX, y: s.y };
          
          const nodesWithPartner = [...shiftedNodes, newPartner];
          const edgesWithPartner = [...p.edges, { id: `e${now}`, type: "couple" as const, sourceId: sid, targetId: mid }];
          
          const genIndexOf3 = buildGenerations(nodesWithPartner, edgesWithPartner);
          let resolved = resolveAllCollisions(nodesWithPartner, edgesWithPartner, undefined, cfgNodeGap, cfgGenGrid, genIndexOf3, undefined, cfgTwinGapMono, cfgTwinGapDizygotic);
          const rS = resolved.find(n => n.id === sid)!;
          const rM = resolved.find(n => n.id === mid)!;
          const trueChildX = (rS.x + rM.x) / 2;
          
          const newChildObj = { id: nid, type: nt, ...nd, x: trueChildX, y: ny };
          resolved = [...resolved, newChildObj];
          const allEdges = [...edgesWithPartner, 
            { id: `e${now + 1}`, type: "parent-child" as const, sourceId: sid, targetId: nid },
            { id: `e${now + 2}`, type: "parent-child" as const, sourceId: mid, targetId: nid }
          ];
          
          const genIndexOf4 = buildGenerations(resolved, allEdges);
          resolved = resolveAllCollisions(resolved, allEdges, undefined, cfgNodeGap, cfgGenGrid, genIndexOf4, undefined, cfgTwinGapMono, cfgTwinGapDizygotic);
          resolved = recenterAllFamilies(resolved, allEdges, undefined, cfgNodeGap, cfgGenGrid, genIndexOf4, undefined, cfgTwinGapMono, cfgTwinGapDizygotic);

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
        
        const gap = existingCouple ? Math.round(cfgNodeGap * 1.5) : cfgNodeGap;
        const insertX = dir > 0 ? s.x + gap : s.x;
        
        const shiftedNodes = makeSpaceAtX(p.nodes, insertX, gap);
        nx = insertX;
        ny = s.y;

        const newPartnerEdge: PedigreeEdge = { id: `e${now}`, type: "couple", sourceId: sid, targetId: nid };
        const allNodes = [...shiftedNodes, { id: nid, type: nt, ...nd, x: nx, y: ny }];
        const allEdges = [...p.edges, newPartnerEdge];
        const genIndexOf = buildGenerations(allNodes, allEdges);
        const resolved = resolveAndRecenter(allNodes, allEdges, undefined, genIndexOf, undefined, undefined, cfgNodeGap, cfgGenGrid, cfgTwinGapMono, cfgTwinGapDizygotic, configRef.current.crossingMinimizationSweeps);

        return { ...p, nodes: resolved, edges: allEdges };
      }
      else if (rel === "parents") {
        const fid = `n${now}`, mid2 = `n${now + 1}`; ny = s.y - SY;
        const fatherStartX = Math.max(cfgGenGrid, s.x - cfgNodeGap / 2);
        
        let collision = true;
        let testX = fatherStartX;
        const rowNodes = p.nodes.filter(n => Math.abs(n.y - ny) < 10);
        while (collision) {
          collision = false;
          for (const n of rowNodes) {
            if (Math.abs(n.x - testX) < cfgNodeGap - 0.05 || Math.abs(n.x - (testX + cfgNodeGap)) < cfgNodeGap - 0.05) {
              collision = true;
              testX += cfgNodeGap;
              break;
            }
          }
        }
        const fatherX = testX;
        const motherX = testX + cfgNodeGap;

        const newParents: PedigreeNode[] = [
          { id: fid, type: "male", ...nd, x: fatherX, y: ny },
          { id: mid2, type: "female", ...nd, x: motherX, y: ny }
        ];
        const newEdges: PedigreeEdge[] = [
          { id: `e${now}`, type: "couple" as const, sourceId: fid, targetId: mid2 },
          { id: `e${now + 1}`, type: "parent-child" as const, sourceId: fid, targetId: sid },
          { id: `e${now + 2}`, type: "parent-child" as const, sourceId: mid2, targetId: sid }
        ];

        const allNodes = [...p.nodes, ...newParents];
        const allEdges = [...p.edges, ...newEdges];
        const genIndexOf = buildGenerations(allNodes, allEdges);
        const exclude = new Set(p.nodes.map(n => n.id));
        let final = resolveAndRecenter(allNodes, allEdges, exclude, genIndexOf, undefined, undefined, cfgNodeGap, cfgGenGrid, cfgTwinGapMono, cfgTwinGapDizygotic, configRef.current.crossingMinimizationSweeps);

        const minY = final.reduce((min, n) => Math.min(min, n.y), Infinity);
        if (minY < cfgGenGrid) {
          const shiftY = cfgGenGrid - minY;
          final = final.map(n => ({ ...n, y: n.y + shiftY }));
        }

        return { ...p, nodes: final, edges: allEdges };
      }
      else { return p; }
      return { ...p, nodes: [...p.nodes, { id: nid, type: nt!, ...nd, x: nx!, y: ny! }], edges: [...p.edges, ...ne] };
    } });
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]) } });
  }, [stateRef, configRef, dispatch]);

  const toggleNodeProp = useCallback((nid: string, prop: "affected" | "carrier" | "deceased" | "proband" | "stillbirth") => {
    const selected = stateRef.current.selectedIds;
    const targets = selected.has(nid) ? selected : new Set([nid]);
    dispatch({
      type: "UPDATE_CANVAS",
      updater: (p) => {
        const clicked = p.nodes.find((n) => n.id === nid);
        if (!clicked) return p;
        const nextVal = !clicked[prop];
        return {
          ...p,
          nodes: p.nodes.map((n) => {
            if (!targets.has(n.id)) return n;
            const updated = { ...n, [prop]: nextVal };
            if (prop === "stillbirth" && nextVal) {
              updated.deceased = true;
            }
            return updated;
          })
        };
      }
    });
    dispatch({ type: "SET_STATE", patch: { contextMenu: null } });
  }, [stateRef, dispatch]);

  const copySelectedNodes = useCallback(() => {
    const selected = stateRef.current.selectedIds;
    if (selected.size === 0) return;
    const nodesToCopy = stateRef.current.canvas.nodes.filter(n => selected.has(n.id));
    const edgesToCopy = stateRef.current.canvas.edges.filter(
      e => selected.has(e.sourceId) && selected.has(e.targetId)
    );
    const annotationsToCopy = stateRef.current.canvas.annotations?.filter(
      a => selected.has(a.nodeId)
    ) ?? [];

    const clipboardData = {
      nodes: nodesToCopy,
      edges: edgesToCopy,
      annotations: annotationsToCopy
    };

    try {
      localStorage.setItem("ppro_node_clipboard", JSON.stringify(clipboardData));
      const copiedCount = nodesToCopy.length;
      toast({
        title: "Copied to Clipboard",
        description: `Copied ${copiedCount} node${copiedCount !== 1 ? "s" : ""} to clipboard.`,
      });
    } catch (err) {
      console.error("Failed to copy nodes to localStorage", err);
    }
  }, [stateRef]);

  const pasteNodes = useCallback(() => {
    let clipboardData: { nodes: PedigreeNode[]; edges: PedigreeEdge[]; annotations?: PedigreeAnnotation[] } | null = null;
    try {
      const stored = localStorage.getItem("ppro_node_clipboard");
      if (stored) {
        clipboardData = JSON.parse(stored);
      }
    } catch (err) {
      console.error("Failed to read clipboard from localStorage", err);
      return;
    }

    if (!clipboardData || !clipboardData.nodes || clipboardData.nodes.length === 0) return;
    const { nodes, edges, annotations = [] } = clipboardData;

    const idMap = new Map<string, string>();
    const newIds: string[] = [];

    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const dx = mouseCoordsRef.current ? mouseCoordsRef.current.x - centerX : 40;
    const dy = mouseCoordsRef.current ? mouseCoordsRef.current.y - centerY : 40;

    dispatch({
      type: "UPDATE_CANVAS",
      updater: (p) => {
        const newNodes: PedigreeNode[] = [];
        nodes.forEach((n) => {
          const newId = `n_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          idMap.set(n.id, newId);
          newIds.push(newId);
          newNodes.push({
            ...n,
            id: newId,
            x: n.x + dx,
            y: n.y + dy,
          });
        });

        const newEdges: PedigreeEdge[] = [];
        edges.forEach((e) => {
          const sourceId = idMap.get(e.sourceId);
          const targetId = idMap.get(e.targetId);
          if (sourceId && targetId) {
            newEdges.push({
              ...e,
              id: `e_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              sourceId,
              targetId,
            });
          }
        });

        const newAnnotations: PedigreeAnnotation[] = [];
        annotations.forEach((a) => {
          const newNodeId = idMap.get(a.nodeId);
          if (newNodeId) {
            newAnnotations.push({
              ...a,
              id: `a_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              nodeId: newNodeId,
              ...(a.x !== undefined ? { x: a.x + dx } : {}),
              ...(a.y !== undefined ? { y: a.y + dy } : {}),
            });
          }
        });

        return {
          ...p,
          nodes: [...p.nodes, ...newNodes],
          edges: [...p.edges, ...newEdges],
          annotations: [...(p.annotations || []), ...newAnnotations],
        };
      }
    });

    if (newIds.length > 0) {
      dispatch({ type: "SET_STATE", patch: { selectedIds: new Set(newIds) } });
    }
    const pastedCount = nodes.length;
    toast({
      title: "Pasted from Clipboard",
      description: `Pasted ${pastedCount} node${pastedCount !== 1 ? "s" : ""} onto the canvas.`,
    });
  }, [mouseCoordsRef, dispatch]);

  const setNodeType = useCallback((nid: string, type: PedigreeNode["type"]) => {
    const selected = stateRef.current.selectedIds;
    const targets = selected.has(nid) ? selected : new Set([nid]);
    dispatch({
      type: "UPDATE_CANVAS",
      updater: (p) => {
        return {
          ...p,
          nodes: p.nodes.map((n) => {
            if (!targets.has(n.id)) return n;
            const hasChildren = p.edges.some((e) => e.type === "parent-child" && e.sourceId === n.id);
            if ((type === "pregnancy" || type === "sab" || type === "unknown") && hasChildren) return n;
            return { ...n, type };
          })
        };
      }
    });
    dispatch({ type: "SET_STATE", patch: { contextMenu: null } });
  }, [stateRef, dispatch]);

  const setNodeColor = useCallback((nid: string, color: string | undefined) => {
    const selected = stateRef.current.selectedIds;
    const targets = selected.has(nid) ? selected : new Set([nid]);
    dispatch({
      type: "UPDATE_CANVAS",
      updater: (p) => ({
        ...p,
        nodes: p.nodes.map((n) => targets.has(n.id) ? { ...n, color } : n)
      })
    });
  }, [stateRef, dispatch]);

  const handleNodeContextMenu = useCallback((nid: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const currentSelected = stateRef.current.selectedIds;
    const newSelected = currentSelected.has(nid) ? currentSelected : new Set([nid]);
    dispatch({
      type: "SET_STATE",
      patch: {
        selectedIds: newSelected,
        contextMenu: { nodeId: nid, x: e.clientX, y: e.clientY },
        showSettings: false
      }
    });
  }, [stateRef, dispatch]);

  const handleNodeDoubleClick = useCallback((nid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (Date.now() - lastDragEndTimeRef.current < 400) return;
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set([nid]), showSettings: false } });
  }, [lastDragEndTimeRef, dispatch]);

  const deleteSelected = useCallback(() => {
    const ids = stateRef.current.selectedIds; if (!ids.size) return;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const nodes = p.nodes.filter((n) => !ids.has(n.id));
      const edges = p.edges.filter((e) => !ids.has(e.sourceId) && !ids.has(e.targetId));
      const annotations = p.annotations.filter((a) => !ids.has(a.nodeId));
      return { nodes, edges, annotations };
    } });
    dispatch({ type: "SET_STATE", patch: { selectedIds: new Set(), selectedAnnotationId: null } });
  }, [stateRef, dispatch]);

  const updateSelectedNode = useCallback((u: Partial<PedigreeNode>) => {
    const sids = stateRef.current.selectedIds; if (sids.size !== 1) return;
    const id = [...sids][0]; if (!id) return;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, nodes: p.nodes.map((n) => n.id === id ? { ...n, ...u } : n) }) });
  }, [stateRef, dispatch]);

  const bulkUpdate = useCallback((u: Partial<PedigreeNode> | ((node: PedigreeNode) => Partial<PedigreeNode>)) => {
    const ids = stateRef.current.selectedIds; if (!ids.size) return;
    dispatch({
      type: "UPDATE_CANVAS",
      updater: (p) => ({
        ...p,
        nodes: p.nodes.map((n) => {
          if (!ids.has(n.id)) return n;
          const updatesObj = typeof u === "function" ? u(n) : u;
          return { ...n, ...updatesObj };
        })
      })
    });
  }, [stateRef, dispatch]);

  return {
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
  };
}
