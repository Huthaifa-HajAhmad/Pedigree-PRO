import React, { useState, useEffect } from "react";
import { User, Dna, MessageSquare, Stethoscope, Trash2, Plus } from "lucide-react";
import type { PedigreeNode, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { AnnotationEditorPanel } from "@/features/pedigree-editor/panels/AnnotationEditorPanel";
import { NodeQuadrantShadingSection } from "./NodeQuadrantShadingSection";
import { calculateAgeFromDob } from "./types";

export function SingleNodeSection({
  singleSelected,
  canvasAnnotations,
  selectedAnnotationId,
  onUpdateSelectedNode,
  onDeleteSelected,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onSelectAnnotation,
  onReorderAnnotations,
}: {
  singleSelected: PedigreeNode;
  canvasAnnotations: PedigreeAnnotation[];
  selectedAnnotationId: string | null;
  onUpdateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  onDeleteSelected: () => void;
  onAddAnnotation: (nodeId: string) => void;
  onUpdateAnnotation: (annId: string, updates: Partial<PedigreeAnnotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
  onSelectAnnotation: (annId: string | null) => void;
  onReorderAnnotations?: (annId: string, direction: "up" | "down") => void;
}) {
  const [genotypeRowsCount, setGenotypeRowsCount] = useState(1);

  useEffect(() => {
    let count = 1;
    if (singleSelected.genotype2 !== undefined) {
      count = 2;
    }
    if (singleSelected.additionalGenotypes && singleSelected.additionalGenotypes.length > 0) {
      count = 2 + singleSelected.additionalGenotypes.length;
    }
    setGenotypeRowsCount(count);
  }, [singleSelected.id, singleSelected.genotype2, singleSelected.additionalGenotypes]);

  const getStatus = (node: PedigreeNode) => node.affected ? "affected" : node.carrier ? "carrier" : "unaffected";
  const applyStatus = (status: string) => {
    const upd: Partial<PedigreeNode> = {
      affected: status === "affected",
      carrier: status === "carrier",
    };
    if (status !== "affected") {
      upd.shading = undefined;
    }
    onUpdateSelectedNode(upd);
  };

  return (
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
      </PanelSection>

      {/* Type & Status */}
      <PanelSection title="Type & Status" icon={<Dna className="w-3 h-3" />}>
        <div className="space-y-4">
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

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Status & Flags</label>
            <div className="space-y-1.5">
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

              <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                {([
                  { key: "deceased", label: "Deceased", disabled: false },
                  { key: "stillbirth", label: "Stillbirth", disabled: singleSelected.type === "pregnancy" || singleSelected.type === "sab" },
                  { key: "proband", label: "Proband", disabled: false },
                  { key: "pinned", label: "Pinned", disabled: false }
                ] as const).map((opt, idx) => {
                  const isActive = !!singleSelected[opt.key];
                  const disabled = opt.disabled;
                  return (
                    <React.Fragment key={opt.key}>
                      {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                      <button
                        type="button"
                        key={opt.key}
                        data-testid={`toggle-${opt.key}`}
                        onClick={() => {
                          if (disabled) return;
                          const nextVal = !singleSelected[opt.key];
                          const updates: any = { [opt.key]: nextVal };
                          if (opt.key === "stillbirth" && nextVal) {
                            updates.deceased = true;
                          }
                          onUpdateSelectedNode(updates);
                        }}
                        className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all border text-center ${
                          disabled
                            ? "opacity-40 cursor-not-allowed border-transparent text-muted-foreground"
                            : isActive
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

          {["left-half", "right-half", "top-half", "bottom-half"].includes(singleSelected.shading ?? "") && (
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

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Shading Style</label>
            <div className="space-y-1.5">
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

          {(singleSelected.shading === "quadrant" || 
            (singleSelected.shading && (singleSelected.shading.startsWith("q") || singleSelected.shading.includes(",")))) && (
            <NodeQuadrantShadingSection
              singleSelected={singleSelected}
              onUpdateSelectedNode={onUpdateSelectedNode}
            />
          )}

          {(singleSelected.shading || singleSelected.affected) && (
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

          <div className="space-y-4 pt-1">
            {(() => {
              const allGenotypes: string[] = [];
              allGenotypes.push(singleSelected.genotype ?? "");
              allGenotypes.push(singleSelected.genotype2 ?? "");
              if (singleSelected.additionalGenotypes) {
                allGenotypes.push(...singleSelected.additionalGenotypes);
              }

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
  );
}
