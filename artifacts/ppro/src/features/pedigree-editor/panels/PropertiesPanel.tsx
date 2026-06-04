import { Pin, PinOff, Users, MessageSquare, Plus, User, Dna, Flag, Stethoscope, Trash2, LayoutGrid, GitBranch, Heart } from "lucide-react";
import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { AnnotationEditorPanel } from "@/features/pedigree-editor/panels/AnnotationEditorPanel";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { computeAutoLabels } from "@/lib/pedigree-labels";
import { useMemo } from "react";

const COUPLE_LABELS: Record<string, string> = {
  couple: "Couple",
  consanguinity: "Consanguinity",
  divorced: "Divorced",
  separated: "Separated",
};

export function PropertiesPanel({
  selectedIds, canvasNodes, canvasEdges, canvasAnnotations,
  selectedAnnotationId,
  onUpdateSelectedNode,
  onBulkUpdate, onDeleteSelected, onAddAnnotation,
  onUpdateAnnotation, onDeleteAnnotation, onSelectAnnotation,
  onAlignSelected, onMarkAsTwins, onUnmarkTwins, onRemoveEdges,
  onUpdateEdgeType,
}: {
  selectedIds: Set<string>;
  canvasNodes: PedigreeNode[];
  canvasEdges: PedigreeEdge[];
  canvasAnnotations: PedigreeAnnotation[];
  selectedAnnotationId: string | null;
  onUpdateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  onBulkUpdate: (updates: Partial<PedigreeNode>) => void;
  onDeleteSelected: () => void;
  onAddAnnotation: (nodeId: string) => void;
  onUpdateAnnotation: (annId: string, updates: Partial<PedigreeAnnotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
  onSelectAnnotation: (annId: string | null) => void;
  onAlignSelected: (axis: "x" | "y") => void;
  onMarkAsTwins?: (nodeIds: string[], twinType: "m" | "d") => void;
  onUnmarkTwins?: (nodeIds: string[]) => void;
  onRemoveEdges?: (edgeIds: string[]) => void;
  onUpdateEdgeType?: (edgeId: string, type: PedigreeEdge["type"]) => void;
}) {
  const autoLabels = useMemo(() => computeAutoLabels(canvasNodes, canvasEdges), [canvasNodes, canvasEdges]);
  const singleSelected = selectedIds.size === 1 ? canvasNodes.find((n) => selectedIds.has(n.id)) ?? null : null;
  const getStatus = (node: PedigreeNode) => node.affected ? "affected" : node.carrier ? "carrier" : "unaffected";
  const applyStatus = (status: string) => {
    const upd = { affected: status === "affected", carrier: status === "carrier" };
    if (selectedIds.size === 1) onUpdateSelectedNode(upd);
    else onBulkUpdate(upd);
  };

  const siblingNodes = selectedIds.size >= 2
    ? canvasNodes.filter((n) => selectedIds.has(n.id))
    : null;
  const areSiblings = siblingNodes && siblingNodes.length >= 2 && (() => {
    const getParents = (n: PedigreeNode) => canvasEdges.filter((e) => e.type === "parent-child" && e.targetId === n.id).map((e) => e.sourceId).sort().join("|");
    const firstKey = getParents(siblingNodes[0]!);
    if (!firstKey) return false;
    return siblingNodes.every((n) => getParents(n) === firstKey);
  })();
  const hasExistingTwins = areSiblings && canvasEdges.some((e) => e.type === "parent-child" && e.twinGroup && selectedIds.has(e.targetId));

  return (
    <div className="absolute right-0 top-0 bottom-0 z-30 overflow-hidden rounded-l-lg h-full shadow-[-4px_0_12px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08)]">
      {selectedIds.size > 1 ? (
        <PanelShell title={`${selectedIds.size} Nodes`} icon={<Users className="w-3.5 h-3.5" />} width="w-full md:w-72">
          {/* Bulk Status */}
          <PanelSection title="Bulk Status" icon={<Dna className="w-3 h-3" />}>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Status (all)</label>
              <div className="grid grid-cols-3 gap-1">
                {(["unaffected", "affected", "carrier"] as const).map((s) => (
                  <button type="button" key={s} onClick={() => applyStatus(s)}
                    className="py-1 rounded text-xs border border-border text-muted-foreground hover:border-primary hover:text-primary transition-all">
                    {s === "unaffected" ? "—" : s === "affected" ? "Affected" : "Carrier"}
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
            <input id="bulk-condition" placeholder="e.g. BRCA1, Lynch" aria-label="Condition"
              className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onBulkUpdate({ condition: (e.target as HTMLInputElement).value });
                  (e.target as HTMLInputElement).value = "";
                }
              }} />
            <div className="text-xs text-muted-foreground mt-1 opacity-60">Press Enter to apply</div>
          </PanelSection>

          {/* Relationship */}
          {(() => {
            const coupleEdges = canvasEdges.filter(
              (e) => (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") && selectedIds.has(e.sourceId) && selectedIds.has(e.targetId)
            );
            if (coupleEdges.length === 0 || !onRemoveEdges) return null;
            return (
              <PanelSection title="Relationship" icon={<Heart className="w-3 h-3" />} defaultOpen={true}>
                {coupleEdges.map((e) => {
                  const srcNode = canvasNodes.find((n) => n.id === e.sourceId);
                  const tgtNode = canvasNodes.find((n) => n.id === e.targetId);
                  const srcLabel = autoLabels.get(e.sourceId) || srcNode?.label || srcNode?.id;
                  const tgtLabel = autoLabels.get(e.targetId) || tgtNode?.label || tgtNode?.id;
                  return (
                    <div key={e.id} className="flex flex-col gap-1.5 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground truncate">
                          {srcLabel} — {tgtLabel}
                        </span>
                        <button type="button" onClick={() => onRemoveEdges([e.id])}
                          aria-label={`Remove relationship between ${srcLabel} and ${tgtLabel}`}
                          className="text-xs text-destructive/70 hover:text-destructive transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {(["couple", "consanguinity", "divorced", "separated"] as const).map((t) => (
                          <button key={t} type="button"
                            aria-label={`Set relationship to ${COUPLE_LABELS[t]}`}
                            aria-pressed={e.type === t}
                            onClick={() => onUpdateEdgeType?.(e.id, t)}
                            className={`py-1.5 text-xs rounded border transition-colors ${
                              e.type === t
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}>
                            {COUPLE_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </PanelSection>
            );
          })()}

          {/* Twins */}
          {areSiblings && onMarkAsTwins && onUnmarkTwins && (
            <PanelSection title="Twins" icon={<GitBranch className="w-3 h-3" />}>
              {hasExistingTwins ? (
                <button type="button" onClick={() => onUnmarkTwins([...selectedIds])}
                  className="w-full py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-destructive hover:text-destructive transition-colors">
                  Remove twin marking
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={() => onMarkAsTwins([...selectedIds], "m")}
                    className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    Identical
                  </button>
                  <button type="button" onClick={() => onMarkAsTwins([...selectedIds], "d")}
                    className="py-1.5 text-xs border border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    Fraternal
                  </button>
                </div>
              )}
            </PanelSection>
          )}

          {/* Bulk delete */}
          <button type="button" data-testid="button-bulk-delete" onClick={onDeleteSelected}
            className="w-full py-1.5 text-xs border border-destructive/50 rounded text-destructive hover:bg-destructive/10 transition-colors">
            Delete {selectedIds.size} Nodes
          </button>
        </PanelShell>
      ) : singleSelected ? (
        <PanelShell title={`${singleSelected.type}`} icon={<User className="w-3.5 h-3.5" />} width="w-full md:w-72">
          {/* Basic Info */}
          <PanelSection title="Basic Info" icon={<User className="w-3 h-3" />}>
            <div>
              <label htmlFor="prop-node-inside-text" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Inside text</label>
              <input id="prop-node-inside-text" data-testid="input-node-inside-text" value={singleSelected.insideText ?? ""}
                onChange={(e) => onUpdateSelectedNode({ insideText: e.target.value || undefined })}
                placeholder="e.g. 3" className="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary transition-colors" />
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
                    {s === "unaffected" ? "—" : s === "affected" ? "Affected" : "Carrier"}
                  </button>
                ))}
              </div>
            </div>
          </PanelSection>

          {/* Annotations */}
          <PanelSection title={`Annotations`} icon={<MessageSquare className="w-3 h-3" />} defaultOpen={true}>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onAddAnnotation(singleSelected.id)}
                className="w-full py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <Plus className="w-3 h-3" /> Add annotation
              </button>
              {canvasAnnotations.filter((a) => a.nodeId === singleSelected.id).length === 0 && (
                <p className="text-xs text-muted-foreground opacity-40 italic text-center">No annotations yet</p>
              )}
              <div className="space-y-3">
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
            </div>
          </PanelSection>

          {/* Flags */}
          <PanelSection title="Flags" icon={<Flag className="w-3 h-3" />} defaultOpen={false}>
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
                  <span className="text-xs text-muted-foreground uppercase tracking-wider" id={`toggle-label-${key}`}>{label}</span>
                  <button type="button" data-testid={`toggle-${key}`}
                    role="switch"
                    aria-checked={singleSelected[key]}
                    aria-labelledby={`toggle-label-${key}`}
                    onClick={() => onUpdateSelectedNode({ [key]: !singleSelected[key] })}
                  className={`w-9 h-5 rounded-full border transition-all relative ${singleSelected[key] ? "border-primary bg-primary" : "border-border bg-muted"}`}>
                  <span className={`absolute top-[1px] left-[1px] w-4 h-4 rounded-full shadow-sm transition-transform bg-card ${singleSelected[key] ? "translate-x-[16px]" : "translate-x-0"}`} />
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
