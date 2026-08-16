import { useCallback } from "react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { buildAdjacency } from "@/lib/layout-shared";
import { collectSubtree } from "@/lib/layout-engine";
import type { PedigreeEditorAction, PedigreeEditorState } from "../context/types";

export function usePedigreeAlignment(
  stateRef: React.MutableRefObject<PedigreeEditorState>,
  dispatch: (action: PedigreeEditorAction) => void
) {
  const alignSelected = useCallback((axis: "x" | "y") => {
    const ids = stateRef.current.selectedIds; if (ids.size < 2) return;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const selectedNodes = p.nodes.filter((n) => ids.has(n.id));
      const avg = selectedNodes.reduce((sum, n) => sum + n[axis], 0) / selectedNodes.length;

      const adj = new Map<string, string[]>();
      for (const n of p.nodes) adj.set(n.id, []);
      for (const e of p.edges) {
        if (adj.has(e.sourceId) && adj.has(e.targetId)) {
          adj.get(e.sourceId)!.push(e.targetId);
          adj.get(e.targetId)!.push(e.sourceId);
        }
      }

      const visited = new Set<string>();
      const nodeToComponent = new Map<string, string[]>();
      for (const n of p.nodes) {
        if (!visited.has(n.id)) {
          const comp: string[] = [];
          const queue = [n.id];
          visited.add(n.id);
          let head = 0;
          while (head < queue.length) {
            const curr = queue[head]!;
            head++;
            comp.push(curr);
            for (const neighbor of adj.get(curr) || []) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
              }
            }
          }
          comp.forEach(id => nodeToComponent.set(id, comp));
        }
      }

      const componentToSelected = new Map<string[], PedigreeNode[]>();
      selectedNodes.forEach(node => {
        const comp = nodeToComponent.get(node.id) || [node.id];
        if (!componentToSelected.has(comp)) componentToSelected.set(comp, []);
        componentToSelected.get(comp)!.push(node);
      });

      if (componentToSelected.size > 1) {
        const newNodes = p.nodes.map(n => ({ ...n }));
        const newAnnotations = p.annotations?.map(a => ({ ...a })) || [];

        for (const [comp, selNodes] of componentToSelected.entries()) {
          const compAvg = selNodes.reduce((sum, n) => sum + n[axis], 0) / selNodes.length;
          const delta = avg - compAvg;

          const compSet = new Set(comp);
          newNodes.forEach(n => {
            if (compSet.has(n.id)) {
              n[axis] += delta;
            }
          });
          newAnnotations.forEach(a => {
            if (a.nodeId && compSet.has(a.nodeId)) {
              if (axis === "x" && a.x !== undefined) a.x += delta;
              if (axis === "y" && a.y !== undefined) a.y += delta;
            }
          });
        }
        return { ...p, nodes: newNodes, annotations: newAnnotations };
      } else {
        return {
          ...p,
          nodes: p.nodes.map((n) => ids.has(n.id) ? { ...n, [axis]: avg } : n)
        };
      }
    } });
  }, [stateRef, dispatch]);

  const distributeSelected = useCallback((axis: "x" | "y") => {
    const ids = stateRef.current.selectedIds; if (ids.size < 3) return;
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => {
      const selectedNodes = p.nodes.filter((n) => ids.has(n.id));

      const adj = new Map<string, string[]>();
      for (const n of p.nodes) adj.set(n.id, []);
      for (const e of p.edges) {
        if (adj.has(e.sourceId) && adj.has(e.targetId)) {
          adj.get(e.sourceId)!.push(e.targetId);
          adj.get(e.targetId)!.push(e.sourceId);
        }
      }

      const visited = new Set<string>();
      const nodeToComponent = new Map<string, string[]>();
      for (const n of p.nodes) {
        if (!visited.has(n.id)) {
          const comp: string[] = [];
          const queue = [n.id];
          visited.add(n.id);
          let head = 0;
          while (head < queue.length) {
            const curr = queue[head]!;
            head++;
            comp.push(curr);
            for (const neighbor of adj.get(curr) || []) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
              }
            }
          }
          comp.forEach(id => nodeToComponent.set(id, comp));
        }
      }

      const componentToSelected = new Map<string[], PedigreeNode[]>();
      selectedNodes.forEach(node => {
        const comp = nodeToComponent.get(node.id) || [node.id];
        if (!componentToSelected.has(comp)) componentToSelected.set(comp, []);
        componentToSelected.get(comp)!.push(node);
      });

      if (componentToSelected.size > 1) {
        const families = [...componentToSelected.keys()].map((comp) => {
          const compNodes = p.nodes.filter(n => comp.includes(n.id));
          const minVal = Math.min(...compNodes.map(n => n[axis]));
          const maxVal = Math.max(...compNodes.map(n => n[axis]));
          return {
            comp,
            minVal,
            maxVal,
            width: maxVal - minVal,
            center: (minVal + maxVal) / 2
          };
        });

        families.sort((a, b) => a.center - b.center);

        const m = families.length;
        if (m < 2) return p;

        const first = families[0]!;
        const last = families[m - 1]!;
        const totalWidth = last.maxVal - first.minVal;
        
        const sumSpans = families.reduce((sum, f) => sum + f.width, 0);
        const totalGapsSpace = totalWidth - sumSpans;
        const gap = totalGapsSpace / (m - 1);

        const newNodes = p.nodes.map(n => ({ ...n }));
        const newAnnotations = p.annotations?.map(a => ({ ...a })) || [];

        let prevTargetMax = first.maxVal;

        for (let i = 1; i < m - 1; i++) {
          const fam = families[i]!;
          const targetMin = prevTargetMax + gap;
          const delta = targetMin - fam.minVal;

          const compSet = new Set(fam.comp);
          newNodes.forEach(n => {
            if (compSet.has(n.id)) {
              n[axis] += delta;
            }
          });
          newAnnotations.forEach(a => {
            if (a.nodeId && compSet.has(a.nodeId)) {
              if (axis === "x" && a.x !== undefined) a.x += delta;
              if (axis === "y" && a.y !== undefined) a.y += delta;
            }
          });

          prevTargetMax = targetMin + fam.width;
        }

        return { ...p, nodes: newNodes, annotations: newAnnotations };
      } else {
        const adj = buildAdjacency(p.nodes, p.edges);
        const sortedNodes = [...selectedNodes].sort((a, b) => a[axis] - b[axis]);

        const tolerance = axis === "y" ? 60 : 50;
        const bands: PedigreeNode[][] = [];

        for (const n of sortedNodes) {
          let foundBand = false;
          for (const b of bands) {
            const representative = b[0]!;
            if (Math.abs(representative[axis] - n[axis]) < tolerance) {
              b.push(n);
              foundBand = true;
              break;
            }
          }
          if (!foundBand) {
            bands.push([n]);
          }
        }

        const m = bands.length;
        if (m < 3) return p;

        const firstBand = bands[0]!;
        const lastBand = bands[m - 1]!;

        const getBandCoord = (b: PedigreeNode[]) => b.reduce((sum, n) => sum + n[axis], 0) / b.length;

        const firstCoord = getBandCoord(firstBand);
        const lastCoord = getBandCoord(lastBand);
        const totalSpan = lastCoord - firstCoord;
        if (Math.abs(totalSpan) < 1) return p;

        const interval = totalSpan / (m - 1);
        const newNodes = p.nodes.map(n => ({ ...n }));
        const newAnnotations = p.annotations?.map(a => ({ ...a })) || [];

        for (let i = 0; i < m; i++) {
          const band = bands[i]!;
          const bandCoord = getBandCoord(band);
          const targetCoord = firstCoord + i * interval;
          const delta = targetCoord - bandCoord;

          const visited = new Set<string>();
          for (let j = 0; j < m; j++) {
            if (i !== j) {
              bands[j]!.forEach(node => visited.add(node.id));
            }
          }

          band.forEach(node => {
            const localVisited = new Set(visited);
            const subtree = collectSubtree(node.id, adj, localVisited, { anchorMarriedIn: true });

            for (const item of visited) {
              subtree.delete(item);
            }

            newNodes.forEach(n => {
              if (subtree.has(n.id)) {
                n[axis] += delta;
              }
            });
            newAnnotations.forEach(a => {
              if (a.nodeId && subtree.has(a.nodeId)) {
                if (axis === "x" && a.x !== undefined) a.x += delta;
                if (axis === "y" && a.y !== undefined) a.y += delta;
              }
            });
          });
        }

        return { ...p, nodes: newNodes, annotations: newAnnotations };
      }
    } });
  }, [stateRef, dispatch]);

  return { alignSelected, distributeSelected };
}
