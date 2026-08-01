import { Users, MessageSquare, Plus, User, Dna, Stethoscope, Trash2, LayoutGrid, GitBranch, Heart, Link2 } from "lucide-react";
import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { AnnotationEditorPanel } from "@/features/pedigree-editor/panels/AnnotationEditorPanel";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { computeAutoLabels } from "@/lib/pedigree-labels";
import React, { useMemo, useState } from "react";
import { getQuadrantsForStyle } from "@/features/pedigree-editor/utils/helpers";

const COUPLE_LABELS: Record<string, string> = {
  couple: "Couple",
  consanguinity: "Consanguinity",
  divorced: "Divorced",
  separated: "Separated",
};

function calculateAgeFromDob(dob?: string): string {
  if (!dob) return "";
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return "";
  const today = new Date();
  
  // Calculate raw difference in months
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
  months -= birthDate.getMonth();
  months += today.getMonth();
  
  // Adjust for partial month days
  if (today.getDate() < birthDate.getDate()) {
    months--;
  }
  
  if (months < 0) return "";
  
  // If age is less than 12 months, return age in months (e.g. "3m")
  if (months < 12) {
    return `${months}m`;
  }
  
  // Otherwise, return age in years
  const years = Math.floor(months / 12);
  return String(years);
}

