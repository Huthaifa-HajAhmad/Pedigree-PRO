import { useContext } from "react";
import { PedigreeEditorContext } from "./PedigreeEditorProvider";
import type { PedigreeEditorContextValue } from "./types";

export function usePedigreeEditor(): PedigreeEditorContextValue {
  const ctx = useContext(PedigreeEditorContext);
  if (!ctx) throw new Error("usePedigreeEditor must be used within a PedigreeEditorProvider");
  return ctx;
}
