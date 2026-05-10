import { Pin, PinOff, Users, MessageSquare, Plus, ShieldCheck, ChevronDown } from "lucide-react";
import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import type { InheritanceMode } from "@/lib/risk-calculator";
import { computeRisk } from "@/lib/risk-calculator";
import { AnnotationEditorPanel } from "@/features/pedigree-editor/panels/AnnotationEditorPanel";
import { RiskCalculatorPanel } from "@/features/pedigree-editor/panels/RiskCalculatorPanel";
import { CANVAS_PRIMARY } from "@/lib/canvas-theme";

export function PropertiesPanel({
  selectedIds, canvasNodes, canvasEdges, canvasAnnotations,
  selectedAnnotationId, riskMode, showRiskCalc,
  onShowRiskCalc, onRiskModeChange, onUpdateSelectedNode,
  onBulkUpdate, onDeleteSelected, onAddAnnotation,
  onUpdateAnnotation, onDeleteAnnotation, onSelectAnnotation,
  onAlignSelected,
}: {
  selectedIds: Set<string>;
  canvasNodes: PedigreeNode[];
  canvasEdges: PedigreeEdge[];
  canvasAnnotations: PedigreeAnnotation[];
  selectedAnnotationId: string | null;
  riskMode: InheritanceMode;
  showRiskCalc: boolean;
  onShowRiskCalc: (v: boolean) => void;
  onRiskModeChange: (m: InheritanceMode) => void;
  onUpdateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  onBulkUpdate: (updates: Partial<PedigreeNode>) => void;
  onDeleteSelected: () => void;
  onAddAnnotation: (nodeId: string) => void;
  onUpdateAnnotation: (annId: string, updates: Partial<PedigreeAnnotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
  onSelectAnnotation: (annId: string | null) => void;
  onAlignSelected: (axis: "x" | "y") => void;
}) {
  const singleSelected = selectedIds.size === 1 ? canvasNodes.find((n) => selectedIds.has(n.id)) ?? null : null;
  const getStatus = (node: PedigreeNode) => node.affected ? "affected" : node.carrier ? "carrier" : "unaffected";
  const applyStatus = (status: string) => {
    const upd = { affected: status === "affected", carrier: status === "carrier" };
    if (selectedIds.size === 1) onUpdateSelectedNode(upd);
    else onBulkUpdate(upd);
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-60 border-l border-border glass-panel overflow-y-auto z-30 shadow-xl">
      {/* ── Multi-select ────────────────────────────────────────────── */}
      {selectedIds.size > 1 ? (
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{selectedIds.size} Nodes</div>
              <div className="text-xs mt-0.5" style={{ color: CANVAS_PRIMARY }}>Multi-selected</div>
            </div>
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Bulk status */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Status (all)</label>
            <div className="grid grid-cols-3 gap-1">
              {(["unaffected", "affected", "carrier"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => applyStatus(s)}
                  className="py-1 rounded text-xs border border-border text-muted-foreground hover:border-primary hover:text-primary transition-all"
                >
                  {s === "unaffected" ? "—" : s === "affected" ? "Aff." : "Carr."}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk toggles: deceased / proband */}
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => onBulkUpdate({ deceased: true })} className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Mark Deceased</button>
            <button onClick={() => onBulkUpdate({ deceased: false })} className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Clear Deceased</button>
            <button onClick={() => onBulkUpdate({ proband: true })} className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Mark Proband</button>
            <button onClick={() => onBulkUpdate({ proband: false })} className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Clear Proband</button>
          </div>

          {/* Pin / Unpin all */}
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => onBulkUpdate({ pinned: true })} className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Pin All</button>
            <button onClick={() => onBulkUpdate({ pinned: false })} className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Unpin All</button>
          </div>

          {/* Alignment */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Align</label>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => onAlignSelected("y")} title="Snap all to same row" className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Horizontal</button>
              <button onClick={() => onAlignSelected("x")} title="Stack all in same column" className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Vertical</button>
            </div>
          </div>

          {/* Shared condition */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Condition (all)</label>
            <input
              placeholder="e.g. BRCA1, Lynch"
              className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onBulkUpdate({ condition: (e.target as HTMLInputElement).value });
                  (e.target as HTMLInputElement).value = "";
                }
              }}
            />
            <div className="text-xs text-muted-foreground mt-1 opacity-60">Press Enter to apply</div>
          </div>

          {/* Bulk delete */}
          <button data-testid="button-bulk-delete" onClick={onDeleteSelected}
            className="w-full py-1.5 text-xs border border-destructive/50 rounded text-destructive hover:bg-destructive/10 transition-colors">
            Delete {selectedIds.size} Nodes
          </button>
        </div>
      ) : singleSelected ? (
        /* ── Single-select ──────────────────────────────────────────── */
        <>
          <div className="p-4 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Node Properties</div>
            <div className="text-xs capitalize" style={{ color: CANVAS_PRIMARY }}>{singleSelected.type}</div>
          </div>
          <div className="p-4 space-y-4">
            {/* Pin status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {singleSelected.pinned ? (
                  <><Pin className="w-3 h-3" style={{ color: "#888" }} /> <span>Position pinned</span></>
                ) : (
                  <><PinOff className="w-3 h-3" /> <span>Not pinned</span></>
                )}
              </div>
              <button onClick={() => onUpdateSelectedNode({ pinned: !singleSelected.pinned })}
                className="text-xs px-2 py-1 rounded border border-border hover:border-primary transition-colors">
                {singleSelected.pinned ? "Unpin" : "Pin"}
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
              <input data-testid="input-node-label" value={singleSelected.label}
                onChange={(e) => onUpdateSelectedNode({ label: e.target.value })}
                placeholder="Label" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors" />
            </div>

            {/* Age */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Age</label>
              <input data-testid="input-node-age" value={singleSelected.age}
                onChange={(e) => onUpdateSelectedNode({ age: e.target.value })}
                placeholder="e.g. 42" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors" />
            </div>

            {/* Gender */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Gender</label>
              <div className="grid grid-cols-2 gap-1">
                {(["male", "female", "unknown", "pregnancy", "sab"] as const).map((t) => (
                  <button key={t} data-testid={`button-sex-${t}`} onClick={() => onUpdateSelectedNode({ type: t })}
                    className={`py-1 rounded text-xs border transition-all ${singleSelected.type === t ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"}`}>
                    {t === "sab" ? "SAB" : <span className="capitalize">{t}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
              <div className="grid grid-cols-3 gap-1">
                {(["unaffected", "affected", "carrier"] as const).map((s) => (
                  <button key={s} data-testid={`button-status-${s}`} onClick={() => applyStatus(s)}
                    className={`py-1 rounded text-xs border transition-all ${
                      getStatus(singleSelected) === s
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}>
                    {s === "unaffected" ? "—" : s === "affected" ? "Aff." : "Carr."}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles: deceased / proband */}
            <div className="space-y-2.5">
              {([
                { key: "deceased" as const, label: "Deceased" },
                { key: "proband" as const, label: "Proband" },
              ]).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">{label}</span>
                  <button data-testid={`toggle-${key}`} onClick={() => onUpdateSelectedNode({ [key]: !singleSelected[key] })}
                    className={`w-9 h-5 rounded-full border transition-all relative ${singleSelected[key] ? "border-primary" : "border-border"}`}
                    style={singleSelected[key] ? { background: CANVAS_PRIMARY } : { background: "hsl(var(--muted))" }}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform ${singleSelected[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </label>
              ))}
            </div>

            {/* Condition */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Condition / Gene</label>
              <input value={singleSelected.condition ?? ""} onChange={(e) => onUpdateSelectedNode({ condition: e.target.value })}
                placeholder="e.g. BRCA1, HD onset 48y" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors" />
            </div>

            {/* Clinical Notes */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Clinical Notes</label>
              <textarea value={singleSelected.notes ?? ""} onChange={(e) => onUpdateSelectedNode({ notes: e.target.value })}
                placeholder="Longer clinical observations…" rows={3} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors resize-none" />
            </div>

            {/* Risk Calculator */}
            <div>
              <button className="w-full flex items-center justify-between py-1 group" onClick={() => onShowRiskCalc(!showRiskCalc)}>
                <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1 cursor-pointer">
                  <ShieldCheck className="w-3 h-3" /> Risk Calculator
                </label>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showRiskCalc ? "rotate-180" : ""}`} />
              </button>
              {showRiskCalc && (
                <RiskCalculatorPanel
                  result={computeRisk(canvasNodes, canvasEdges, singleSelected.id, riskMode)}
                  mode={riskMode}
                  onModeChange={onRiskModeChange}
                />
              )}
            </div>

            {/* Annotations */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Annotations
                </label>
                <button onClick={() => onAddAnnotation(singleSelected.id)}
                  className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {canvasAnnotations.filter((a) => a.nodeId === singleSelected.id).length === 0 && (
                <p className="text-xs text-muted-foreground opacity-40 italic">No annotations</p>
              )}
              {canvasAnnotations
                .filter((a) => a.nodeId === singleSelected.id)
                .map((ann) => (
                  <AnnotationEditorPanel
                    key={ann.id}
                    annotation={ann}
                    isSelected={selectedAnnotationId === ann.id}
                    onSelect={() => onSelectAnnotation(selectedAnnotationId === ann.id ? null : ann.id)}
                    onUpdate={(updates) => onUpdateAnnotation(ann.id, updates)}
                    onDelete={() => onDeleteAnnotation(ann.id)}
                  />
                ))}
            </div>

            {/* Delete */}
            <button data-testid="button-delete-node" onClick={onDeleteSelected}
              className="w-full py-1.5 text-xs border border-destructive/50 rounded text-destructive hover:bg-destructive/10 transition-colors">
              Delete Node
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}