export function PropertiesPanel({
  selectedIds, canvasNodes, canvasEdges, canvasAnnotations,
  selectedAnnotationId,
  onUpdateSelectedNode,
  onBulkUpdate, onDeleteSelected, onAddAnnotation,
  onUpdateAnnotation, onDeleteAnnotation, onSelectAnnotation,
  onReorderAnnotations,
  onAlignSelected, onMarkAsTwins, onUnmarkTwins, onRemoveEdges,
  onUpdateEdgeType, onToggleCoupleInverted,
  onCreateCoupleEdge, onCreateConsanguinityEdge, onCreateCoupleAndChild,
  onCreateParentsForGroup,
}: {
  selectedIds: Set<string>;
  canvasNodes: PedigreeNode[];
  canvasEdges: PedigreeEdge[];
  canvasAnnotations: PedigreeAnnotation[];
  selectedAnnotationId: string | null;
  onUpdateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  onBulkUpdate: (updates: Partial<PedigreeNode> | ((node: PedigreeNode) => Partial<PedigreeNode>)) => void;
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
  onToggleCoupleInverted?: (edgeId: string) => void;
  onCreateCoupleEdge?: (sourceId: string, targetId: string) => void;
  onCreateConsanguinityEdge?: (sourceId: string, targetId: string) => void;
  onCreateCoupleAndChild?: (maleId: string, femaleId: string) => void;
  onCreateParentsForGroup?: (nodeIds: string[]) => void;
}) {
  const autoLabels = useMemo(() => computeAutoLabels(canvasNodes, canvasEdges), [canvasNodes, canvasEdges]);
  const singleSelected = selectedIds.size === 1 ? canvasNodes.find((n) => selectedIds.has(n.id)) ?? null : null;
  const [genotypeRowsCount, setGenotypeRowsCount] = useState(1);
  const [selectedQuad, setSelectedQuad] = useState<"q1" | "q2" | "q3" | "q4">("q1");

  React.useEffect(() => {
    if (selectedIds.size > 1) {
      let maxCount = 1;
      Array.from(selectedIds).forEach((id) => {
        const node = canvasNodes.find((n) => n.id === id);
        if (!node) return;
        let count = 1;
        if (node.genotype2 !== undefined) count = 2;
        if (node.additionalGenotypes && node.additionalGenotypes.length > 0) {
          count = 2 + node.additionalGenotypes.length;
        }
        if (count > maxCount) maxCount = count;
      });
      setGenotypeRowsCount(maxCount);
      return;
    }
    if (!singleSelected) {
      setGenotypeRowsCount(1);
      return;
    }
    let count = 1;
    if (singleSelected.genotype2 !== undefined) {
      count = 2;
    }
    if (singleSelected.additionalGenotypes && singleSelected.additionalGenotypes.length > 0) {
      count = 2 + singleSelected.additionalGenotypes.length;
    }
    setGenotypeRowsCount(count);
  }, [singleSelected?.id, selectedIds, canvasNodes]);

  const getStatus = (node: PedigreeNode) => node.affected ? "affected" : node.carrier ? "carrier" : "unaffected";
  const applyStatus = (status: string) => {
    const upd: Partial<PedigreeNode> = {
      affected: status === "affected",
      carrier: status === "carrier",
    };
    if (status !== "affected") {
      upd.shading = undefined;
    }
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
    <div className="h-full w-full overflow-hidden flex flex-col">
      {selectedIds.size > 1 ? (
        <PanelShell key={`bulk-${Array.from(selectedIds).sort().join(",")}`} title={`${selectedIds.size} Nodes`} icon={<Users className="w-3.5 h-3.5" />} width="w-full">
          {/* Bulk Status & Flags */}
          {(() => {
            const selectedNodes = Array.from(selectedIds).map(id => canvasNodes.find(n => n.id === id)).filter(Boolean) as PedigreeNode[];
            const allDeceased = selectedNodes.length > 0 && selectedNodes.every(n => n.deceased);
            const allProband = selectedNodes.length > 0 && selectedNodes.every(n => n.proband);
            const allPinned = selectedNodes.length > 0 && selectedNodes.every(n => n.pinned);
            
            const firstStatus = selectedNodes[0] ? getStatus(selectedNodes[0]) : "";
            const isCommonStatus = selectedNodes.every(n => getStatus(n) === firstStatus);
            const commonStatus = isCommonStatus ? firstStatus : "";

            const commonCondition = (() => {
              const conds = selectedNodes.map(n => n.condition).filter(Boolean);
              if (conds.length === 0) return "";
              return conds.every(c => c === conds[0]) ? (conds[0] || "") : "";
            })();



            return (
              <>
                <PanelSection title="Bulk Status" icon={<Dna className="w-3 h-3" />}>
                  <div className="space-y-3">
                    {/* Row 1: Status */}
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Status (all)</label>
                      <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                        {([
                          { value: "unaffected", label: "Unaffected" },
                          { value: "affected", label: "Affected" },
                          { value: "carrier", label: "Carrier" }
                        ] as const).map((opt, idx) => {
                          const isActive = commonStatus === opt.value;
                          return (
                            <React.Fragment key={opt.value}>
                              {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                              <button
                                type="button"
                                onClick={() => applyStatus(opt.value)}
                                className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all border text-center ${
                                  isActive
                                    ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                                }`}
                              >
                                {opt.label}
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row 2: Flags */}
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Flags (all)</label>
                      <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                        {([
                          { key: "deceased", label: "Deceased", active: allDeceased },
                          { key: "proband", label: "Proband", active: allProband },
                          { key: "pinned", label: "Pinned", active: allPinned }
                        ] as const).map((opt, idx) => {
                          return (
                            <React.Fragment key={opt.key}>
                              {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                              <button
                                type="button"
                                onClick={() => onBulkUpdate({ [opt.key]: !opt.active })}
                                className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all border text-center ${
                                  opt.active
                                    ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                                }`}
                              >
                                {opt.label}
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
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

                {/* Condition & Genotype */}
                <PanelSection title="Condition & Genotype" icon={<Stethoscope className="w-3.5 h-3.5" />}>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="bulk-condition" className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Condition (all)</label>
                      <input
                        id="bulk-condition"
                        placeholder="e.g. BRCA1, Lynch"
                        aria-label="Condition"
                        defaultValue={commonCondition}
                        key={`cond-${commonCondition}`}
                        className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onBulkUpdate({ condition: (e.target as HTMLInputElement).value || undefined });
                          }
                        }}
                      />
                      <div className="text-[9px] text-muted-foreground mt-1 opacity-60">Press Enter to apply</div>
                    </div>

                    <div className="space-y-3.5 pt-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-medium">Genotypes (all)</span>
                      {(() => {
                        const getCommonGenotypeForIndex = (rowIdx: number) => {
                          const vals = selectedNodes.map(n => {
                            if (rowIdx === 0) return n.genotype;
                            if (rowIdx === 1) return n.genotype2;
                            return n.additionalGenotypes?.[rowIdx - 2];
                          }).map(v => v || "");
                          return vals.every(v => v === vals[0]) ? (vals[0] || "") : "";
                        };

                        const handleBulkGenotypeChange = (rowIdx: number, val: string) => {
                          onBulkUpdate((node) => {
                            const nodeGenotypes = [
                              node.genotype ?? "",
                              node.genotype2 ?? "",
                              ...(node.additionalGenotypes ?? [])
                            ];
                            while (nodeGenotypes.length <= rowIdx) {
                              nodeGenotypes.push("");
                            }
                            nodeGenotypes[rowIdx] = val;
                            
                            const genotype = nodeGenotypes[0] || undefined;
                            const genotype2 = nodeGenotypes[1] || undefined;
                            const additionalGenotypes = nodeGenotypes.slice(2).filter(Boolean).length > 0 ? nodeGenotypes.slice(2) : undefined;
                            return { genotype, genotype2, additionalGenotypes };
                          });
                        };

                        const handleBulkRemoveRow = (rowIdx: number) => {
                          onBulkUpdate((node) => {
                            const nodeGenotypes = [
                              node.genotype ?? "",
                              node.genotype2 ?? "",
                              ...(node.additionalGenotypes ?? [])
                            ];
                            nodeGenotypes.splice(rowIdx, 1);
                            
                            const genotype = nodeGenotypes[0] || undefined;
                            const genotype2 = nodeGenotypes[1] || undefined;
                            const additionalGenotypes = nodeGenotypes.slice(2).filter(Boolean).length > 0 ? nodeGenotypes.slice(2) : undefined;
                            return { genotype, genotype2, additionalGenotypes };
                          });
                          setGenotypeRowsCount(prev => Math.max(1, prev - 1));
                        };

                        return (
                          <>
                            {Array.from({ length: genotypeRowsCount }).map((_, idx) => {
                              const gVal = getCommonGenotypeForIndex(idx);
                              return (
                                <div key={idx} className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <label htmlFor={`bulk-genotype-${idx}`} className="text-xs text-muted-foreground uppercase tracking-wider truncate">
                                        {idx === 0 ? "Genotype" : `Row ${idx + 1}`}
                                      </label>
                                      {idx > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => handleBulkRemoveRow(idx)}
                                          className="text-[10px] text-destructive hover:underline font-medium shrink-0"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                    <input
                                      id={`bulk-genotype-${idx}`}
                                      placeholder="e.g. +/-"
                                      aria-label={idx === 0 ? "Genotype" : `Genotype Row ${idx + 1}`}
                                      defaultValue={gVal}
                                      key={`bulk-geno-${idx}-${gVal}`}
                                      className="flex-1 min-w-[120px] bg-background border border-border/80 rounded-lg px-2.5 py-1 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200 font-mono"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleBulkGenotypeChange(idx, (e.target as HTMLInputElement).value || "");
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                                    {(["+/-", "+/+", "-/-", "+/Y", "-/Y"] as const).map((preset, pIdx) => {
                                      const isActive = gVal === preset;
                                      return (
                                        <React.Fragment key={preset}>
                                          {pIdx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                                          <button
                                            type="button"
                                            onClick={() => handleBulkGenotypeChange(idx, isActive ? "" : preset)}
                                            className={`flex-1 py-0.5 rounded-md text-[10px] font-mono transition-all border text-center ${
                                              isActive
                                                ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                                            }`}
                                          >
                                            {preset}
                                          </button>
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setGenotypeRowsCount(prev => prev + 1)}
                              className="w-full py-1.5 border border-dashed border-border hover:border-primary/50 rounded-lg text-[10px] text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-1 mt-2 font-medium"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Genotype Row
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </PanelSection>
              </>
            );
          })()}

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
              <PanelSection title="Add Relationship" icon={<Link2 className="w-3 h-3" />} defaultOpen={true}>
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

          {/* Relationship / Flip Partner Order */}
          {(() => {
            if (selectedIds.size !== 2) return null;
            const ids = Array.from(selectedIds);
            const coupleEdge = canvasEdges.find(
              (e) =>
                (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") &&
                ((e.sourceId === ids[0] && e.targetId === ids[1]) || (e.sourceId === ids[1] && e.targetId === ids[0]))
            );
            if (!coupleEdge || !onToggleCoupleInverted) return null;
            return (
              <PanelSection title="Relationship" icon={<Heart className="w-3 h-3 text-rose-500" />}>
                <button
                  type="button"
                  onClick={() => onToggleCoupleInverted(coupleEdge.id)}
                  className="w-full py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Flip Partner Order
                </button>
              </PanelSection>
            );
          })()}

          {/* Bulk delete */}
          <button type="button" data-testid="button-bulk-delete" onClick={onDeleteSelected}
            className="w-full py-1.5 text-xs border border-destructive/40 rounded-lg text-destructive/90 hover:bg-destructive/10 hover:border-destructive/60 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            Delete {selectedIds.size} Nodes
          </button>
        </PanelShell>
      ) : singleSelected ? (
        <PanelShell key={`single-${singleSelected.id}`} title={`${singleSelected.type}`} icon={<User className="w-3.5 h-3.5" />} width="w-full">
          {/* Basic Info */}
          <PanelSection title="Basic Info" icon={<User className="w-3 h-3" />}>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="prop-node-inside-text" className="text-xs text-muted-foreground uppercase tracking-wider">Inside Text</label>
                <input id="prop-node-inside-text" data-testid="input-node-inside-text" value={singleSelected.insideText ?? ""}
                  onChange={(e) => onUpdateSelectedNode({ insideText: e.target.value || undefined })}
                  placeholder="e.g. 3" className="w-36 bg-background border border-border/80 rounded-lg px-2.5 py-1 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="prop-node-age" className="text-xs text-muted-foreground uppercase tracking-wider">Age</label>
                <input id="prop-node-age" data-testid="input-node-age" value={singleSelected.age ?? ""}
                  onChange={(e) => onUpdateSelectedNode({ age: e.target.value || undefined })}
                  placeholder="e.g. 42 or 3m" className="w-36 bg-background border border-border/80 rounded-lg px-2.5 py-1 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200" />
              </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="prop-node-dob" className="text-xs text-muted-foreground uppercase tracking-wider">Date of Birth</label>
                  <input id="prop-node-dob" type="date" value={singleSelected.dob ?? ""}
                    onChange={(e) => {
                      const dobVal = e.target.value;
                      const calculatedAge = calculateAgeFromDob(dobVal);
                      onUpdateSelectedNode({
                        dob: dobVal || undefined,
                        age: calculatedAge || singleSelected.age
                      });
                    }}
                    className="w-36 bg-background border border-border/80 rounded-lg px-2.5 py-1 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none text-muted-foreground transition-all duration-200" />
                </div>
              </div>
            </PanelSection>          {/* Type & Status */}
          <PanelSection title="Type & Status" icon={<Dna className="w-3 h-3" />}>
            <div className="space-y-4">
              {/* Gender selection buttons polished */}
              <div>
                <label htmlFor="prop-node-gender" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Gender</label>
                <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                  {(["male", "female", "unknown", "pregnancy", "sab"] as const).map((t, idx) => {
                    const isActive = singleSelected.type === t;
                    const labelText = t === "sab" ? "SAB" : t.charAt(0).toUpperCase() + t.slice(1);
                    return (
                      <React.Fragment key={t}>
                        {idx > 0 && <div className="w-[1px] h-4 bg-border/50 shrink-0 self-center" />}
                        <button
                          type="button"
                          key={t}
                          data-testid={`button-sex-${t}`}
                          onClick={() => onUpdateSelectedNode({ type: t })}
                          title={labelText}
                          className={`flex-1 py-1.5 rounded-md transition-all duration-200 border flex items-center justify-center min-w-0 ${
                            isActive
                              ? "bg-card text-primary border-border/75 shadow-sm"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                          }`}
                        >
                          <svg className="w-4.5 h-4.5 flex-shrink-0" viewBox="-10 -10 20 20" fill="none" stroke="currentColor">
                            {(() => {
                              const sw = 1.8;
                              if (t === "male") return <rect x={-7} y={-7} width={14} height={14} strokeWidth={sw} rx={0.5} />;
                              if (t === "female") return <circle cx={0} cy={0} r={7} strokeWidth={sw} />;
                              if (t === "sab") return <polygon points="0,7 -7,-7 7,-7" strokeWidth={sw} />;
                              if (t === "pregnancy") return (
                                <>
                                  <rect x={-7} y={-7} width={14} height={14} strokeWidth={sw} rx={0.5} transform="rotate(45)" />
                                  <text x={0} y={0.5} textAnchor="middle" dominantBaseline="central" fontSize={7} fontWeight="bold" fill="currentColor" style={{ fontFamily: "JetBrains Mono, monospace" }}>P</text>
                                </>
                              );
                              return <rect x={-7} y={-7} width={14} height={14} strokeWidth={sw} rx={0.5} transform="rotate(45)" />;
                            })()}
                          </svg>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Status & Flags Selector (Row 1 mutually exclusive, Row 2 independent flags) */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Status & Flags</label>
                <div className="space-y-1.5">
                  {/* Row 1: mutually exclusive status */}
                  <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                    {([
                      { value: "unaffected", label: "Unaffected" },
                      { value: "affected", label: "Affected" },
                      { value: "carrier", label: "Carrier" }
                    ] as const).map((opt, idx) => {
                      const isActive = getStatus(singleSelected) === opt.value;
                      return (
                        <React.Fragment key={opt.value}>
                          {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                          <button
                            type="button"
                            key={opt.value}
                            data-testid={`button-status-${opt.value}`}
                            onClick={() => applyStatus(opt.value)}
                            className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all border text-center ${
                              isActive
                                ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                            }`}
                          >
                            {opt.label}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Row 2: independent toggles */}
                  <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                    {([
                      { key: "deceased", label: "Deceased" },
                      { key: "proband", label: "Proband" },
                      { key: "pinned", label: "Pinned" }
                    ] as const).map((opt, idx) => {
                      const isActive = !!singleSelected[opt.key];
                      return (
                        <React.Fragment key={opt.key}>
                          {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                          <button
                            type="button"
                            key={opt.key}
                            data-testid={`toggle-${opt.key}`}
                            onClick={() => onUpdateSelectedNode({ [opt.key]: !singleSelected[opt.key] })}
                            className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all border text-center ${
                              isActive
                                ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                            }`}
                          >
                            {opt.label}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Node Color selector inside Type & Status */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Node Color</label>
                  {singleSelected.color && (
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedNode({ color: undefined })}
                      className="text-[10px] text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium animate-in fade-in duration-200"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 py-1">
                  {["#ffb3b3", "#ffd9b3", "#ffffb3", "#c1f0c1", "#b3d9ff", "#d9b3ff", "#ffb3d9", "#e2e8f0"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateSelectedNode({ color: c })}
                      className="w-5.5 h-5.5 rounded-full border border-border/50 transition-transform hover:scale-110 flex-shrink-0"
                      style={{ background: c, outline: singleSelected.color === c ? "2px solid hsl(var(--primary))" : "none", outlineOffset: 1 }}
                      title={c}
                    />
                  ))}
                  
                  {/* Custom color input */}
                  <label
                    className="relative w-5.5 h-5.5 rounded-full overflow-hidden flex-shrink-0 transition-transform hover:scale-110 cursor-pointer"
                    style={{
                      boxShadow: "0 0 0 1px hsl(var(--border)/0.3)",
                      background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                      outline: (singleSelected.color && !["#ffb3b3", "#ffd9b3", "#ffffb3", "#c1f0c1", "#b3d9ff", "#d9b3ff", "#ffb3d9", "#e2e8f0"].includes(singleSelected.color)) ? "2px solid hsl(var(--primary))" : "none",
                      outlineOffset: 1,
                    }}
                    title="Custom color"
                  >
                    <input
                      type="color"
                      value={singleSelected.color || "#000000"}
                      onChange={(e) => onUpdateSelectedNode({ color: e.target.value })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label="Custom color"
                    />
                  </label>
                </div>
              </div>

              {/* Secondary Color Selector (only shown for split shading styles) */}
              {singleSelected && ["left-half", "right-half", "top-half", "bottom-half"].includes(singleSelected.shading ?? "") && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Secondary Color (Dual Phenotype)
                  </label>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedNode({ color2: undefined })}
                      className="w-5.5 h-5.5 rounded-full border border-border/50 transition-transform hover:scale-110 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted bg-background"
                      style={{ outline: !singleSelected.color2 ? "2px solid hsl(var(--primary))" : "none", outlineOffset: 1 }}
                      title="Clear secondary color (default background)"
                    >
                      ×
                    </button>
                    {["#ffb3b3", "#ffd9b3", "#ffffb3", "#c1f0c1", "#b3d9ff", "#d9b3ff", "#ffb3d9", "#e2e8f0"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onUpdateSelectedNode({ color2: c })}
                        className="w-5.5 h-5.5 rounded-full border border-border/50 transition-transform hover:scale-110 flex-shrink-0"
                        style={{ background: c, outline: singleSelected.color2 === c ? "2px solid hsl(var(--primary))" : "none", outlineOffset: 1 }}
                        title={c}
                      />
                    ))}
                    
                    {/* Custom secondary color input */}
                    <label
                      className="relative w-5.5 h-5.5 rounded-full overflow-hidden flex-shrink-0 transition-transform hover:scale-110 cursor-pointer"
                      style={{
                        boxShadow: "0 0 0 1px hsl(var(--border)/0.3)",
                        background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                        outline: (singleSelected.color2 && !["#ffb3b3", "#ffd9b3", "#ffffb3", "#c1f0c1", "#b3d9ff", "#d9b3ff", "#ffb3d9", "#e2e8f0"].includes(singleSelected.color2)) ? "2px solid hsl(var(--primary))" : "none",
                        outlineOffset: 1,
                      }}
                      title="Custom secondary color"
                    >
                      <input
                        type="color"
                        value={singleSelected.color2 || "#000000"}
                        onChange={(e) => onUpdateSelectedNode({ color2: e.target.value })}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="Custom secondary color"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Shading Style Selector (Segmented Rows) */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Shading Style</label>
                <div className="space-y-1.5">
                  {/* Row 1: Fills */}
                  <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                    {([
                      { value: "none", label: "None" },
                      { value: "solid", label: "Solid" },
                      { value: "striped", label: "Striped" },
                      { value: "cross-hatched", label: "Crossed" },
                      { value: "dots", label: "Dotted" },
                    ] as const).map((opt, idx) => {
                      const isActive = (singleSelected.shading || (singleSelected.affected ? "solid" : "none")) === opt.value;
                      return (
                        <React.Fragment key={opt.value}>
                          {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                          <button
                            type="button"
                            onClick={() => {
                              const isNone = opt.value === "none";
                              onUpdateSelectedNode({
                                shading: isNone || opt.value === "solid" ? undefined : opt.value,
                                affected: !isNone,
                                color2: undefined,
                              });
                            }}
                            className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all border text-center ${
                              isActive
                                ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                            }`}
                          >
                            {opt.label}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Row 2: Partials */}
                  <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                    {([
                      { value: "left-half", label: "Left ½" },
                      { value: "right-half", label: "Right ½" },
                      { value: "top-half", label: "Top ½" },
                      { value: "bottom-half", label: "Bottom ½" },
                      { value: "quadrant", label: "Quad ¼" },
                    ] as const).map((opt, idx) => {
                      const isActive = (singleSelected.shading || (singleSelected.affected ? "solid" : "none")) === opt.value;
                      return (
                        <React.Fragment key={opt.value}>
                          {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateSelectedNode({
                                shading: opt.value,
                                affected: true,
                              });
                            }}
                            className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all border text-center ${
                              isActive
                                ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                            }`}
                          >
                            {opt.label}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quadrant Configuration (only shown for quadrant shading style or custom segments) */}
              {singleSelected && (
                singleSelected.shading === "quadrant" || 
                (singleSelected.shading && (singleSelected.shading.startsWith("q") || singleSelected.shading.includes(",")))
              ) && (() => {
                const currentStyle = singleSelected.shading || "";
                const [q1, q2, q3, q4] = getQuadrantsForStyle(currentStyle);

                const updateQuadrant = (quad: "q1" | "q2" | "q3" | "q4", checked: boolean) => {
                  const active: string[] = [];
                  if (quad === "q1" ? checked : q1) active.push("q1");
                  if (quad === "q2" ? checked : q2) active.push("q2");
                  if (quad === "q3" ? checked : q3) active.push("q3");
                  if (quad === "q4" ? checked : q4) active.push("q4");
                  
                  let nextShading: string | undefined = active.join(",");
                  if (active.length === 0) nextShading = undefined;
                  else if (active.length === 4) nextShading = "solid";

                  onUpdateSelectedNode({
                    shading: nextShading,
                    affected: active.length > 0,
                  });
                };
                const quads = [
                  { id: "q1" as const, label: "Q1 (Top-Right)", active: q1, colorField: "colorQ1" as const },
                  { id: "q2" as const, label: "Q2 (Top-Left)", active: q2, colorField: "colorQ2" as const },
                  { id: "q3" as const, label: "Q3 (Bottom-Left)", active: q3, colorField: "colorQ3" as const },
                  { id: "q4" as const, label: "Q4 (Bottom-Right)", active: q4, colorField: "colorQ4" as const },
                ];

                const activeQ = quads.find((q) => q.id === selectedQuad)!;
                const activeColor = singleSelected[activeQ.colorField] || singleSelected.color || "#000000";

                return (
                  <div className="space-y-3 border-t border-border pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-3 bg-muted/15 p-2 rounded-lg border border-border/40">
                      {/* 2x2 Grid Representation */}
                      <div className="flex-shrink-0 grid grid-cols-2 gap-1 w-14 h-14 bg-card p-1 rounded-md border border-border/80 relative">
                        {/* Q2 (Top-Left) */}
                        <button
                          type="button"
                          onClick={() => setSelectedQuad("q2")}
                          className={`w-5 h-5 rounded-tl-sm border transition-all ${
                            selectedQuad === "q2" ? "ring-2 ring-primary ring-offset-1 z-10 scale-105" : "border-border/45"
                          }`}
                          style={{
                            backgroundColor: q2 ? (singleSelected.colorQ2 || singleSelected.color || "hsl(var(--primary))") : "transparent",
                          }}
                          title="Q2 (Top-Left) — Click to select"
                        />
                        {/* Q1 (Top-Right) */}
                        <button
                          type="button"
                          onClick={() => setSelectedQuad("q1")}
                          className={`w-5 h-5 rounded-tr-sm border transition-all ${
                            selectedQuad === "q1" ? "ring-2 ring-primary ring-offset-1 z-10 scale-105" : "border-border/45"
                          }`}
                          style={{
                            backgroundColor: q1 ? (singleSelected.colorQ1 || singleSelected.color || "hsl(var(--primary))") : "transparent",
                          }}
                          title="Q1 (Top-Right) — Click to select"
                        />
                        {/* Q3 (Bottom-Left) */}
                        <button
                          type="button"
                          onClick={() => setSelectedQuad("q3")}
                          className={`w-5 h-5 rounded-bl-sm border transition-all ${
                            selectedQuad === "q3" ? "ring-2 ring-primary ring-offset-1 z-10 scale-105" : "border-border/45"
                          }`}
                          style={{
                            backgroundColor: q3 ? (singleSelected.colorQ3 || singleSelected.color || "hsl(var(--primary))") : "transparent",
                          }}
                          title="Q3 (Bottom-Left) — Click to select"
                        />
                        {/* Q4 (Bottom-Right) */}
                        <button
                          type="button"
                          onClick={() => setSelectedQuad("q4")}
                          className={`w-5 h-5 rounded-br-sm border transition-all ${
                            selectedQuad === "q4" ? "ring-2 ring-primary ring-offset-1 z-10 scale-105" : "border-border/45"
                          }`}
                          style={{
                            backgroundColor: q4 ? (singleSelected.colorQ4 || singleSelected.color || "hsl(var(--primary))") : "transparent",
                          }}
                          title="Q4 (Bottom-Right) — Click to select"
                        />
                      </div>

                      {/* Selected Quadrant Status Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                          Selected Segment
                        </span>
                        <span className="text-xs font-bold text-foreground truncate">
                          {activeQ.label}
                        </span>
                        <label className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeQ.active}
                            onChange={(e) => updateQuadrant(activeQ.id, e.target.checked)}
                            className="rounded w-3 h-3 border-border/80 text-primary focus:ring-primary/40 focus:ring-offset-0 focus:ring-1"
                          />
                          <span>Shade this quadrant</span>
                        </label>
                      </div>
                    </div>

                    {/* Color selection row for the selected quadrant */}
                    {activeQ.active && (
                      <div className="space-y-1.5 bg-card/10 border border-border/30 p-2 rounded-lg animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            Shading Color
                          </span>
                          {singleSelected[activeQ.colorField] && (
                            <button
                              type="button"
                              onClick={() => onUpdateSelectedNode({ [activeQ.colorField]: undefined })}
                              className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                              title="Reset to default shading color"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {["#ffb3b3", "#ffd9b3", "#ffffb3", "#c1f0c1", "#b3d9ff", "#d9b3ff", "#ffb3d9", "#e2e8f0"].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => onUpdateSelectedNode({ [activeQ.colorField]: c })}
                              className="w-4 h-4 rounded-full border border-border/30 transition-transform hover:scale-110 flex-shrink-0"
                              style={{
                                background: c,
                                outline: singleSelected[activeQ.colorField] === c ? "2px solid hsl(var(--primary))" : "none",
                                outlineOffset: 1,
                              }}
                              title={c}
                            />
                          ))}
                          <label
                            className="relative w-4 h-4 rounded-full overflow-hidden flex-shrink-0 transition-transform hover:scale-110 cursor-pointer border border-border/30"
                            style={{
                              background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                              outline: (singleSelected[activeQ.colorField] && !["#ffb3b3", "#ffd9b3", "#ffffb3", "#c1f0c1", "#b3d9ff", "#d9b3ff", "#ffb3d9", "#e2e8f0"].includes(singleSelected[activeQ.colorField] as string)) ? "2px solid hsl(var(--primary))" : "none",
                              outlineOffset: 1,
                            }}
                            title="Custom quadrant color"
                          >
                            <input
                              type="color"
                              value={activeColor}
                              onChange={(e) => onUpdateSelectedNode({ [activeQ.colorField]: e.target.value })}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              aria-label={`Custom color for ${activeQ.label}`}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Contextual Phenotype / Condition input */}
              {singleSelected && (singleSelected.shading || singleSelected.affected) && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <label htmlFor="prop-node-condition" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">
                    Phenotype (Added to Legend)
                  </label>
                  <input
                    id="prop-node-condition"
                    value={singleSelected.condition ?? ""}
                    onChange={(e) => onUpdateSelectedNode({ condition: e.target.value || undefined })}
                    placeholder="e.g. Breast Cancer, Lynch Syndrome"
                    className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200"
                  />
                </div>
              )}

              {/* Genotypes Section */}
              <div className="space-y-4 pt-1">
                {(() => {
                  if (!singleSelected) return null;
                  
                  // Construct the array of genotype strings
                  const allGenotypes: string[] = [];
                  allGenotypes.push(singleSelected.genotype ?? "");
                  allGenotypes.push(singleSelected.genotype2 ?? "");
                  if (singleSelected.additionalGenotypes) {
                    allGenotypes.push(...singleSelected.additionalGenotypes);
                  }

                  // Pad the array to match genotypeRowsCount
                  while (allGenotypes.length < genotypeRowsCount) {
                    allGenotypes.push("");
                  }

                  const handleGenotypeChange = (idx: number, val: string) => {
                    const newGenotypes = [...allGenotypes];
                    newGenotypes[idx] = val;
                    const genotype = newGenotypes[0] || undefined;
                    const genotype2 = newGenotypes[1] || undefined;
                    const additionalGenotypes = newGenotypes.slice(2).length > 0 ? newGenotypes.slice(2) : undefined;
                    onUpdateSelectedNode({ genotype, genotype2, additionalGenotypes });
                  };

                  const handleRemoveRow = (idx: number) => {
                    const newGenotypes = [...allGenotypes];
                    newGenotypes.splice(idx, 1);
                    const genotype = newGenotypes[0] || undefined;
                    const genotype2 = newGenotypes[1] || undefined;
                    const additionalGenotypes = newGenotypes.slice(2).length > 0 ? newGenotypes.slice(2) : undefined;
                    onUpdateSelectedNode({ genotype, genotype2, additionalGenotypes });
                    setGenotypeRowsCount(prev => Math.max(1, prev - 1));
                  };

                  return (
                    <div className="space-y-3.5">
                      {allGenotypes.slice(0, genotypeRowsCount).map((gVal, idx) => (
                        <div key={idx} className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <label htmlFor={`prop-node-genotype-${idx}`} className="text-xs text-muted-foreground uppercase tracking-wider truncate">
                                {idx === 0 ? "Genotype" : `Row ${idx + 1}`}
                              </label>
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(idx)}
                                  className="text-[10px] text-destructive hover:underline font-medium shrink-0"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <input
                              id={`prop-node-genotype-${idx}`}
                              value={gVal}
                              onChange={(e) => handleGenotypeChange(idx, e.target.value)}
                              placeholder="e.g. +/-"
                              className="flex-1 min-w-[120px] bg-background border border-border/80 rounded-lg px-2.5 py-1 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200"
                            />
                          </div>
                          <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                            {(["+/-", "+/+", "-/-", "+/Y", "-/Y"] as const).map((preset, pIdx) => {
                              const isActive = gVal === preset;
                              return (
                                <React.Fragment key={preset}>
                                  {pIdx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                                  <button
                                    type="button"
                                    onClick={() => handleGenotypeChange(idx, isActive ? "" : preset)}
                                    className={`flex-1 py-0.5 rounded-md text-[10px] font-mono transition-all border text-center ${
                                      isActive
                                        ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={() => setGenotypeRowsCount(prev => prev + 1)}
                        className="w-full py-1.5 border border-dashed border-border hover:border-primary/50 rounded-lg text-[10px] text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-1 mt-2 font-medium"
                      >
                        <Plus className="w-3 h-3" /> Add Genotype Row
                      </button>
                    </div>
                  );
                })()}
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
          <PanelShell title="Text Note" icon={<MessageSquare className="w-3.5 h-3.5" />} width="w-full">
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
