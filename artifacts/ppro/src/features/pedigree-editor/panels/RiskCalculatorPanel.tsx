import { TrendingUp, AlertTriangle, Info } from "lucide-react";
import { useState, useMemo } from "react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { computeRisk, type InheritanceMode, type RiskResult } from "@/lib/risk-calculator";
import { calculateInbreeding } from "@/lib/inbreeding";
import { computeAutoLabels } from "@/lib/pedigree-labels";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { InbreedingInfoModal } from "../modals/InbreedingInfoModal";


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

export const CARRIER_RATES = [
  { label: "Generic Recessive (1/50)", value: 1 / 50 },
  { label: "Cystic Fibrosis (1/25)", value: 1 / 25 },
  { label: "Spinal Muscular Atrophy (1/40)", value: 1 / 40 },
  { label: "Sickle Cell Disease (1/12)", value: 1 / 12 },
  { label: "Custom Rate", value: -1 },
];

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
        
        {result.mathSteps && result.mathSteps.length > 0 && (
          <details className="pt-2 mt-2 border-t border-border/40">
            <summary className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground outline-none select-none">
              Calculation Math Steps
            </summary>
            <div className="mt-2 pl-2 border-l border-primary/30 space-y-1.5">
              {result.mathSteps.map((step, i) => (
                <p key={i} className="text-[11px] font-mono text-foreground/80 leading-normal bg-card/65 px-1.5 py-1 rounded border border-border/40">
                  {step}
                </p>
              ))}
            </div>
          </details>
        )}

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
  const [carrierRate, setCarrierRate] = useState<number>(1 / 50);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const proband = canvas.nodes.find((n) => n.proband);
  const effectiveFocusId = focusId ?? proband?.id ?? null;
  const focusNode = effectiveFocusId ? (canvas.nodes.find((n) => n.id === effectiveFocusId) ?? null) : null;

  const inbreedingCoefficients = useMemo(() => {
    return calculateInbreeding(canvas.nodes, canvas.edges);
  }, [canvas.nodes, canvas.edges]);

  const autoLabels = useMemo(() => {
    return computeAutoLabels(canvas.nodes, canvas.edges);
  }, [canvas.nodes, canvas.edges]);

  const getDisplayName = (n: PedigreeNode) => {
    const roman = autoLabels.get(n.id);
    const baseLabel = n.label || n.type;
    return roman ? `${roman} — ${baseLabel}` : baseLabel;
  };

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
    () => effectiveFocusId ? computeRisk(canvas.nodes, canvas.edges, effectiveFocusId, mode, carrierRate) : null,
    [canvas.nodes, canvas.edges, effectiveFocusId, mode, carrierRate],
  );

  const memberRisks = useMemo(() => (
    canvas.nodes
      .filter((n) => n.type !== "sab" && n.type !== "pregnancy")
      .map((n) => {
        const result = computeRisk(canvas.nodes, canvas.edges, n.id, mode, carrierRate);
        return { node: n, topEntry: result.entries[0] ?? null };
      })
      .sort((a, b) => (b.topEntry?.value ?? 0) - (a.topEntry?.value ?? 0))
  ), [canvas.nodes, canvas.edges, mode, carrierRate]);

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

      {mode === "AR" && (
        <PanelSection title="Carrier Settings">
          <div className="space-y-1.5">
            <label htmlFor="carrier-rate-select" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Population Carrier Rate
            </label>
            <select
              id="carrier-rate-select"
              value={CARRIER_RATES.some(r => Math.abs(r.value - carrierRate) < 0.0001) ? carrierRate : -1}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (val !== -1) {
                  setCarrierRate(val);
                } else {
                  setCarrierRate(1 / 100);
                }
              }}
              className="w-full text-xs bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-foreground outline-none hover:bg-accent/20 focus:border-muted-foreground/45 transition-all duration-200"
            >
              {CARRIER_RATES.map((r) => (
                <option key={r.label} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            {!CARRIER_RATES.slice(0, 4).some(r => Math.abs(r.value - carrierRate) < 0.0001) && (
              <div className="flex gap-2 items-center mt-1.5">
                <span className="text-xs text-muted-foreground flex-shrink-0">1 /</span>
                <input
                  id="custom-carrier-rate-input"
                  type="number"
                  min="2"
                  max="10000"
                  value={Math.round(1 / carrierRate)}
                  onChange={(e) => {
                    const denom = parseInt(e.target.value);
                    if (denom > 1) setCarrierRate(1 / denom);
                  }}
                  className="w-full text-xs bg-background border border-border/80 rounded-lg px-2.5 py-1 text-foreground outline-none focus:border-muted-foreground/45 transition-all duration-200"
                />
              </div>
            )}
          </div>
        </PanelSection>
      )}

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
                  {getDisplayName(n)}{n.proband ? " (Proband)" : n.affected ? " (Aff)" : n.carrier ? " (Carrier)" : ""}
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
                    {getDisplayName(node)}{node.proband ? " ★" : ""}
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

      {inbreedingCoefficients.length > 0 ? (
        <PanelSection
          title="Inbreeding Coefficients (F)"
          actions={
            <button
              type="button"
              aria-label="Coefficient of Inbreeding info"
              onClick={() => setInfoModalOpen(true)}
              className="text-muted-foreground hover:text-primary p-0.5 hover:bg-accent/40 rounded transition-colors mr-0.5"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          }
        >
          <div className="space-y-1.5">
            {inbreedingCoefficients.map((res) => (
              <div key={res.nodeId} className="flex justify-between items-center bg-card/50 border border-border/80 rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-medium text-foreground">
                  {getDisplayName(canvas.nodes.find(n => n.id === res.nodeId) || { id: res.nodeId, type: "unknown", label: res.label } as any)}
                </span>
                <span className="text-xs font-bold text-primary bg-background border border-border/50 px-1.5 py-0.5 rounded">
                  F = {(res.fValue * 100).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </PanelSection>
      ) : (
        <PanelSection
          title="Inbreeding Coefficients (F)"
          actions={
            <button
              type="button"
              aria-label="Coefficient of Inbreeding info"
              onClick={() => setInfoModalOpen(true)}
              className="text-muted-foreground hover:text-primary p-0.5 hover:bg-accent/40 rounded transition-colors mr-0.5"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          }
        >
          <p className="text-xs text-muted-foreground italic">No consanguinity detected (all individuals F = 0).</p>
        </PanelSection>
      )}

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-1 mt-4 mx-3 mb-2">
        <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Clinical Disclaimer
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed font-sans">
          This calculator uses simplified Mendelian models for educational and preliminary assessment purposes only. It is not a certified diagnostic tool and should not be used as a substitute for professional genetic counseling or clinical decision-making.
        </p>
      </div>

      <InbreedingInfoModal open={infoModalOpen} onOpenChange={setInfoModalOpen} />
    </PanelShell>
  );
}