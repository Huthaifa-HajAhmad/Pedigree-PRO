import { useCallback, useRef } from "react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE, NODE_GAP, GEN_GRID } from "@/features/pedigree-editor/canvas/types";
import { resolveAndRecenter, buildGenerations, ROW_TOLERANCE } from "@/lib/layout-engine";
import { toast } from "@/hooks/use-toast";
import type { PedigreeEditorAction } from "../context/types";
import type { CanvasConfig } from "../context/CanvasConfigContext";

function calculateAgeFromDob(dob?: string): string {
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
}

function parentIdsFromEdges(edges: PedigreeEdge[]): string[] {
  const ids: string[] = [];
  for (const e of edges) {
    if (e.type === "parent-child" && !ids.includes(e.sourceId)) ids.push(e.sourceId);
  }
  return ids;
}

export function usePedigreeGraphOperations(
  configRef: React.MutableRefObject<CanvasConfig>,
  dispatch: (action: PedigreeEditorAction) => void
) {
  const addSiblingsBlockedRef = useRef(false);

  const createConsanguinityEdge = useCallback((sourceId: string, targetId: string) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({
      ...p,
      edges: [
        ...p.edges.filter((ed) => !((ed.type === "couple" || ed.type === "consanguinity") && ((ed.sourceId === sourceId && ed.targetId === targetId) || (ed.sourceId === targetId && ed.targetId === sourceId)))),
        { id: `e${Date.now()}`, type: "consanguinity", sourceId, targetId }
      ]
    }) });
  }, [dispatch]);

  const createCoupleEdge = useCallback((sourceId: string, targetId: string) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({
      ...p,
      edges: [
        ...p.edges.filter((ed) => !((ed.type === "couple" || ed.type === "consanguinity") && ((ed.sourceId === sourceId && ed.targetId === targetId) || (ed.sourceId === targetId && ed.targetId === sourceId)))),
        { id: `e${Date.now()}`, type: "couple", sourceId, targetId }
      ]
    }) });
  }, [dispatch]);

  const createParentsForGroup = useCallback((nodeIds: string[]) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      if (nodeIds.length === 0) return p;
      const localConfig = p.settings?.config;
      const annFs = localConfig?.annFontSize ?? configRef.current.annFontSize ?? 12;
      const genoFs = localConfig?.genotypeFontSize ?? configRef.current.genotypeFontSize ?? 12;
      const fontScale = 1.0 + Math.max(0, Math.max(annFs, genoFs) - 12) * 0.05;
      const cfgNodeGap = (localConfig?.nodeGap ?? configRef.current.nodeGap ?? NODE_GAP) * fontScale;
      const cfgGenGrid = localConfig?.genGrid ?? configRef.current.genGrid ?? GEN_GRID;
      const cfgTwinGapMono = (localConfig?.twinGapMono ?? configRef.current.twinGapMono ?? (NODE_SIZE * 0.55)) * fontScale;
      const cfgTwinGapDizygotic = (localConfig?.twinGapDizygotic ?? configRef.current.twinGapDizygotic ?? (NODE_SIZE * 0.8)) * fontScale;
      const SY = cfgGenGrid;
      const now = Date.now();
      const nd = { affected: false, carrier: false, deceased: false, proband: false, label: "", age: "" };
      
      const firstNode = p.nodes.find(n => n.id === nodeIds[0]);
      if (!firstNode) return p;
      const ny = firstNode.y - SY;

      const selectedNodes = p.nodes.filter(n => nodeIds.includes(n.id));
      const avgX = selectedNodes.reduce((sum, n) => sum + n.x, 0) / selectedNodes.length;
      const fatherStartX = Math.max(cfgGenGrid, avgX - cfgNodeGap / 2);

      let collision = true;
      let testX = fatherStartX;
      const rowNodes = p.nodes.filter(n => Math.abs(n.y - ny) < ROW_TOLERANCE);
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

      const fid = `n${now}_father`;
      const mid = `n${now}_mother`;

      const newParents: PedigreeNode[] = [
        { id: fid, type: "male", ...nd, x: fatherX, y: ny },
        { id: mid, type: "female", ...nd, x: motherX, y: ny }
      ];

      const newEdges: PedigreeEdge[] = [
        { id: `e${now}_couple`, type: "couple" as const, sourceId: fid, targetId: mid }
      ];

      for (let i = 0; i < nodeIds.length; i++) {
        newEdges.push(
          { id: `e${now}_pchild_f_${i}`, type: "parent-child" as const, sourceId: fid, targetId: nodeIds[i]! },
          { id: `e${now}_pchild_m_${i}`, type: "parent-child" as const, sourceId: mid, targetId: nodeIds[i]! }
        );
      }

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
    } });
  }, [configRef, dispatch]);

  const createCoupleAndChild = useCallback((maleId: string, femaleId: string) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const localConfig = p.settings?.config;
      const annFs = localConfig?.annFontSize ?? configRef.current.annFontSize ?? 12;
      const genoFs = localConfig?.genotypeFontSize ?? configRef.current.genotypeFontSize ?? 12;
      const fontScale = 1.0 + Math.max(0, Math.max(annFs, genoFs) - 12) * 0.05;
      const cfgNodeGap = (localConfig?.nodeGap ?? configRef.current.nodeGap ?? NODE_GAP) * fontScale;
      const cfgGenGrid = localConfig?.genGrid ?? configRef.current.genGrid ?? GEN_GRID;
      const cfgTwinGapMono = (localConfig?.twinGapMono ?? configRef.current.twinGapMono ?? (NODE_SIZE * 0.55)) * fontScale;
      const cfgTwinGapDizygotic = (localConfig?.twinGapDizygotic ?? configRef.current.twinGapDizygotic ?? (NODE_SIZE * 0.8)) * fontScale;

      const male = p.nodes.find(n => n.id === maleId);
      const female = p.nodes.find(n => n.id === femaleId);
      if (!male || !female) return p;
      const hasCoupleEdge = p.edges.some(e => (e.type === "couple" || e.type === "consanguinity") && ((e.sourceId === maleId && e.targetId === femaleId) || (e.sourceId === femaleId && e.targetId === maleId)));
      const now = Date.now();
      const nid = `n${now}-${Math.random().toString(36).slice(2, 6)}`;
      const childY = Math.max(male.y, female.y) + cfgGenGrid;
      const childX = (male.x + female.x) / 2;
      const newChild: PedigreeNode = { id: nid, type: "unknown", affected: false, carrier: false, deceased: false, proband: false, label: "", age: "", x: childX, y: childY };
      const edgesToAdd: PedigreeEdge[] = [];
      if (!hasCoupleEdge) edgesToAdd.push({ id: `e${now}`, type: "couple", sourceId: maleId, targetId: femaleId });
      edgesToAdd.push({ id: `e${now + 1}`, type: "parent-child", sourceId: maleId, targetId: nid });
      edgesToAdd.push({ id: `e${now + 2}`, type: "parent-child", sourceId: femaleId, targetId: nid });
      const allNodes = [...p.nodes, newChild];
      const allEdges = [...p.edges, ...edgesToAdd];
      const genIndexOf = buildGenerations(allNodes, allEdges);
      const resolved = resolveAndRecenter(allNodes, allEdges, new Set([nid]), genIndexOf, undefined, undefined, cfgNodeGap, cfgGenGrid, cfgTwinGapMono, cfgTwinGapDizygotic, configRef.current.crossingMinimizationSweeps);
      return { ...p, nodes: resolved, edges: allEdges };
    } });
  }, [configRef, dispatch]);

  const addSiblings = useCallback((
    sourceId: string,
    siblings: Array<{
      id: string;
      type: PedigreeNode["type"];
      dob: string;
      affected?: boolean;
      carrier?: boolean;
      deceased?: boolean;
      proband?: boolean;
      condition?: string;
      notes?: string;
      isSource?: boolean;
    }>
  ) => {
    addSiblingsBlockedRef.current = false;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const localConfig = p.settings?.config;
      const annFs = localConfig?.annFontSize ?? configRef.current.annFontSize ?? 12;
      const genoFs = localConfig?.genotypeFontSize ?? configRef.current.genotypeFontSize ?? 12;
      const fontScale = 1.0 + Math.max(0, Math.max(annFs, genoFs) - 12) * 0.05;
      const cfgNodeGap = (localConfig?.nodeGap ?? configRef.current.nodeGap ?? NODE_GAP) * fontScale;
      const cfgGenGrid = localConfig?.genGrid ?? configRef.current.genGrid ?? GEN_GRID;
      const cfgTwinGapMono = (localConfig?.twinGapMono ?? configRef.current.twinGapMono ?? (NODE_SIZE * 0.55)) * fontScale;
      const cfgTwinGapDizygotic = (localConfig?.twinGapDizygotic ?? configRef.current.twinGapDizygotic ?? (NODE_SIZE * 0.8)) * fontScale;

      const s = p.nodes.find((n) => n.id === sourceId); if (!s) return p;
      const SY = cfgGenGrid;
      const nd = { affected: false, carrier: false, deceased: false, proband: false, label: "", age: "" };

      const newSiblingEntries = siblings.filter((sib) => !sib.isSource);

      const parentEdges = p.edges.filter((e) => e.type === "parent-child" && e.targetId === sourceId);
      let parentIds = parentIdsFromEdges(parentEdges);
      const now = Date.now();

      let createdParents: PedigreeNode[] = [];
      const coupleEdges: PedigreeEdge[] = [];

      if (parentIds.length === 0) {
        const fid = `n${now}_father`;
        const mid = `n${now}_mother`;
        const parentY = s.y - SY;
        const fatherX = Math.max(cfgGenGrid, s.x - cfgNodeGap / 2 + 0.01);
        const motherX = Math.max(fatherX + cfgNodeGap, s.x + cfgNodeGap / 2 - 0.01);

        createdParents.push(
          { id: fid, type: "male", ...nd, x: fatherX, y: parentY, label: "" },
          { id: mid, type: "female", ...nd, x: motherX, y: parentY, label: "" }
        );
        coupleEdges.push(
          { id: `e${now}_couple`, type: "couple", sourceId: fid, targetId: mid }
        );
        parentIds = [fid, mid];
      }

      const existingChildren = p.nodes.filter((n) =>
        p.edges.some(
          (e) =>
            e.type === "parent-child" &&
            parentIds.includes(e.sourceId) &&
            e.targetId === n.id
        )
      );
      existingChildren.sort((a, b) => a.x - b.x);
      const existingChildIds = existingChildren.map((n) => n.id);

      const orderedChildIds = siblings.map((sib) => (sib.isSource ? sourceId : sib.id));

      const finalChildIdsOrder = [...existingChildIds];
      const sourceIndex = existingChildIds.indexOf(sourceId);
      if (sourceIndex !== -1) {
        finalChildIdsOrder.splice(sourceIndex, 1, ...orderedChildIds);
      } else {
        finalChildIdsOrder.push(...orderedChildIds);
      }

      const filteredEdges = p.edges.filter(
        (e) => !(e.type === "parent-child" && parentIds.includes(e.sourceId))
      );

      const parentChildEdges: PedigreeEdge[] = [];
      let edgeIndex = 0;
      for (const pid of parentIds) {
        for (const cid of finalChildIdsOrder) {
          parentChildEdges.push({
            id: `e_pc_${now}_${pid}_${cid}_${edgeIndex++}`,
            type: "parent-child",
            sourceId: pid,
            targetId: cid,
          });
        }
      }

      const currentX = new Map<string, number>();
      for (const child of existingChildren) {
        currentX.set(child.id, child.x);
      }

      const newNodes: PedigreeNode[] = [];
      for (const sb of newSiblingEntries) {
        const age = calculateAgeFromDob(sb.dob);

        const idx = finalChildIdsOrder.indexOf(sb.id);
        let xVal = s.x;
        if (idx !== -1) {
          let leftIdx = -1;
          for (let i = idx - 1; i >= 0; i--) {
            if (currentX.has(finalChildIdsOrder[i]!)) {
              leftIdx = i;
              break;
            }
          }
          let rightIdx = -1;
          for (let i = idx + 1; i < finalChildIdsOrder.length; i++) {
            if (currentX.has(finalChildIdsOrder[i]!)) {
              rightIdx = i;
              break;
            }
          }

          if (leftIdx !== -1 && rightIdx !== -1) {
            const leftId = finalChildIdsOrder[leftIdx]!;
            const rightId = finalChildIdsOrder[rightIdx]!;
            const leftX = currentX.get(leftId)!;
            const rightX = currentX.get(rightId)!;
            const ratio = (idx - leftIdx) / (rightIdx - leftIdx);
            xVal = leftX + ratio * (rightX - leftX);
          } else if (leftIdx !== -1) {
            const leftId = finalChildIdsOrder[leftIdx]!;
            const leftX = currentX.get(leftId)!;
            xVal = leftX + (idx - leftIdx) * cfgNodeGap;
          } else if (rightIdx !== -1) {
            const rightId = finalChildIdsOrder[rightIdx]!;
            const rightX = currentX.get(rightId)!;
            xVal = rightX - (rightIdx - idx) * cfgNodeGap;
          }
        }

        newNodes.push({
          id: sb.id,
          type: sb.type,
          affected: sb.affected ?? false,
          carrier: sb.carrier ?? false,
          deceased: sb.deceased ?? false,
          proband: sb.proband ?? false,
          label: "",
          age,
          x: xVal,
          y: s.y,
          dob: sb.dob || undefined,
          condition: sb.condition || undefined,
          notes: sb.notes || undefined,
        });

        currentX.set(sb.id, xVal);
      }

      const allNodes = [...p.nodes, ...createdParents, ...newNodes];
      const allEdges = [...filteredEdges, ...coupleEdges, ...parentChildEdges];

      const excludeIds = new Set(newNodes.map(n => n.id));
      const genIndexOf = buildGenerations(allNodes, allEdges);
      let final = resolveAndRecenter(allNodes, allEdges, excludeIds, genIndexOf, undefined, undefined, cfgNodeGap, cfgGenGrid, cfgTwinGapMono, cfgTwinGapDizygotic, configRef.current.crossingMinimizationSweeps);

      const minY = final.reduce((min, n) => Math.min(min, n.y), Infinity);
      if (minY < cfgGenGrid) {
        const shiftY = cfgGenGrid - minY;
        final = final.map(n => ({ ...n, y: n.y + shiftY }));
      }

      return { ...p, nodes: final, edges: allEdges };
    } });

    if (addSiblingsBlockedRef.current) {
      toast({ title: "No free space nearby", description: "Please move existing nodes or use auto-layout to make room for siblings.", duration: 4000 });
      addSiblingsBlockedRef.current = false;
      return;
    }

    dispatch({ type: "SET_STATE", patch: { showAddSiblingDialog: false, siblingSourceId: null } });
  }, [configRef, dispatch]);

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
  }, [dispatch]);

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
  }, [dispatch]);

  const removeEdges = useCallback((edgeIds: string[]) => {
    dispatch({ type: "REMOVE_EDGES", edgeIds });
  }, [dispatch]);

  const updateEdgeType = useCallback((edgeId: string, type: PedigreeEdge["type"]) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({
      ...p,
      edges: p.edges.map((e) => e.id === edgeId ? { ...e, type } : e)
    }) });
  }, [dispatch]);

  const toggleCoupleInverted = useCallback((edgeId: string) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const nextEdges = p.edges.map((e) => e.id === edgeId ? { ...e, inverted: !(e.inverted ?? false) } : e);
      const localConfig = p.settings?.config;
      const annFs = localConfig?.annFontSize ?? configRef.current.annFontSize ?? 12;
      const genoFs = localConfig?.genotypeFontSize ?? configRef.current.genotypeFontSize ?? 12;
      const fontScale = 1.0 + Math.max(0, Math.max(annFs, genoFs) - 12) * 0.05;
      const cfgNodeGap = (localConfig?.nodeGap ?? configRef.current.nodeGap ?? NODE_GAP) * fontScale;
      const cfgGenGrid = localConfig?.genGrid ?? configRef.current.genGrid ?? GEN_GRID;
      const cfgTwinGapMono = (localConfig?.twinGapMono ?? configRef.current.twinGapMono ?? (NODE_SIZE * 0.55)) * fontScale;
      const cfgTwinGapDizygotic = (localConfig?.twinGapDizygotic ?? configRef.current.twinGapDizygotic ?? (NODE_SIZE * 0.8)) * fontScale;

      const edge = p.edges.find((e) => e.id === edgeId);
      if (!edge || (edge.type !== "couple" && edge.type !== "consanguinity")) return { ...p, edges: nextEdges };

      const maleId = edge.sourceId;
      const femaleId = edge.targetId;

      const genIndexOf = buildGenerations(p.nodes, nextEdges);
      const resolvedNodes = resolveAndRecenter(
        p.nodes,
        nextEdges,
        new Set([maleId, femaleId]),
        genIndexOf,
        undefined,
        undefined,
        cfgNodeGap,
        cfgGenGrid,
        cfgTwinGapMono,
        cfgTwinGapDizygotic,
        configRef.current.crossingMinimizationSweeps
      );

      return {
        ...p,
        nodes: resolvedNodes,
        edges: nextEdges,
      };
    } });
  }, [configRef, dispatch]);

  return {
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
  };
}
