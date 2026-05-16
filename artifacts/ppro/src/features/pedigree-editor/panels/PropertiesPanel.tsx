import { Pin, PinOff, Users, MessageSquare, Plus, ShieldCheck, ChevronDown, User, Dna, Flag, Stethoscope, Trash2, LayoutGrid } from "lucide-react";
import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import type { InheritanceMode } from "@/lib/risk-calculator";
import { computeRisk } from "@/lib/risk-calculator";
import { AnnotationEditorPanel } from "@/features/pedigree-editor/panels/AnnotationEditorPanel";
import { RiskCalculatorPanel } from "@/features/pedigree-editor/panels/RiskCalculatorPanel";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";

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
    <div className="absolute right-0 top-0 bottom-0 z-30 shadow-xl">
      {selectedIds.size > 1 ? (
        <PanelShell title={`${selectedIds.size} Nodes`} icon={<Users className="w-3.5 h-3.5" />} width="w-full md:w-60">
          {/* Bulk Status */}
          <PanelSection title="Bulk Status" icon={<Dna className="w-3 h-3" />}>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Status (all)</label>
              <div className="grid grid-cols-3 gap-1">
                {(["unaffected", "affected", "carrier"] as const).map((s) => (
                  <button type="button" key={s} onClick={() => applyStatus(s)}
                    className="py-1 rounded text-xs border border-border text-muted-foreground hover:border-primary hover:text-primary transition-all">
                    {s === "unaffected" ? "—" : s === "affected" ? "Aff." : "Carr."}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => onBulkUpdate({ deceased: true })}
                className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Mark Deceased</button>
              <button type="button" onClick={() => onBulkUpdate({ deceased: false })}
                className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Clear Deceased</button>
              <button type="button" onClick={() => onBulkUpdate({ proband: true })}
                className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Mark Proband</button>
              <button type="button" onClick={() => onBulkUpdate({ proband: false })}
                className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Clear Proband</button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => onBulkUpdate({ pinned: true })}
                className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Pin All</button>
              <button type="button" onClick={() => onBulkUpdate({ pinned: false })}
                className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Unpin All</button>
            </div>
          </PanelSection>

          {/* Alignment */}
          <PanelSection title="Align" icon={<LayoutGrid className="w-3 h-3" />}>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => onAlignSelected("y")} title="Snap all to same row"
                className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Horizontal</button>
              <button type="button" onClick={() => onAlignSelected("x")} title="Stack all in same column"
                className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">Vertical</button>
            </div>
          </PanelSection>

          {/* Shared condition */}
          <PanelSection title="Condition (all)">
            <input id="bulk-condition" placeholder="e.g. BRCA1, Lynch"
              className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onBulkUpdate({ condition: (e.target as HTMLInputElement).value });
                  (e.target as HTMLInputElement).value = "";
                }
              }} />
            <div className="text-xs text-muted-foreground mt-1 opacity-60">Press Enter to apply</div>
          </PanelSection>

          {/* Bulk delete */}
          <button type="button" data-testid="button-bulk-delete" onClick={onDeleteSelected}
            className="w-full py-1.5 text-xs border border-destructive/50 rounded text-destructive hover:bg-destructive/10 transition-colors">
            Delete {selectedIds.size} Nodes
          </button>
        </PanelShell>
      ) : singleSelected ? (
        <PanelShell title={`${singleSelected.type}`} icon={<User className="w-3.5 h-3.5" />} width="w-full md:w-60">
          {/* Basic Info */}
          <PanelSection title="Basic Info" icon={<User className="w-3 h-3" />}>
            <div>
              <label htmlFor="prop-node-label" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
              <input id="prop-node-label" data-testid="input-node-label" value={singleSelected.label}
                onChange={(e) => onUpdateSelectedNode({ label: e.target.value })}
                placeholder="Label" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label htmlFor="prop-node-age" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Age</label>
              <input id="prop-node-age" data-testid="input-node-age" value={singleSelected.age}
                onChange={(e) => onUpdateSelectedNode({ age: e.target.value })}
                placeholder="e.g. 42" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label htmlFor="prop-node-condition" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Condition / Gene</label>
              <input id="prop-node-condition" value={singleSelected.condition ?? ""}
                onChange={(e) => onUpdateSelectedNode({ condition: e.target.value })}
                placeholder="e.g. BRCA1, HD onset 48y" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors" />
            </div>
          </PanelSection>

          {/* Type & Status */}
          <PanelSection title="Type & Status" icon={<Dna className="w-3 h-3" />}>
            <div>
              <label htmlFor="prop-node-gender" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Gender</label>
              <div className="grid grid-cols-2 gap-1">
                {(["male", "female", "unknown", "pregnancy", "sab"] as const).map((t) => (
                  <button type="button" key={t} data-testid={`button-sex-${t}`}
                    onClick={() => onUpdateSelectedNode({ type: t })}
                    className={`py-1 rounded text-xs border transition-all ${singleSelected.type === t ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"}`}>
                    {t === "sab" ? "SAB" : <span className="capitalize">{t}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
              <div className="grid grid-cols-3 gap-1">
                {(["unaffected", "affected", "carrier"] as const).map((s) => (
                  <button type="button" key={s} data-testid={`button-status-${s}`} onClick={() => applyStatus(s)}
                    className={`py-1 rounded text-xs border transition-all ${getStatus(singleSelected) === s ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"}`}>
                    {s === "unaffected" ? "—" : s === "affected" ? "Aff." : "Carr."}
                  </button>
                ))}
              </div>
            </div>
          </PanelSection>

          {/* Flags */}
          <PanelSection title="Flags" icon={<Flag className="w-3 h-3" />}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {singleSelected.pinned ? <><Pin className="w-3 h-3 text-muted-foreground" /> Pinned</> : <><PinOff className="w-3 h-3" /> Not pinned</>}
              </span>
              <button type="button" onClick={() => onUpdateSelectedNode({ pinned: !singleSelected.pinned })}
                className="text-xs px-2 py-1 rounded border border-border hover:border-primary transition-colors">
                {singleSelected.pinned ? "Unpin" : "Pin"}
              </button>
            </div>
            <div className="space-y-2.5">
              {([
                { key: "deceased" as const, label: "Deceased" },
                { key: "proband" as const, label: "Proband" },
              ]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
                  <button type="button" data-testid={`toggle-${key}`}
                    onClick={() => onUpdateSelectedNode({ [key]: !singleSelected[key] })}
                    className={`w-9 h-5 rounded-full border transition-all relative ${singleSelected[key] ? "border-primary bg-primary" : "border-border bg-muted"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform ${singleSelected[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          </PanelSection>

          {/* Clinical Notes */}
          <PanelSection title="Clinical Notes" icon={<Stethoscope className="w-3 h-3" />} defaultOpen={false}>
            <textarea id="prop-node-notes" value={singleSelected.notes ?? ""}
              onChange={(e) => onUpdateSelectedNode({ notes: e.target.value })}
              placeholder="Longer clinical observations…" rows={3}
              className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors resize-none" />
          </PanelSection>

          {/* Risk Calculator inline */}
          <div>
            <button type="button" className="w-full flex items-center justify-between py-1 group" onClick={() => onShowRiskCalc(!showRiskCalc)}>
              <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1 cursor-pointer">
                <ShieldCheck className="w-3 h-3" /> Risk Calculator
              </span>
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
          <PanelSection title={`Annotations`} icon={<MessageSquare className="w-3 h-3" />}>
            <button type="button" onClick={() => onAddAnnotation(singleSelected.id)}
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Plus className="w-3 h-3" /> Add
            </button>
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
          </PanelSection>

          {/* Delete */}
          <button type="button" data-testid="button-delete-node" onClick={onDeleteSelected}
            className="w-full py-1.5 text-xs border border-destructive/50 rounded text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-3 h-3 inline mr-1" /> Delete Node
          </button>
        </PanelShell>
      ) : null}
    </div>
  );
}
