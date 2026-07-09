import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

export interface InbreedingResult {
  nodeId: string;
  label: string;
  fValue: number;
}

export function calculateInbreeding(nodes: PedigreeNode[], edges: PedigreeEdge[]): InbreedingResult[] {
  const parentsMap = new Map<string, string[]>();
  for (const n of nodes) {
    parentsMap.set(n.id, []);
  }

  for (const e of edges) {
    if (e.type === "parent-child") {
      const parents = parentsMap.get(e.targetId);
      if (parents && !parents.includes(e.sourceId)) {
        parents.push(e.sourceId);
      }
    }
  }

  // Topological Sort
  const inDegree = new Map<string, number>();
  const childrenMap = new Map<string, string[]>();
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    childrenMap.set(n.id, []);
  }

  for (const n of nodes) {
    const parents = parentsMap.get(n.id) ?? [];
    inDegree.set(n.id, parents.length);
    for (const p of parents) {
      if (!childrenMap.has(p)) childrenMap.set(p, []);
      childrenMap.get(p)!.push(n.id);
    }
  }

  const topoQueue: string[] = [];
  for (const n of nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) {
      topoQueue.push(n.id);
    }
  }

  let head = 0;
  const sortedNodeIds: string[] = [];
  while (head < topoQueue.length) {
    const curr = topoQueue[head++]!;
    sortedNodeIds.push(curr);
    const children = childrenMap.get(curr) ?? [];
    for (const c of children) {
      const d = (inDegree.get(c) ?? 0) - 1;
      inDegree.set(c, d);
      if (d === 0) {
        topoQueue.push(c);
      }
    }
  }

  // Handle remaining nodes in case of cycles
  const remaining = nodes.filter(n => !sortedNodeIds.includes(n.id)).map(n => n.id);
  sortedNodeIds.push(...remaining);

  const fValues = new Map<string, number>();
  for (const id of sortedNodeIds) {
    fValues.set(id, 0);
  }

  function getAncestors(startId: string): Set<string> {
    const ancestors = new Set<string>();
    const queue = [startId];
    let qHead = 0;
    while (qHead < queue.length) {
      const curr = queue[qHead++]!;
      const parents = parentsMap.get(curr) ?? [];
      for (const p of parents) {
        if (!ancestors.has(p)) {
          ancestors.add(p);
          queue.push(p);
        }
      }
    }
    return ancestors;
  }

  function getPathsToAncestor(startId: string, targetId: string): string[][] {
    const allPaths: string[][] = [];
    function findPaths(current: string, path: string[]) {
      if (current === targetId) {
        allPaths.push([...path]);
        return;
      }
      const parents = parentsMap.get(current) ?? [];
      for (const p of parents) {
        if (!path.includes(p)) {
          path.push(p);
          findPaths(p, path);
          path.pop();
        }
      }
    }
    findPaths(startId, [startId]);
    return allPaths;
  }

  const results: InbreedingResult[] = [];

  for (const nodeId of sortedNodeIds) {
    const parents = parentsMap.get(nodeId) ?? [];
    if (parents.length < 2) {
      fValues.set(nodeId, 0);
      continue;
    }

    // Wright's Path Method
    // Parents of nodeId
    const p1 = parents[0]!;
    const p2 = parents[1]!;

    // Ancestors of parents
    const ancestors1 = getAncestors(p1);
    ancestors1.add(p1); // Parent itself can be ancestor (e.g. incest)
    const ancestors2 = getAncestors(p2);
    ancestors2.add(p2);

    const commonAncestors = new Set<string>();
    for (const a of ancestors1) {
      if (ancestors2.has(a)) {
        commonAncestors.add(a);
      }
    }

    let fSum = 0;
    for (const ancestor of commonAncestors) {
      const paths1 = getPathsToAncestor(p1, ancestor);
      const paths2 = getPathsToAncestor(p2, ancestor);
      const fA = fValues.get(ancestor) ?? 0;

      for (const path1 of paths1) {
        for (const path2 of paths2) {
          // Check disjointness: they must only share the common ancestor
          let disjoint = true;
          for (const node of path1) {
            if (node !== ancestor && path2.includes(node)) {
              disjoint = false;
              break;
            }
          }

          if (disjoint) {
            const n1 = path1.length - 1;
            const n2 = path2.length - 1;
            fSum += Math.pow(0.5, n1 + n2 + 1) * (1 + fA);
          }
        }
      }
    }

    fValues.set(nodeId, fSum);

    if (fSum > 0) {
      const nodeObj = nodes.find(n => n.id === nodeId);
      results.push({
        nodeId,
        label: nodeObj?.label || nodeId,
        fValue: fSum
      });
    }
  }

  return results;
}
