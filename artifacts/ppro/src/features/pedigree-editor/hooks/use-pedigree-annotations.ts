import { useCallback } from "react";
import type { PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { getDefaultAnnotationColor } from "@/lib/theme";
import { getModuleCanvasConfig } from "../context/CanvasConfigContext";
import type { PedigreeEditorAction } from "../context/types";

export function usePedigreeAnnotations(
  dispatch: (action: PedigreeEditorAction) => void
) {
  const addAnnotation = useCallback((nid: string) => {
    const cfg = getModuleCanvasConfig?.() ?? { annFontSize: 12, annDefaultPos: "below" as const };
    const position = cfg.annDefaultPos as PedigreeAnnotation["position"];
    const a: PedigreeAnnotation = {
      id: `a${Date.now()}`,
      nodeId: nid,
      text: "Note",
      color: getDefaultAnnotationColor(),
      fontSize: cfg.annFontSize ?? 12,
      position,
    };
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, annotations: [...p.annotations, a] }) });
    dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: a.id, editAnnotationId: a.id } });
  }, [dispatch]);

  const addFreeAnnotation = useCallback((x: number, y: number) => {
    const cfg = getModuleCanvasConfig?.() ?? { annFontSize: 12 };
    const a: PedigreeAnnotation = {
      id: `a${Date.now()}`,
      nodeId: "",
      text: "Text Note",
      color: getDefaultAnnotationColor(),
      fontSize: cfg.annFontSize ?? 12,
      position: "below",
      x,
      y,
    };
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, annotations: [...p.annotations, a] }) });
    dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: a.id, selectedIds: new Set(), editAnnotationId: a.id } });
  }, [dispatch]);

  const updateAnnotation = useCallback((aid: string, u: Partial<PedigreeAnnotation>) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, annotations: p.annotations.map((a) => a.id === aid ? { ...a, ...u } : a) }) });
  }, [dispatch]);

  const deleteAnnotation = useCallback((aid: string) => {
    dispatch({ type: "UPDATE_CANVAS", updater: (p) => ({ ...p, annotations: p.annotations.filter((a) => a.id !== aid) }) });
    dispatch({ type: "SET_STATE", patch: { selectedAnnotationId: null, editAnnotationId: null } });
  }, [dispatch]);

  return { addAnnotation, addFreeAnnotation, updateAnnotation, deleteAnnotation };
}
