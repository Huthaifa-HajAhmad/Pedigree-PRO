import { useState, useRef, useEffect, useCallback } from "react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";
import { encryptDraft, decryptDraft } from "@workspace/browser-backend";
import { parseCanvas } from "@/features/pedigree-editor/utils/helpers";

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

  const lastSerializedRef = useRef<string>("");
  const encryptedDraftRef = useRef<string>("");

  // Keep draftKeyRef in sync
  useEffect(() => { draftKeyRef.current = `ppro_draft_${id}`; }, [id]);

  // Reset draft refs when navigating between pedigrees
  useEffect(() => {
    draftCheckedRef.current = false;
    draftEnabledRef.current = false;
    setShowDraftBanner(false);
    setDraftData(null);
    lastSerializedRef.current = "";
    encryptedDraftRef.current = "";
  }, [id]);

  // Check for a newer local draft on initial pedigree load
  useEffect(() => {
    if (!pedigreeData || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    
    const checkDraft = async () => {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const decrypted = await decryptDraft(raw);
          const parsed = JSON.parse(decrypted) as { canvas: CanvasData; at: number };
          const serverAt = new Date((pedigreeData as unknown as { updatedAt: string }).updatedAt).getTime();
          if (parsed.at > serverAt + 3000 && parsed.canvas?.nodes?.length > 0) {
            const sanitized = parseCanvas(JSON.stringify(parsed.canvas));
            setDraftData(sanitized);
            setShowDraftBanner(true);
            return;
          }
        }
      } catch {}
      draftEnabledRef.current = true;
    };
    
    checkDraft();
  }, [pedigreeData, draftKey]);

  // Background draft pre-encryption helper
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!draftEnabledRef.current || !canvasRef.current) return;
      try {
        const payload = JSON.stringify({ canvas: canvasRef.current, at: Date.now() });
        if (payload !== lastSerializedRef.current) {
          lastSerializedRef.current = payload;
          const enc = await encryptDraft(payload);
          encryptedDraftRef.current = enc;
        }
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Save encrypted draft to localStorage on page/tab close or unmount
  useEffect(() => {
    const handleUnload = () => {
      if (!draftEnabledRef.current || !encryptedDraftRef.current) return;
      try {
        localStorage.setItem(draftKeyRef.current, encryptedDraftRef.current);
      } catch {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      // Attempt final save on unmount
      if (draftEnabledRef.current && encryptedDraftRef.current) {
        try {
          localStorage.setItem(draftKeyRef.current, encryptedDraftRef.current);
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
