import { useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, User, Calendar, Stethoscope, Dna, Flag, MessageSquare } from "lucide-react";
import type { PedigreeNode, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { ANNOTATION_COLORS, ANNOTATION_SIZES, ANNOTATION_POSITIONS } from "@/features/pedigree-editor/canvas/types";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";

export function NodeEditModal({
  node, autoLabel, annotations,
  onClose, onUpdateNode, onAddAnnotation, onUpdateAnnotation, onDeleteAnnotation,
}: {
  node: PedigreeNode;
  autoLabel?: string;
  annotations: PedigreeAnnotation[];
  onClose: () => void;
  onUpdateNode: (updates: Partial<PedigreeNode>) => void;
  onAddAnnotation: (nodeId: string) => void;
  onUpdateAnnotation: (annId: string, updates: Partial<PedigreeAnnotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onCloseRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const statusValue = node.affected ? "affected" : node.carrier ? "carrier" : "unaffected";

  const field = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground";
  const sectionLabel = "text-xs uppercase tracking-widest text-muted-foreground block mb-2";
  const toggleBtn = (active: boolean) =>
    `w-9 h-5 rounded-full border transition-all relative flex-shrink-0 ${active ? "border-primary" : "border-border"}`;

  const handleAddAnnotation = useCallback(() => onAddAnnotation(node.id), [node.id, onAddAnnotation]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 h-full w-80" onClick={(e) => e.stopPropagation()}>
        <PanelShell
          title="Edit Node"
          icon={<User className="w-3.5 h-3.5" />}
          onClose={onClose}
          width="w-80"
        >
          {/* Identity */}
          <PanelSection title="Identity" icon={<User className="w-3 h-3" />}>
            <div>
              <label htmlFor="ne-name" className={sectionLabel}>Name</label>
              <input id="ne-name" type="text" value={node.label}
                onChange={(e) => onUpdateNode({ label: e.target.value })}
                placeholder="Patient name…" autoFocus className={field} />
            </div>
          </PanelSection>

          {/* Demographics */}
          <PanelSection title="Demographics" icon={<Calendar className="w-3 h-3" />}>
            <div>
              <label htmlFor="ne-dob" className={sectionLabel}>Date of Birth</label>
              <input id="ne-dob" type="date" value={node.dob ?? ""}
                onChange={(e) => onUpdateNode({ dob: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="ne-age" className={sectionLabel}>Age (years)</label>
              <input id="ne-age" type="number" value={node.age ?? ""}
                onChange={(e) => onUpdateNode({ age: e.target.value })}
                placeholder="e.g. 42" className={field} />
            </div>
          </PanelSection>

          {/* Clinical */}
          <PanelSection title="Clinical" icon={<Stethoscope className="w-3 h-3" />}>
            <div>
              <label htmlFor="ne-condition" className={sectionLabel}>Condition / Gene</label>
              <input id="ne-condition" type="text" value={node.condition ?? ""}
                onChange={(e) => onUpdateNode({ condition: e.target.value })}
                placeholder="e.g. BRCA1, HD onset 48y" className={field} />
              <p className="text-xs text-muted-foreground mt-1 opacity-60">Shown in amber italic below node</p>
            </div>
            <div>
              <label htmlFor="ne-notes" className={sectionLabel}>Clinical Notes</label>
              <textarea id="ne-notes" value={node.notes ?? ""}
                onChange={(e) => onUpdateNode({ notes: e.target.value })}
                placeholder="Clinical observations…" rows={4}
                className={field + " resize-none"} />
              <p className="text-xs text-muted-foreground mt-1 opacity-60">Sidebar & export only</p>
            </div>
          </PanelSection>

          {/* Type & Status */}
          <PanelSection title="Type & Status" icon={<Dna className="w-3 h-3" />}>
            <div>
              <label className={sectionLabel}>Sex / Type</label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
                {(["male", "female", "unknown", "pregnancy", "sab"] as const).map((t) => (
                  <button type="button" key={t} onClick={() => onUpdateNode({ type: t })}
                    className={`py-1.5 rounded-lg text-xs border transition-all ${
                      node.type === t
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}>
                    {t === "sab" ? "SAB" : t === "pregnancy" ? "Preg." : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={sectionLabel}>Status</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["unaffected", "affected", "carrier"] as const).map((s) => (
                  <button type="button" key={s} onClick={() => {
                    if (s === "affected") onUpdateNode({ affected: true, carrier: false });
                    else if (s === "carrier") onUpdateNode({ affected: false, carrier: true });
                    else onUpdateNode({ affected: false, carrier: false });
                  }}
                    className={`py-1.5 rounded-lg text-xs border transition-all ${
                      statusValue === s
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}>
                    {s === "unaffected" ? "—" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </PanelSection>

          {/* Flags */}
          <PanelSection title="Flags" icon={<Flag className="w-3 h-3" />}>
            {([
              { key: "deceased" as const, label: "Deceased" },
              { key: "proband"  as const, label: "Proband"  },
              { key: "pinned"   as const, label: "Pin position" },
            ]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
                <button type="button" onClick={() => onUpdateNode({ [key]: !node[key] })}
                  className={`${toggleBtn(!!node[key])} ${node[key] ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform ${node[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </PanelSection>

          {/* Annotations */}
          <PanelSection title={`Annotations (${annotations.length})`} icon={<MessageSquare className="w-3 h-3" />}>
            <button type="button" onClick={handleAddAnnotation}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <Plus className="w-3 h-3" /> Add Annotation
            </button>
            {annotations.length === 0 && (
              <p className="text-xs text-muted-foreground opacity-40 italic">No annotations</p>
            )}
            <div className="space-y-3">
              {annotations.map((ann, idx) => (
                <div key={ann.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                    <span className="text-xs text-muted-foreground uppercase tracking-widest">#{idx + 1}</span>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ann.color }} />
                    <span className="text-xs flex-1 truncate" style={{ color: ann.color }}>{ann.text || "—"}</span>
                    <button type="button" aria-label="Remove annotation"
                      onClick={() => onDeleteAnnotation(ann.id)}
                      className="text-destructive/60 hover:text-destructive transition-colors" title="Remove annotation">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="px-3 py-3 space-y-2.5">
                    <input type="text" value={ann.text}
                      onChange={(e) => onUpdateAnnotation(ann.id, { text: e.target.value })}
                      aria-label="Annotation text"
                      className="w-full bg-transparent border border-border rounded-md px-2.5 py-1.5 text-xs focus:border-primary outline-none transition-colors" />
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Color</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ANNOTATION_COLORS.map((c) => (
                          <button type="button" key={c}
                            onClick={() => onUpdateAnnotation(ann.id, { color: c })}
                            className="w-5 h-5 rounded-full flex-shrink-0 transition-all"
                            style={{ background: c, outline: ann.color === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset: 2 }}
                            title={c} />
                        ))}
                        <input type="color" value={ann.color}
                          onChange={(e) => onUpdateAnnotation(ann.id, { color: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer flex-shrink-0"
                          style={{ padding: 0, border: "none", background: "none" }} aria-label="Select color" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Size</div>
                        <div className="flex gap-1">
                          {ANNOTATION_SIZES.map((s) => (
                            <button type="button" key={s.value}
                              onClick={() => onUpdateAnnotation(ann.id, { fontSize: s.value })}
                              className={`flex-1 py-0.5 rounded text-xs border transition-all ${
                                ann.fontSize === s.value ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                              }`}>{s.label}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Position</div>
                        <div className="grid grid-cols-2 gap-1">
                          {ANNOTATION_POSITIONS.map((p) => (
                            <button type="button" key={p}
                              onClick={() => onUpdateAnnotation(ann.id, { position: p })}
                              className={`py-0.5 rounded text-xs border capitalize transition-all ${
                                ann.position === p ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                              }`}>{p.slice(0, 3)}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PanelSection>
        </PanelShell>
      </div>
    </div>
  );
}
