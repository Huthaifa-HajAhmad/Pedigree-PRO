import { TrendingUp, X } from "lucide-react";
import { useState, useMemo } from "react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { computeRisk, type InheritanceMode, type RiskResult } from "@/lib/risk-calculator";


export const MODES: { id: InheritanceMode; label: string; title: string }[] = [
  { id: "AD",  label: "AD",  title: "Autosomal Dominant"   },
  { id: "AR",  label: "AR",  title: "Autosomal Recessive"  },
  { id: "XLR", label: "XLR", title: "X-Linked Recessive"   },
  { id: "XLD", label: "XLD", title: "X-Linked Dominant"    },
];

export const TIER_COLORS = {
  low:      { bar: "hsl(var(--primary))", text: "hsl(var(--primary))" },
  moderate: { bar: "hsl(var(--warning))", text: "hsl(var(--warning))" },
  high:     { bar: "hsl(var(--destructive))", text: "hsl(var(--destructive))" },
};

export function RiskCalculatorPanel({
  result, mode, onModeChange,
}: {
  result: RiskResult;
  mode: InheritanceMode;
  onModeChange: (m: InheritanceMode) => void;
}) {
  const confidenceLabel = result.confidence === "strong" ? "● verified" : result.confidence === "inferred" ? "◐ inferred" : "○ assumed";
  const confidenceColor = result.confidence === "strong" ? "hsl(var(--primary))" : result.confidence === "inferred" ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))"

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="grid grid-cols-4 gap-1">
        {MODES.map((m) => (
          <button
            type="button"
            key={m.id}
            onClick={() => onModeChange(m.id)}
            title={m.title}
            className={`py-0.5 rounded text-xs border transition-all ${
              mode === m.id
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:border-primary"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Risk entries */}
      <div className="space-y-2">
        {result.entries.map((e, i) => {
          const colors = TIER_COLORS[e.tier];
          return (
            <div key={`${e.label}-${i}`}>
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="text-xs text-muted-foreground leading-tight pr-2">{e.label}</span>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: colors.text }}>
                  {e.percent}
                </span>
              </div>
              <div className="h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, e.value * 100)}%`, background: colors.bar }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Basis notes */}
      <div className="border border-border/50 rounded p-2 space-y-1">
        {result.basis.map((b, i) => (
          <p key={`${b.substring(0, 24)}-${i}`} className="text-xs text-muted-foreground leading-snug">{b}</p>
        ))}
        <p className="text-xs mt-1" style={{ color: confidenceColor }}>{confidenceLabel}</p>
      </div>
    </div>
  );
}

