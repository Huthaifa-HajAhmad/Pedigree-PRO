import { Pin, PinOff, Users, MessageSquare, Plus, User, Dna, Flag, Stethoscope, Trash2, LayoutGrid, GitBranch, Heart, Link2 } from "lucide-react";
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
  onReorderAnnotations,
  onAlignSelected, onMarkAsTwins, onUnmarkTwins, onRemoveEdges,
  onUpdateEdgeType,
  onCreateCoupleEdge, onCreateConsanguinityEdge, onCreateCoupleAndChild,
  onCreateParentsForGroup,
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
  onReorderAnnotations?: (annId: string, direction: "up" | "down") => void;
  onAlignSelected: (axis: "x" | "y") => void;
  onMarkAsTwins?: (nodeIds: string[], twinType: "m" | "d") => void;
  onUnmarkTwins?: (nodeIds: string[]) => void;
  onRemoveEdges?: (edgeIds: string[]) => void;
  onUpdateEdgeType?: (edgeId: string, type: PedigreeEdge["type"]) => void;
  onCreateCoupleEdge?: (sourceId: string, targetId: string) => void;
  onCreateConsanguinityEdge?: (sourceId: string, targetId: string) => void;
  onCreateCoupleAndChild?: (maleId: string, femaleId: string) => void;
  onCreateParentsForGroup?: (nodeIds: string[]) => void;
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
                    className="py-1 rounded-lg text-xs border border-border/80 text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {s === "unaffected" ? "—" : s === "affected" ? "Affected" : "Carrier"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => onBulkUpdate({ deceased: true })}
                className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Mark Deceased</button>
              <button type="button" onClick={() => onBulkUpdate({ deceased: false })}
                className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Clear Deceased</button>
              <button type="button" onClick={() => onBulkUpdate({ proband: true })}
                className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Mark Proband</button>
              <button type="button" onClick={() => onBulkUpdate({ proband: false })}
                className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Clear Proband</button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => onBulkUpdate({ pinned: true })}
                className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Pin All</button>
              <button type="button" onClick={() => onBulkUpdate({ pinned: false })}
                className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Unpin All</button>
            </div>
          </PanelSection>

          {/* Alignment */}
          <PanelSection title="Align" icon={<LayoutGrid className="w-3 h-3" />}>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => onAlignSelected("y")} title="Snap all to same row"
                className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Horizontal</button>
              <button type="button" onClick={() => onAlignSelected("x")} title="Stack all in same column"
                className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Vertical</button>
            </div>
          </PanelSection>

          {/* Shared condition */}
          <PanelSection title="Condition (all)">
            <input id="bulk-condition" placeholder="e.g. BRCA1, Lynch" aria-label="Condition"
              className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onBulkUpdate({ condition: (e.target as HTMLInputElement).value });
                  (e.target as HTMLInputElement).value = "";
                }
              }} />
            <div className="text-xs text-muted-foreground mt-1 opacity-60">Press Enter to apply</div>
          </PanelSection>

          {/* Add Relationship */}
          {(() => {
            if (selectedIds.size !== 2 || !onCreateCoupleEdge || !onCreateConsanguinityEdge) return null;
            const nodes = canvasNodes.filter(n => selectedIds.has(n.id));
            if (nodes.length !== 2) return null;
            const a = nodes[0]!;
            const b = nodes[1]!;

            const hasRelEdge = canvasEdges.some(e => 
              (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") && 
              ((e.sourceId === a.id && e.targetId === b.id) || (e.sourceId === b.id && e.targetId === a.id))
            );

            const getParents = (id: string): string[] => {
              return canvasEdges
                .filter((e) => e.type === "parent-child" && e.targetId === id)
                .map((e) => e.sourceId);
            };

            const getAncestors = (id: string, visited = new Set<string>()): Set<string> => {
              const ancestors = new Set<string>();
              const parents = getParents(id);
              for (const p of parents) {
                if (!visited.has(p)) {
                  visited.add(p);
                  ancestors.add(p);
                  const pAncestors = getAncestors(p, visited);
                  for (const ans of pAncestors) {
                    ancestors.add(ans);
                  }
                }
              }
              return ancestors;
            };

            const parentsA = getParents(a.id);
            const parentsB = getParents(b.id);
            const ancestorsA = getAncestors(a.id);
            const ancestorsB = getAncestors(b.id);

            const isDirectParentChild = ancestorsA.has(b.id) || ancestorsB.has(a.id);
            const isSibling = parentsA.length > 0 && parentsB.length > 0 && parentsA.some(p => parentsB.includes(p));

            let shareAncestor = false;
            for (const ans of ancestorsA) {
              if (ancestorsB.has(ans)) {
                shareAncestor = true;
                break;
              }
            }
            const isGeneticRelative = shareAncestor && !isSibling && !isDirectParentChild;
            const hasNoParents = parentsA.length === 0 && parentsB.length === 0;

            const isBlocked = isDirectParentChild || isSibling;
            if (hasRelEdge) return null;
            if (isBlocked) return null;

            const maleId = a.type === "male" ? a.id : b.type === "male" ? b.id : a.id;
            const femaleId = a.type === "female" ? a.id : b.type === "female" ? b.id : b.id;

            return (
              <PanelSection title="Add Relationship" icon={<Link2 className="w-3 h-3" />}>
                {isGeneticRelative ? (
                  <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-500 text-xs leading-relaxed mb-2">
                    Genetic relationship detected. Consanguineous link recommended.
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-1">
                  <button 
                    type="button" 
                    onClick={() => onCreateCoupleEdge(maleId, femaleId)}
                    className="border-border/80 text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground py-1.5 text-xs border rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <Heart className="w-3 h-3 inline mr-1" />Couple
                  </button>
                  <button 
                    type="button" 
                    onClick={() => onCreateConsanguinityEdge(maleId, femaleId)}
                    className={`py-1.5 text-xs border rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      isGeneticRelative
                        ? "border-amber-500/50 text-amber-600 dark:text-amber-500 bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/15"
                        : "border-border/80 text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground"
                    }`}
                  >
                    <GitBranch className="w-3 h-3 inline mr-1" />Consang.
                  </button>
                </div>

                {onCreateCoupleAndChild && (
                  <button 
                    type="button" 
                    onClick={() => onCreateCoupleAndChild(maleId, femaleId)}
                    className="w-full mt-1 py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />Add Child
                  </button>
                )}

                {hasNoParents && onCreateParentsForGroup && (
                  <button 
                    type="button" 
                    onClick={() => onCreateParentsForGroup([a.id, b.id])}
                    className="w-full mt-1.5 py-1.5 text-xs border border-primary/40 rounded-lg text-primary bg-primary/5 hover:bg-primary/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />Add Shared Parents
                  </button>
                )}
              </PanelSection>
            );
          })()}

          {(() => {
            const coupleEdges = canvasEdges.filter(
              (e) => (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") && selectedIds.has(e.sourceId) && selectedIds.has(e.targetId)
            );
            if (coupleEdges.length === 0 || !onRemoveEdges) return null;

            const hasChildren = (p1Id: string, p2Id: string) => {
              return canvasNodes.some((child) => {
                const childParents = canvasEdges
                  .filter((e) => e.type === "parent-child" && e.targetId === child.id)
                  .map((e) => e.sourceId);
                return childParents.includes(p1Id) && childParents.includes(p2Id);
              });
            };

            const coupleHasNoChildren = coupleEdges.some(e => !hasChildren(e.sourceId, e.targetId));
            const sectionTitle = coupleHasNoChildren ? "Parents" : "Relationship";

            return (
              <PanelSection title={sectionTitle} icon={<Heart className="w-3 h-3" />} defaultOpen={true}>
                {coupleEdges.map((e) => {
                  const srcNode = canvasNodes.find((n) => n.id === e.sourceId);
                  const tgtNode = canvasNodes.find((n) => n.id === e.targetId);
                  const srcLabel = autoLabels.get(e.sourceId) || srcNode?.label || srcNode?.id;
                  const tgtLabel = autoLabels.get(e.targetId) || tgtNode?.label || tgtNode?.id;
                  const noChildren = !hasChildren(e.sourceId, e.targetId);
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
                            className={`py-1.5 text-xs rounded-lg border transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                              e.type === t
                                ? "border-primary/60 text-primary bg-primary/5 hover:bg-primary/10 font-medium"
                                : "border-border/80 text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground"
                            }`}>
                            {COUPLE_LABELS[t]}
                          </button>
                        ))}
                      </div>
                      {noChildren && onCreateCoupleAndChild && (
                        <button type="button" 
                          onClick={() => {
                            const maleId = srcNode?.type === "male" ? srcNode.id : tgtNode?.type === "male" ? tgtNode.id : srcNode?.id || e.sourceId;
                            const femaleId = srcNode?.type === "female" ? srcNode.id : tgtNode?.type === "female" ? tgtNode.id : tgtNode?.id || e.targetId;
                            onCreateCoupleAndChild(maleId, femaleId);
                          }}
                          className="w-full mt-1 py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <Plus className="w-3 h-3 inline mr-1" />Add Child
                        </button>
                      )}
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
                  className="w-full py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:border-destructive/60 hover:text-destructive transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  Remove twin marking
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={() => onMarkAsTwins([...selectedIds], "m")}
                    className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    Identical
                  </button>
                  <button type="button" onClick={() => onMarkAsTwins([...selectedIds], "d")}
                    className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    Fraternal
                  </button>
                </div>
              )}
            </PanelSection>
          )}

          {/* Bulk delete */}
          <button type="button" data-testid="button-bulk-delete" onClick={onDeleteSelected}
            className="w-full py-1.5 text-xs border border-destructive/40 rounded-lg text-destructive/90 hover:bg-destructive/10 hover:border-destructive/60 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
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
                placeholder="e.g. 3" className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200" />
            </div>
            <div>
              <label htmlFor="prop-node-age" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Age</label>
              <input id="prop-node-age" data-testid="input-node-age" value={singleSelected.age}
                onChange={(e) => onUpdateSelectedNode({ age: e.target.value })}
                placeholder="e.g. 42" className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200" />
            </div>
            <div>
              <label htmlFor="prop-node-condition" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Condition / Gene</label>
              <input id="prop-node-condition" value={singleSelected.condition ?? ""}
                onChange={(e) => onUpdateSelectedNode({ condition: e.target.value })}
                placeholder="e.g. BRCA1, HD onset 48y" className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200" />
            </div>
          </PanelSection>

          {/* Type & Status */}
          <PanelSection title="Type & Status" icon={<Dna className="w-3 h-3" />}>
            <div>
              <label htmlFor="prop-node-gender" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Gender</label>
              <div className="grid grid-cols-2 gap-1">
                {(["male", "female", "unknown", "pregnancy", "sab"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    data-testid={`button-sex-${t}`}
                    onClick={() => onUpdateSelectedNode({ type: t })}
                    className={`py-1 rounded-lg text-xs border transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      singleSelected.type === t
                        ? "border-primary/60 text-primary bg-primary/5 hover:bg-primary/10"
                        : "border-border/80 text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {t === "sab" ? "SAB" : <span className="capitalize">{t}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
              <div className="grid grid-cols-3 gap-1">
                {(["unaffected", "affected", "carrier"] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    data-testid={`button-status-${s}`}
                    onClick={() => applyStatus(s)}
                    className={`py-1 rounded-lg text-xs border transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      getStatus(singleSelected) === s
                        ? "border-primary/60 text-primary bg-primary/5 hover:bg-primary/10"
                        : "border-border/80 text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground"
                    }`}
                  >
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
                className="w-full py-1.5 rounded-lg border border-primary/20 hover:border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Plus className="w-3.5 h-3.5" /> Add Annotation
              </button>
              {canvasAnnotations.filter((a) => a.nodeId === singleSelected.id).length === 0 && (
                <p className="text-xs text-muted-foreground opacity-40 italic text-center">No annotations yet</p>
              )}
              <div className="space-y-3">
                {(() => {
                  const nodeAnns = canvasAnnotations.filter((a) => a.nodeId === singleSelected.id);
                  return nodeAnns.map((ann, annIdx) => (
                    <AnnotationEditorPanel
                      key={ann.id}
                      annotation={ann}
                      isSelected={selectedAnnotationId === ann.id}
                      onSelect={() => onSelectAnnotation(selectedAnnotationId === ann.id ? null : ann.id)}
                      onUpdate={(updates) => onUpdateAnnotation(ann.id, updates)}
                      onDelete={() => onDeleteAnnotation(ann.id)}
                      onReorder={(direction) => onReorderAnnotations?.(ann.id, direction)}
                      isFirst={annIdx === 0}
                      isLast={annIdx === nodeAnns.length - 1}
                    />
                  ));
                })()}
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
                className="text-xs px-2.5 py-1 rounded-lg border border-border/80 text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
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
                  className={`w-9 h-5 rounded-full border transition-all relative focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${singleSelected[key] ? "border-primary bg-primary" : "border-border bg-muted/60"}`}>
                  <span className={`absolute top-[1.5px] left-[1.5px] w-3.5 h-3.5 rounded-full shadow-xs transition-transform bg-card ${singleSelected[key] ? "translate-x-[16px]" : "translate-x-0"}`} />
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
              className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200 resize-none" />
          </PanelSection>

          {/* Delete */}
          <button type="button" data-testid="button-delete-node" onClick={onDeleteSelected}
            className="w-full py-1.5 text-xs border border-destructive/40 rounded-lg text-destructive/90 hover:bg-destructive/10 hover:border-destructive/60 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <Trash2 className="w-3 h-3 inline mr-1" /> Delete Node
          </button>
        </PanelShell>
      ) : selectedAnnotationId && selectedIds.size === 0 ? (() => {
        const ann = canvasAnnotations.find((a) => a.id === selectedAnnotationId);
        if (!ann) return null;
        return (
          <PanelShell title="Text Note" icon={<MessageSquare className="w-3.5 h-3.5" />} width="w-full md:w-72">
            <PanelSection title="Edit Text Note" icon={<MessageSquare className="w-3 h-3" />} defaultOpen={true}>
              <AnnotationEditorPanel
                annotation={ann}
                isSelected={true}
                onSelect={() => {}}
                onUpdate={(updates) => onUpdateAnnotation(ann.id, updates)}
                onDelete={() => onDeleteAnnotation(ann.id)}
              />
            </PanelSection>
          </PanelShell>
        );
      })() : null}
    </div>
  );
}
