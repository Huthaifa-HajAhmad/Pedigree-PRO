import { useParams, Link, useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { useGetSharedPedigree, useImportShared } from "@workspace/api-client-react";
import { ReadOnlyCanvas } from "@/features/pedigree-editor/canvas/ReadOnlyCanvas";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";
import { ShieldAlert, KeyRound, Loader2, RefreshCw } from "lucide-react";

function parseCanvas(raw: string | null | undefined): CanvasData {
  if (!raw) return { nodes: [], edges: [], annotations: [] };
  try {
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.nodes)
      ? { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [], annotations: parsed.annotations ?? [] }
      : { nodes: [], edges: [], annotations: [] };
  } catch {
    return { nodes: [], edges: [], annotations: [] };
  }
}

function useAccessMode(): "view" | "edit" {
  try {
    const m = new URLSearchParams(window.location.search).get("access");
    return m === "edit" ? "edit" : "view";
  } catch {
    return "view";
  }
}

export default function PedigreeShare() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const accessMode = useAccessMode();
  const importMutation = useImportShared();
  const [importAttempted, setImportAttempted] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const { data: pedigree, isLoading, isError, refetch } = useGetSharedPedigree(token ?? "");

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
    refetch();
  }, [refetch]);

  const importAndEdit = useCallback(() => {
    if (importAttempted || importMutation.isPending) return false;
    setImportAttempted(true);
    importMutation.mutate(token ?? "", {
      onSuccess: (imported) => {
        const id = (imported as { id?: number }).id;
        if (id) navigate(`/pedigrees/${id}`);
      },
      onError: (err) => {
        setImportAttempted(false);
        console.error("[PedigreeShare] Failed to import:", err);
      },
    });
    return true;
  }, [token, navigate, importMutation, importAttempted]);

  useEffect(() => {
    if (
      accessMode === "edit" &&
      pedigree &&
      !isLoading &&
      !isError &&
      !pedigree.encrypted &&
      !pedigree.decryptError
    ) {
      importAndEdit();
    }
  }, [accessMode, pedigree, isLoading, isError, importAndEdit]);

  if (isLoading || (accessMode === "edit" && importMutation.isPending)) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh gap-3 bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <div className="text-primary tracking-widest text-sm font-mono">
          {importMutation.isPending ? "Importing pedigree into editor..." : "Loading..."}
        </div>
      </div>
    );
  }

  if (isError || !pedigree || pedigree.decryptError) {
    const errorMessage = pedigree?.decryptError
      ?? (isError ? "An unexpected error occurred while loading this share link." : "No data received.");

    const isEncrypted = pedigree?.encrypted ?? false;

    return (
      <div className="flex flex-col items-center justify-center h-dvh gap-4 bg-background px-6" key={retryKey}>
        {isEncrypted ? (
          <>
            <KeyRound className="w-12 h-12 text-primary/50" />
            <div className="text-3xl font-mono text-primary">🔐</div>
          </>
        ) : (
          <div className="text-5xl font-mono text-primary">404</div>
        )}
        <div className="text-muted-foreground text-sm font-mono text-center max-w-md">
          {errorMessage}
        </div>
        {isEncrypted && (
          <div className="flex items-start gap-2 px-3 py-2 rounded border border-primary/30 bg-primary/5 max-w-md">
            <ShieldAlert className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-primary/80">
              End-to-end encryption ensures only the intended recipient can view the data.
              The relay and sender's browser never expose plaintext.
            </p>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-4 py-2 rounded border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors font-mono"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
          <Link href="/">
            <button type="button" className="px-4 py-2 rounded border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors font-mono">
              ← Back to Pedigree PRO
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const canvas = parseCanvas(pedigree.canvas_data);

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-widest text-primary">PEDIGREE PRO</span>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-sm font-semibold">{pedigree.title}</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-mono border text-primary border-primary/25 bg-primary/10">
            READ-ONLY
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Shared {new Date(pedigree.updated_at).toLocaleDateString()}
        </div>
      </div>

      {/* Canvas — uses real canvas components for pixel-perfect fidelity */}
      <div className="flex-1 overflow-hidden relative bg-background"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}>
        {canvas.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground text-sm font-mono">No pedigree data in this canvas.</span>
          </div>
        ) : (
          <ReadOnlyCanvas canvas={canvas} />
        )}
      </div>

      {/* Notes footer */}
      {pedigree.notes && (
        <div className="px-5 py-3 border-t flex-shrink-0 bg-card">
          <span className="text-xs text-muted-foreground mr-2 uppercase tracking-widest">Notes:</span>
          <span className="text-xs text-foreground/70">{pedigree.notes}</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 px-5 py-2 border-t flex-shrink-0 bg-card">
        {[
          { shape: "square", label: "Male" },
          { shape: "circle", label: "Female" },
          { shape: "diamond", label: "Unknown" },
          { shape: "filled", label: "Affected" },
        ].map(({ shape, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="-7 -7 14 14">
              {shape === "square" && <rect x="-5" y="-5" width="10" height="10" fill="none" stroke="hsl(var(--foreground) / 0.45)" strokeWidth="1.2" rx="1" />}
              {shape === "circle" && <circle cx="0" cy="0" r="5" fill="none" stroke="hsl(var(--foreground) / 0.45)" strokeWidth="1.2" />}
              {shape === "diamond" && <polygon points="0,-5 5,0 0,5 -5,0" fill="none" stroke="hsl(var(--foreground) / 0.45)" strokeWidth="1.2" />}
              {shape === "filled" && <circle cx="0" cy="0" r="5" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth="1.2" />}
            </svg>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <span className="ml-auto text-xs text-muted-foreground opacity-50">
          View-only · Shared via Pedigree PRO
        </span>
      </div>
    </div>
  );
}