export function RiskPanelSidebar({
  canvas, mode, onModeChange, onClose,
}: {
  canvas: { nodes: PedigreeNode[]; edges: PedigreeEdge[] };
  mode: InheritanceMode;
  onModeChange: (m: InheritanceMode) => void;
  onClose: () => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);

  const proband = canvas.nodes.find((n) => n.proband);
  const effectiveFocusId = focusId ?? proband?.id ?? null;
  const focusNode = effectiveFocusId ? (canvas.nodes.find((n) => n.id === effectiveFocusId) ?? null) : null;

  const summary = useMemo(() => {
    const valid = canvas.nodes.filter((n) => n.type !== "sab" && n.type !== "pregnancy");
    return {
      total: valid.length,
      affected: valid.filter((n) => n.affected).length,
      carriers: valid.filter((n) => n.carrier && !n.affected).length,
      proband: valid.filter((n) => n.proband).length,
    };
  }, [canvas.nodes]);

  const focusResult = useMemo(
    () => effectiveFocusId ? computeRisk(canvas.nodes, canvas.edges, effectiveFocusId, mode) : null,
    [canvas.nodes, canvas.edges, effectiveFocusId, mode],
  );

  const memberRisks = useMemo(() => (
    canvas.nodes
      .filter((n) => n.type !== "sab" && n.type !== "pregnancy")
      .map((n) => {
        const result = computeRisk(canvas.nodes, canvas.edges, n.id, mode);
        return { node: n, topEntry: result.entries[0] ?? null };
      })
      .sort((a, b) => (b.topEntry?.value ?? 0) - (a.topEntry?.value ?? 0))
  ), [canvas.nodes, canvas.edges, mode]);

  const confidenceColor = focusResult?.confidence === "strong" ? "hsl(var(--primary))"
    : focusResult?.confidence === "inferred" ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))"
  const confidenceLabel = focusResult?.confidence === "strong" ? "● verified"
    : focusResult?.confidence === "inferred" ? "◐ inferred" : "○ assumed";

  const validNodes = canvas.nodes.filter((n) => n.type !== "sab" && n.type !== "pregnancy");

  return (
    <div className="w-64 border-l border-border glass-panel flex flex-col flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk Calculator</span>
        </div>
        <button type="button" aria-label="Close risk calculator" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Mode tabs */}
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Inheritance Mode</div>
          <div className="grid grid-cols-4 gap-1">
            {MODES.map((m) => (
              <button type="button" key={m.id} onClick={() => onModeChange(m.id)} title={m.title}
                className={`py-1 rounded text-xs border transition-all ${
                  mode === m.id ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Family Summary */}
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Family Summary</div>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { label: "Total",    value: summary.total,    color: undefined  },
              { label: "Affected", value: summary.affected, color: "hsl(var(--destructive))"  },
              { label: "Carriers", value: summary.carriers, color: "hsl(var(--warning))"  },
              { label: "Proband",  value: summary.proband,  color: "hsl(var(--primary))"       },
            ] as const).map(({ label, value, color }) => (
              <div key={label} className="border border-border rounded p-2 text-center">
                <div className="text-xl font-bold" style={{ color: color ?? "inherit" }}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Individual focus */}
        <div>
          <label htmlFor="risk-individual-select" className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Individual Risk</label>
          {validNodes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No individuals on canvas yet.</p>
          ) : (
            <>
              <select
                id="risk-individual-select"
                value={effectiveFocusId ?? ""}
                onChange={(e) => setFocusId(e.target.value || null)}
                className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 mb-2 text-foreground"
              >
                <option value="">— select individual —</option>
                {validNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label || n.type}{n.proband ? " (Proband)" : n.affected ? " (Aff)" : n.carrier ? " (Carrier)" : ""}
                  </option>
                ))}
              </select>

              {focusResult && focusNode && (
                <div className="space-y-2">
                  <div className="text-xs font-medium">
                    {focusNode.label || focusNode.type}
                    {focusNode.proband && <span className="ml-1" style={{ color: "hsl(var(--primary))" }}>★ proband</span>}
                  </div>
                  {focusResult.entries.map((e, i) => {
                    const colors = TIER_COLORS[e.tier];
                    return (
                      <div key={`${e.label}-${i}`}>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="text-xs text-muted-foreground leading-tight pr-2">{e.label}</span>
                          <span className="text-xs font-semibold flex-shrink-0" style={{ color: colors.text }}>{e.percent}</span>
                        </div>
                        <div className="h-1 rounded-full bg-border overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, e.value * 100)}%`, background: colors.bar }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="border border-border/50 rounded p-2 space-y-1">
                    {focusResult.basis.map((b, i) => (
                      <p key={`${b.substring(0, 24)}-${i}`} className="text-xs text-muted-foreground leading-snug">{b}</p>
                    ))}
                    <p className="text-xs mt-1" style={{ color: confidenceColor }}>{confidenceLabel}</p>
                  </div>
                </div>
              )}

              {!effectiveFocusId && (
                <p className="text-xs text-muted-foreground italic">Mark a proband or pick an individual above.</p>
              )}
            </>
          )}
        </div>

        {/* All-members risk table */}
        {memberRisks.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
              All Members <span className="text-primary/70">({mode})</span>
            </div>
            <div className="space-y-1">
              {memberRisks.map(({ node, topEntry }) => (
                <button type="button" key={node.id} onClick={() => setFocusId(node.id)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded border transition-colors text-left ${
                    node.id === effectiveFocusId ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs text-foreground truncate">
                      {node.label || node.type}{node.proband ? " ★" : ""}
                    </div>
                    {(node.affected || node.carrier) && (
                      <div className="text-xs" style={{ color: node.affected ? "hsl(var(--destructive))" : "hsl(var(--warning))" }}>
                        {node.affected ? "affected" : "carrier"}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold flex-shrink-0 ml-2"
                    style={{ color: topEntry ? TIER_COLORS[topEntry.tier].text : "hsl(var(--muted-foreground))" }}>
                    {topEntry?.percent ?? "—"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}