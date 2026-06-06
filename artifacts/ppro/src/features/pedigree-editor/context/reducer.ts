import type { PedigreeEditorState, PedigreeEditorAction } from "./types";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

// Helper function to traverse and collect all ancestors of a node
function getAncestors(nodeId: string, edges: PedigreeEdge[]): Set<string> {
  const ancestors = new Set<string>();
  const queue = [nodeId];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    
    // Find parent-child edges where curr is the child
    for (const e of edges) {
      if (e.type === "parent-child" && e.targetId === curr) {
        ancestors.add(e.sourceId);
        queue.push(e.sourceId);
      }
    }
  }
  return ancestors;
}

export function autoDetectConsanguinity(nodes: PedigreeNode[], edges: PedigreeEdge[]): PedigreeEdge[] {
  return edges.map((edge) => {
    if (edge.type !== "couple" && edge.type !== "consanguinity") {
      return edge;
    }

    const ancestorsSource = getAncestors(edge.sourceId, edges);
    const ancestorsTarget = getAncestors(edge.targetId, edges);

    // Check for common ancestors
    let isConsanguineous = false;
    for (const anc of ancestorsSource) {
      if (ancestorsTarget.has(anc)) {
        isConsanguineous = true;
        break;
      }
    }

    const expectedType = isConsanguineous ? "consanguinity" : "couple";
    if (edge.type !== expectedType) {
      return { ...edge, type: expectedType };
    }
    return edge;
  });
}

export function pedigreeEditorReducer(
  state: PedigreeEditorState,
  action: PedigreeEditorAction,
): PedigreeEditorState {
  switch (action.type) {
    case "SET_STATE":
      return { ...state, ...action.patch };

    case "SET_CANVAS": {
      const canvas = { ...action.canvas };
      canvas.edges = autoDetectConsanguinity(canvas.nodes, canvas.edges);
      return { ...state, canvas };
    }

    case "UPDATE_CANVAS": {
      const prev = state.canvas;
      const next = action.updater(prev);
      const pushHistory = action.pushHistory !== false;
      
      const updatedEdges = autoDetectConsanguinity(next.nodes, next.edges);
      const nextWithConsanguinity = { ...next, edges: updatedEdges };

      return {
        ...state,
        canvas: nextWithConsanguinity,
        history: pushHistory ? [...state.history.slice(-49), prev] : state.history,
        future: pushHistory ? [] : state.future,
      };
    }

    case "UNDO": {
      if (!state.history.length) return state;
      const last = state.history[state.history.length - 1];
      if (!last) return state;
      return {
        ...state,
        canvas: last,
        history: state.history.slice(0, -1),
        future: [...state.future.slice(-49), state.canvas],
      };
    }

    case "REDO": {
      if (!state.future.length) return state;
      const last = state.future[state.future.length - 1];
      if (!last) return state;
      return {
        ...state,
        canvas: last,
        future: state.future.slice(0, -1),
        history: [...state.history.slice(-49), state.canvas],
      };
    }

    case "REMOVE_EDGES": {
      const removeSet = new Set(action.edgeIds);
      const newEdges = state.canvas.edges.filter((e) => !removeSet.has(e.id));
      const prev = state.canvas;
      const updatedEdges = autoDetectConsanguinity(state.canvas.nodes, newEdges);
      return {
        ...state,
        canvas: { ...state.canvas, edges: updatedEdges },
        history: [...state.history.slice(-49), prev],
        future: [],
      };
    }

    default:
      return state;
  }
}
