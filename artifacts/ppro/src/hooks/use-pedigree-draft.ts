import { useState, useRef, useEffect, useCallback } from "react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";

export interface UsePedigreeDraftParams {
  id: number;
  pedigreeData: unknown;
  canvasRef: React.RefObject<CanvasData | null>;
  draftKeyRef: React.MutableRefObject<string>;
}

export function usePedigreeDraft({ id, pedigreeData, canvasRef, draftKeyRef }: UsePedigreeDraftParams) {
  const draftKey = `ppro_draft_${id}`;
  const draftCheckedRef = useRef(false);
  const draftEnabledRef = useRef(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftData, setDraftData] = useState<CanvasData | null>(null);

  // Keep draftKeyRef in sync
  useEffect(() => { draftKeyRef.current = `ppro_draft_${id}`; }, [id]);

  // Reset draft refs when navigating between pedigrees
  useEffect(() => {
    draftCheckedRef.current = false;
    draftEnabledRef.current = false;
    setShowDraftBanner(false);
    setDraftData(null);
  }, [id]);

  // Check for a newer local draft on initial pedigree load
  useEffect(() => {
    if (!pedigreeData || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { canvas: CanvasData; at: number };
        const serverAt = new Date((pedigreeData as unknown as { updatedAt: string }).updatedAt).getTime();
        if (parsed.at > serverAt + 3000 && parsed.canvas?.nodes?.length > 0) {
          setDraftData(parsed.canvas);
          setShowDraftBanner(true);
          return;
        }
      }
    } catch {}
    draftEnabledRef.current = true;
  }, [pedigreeData, draftKey]);

  // Save draft to localStorage on page/tab close
  useEffect(() => {
    const handleUnload = () => {
      if (!draftEnabledRef.current) return;
      try {
        localStorage.setItem(draftKeyRef.current, JSON.stringify({ canvas: canvasRef.current, at: Date.now() }));
      } catch {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      // Attempt final save on unmount
      if (draftEnabledRef.current && canvasRef.current) {
        try {
          localStorage.setItem(draftKeyRef.current, JSON.stringify({ canvas: canvasRef.current, at: Date.now() }));
        } catch {}
      }
    };
  }, []);

  const handleRestoreDraft = useCallback((setCanvas: (c: CanvasData) => void, setHistory: (h: CanvasData[]) => void, setFuture: (f: CanvasData[]) => void) => {
    if (draftData) {
      setCanvas(draftData);
      setHistory([]);
      setFuture([]);
    }
    setShowDraftBanner(false);
    setDraftData(null);
    draftEnabledRef.current = true;
  }, [draftData]);

  const handleDismissDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey); } catch {}
    setShowDraftBanner(false);
    setDraftData(null);
    draftEnabledRef.current = true;
  }, [draftKey]);

  return {
    showDraftBanner,
    draftEnabledRef,
    handleRestoreDraft,
    handleDismissDraft,
  };
}
