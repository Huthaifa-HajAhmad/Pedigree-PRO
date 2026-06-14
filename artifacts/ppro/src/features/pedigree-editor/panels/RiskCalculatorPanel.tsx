import { TrendingUp } from "lucide-react";
import { useState, useMemo } from "react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { computeRisk, type InheritanceMode, type RiskResult } from "@/lib/risk-calculator";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";


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
    <div className="space-y-4">
      {/* Mode tabs - styled as a segmented control */}
      <div className="bg-muted/60 border border-border/60 rounded-lg p-1">
        <div className="grid grid-cols-4 gap-1">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => onModeChange(m.id)}
              title={m.title}
              className={`py-1.5 rounded-md text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                mode === m.id
                  ? "bg-card text-primary shadow-xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/25"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Risk entries - styled as cards */}
      <div className="space-y-2.5">
        {result.entries.map((e, i) => {
          const colors = TIER_COLORS[e.tier];
          return (
            <div key={`${e.label}-${i}`} className="bg-muted/30 border border-border/50 rounded-lg p-2.5">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium text-foreground leading-tight pr-2">{e.label}</span>
                <span className="text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded bg-background border border-border/50" style={{ color: colors.text }}>
                  {e.percent}
                </span>
              </div>
              <div className="h-2 rounded-full bg-border/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, e.value * 100)}%`, background: colors.bar }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Basis notes - styled as an info box */}
      <div className="bg-muted/40 border border-border/50 rounded-lg p-3 space-y-1.5">
        <div className="text-xs font-medium text-foreground mb-2">Risk Basis</div>
        {result.basis.map((b, i) => (
          <p key={`${b.substring(0, 24)}-${i}`} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
            <span className="text-primary mt-0.5">•</span>
            <span>{b}</span>
          </p>
        ))}
        <div className="pt-2 mt-2 border-t border-border/40">
          <p className="text-xs font-medium" style={{ color: confidenceColor }}>{confidenceLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function RiskPanelSidebar({
  canvas, mode, onModeChange, onClose, width,
}: {
  canvas: { nodes: PedigreeNode[]; edges: PedigreeEdge[] };
  mode: InheritanceMode;
  onModeChange: (m: InheritanceMode) => void;
  onClose: () => void;
  width?: string;
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

  const validNodes = canvas.nodes.filter((n) => n.type !== "sab" && n.type !== "pregnancy");

  return (
    <PanelShell title="Risk Calculator" icon={<TrendingUp className="w-4 h-4" />} onClose={onClose} width={width}>
      <PanelSection title="Inheritance Mode">
        <div className="grid grid-cols-4 gap-1">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => onModeChange(m.id)}
              title={m.title}
              className={`py-1 rounded-lg text-xs border transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                mode === m.id
                  ? "border-primary/60 text-primary bg-primary/5 hover:bg-primary/10"
                  : "border-border/80 text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Family Summary">
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { label: "Total",    value: summary.total,    color: undefined  },
            { label: "Affected", value: summary.affected, color: "hsl(var(--destructive))"  },
            { label: "Carriers", value: summary.carriers, color: "hsl(var(--warning))"  },
            { label: "Proband",  value: summary.proband,  color: "hsl(var(--primary))"       },
          ] as const).map(({ label, value, color }) => (
            <div key={label} className="border border-border/80 rounded-lg p-2 text-center bg-card/50">
              <div className="text-xl font-bold" style={{ color: color ?? "inherit" }}>{value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{label}</div>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Individual Risk">
        {validNodes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No individuals on canvas yet.</p>
        ) : (
          <>
            <select
              id="risk-individual-select"
              value={effectiveFocusId ?? ""}
              onChange={(e) => setFocusId(e.target.value || null)}
              className="w-full text-xs bg-background border border-border/80 rounded-lg px-2.5 py-1.5 mb-2 text-foreground outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 transition-all duration-200"
            >
              <option value="">— select individual —</option>
              {validNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label || n.type}{n.proband ? " (Proband)" : n.affected ? " (Aff)" : n.carrier ? " (Carrier)" : ""}
                </option>
              ))}
            </select>

            {focusResult && focusNode && (
              <RiskCalculatorPanel
                result={focusResult}
                mode={mode}
                onModeChange={onModeChange}
              />
            )}

            {!effectiveFocusId && (
              <p className="text-xs text-muted-foreground italic">Mark a proband or pick an individual above.</p>
            )}
          </>
        )}
      </PanelSection>

      {memberRisks.length > 0 && (
        <PanelSection title={`All Members (${mode})`}>
          <div className="space-y-1">
            {memberRisks.map(({ node, topEntry }) => (
              <button
                type="button"
                key={node.id}
                onClick={() => setFocusId(node.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left ${
                  node.id === effectiveFocusId
                    ? "border-primary/60 bg-primary/5 text-primary hover:bg-primary/10"
                    : "border-border/80 hover:border-muted-foreground/30 hover:bg-accent/20"
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
        </PanelSection>
      )}
    </PanelShell>
  );
}