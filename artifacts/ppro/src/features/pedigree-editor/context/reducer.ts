import type { PedigreeEditorState, PedigreeEditorAction } from "./types";

export function pedigreeEditorReducer(
  state: PedigreeEditorState,
  action: PedigreeEditorAction,
): PedigreeEditorState {
  switch (action.type) {
    case "SET_STATE":
      return { ...state, ...action.patch };

    case "SET_CANVAS":
      return { ...state, canvas: action.canvas };

    case "UPDATE_CANVAS": {
      const prev = state.canvas;
      const next = action.updater(prev);
      const pushHistory = action.pushHistory !== false;
      return {
        ...state,
        canvas: next,
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

    default:
      return state;
  }
}
