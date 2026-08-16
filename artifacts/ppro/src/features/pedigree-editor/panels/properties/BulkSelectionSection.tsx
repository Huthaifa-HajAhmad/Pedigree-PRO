import React, { useState } from "react";
import { Users, Dna, LayoutGrid, Stethoscope, Plus, Link2, Heart, GitBranch, Trash2 } from "lucide-react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { COUPLE_LABELS } from "./types";

export function BulkSelectionSection({
  selectedIds,
  canvasNodes,
  canvasEdges,
  onUpdateSelectedNode,
  onBulkUpdate,
  onDeleteSelected,
  onAlignSelected,
  onDistributeSelected,
  onMarkAsTwins,
  onUnmarkTwins,
  onRemoveEdges,
  onUpdateEdgeType,
  onToggleCoupleInverted,
  onCreateCoupleEdge,
  onCreateConsanguinityEdge,
  onCreateCoupleAndChild,
  onCreateParentsForGroup,
}: {
  selectedIds: Set<string>;
  canvasNodes: PedigreeNode[];
  canvasEdges: PedigreeEdge[];
  onUpdateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  onBulkUpdate: (updates: Partial<PedigreeNode> | ((node: PedigreeNode) => Partial<PedigreeNode>)) => void;
  onDeleteSelected: () => void;
  onAlignSelected: (axis: "x" | "y") => void;
  onDistributeSelected: (axis: "x" | "y") => void;
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
  const [genotypeRowsCount, setGenotypeRowsCount] = useState(1);

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

  const autoLabels = new Map<string, string>();
  canvasNodes.forEach(n => autoLabels.set(n.id, n.label || n.id));

  return (
    <PanelShell key={`bulk-${Array.from(selectedIds).sort().join(",")}`} title={`${selectedIds.size} Nodes`} icon={<Users className="w-3.5 h-3.5" />} width="w-full">
      {(() => {
        const selectedNodes = Array.from(selectedIds).map(id => canvasNodes.find(n => n.id === id)).filter(Boolean) as PedigreeNode[];
        const allDeceased = selectedNodes.length > 0 && selectedNodes.every(n => n.deceased);
        const allStillbirth = selectedNodes.length > 0 && selectedNodes.every(n => n.stillbirth);
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

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Flags (all)</label>
                  <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                    {([
                      { key: "deceased", label: "Deceased", active: allDeceased },
                      { key: "stillbirth", label: "Stillbirth", active: allStillbirth },
                      { key: "proband", label: "Proband", active: allProband },
                      { key: "pinned", label: "Pinned", active: allPinned }
                    ] as const).map((opt, idx) => {
                      return (
                        <React.Fragment key={opt.key}>
                          {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = !opt.active;
                              const updates: any = { [opt.key]: nextVal };
                              if (opt.key === "stillbirth" && nextVal) {
                                updates.deceased = true;
                              }
                              onBulkUpdate(updates);
                            }}
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

            <PanelSection title="Align & Distribute" icon={<LayoutGrid className="w-3.5 h-3.5" />}>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Align</span>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => onAlignSelected("y")} title="Align selected elements horizontally (same row)"
                      className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Horizontal</button>
                    <button type="button" onClick={() => onAlignSelected("x")} title="Align selected elements vertically (same column)"
                      className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Vertical</button>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Distribute (3+ nodes)</span>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => onDistributeSelected("x")} disabled={selectedIds.size < 3} title="Distribute selected elements horizontally"
                      className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed">Horizontal</button>
                    <button type="button" onClick={() => onDistributeSelected("y")} disabled={selectedIds.size < 3} title="Distribute selected elements vertically"
                      className="py-1.5 text-xs border border-border/80 rounded-lg text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed">Vertical</button>
                  </div>
                </div>
              </div>
            </PanelSection>

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

      {/* Existing Couple / Relationship Edits */}
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

      {/* Flip Partner Order */}
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
  );
}
