import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

export interface UsePedigreeKeyboardParams {
  deleteSelected: () => void;
  deleteAnnotation: ((aid: string) => void) | null;
  selectedAnnotationId: string | null;
  addNode: (type: PedigreeNode["type"]) => void;
  addContextNode: (rel: "child" | "partner" | "sibling" | "parents") => void;
  undo: () => void;
  redo: () => void;
  navigateArrow: (dir: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => void;
  showSearch: boolean;
  fitToScreen: () => void;
  runAutoLayout: (respectPinned: boolean) => void;
  setShowSearch: Dispatch<SetStateAction<boolean>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setLinkMode: Dispatch<SetStateAction<"couple" | "parent-child" | "consanguinity" | null>>;
  setLinkSource: Dispatch<SetStateAction<string | null>>;
  setSelectedAnnotationId: Dispatch<SetStateAction<string | null>>;
  setViewBox: Dispatch<SetStateAction<{ x: number; y: number; zoom: number }>>;
  spaceHeldRef: React.MutableRefObject<boolean>;
  setSpaceHeld: Dispatch<SetStateAction<boolean>>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  twinSelectMode: boolean;
  setTwinSelectMode: Dispatch<SetStateAction<boolean>>;
  clearTwinCandidates: () => void;
  updateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  selectedNode: PedigreeNode | null;
  selectedIds: Set<string>;
  canvasNodes: PedigreeNode[];
  createCoupleAndChild: (idA: string, idB: string) => void;
  W: number;
  H: number;
}

export function usePedigreeKeyboard(params: UsePedigreeKeyboardParams) {
  const kbRef = useRef(params);
  kbRef.current = params;

  const searchFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupSearchFocusTimeout = () => {
    if (searchFocusTimeoutRef.current !== null) {
      clearTimeout(searchFocusTimeoutRef.current);
      searchFocusTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as Element;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLSelectElement || (document.activeElement as HTMLElement)?.isContentEditable) return;
      const k = kbRef.current;

      if (e.code === "Space") { e.preventDefault(); k.spaceHeldRef.current = true; k.setSpaceHeld(true); return; }

      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); k.undo(); return; }
        if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); k.redo(); return; }
        if (e.key === "=" || e.key === "+") { e.preventDefault(); k.setViewBox((v) => ({ ...v, zoom: Math.max(0.25, v.zoom * 0.85) })); return; }
        if (e.key === "-" || e.key === "_") { e.preventDefault(); k.setViewBox((v) => ({ ...v, zoom: Math.min(4, v.zoom * 1.18) })); return; }
        if (e.key === "0") { e.preventDefault(); k.fitToScreen(); return; }
        if (e.key === "f") {
          e.preventDefault();
          k.setShowSearch(true);
          cleanupSearchFocusTimeout();
          searchFocusTimeoutRef.current = setTimeout(() => k.searchInputRef.current?.focus(), 30);
          return;
        }
        return;
      }

      if (e.key === "Escape") {
        if (k.showSearch) { k.setShowSearch(false); k.setSearchQuery(""); return; }
        if (k.twinSelectMode) { k.setTwinSelectMode(false); k.clearTwinCandidates(); return; }
        k.setSelectedIds(new Set()); k.setLinkMode(null); k.setLinkSource(null); k.setSelectedAnnotationId(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (k.selectedAnnotationId && k.deleteAnnotation) {
          k.deleteAnnotation(k.selectedAnnotationId);
        } else {
          k.deleteSelected();
        }
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        k.navigateArrow(e.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight");
        return;
      }
      // Numpad gestures
      if (e.code === "NumpadAdd" || (e.code === "Equal" && !e.shiftKey)) { e.preventDefault(); k.setViewBox((v) => ({ ...v, zoom: Math.max(0.25, v.zoom * 0.85) })); return; }
      if (e.code === "NumpadSubtract" || e.code === "Minus") { e.preventDefault(); k.setViewBox((v) => ({ ...v, zoom: Math.min(4, v.zoom * 1.18) })); return; }
      if (e.code === "NumpadMultiply") { e.preventDefault(); k.setViewBox((v) => ({ ...v, zoom: Math.max(0.25, v.zoom * 0.6) })); return; }
      if (e.code === "NumpadDivide") { e.preventDefault(); k.setViewBox((v) => ({ ...v, zoom: Math.min(4, v.zoom * 1.67) })); return; }
      if (e.code === "Numpad0" || e.code === "Numpad5") { e.preventDefault(); k.fitToScreen(); return; }
      if (e.code.startsWith("Numpad")) {
        e.preventDefault();
        k.setViewBox((v) => {
          const pan = k.W * v.zoom * 0.12;
          const dirs: Record<string, [number, number]> = { Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1] };
          const d = dirs[e.code]; if (!d) return v;
          return { ...v, x: v.x + d[0] * pan, y: v.y + d[1] * pan };
        });
        return;
      }
      if (e.altKey) return;
      if (e.key === "l" || e.key === "L") { k.runAutoLayout(true); return; }
if (e.key === "c" || e.key === "C") {
        if (k.selectedIds.size === 2) {
          const ids = [...k.selectedIds];
          const nA = k.canvasNodes.find(n => n.id === ids[0]);
          const nB = k.canvasNodes.find(n => n.id === ids[1]);
          if (nA && nB && ((nA.type === "male" && nB.type === "female") || (nA.type === "female" && nB.type === "male"))) {
            const maleId = nA.type === "male" ? nA.id : nB.id;
            const femaleId = nA.type === "female" ? nA.id : nB.id;
            k.createCoupleAndChild(maleId, femaleId);
            return;
          }
        }
        k.addContextNode("child");
        return;
      }
      if (e.key === "r" || e.key === "R") { k.addContextNode("partner"); return; }
      if (e.key === "b" || e.key === "B") { k.addContextNode("sibling"); return; }
      if (e.key === "m" || e.key === "M") {
        if (k.selectedNode) { k.updateSelectedNode({ type: "male" }); return; }
        k.addNode("male");
        return;
      }
      if (e.key === "f" || e.key === "F") {
        if (k.selectedNode) { k.updateSelectedNode({ type: "female" }); return; }
        k.addNode("female");
        return;
      }
      if (e.key === "u" || e.key === "U") {
        if (k.selectedNode) { k.updateSelectedNode({ type: "unknown" }); return; }
        k.addNode("unknown");
        return;
      }
      if (e.key === "p" || e.key === "P") { k.addNode("pregnancy"); return; }
      if (e.key === "k" || e.key === "K") { k.setLinkMode((prev) => (prev === "consanguinity" ? null : "consanguinity")); k.setLinkSource(null); return; }
      if (e.key === "s" || e.key === "S") { k.addNode("sab"); return; }
    };

    const upHandler = (e: KeyboardEvent) => {
      if (e.code === "Space") { kbRef.current.spaceHeldRef.current = false; kbRef.current.setSpaceHeld(false); }
    };

    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", upHandler);

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", upHandler);
      cleanupSearchFocusTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}