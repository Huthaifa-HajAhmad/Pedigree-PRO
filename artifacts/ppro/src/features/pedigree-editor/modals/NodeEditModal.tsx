import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Square, Circle, Diamond, Baby, AlertTriangle, RotateCcw,
} from "lucide-react";
import type { PedigreeNode, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { ANNOTATION_COLORS, ANNOTATION_POSITIONS } from "@/features/pedigree-editor/canvas/types";

function TypeIcon({ type }: { type: PedigreeNode["type"] }) {
  const cls = "w-3.5 h-3.5";
  switch (type) {
    case "male": return <Square className={cls} />;
    case "female": return <Circle className={cls} />;
    case "unknown": return <Diamond className={cls} />;
    case "pregnancy": return <Baby className={cls} />;
    case "sab": return <AlertTriangle className={cls} />;
  }
}

interface NodeEditModalProps {
  node: PedigreeNode;
  autoLabel?: string;
  annotations: PedigreeAnnotation[];
  onClose: () => void;
  onUpdateNode: (updates: Partial<PedigreeNode>) => void;
  onAddAnnotation: (nodeId: string) => void;
  onUpdateAnnotation: (annId: string, updates: Partial<PedigreeAnnotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
}

export function NodeEditModal({
  node, autoLabel, annotations,
  onClose, onUpdateNode, onAddAnnotation, onUpdateAnnotation, onDeleteAnnotation,
}: NodeEditModalProps) {
  const [draft, setDraft] = useState<Partial<PedigreeNode>>({});

  useEffect(() => {
    setDraft({
      label: node.label,
      dob: node.dob,
      age: node.age,
      condition: node.condition,
      notes: node.notes,
      type: node.type,
      affected: node.affected,
      carrier: node.carrier,
      deceased: node.deceased,
      proband: node.proband,
      pinned: node.pinned,
    });
  }, [node.id]);

  const current = { ...node, ...draft } as PedigreeNode;

  const patch = useCallback((u: Partial<PedigreeNode>) => {
    setDraft((prev) => ({ ...prev, ...u }));
  }, []);

  const handleSave = () => {
    const updates: Partial<PedigreeNode> = {};
    if (draft.label !== undefined && draft.label !== node.label) updates.label = draft.label;
    if (draft.dob !== undefined && draft.dob !== node.dob) updates.dob = draft.dob;
    if (draft.age !== undefined && draft.age !== node.age) updates.age = draft.age;
    if (draft.condition !== undefined && draft.condition !== node.condition) updates.condition = draft.condition;
    if (draft.notes !== undefined && draft.notes !== node.notes) updates.notes = draft.notes;
    if (draft.type !== undefined && draft.type !== node.type) updates.type = draft.type;
    if (draft.affected !== undefined && draft.affected !== node.affected) updates.affected = draft.affected;
    if (draft.carrier !== undefined && draft.carrier !== node.carrier) updates.carrier = draft.carrier;
    if (draft.deceased !== undefined && draft.deceased !== node.deceased) updates.deceased = draft.deceased;
    if (draft.proband !== undefined && draft.proband !== node.proband) updates.proband = draft.proband;
    if (draft.pinned !== undefined && draft.pinned !== node.pinned) updates.pinned = draft.pinned;
    if (Object.keys(updates).length > 0) onUpdateNode(updates);
    onClose();
  };

  const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  const sectionLabel = "text-xs uppercase tracking-widest text-muted-foreground block mb-2";
  const toggleBtn = (active: boolean) =>
    `w-9 h-5 rounded-full border transition-all relative flex-shrink-0 ${active ? "border-primary bg-primary" : "border-border bg-muted"}`;

  const handleAddAnnotation = useCallback(() => onAddAnnotation(node.id), [node.id, onAddAnnotation]);

  const statusValue = current.affected ? "affected" : current.carrier ? "carrier" : "unaffected";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <TypeIcon type={current.type} />
            Edit Node
            {autoLabel && (
              <span className="text-xs text-muted-foreground font-normal ml-1">({autoLabel})</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6">
          {/* Identity */}
          <section>
            <label className={sectionLabel}>Identity</label>
            <input
              type="text"
              value={current.label ?? ""}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder="Patient name…"
              autoFocus
              className={inputCls}
            />
          </section>

          {/* Demographics */}
          <section>
            <label className={sectionLabel}>Demographics</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Date of Birth</label>
                <input
                  type="date"
                  value={current.dob ?? ""}
                  onChange={(e) => patch({ dob: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Age (years)</label>
                <input
                  type="number"
                  value={current.age ?? ""}
                  onChange={(e) => patch({ age: e.target.value })}
                  placeholder="e.g. 42"
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* Clinical */}
          <section>
            <label className={sectionLabel}>Clinical Notes</label>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Condition / Gene</label>
                <input
                  type="text"
                  value={current.condition ?? ""}
                  onChange={(e) => patch({ condition: e.target.value })}
                  placeholder="e.g. BRCA1, HD onset 48y"
                  className={inputCls}
                />
                <p className="text-xs text-muted-foreground mt-1 opacity-60">Shown in amber italic below node</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <textarea
                  value={current.notes ?? ""}
                  onChange={(e) => patch({ notes: e.target.value })}
                  placeholder="Clinical observations…"
                  rows={3}
                  className={`${inputCls} resize-none min-h-[72px]`}
                />
                <p className="text-xs text-muted-foreground mt-1 opacity-60">{(current.notes ?? "").length} characters</p>
              </div>
            </div>
          </section>

          {/* Type & Status */}
          <section>
            <label className={sectionLabel}>Type & Status</label>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Sex / Type</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(["male", "female", "unknown", "pregnancy", "sab"] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => patch({ type: t })}
                      className={`py-1.5 rounded-lg text-xs border transition-all ${
                        current.type === t
                          ? "border-primary text-primary bg-primary/10"
                          : "border-border text-muted-foreground hover:border-primary"
                      }`}
                    >
                      {t === "sab" ? "SAB" : t === "pregnancy" ? "Preg." : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["unaffected", "affected", "carrier"] as const).map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => {
                        if (s === "affected") patch({ affected: true, carrier: false });
                        else if (s === "carrier") patch({ affected: false, carrier: true });
                        else patch({ affected: false, carrier: false });
                      }}
                      className={`py-1.5 rounded-lg text-xs border transition-all ${
                        statusValue === s
                          ? "border-primary text-primary bg-primary/10"
                          : "border-border text-muted-foreground hover:border-primary"
                      }`}
                    >
                      {s === "unaffected" ? "—" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Flags */}
          <section>
            <label className={sectionLabel}>Flags</label>
            <div className="space-y-2">
              {([
                { key: "deceased" as const, label: "Deceased" },
                { key: "proband" as const, label: "Proband" },
                { key: "pinned" as const, label: "Pin position" },
              ]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
                  <button
                    type="button"
                    onClick={() => patch({ [key]: !current[key] })}
                    className={toggleBtn(!!current[key])}
                    aria-pressed={!!current[key]}
                  >
                    <span className={`absolute top-[1px] left-[1px] w-4 h-4 rounded-full shadow-sm transition-transform bg-card ${current[key] ? "translate-x-[16px]" : "translate-x-0"}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Annotations */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className={sectionLabel + " mb-0"}>Annotations ({annotations.length})</label>
              <button
                type="button"
                onClick={handleAddAnnotation}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
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
                    <button
                      type="button"
                      aria-label="Remove annotation"
                      onClick={() => onDeleteAnnotation(ann.id)}
                      className="text-destructive/60 hover:text-destructive transition-colors"
                      title="Remove annotation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="px-3 py-3 space-y-2.5">
                    <input
                      type="text"
                      value={ann.text}
                      onChange={(e) => onUpdateAnnotation(ann.id, { text: e.target.value })}
                      aria-label="Annotation text"
                      className="w-full bg-transparent border border-border rounded-md px-2.5 py-1.5 text-xs focus:border-primary outline-none transition-colors"
                    />
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Color</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ANNOTATION_COLORS.map((c) => (
                          <button
                            type="button"
                            key={c}
                            onClick={() => onUpdateAnnotation(ann.id, { color: c })}
                            className="w-5 h-5 rounded-full flex-shrink-0 transition-all"
                            style={{ background: c, outline: ann.color === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset: 2 }}
                            title={c}
                          />
                        ))}
                        <input
                          type="color"
                          value={ann.color}
                          onChange={(e) => onUpdateAnnotation(ann.id, { color: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer flex-shrink-0"
                          style={{ padding: 0, border: "none", background: "none" }}
                          aria-label="Select color"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                         <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Size</div>
                         <div className="flex items-center gap-2">
                           <input
                             type="range"
                             min={8}
                             max={20}
                             step={1}
                             value={ann.fontSize}
                             onChange={(e) => onUpdateAnnotation(ann.id, { fontSize: Number(e.target.value) })}
                             className="flex-1 accent-primary h-1"
                           />
                           <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-6 text-right">{ann.fontSize}</span>
                         </div>
                       </div>
                      <div>
                        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Position</div>
                        <div className="grid grid-cols-2 gap-1">
                          {ANNOTATION_POSITIONS.map((p) => (
                            <button
                              type="button"
                              key={p}
                              onClick={() => onUpdateAnnotation(ann.id, { position: p })}
                              className={`py-0.5 rounded text-xs border capitalize transition-all ${
                                ann.position === p ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                              }`}
                            >{p.slice(0, 3)}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {((ann.offsetX ?? 0) !== 0 || (ann.offsetY ?? 0) !== 0) && (
                      <button
                        type="button"
                        onClick={() => onUpdateAnnotation(ann.id, { offsetX: 0, offsetY: 0 })}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset position
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save Changes
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
