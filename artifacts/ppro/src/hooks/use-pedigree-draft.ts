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
          let decrypted: string;
          let wasLegacyPlaintext = false;
          try {
            decrypted = await decryptDraft(raw);
          } catch {
            // Attempt backward-compatible migration of legacy plaintext draft
            const maybePlain = JSON.parse(raw);
            if (maybePlain && typeof maybePlain === "object" && (maybePlain.canvas || maybePlain.nodes)) {
              decrypted = raw;
              wasLegacyPlaintext = true;
            } else {
              throw new Error("Corrupted draft");
            }
          }

          const parsed = JSON.parse(decrypted) as { canvas?: CanvasData; nodes?: any[]; edges?: any[]; at?: number; timestamp?: number };
          const canvasObj = parsed.canvas ?? (parsed.nodes ? { nodes: parsed.nodes, edges: parsed.edges ?? [], annotations: [] } : null);
          const draftTime = parsed.at ?? parsed.timestamp ?? 0;
          const serverAt = new Date((pedigreeData as unknown as { updatedAt: string }).updatedAt).getTime();
          if (canvasObj && draftTime > serverAt + 3000 && (canvasObj.nodes?.length ?? 0) > 0) {
            const sanitized = parseCanvas(JSON.stringify(canvasObj));
            setDraftData(sanitized);
            setShowDraftBanner(true);
            if (wasLegacyPlaintext) {
              const enc = await encryptDraft(JSON.stringify({ canvas: sanitized, at: draftTime }));
              localStorage.setItem(draftKey, enc);
            }
            return;
          }
        }
      } catch (err) {
        console.warn("Draft check failed or legacy draft unreadable:", err);
      }
      draftEnabledRef.current = true;
    };
    
    checkDraft();
  }, [pedigreeData, draftKey]);

  // Background draft encryption and auto-save helper
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!draftEnabledRef.current || !canvasRef.current) return;
      try {
        const payload = JSON.stringify({ canvas: canvasRef.current, at: Date.now() });
        if (payload !== lastSerializedRef.current) {
          lastSerializedRef.current = payload;
          const enc = await encryptDraft(payload);
          encryptedDraftRef.current = enc;
          localStorage.setItem(draftKeyRef.current, enc);
        }
      } catch (err) {
        console.error("Auto-save draft failed:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [canvasRef, draftKeyRef]);

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
  }, [draftKeyRef]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKeyRef.current); } catch {}
    lastSerializedRef.current = "";
    encryptedDraftRef.current = "";
  }, [draftKeyRef]);

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
    clearDraft();
    setShowDraftBanner(false);
    setDraftData(null);
    draftEnabledRef.current = true;
  }, [clearDraft]);

  return {
    showDraftBanner,
    draftEnabledRef,
    clearDraft,
    handleRestoreDraft,
    handleDismissDraft,
  };
}
