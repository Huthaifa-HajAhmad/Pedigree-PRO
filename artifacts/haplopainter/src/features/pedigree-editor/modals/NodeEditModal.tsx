import { useEffect, useRef } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { PedigreeNode, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { ANNOTATION_COLORS, ANNOTATION_SIZES, ANNOTATION_POSITIONS } from "@/features/pedigree-editor/canvas/types";

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
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const statusValue = node.affected ? "affected" : node.carrier ? "carrier" : "unaffected";

  const field = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground";
  const sectionLabel = "text-[10px] uppercase tracking-widest text-muted-foreground block mb-2";
  const toggleBtn = (active: boolean) =>
    `w-9 h-5 rounded-full border transition-all relative flex-shrink-0 ${active ? "border-primary" : "border-border"}`;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed z-[60] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden"
        style={{ background: "hsl(var(--popover))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Edit Node</div>
            <div className="text-sm font-semibold mt-0.5" style={{ color: "hsl(var(--primary))" }}>
              {autoLabel || node.id}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto max-h-[72vh] p-5 space-y-5">

          {/* ── Name ─────────────────────────────────────────── */}
          <div>
            <label className={sectionLabel}>Name</label>
            <input
              type="text"
              value={node.label}
              onChange={(e) => onUpdateNode({ label: e.target.value })}
              placeholder="Patient name…"
              autoFocus
              className={field}
            />
          </div>

          {/* ── Date of Birth ───────────────────────────────── */}
          <div>
            <label className={sectionLabel}>Date of Birth</label>
            <input
              type="date"
              value={node.dob ?? ""}
              onChange={(e) => onUpdateNode({ dob: e.target.value })}
              className={field}
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* ── Age ─────────────────────────────────────────── */}
          <div>
            <label className={sectionLabel}>Age (years)</label>
            <input
              type="number"
              value={node.age ?? ""}
              onChange={(e) => onUpdateNode({ age: e.target.value })}
              placeholder="e.g. 42"
              className={field}
            />
          </div>

          {/* ── Condition / Gene ────────────────────────────── */}
          <div>
            <label className={sectionLabel}>Condition / Gene</label>
            <input
              type="text"
              value={node.condition ?? ""}
              onChange={(e) => onUpdateNode({ condition: e.target.value })}
              placeholder="e.g. BRCA1, HD onset 48y"
              className={field}
            />
            <p className="text-[10px] text-muted-foreground mt-1 opacity-60">Shown in amber italic below the node on canvas</p>
          </div>

          {/* ── Clinical Notes ───────────────────────────────── */}
          <div>
            <label className={sectionLabel}>Clinical Notes</label>
            <textarea
              value={node.notes ?? ""}
              onChange={(e) => onUpdateNode({ notes: e.target.value })}
              placeholder="Longer clinical observations, referrals, test results…"
              rows={4}
              className={field + " resize-none"}
            />
            <p className="text-[10px] text-muted-foreground mt-1 opacity-60">Sidebar & export only — not displayed on canvas</p>
          </div>

          {/* ── Sex / Type ──────────────────────────────────── */}
          <div>
            <label className={sectionLabel}>Sex / Type</label>
            <div className="grid grid-cols-5 gap-1.5">
              {(["male", "female", "unknown", "pregnancy", "sab"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onUpdateNode({ type: t })}
                  className={`py-1.5 rounded-lg text-xs border transition-all ${
                    node.type === t
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {t === "sab" ? "SAB" : t === "pregnancy" ? "Preg." : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Status ──────────────────────────────────────── */}
          <div>
            <label className={sectionLabel}>Status</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { value: "unaffected", label: "Unaffected" },
                { value: "affected",   label: "Affected" },
                { value: "carrier",    label: "Carrier" },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    if (value === "affected")   onUpdateNode({ affected: true,  carrier: false });
                    else if (value === "carrier") onUpdateNode({ affected: false, carrier: true });
                    else                          onUpdateNode({ affected: false, carrier: false });
                  }}
                  className={`py-1.5 rounded-lg text-xs border transition-all ${
                    statusValue === value
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Toggles ─────────────────────────────────────── */}
          <div className="space-y-3">
            {([
              { key: "deceased" as const, label: "Deceased" },
              { key: "proband"  as const, label: "Proband"  },
              { key: "pinned"   as const, label: "Pin position (auto-layout skip)" },
            ]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
                <button
                  onClick={() => onUpdateNode({ [key]: !node[key] })}
                  className={toggleBtn(!!node[key])}
                  style={node[key] ? { background: "hsl(var(--primary))" } : { background: "hsl(var(--muted))" }}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform ${node[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>

          {/* ── Annotations ─────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className={sectionLabel + " mb-0"}>
                Annotations ({annotations.length})
              </label>
              <button
                onClick={() => onAddAnnotation(node.id)}
                className="text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {annotations.length === 0 && (
              <p className="text-xs text-muted-foreground opacity-40 italic py-2">No annotations — click Add to create one</p>
            )}

            <div className="space-y-3">
              {annotations.map((ann, idx) => (
                <div key={ann.id} className="border border-border rounded-lg overflow-hidden">
                  {/* Ann header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">#{idx + 1}</span>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ann.color }} />
                    <span className="text-xs flex-1 truncate" style={{ color: ann.color }}>{ann.text || "—"}</span>
                    <button
                      onClick={() => onDeleteAnnotation(ann.id)}
                      className="text-destructive/60 hover:text-destructive transition-colors"
                      title="Remove annotation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Ann editor — always expanded */}
                  <div className="px-3 py-3 space-y-2.5">
                    {/* Text */}
                    <input
                      type="text"
                      value={ann.text}
                      onChange={(e) => onUpdateAnnotation(ann.id, { text: e.target.value })}
                      placeholder="Annotation text…"
                      className="w-full bg-transparent border border-border rounded-md px-2.5 py-1.5 text-xs focus:border-primary outline-none transition-colors"
                    />

                    {/* Color swatches + custom picker */}
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Color</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ANNOTATION_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => onUpdateAnnotation(ann.id, { color: c })}
                            className="w-5 h-5 rounded-full flex-shrink-0 transition-all"
                            style={{
                              background: c,
                              outline: ann.color === c ? `2px solid ${c}` : "2px solid transparent",
                              outlineOffset: 2,
                            }}
                            title={c}
                          />
                        ))}
                        <input
                          type="color"
                          value={ann.color}
                          onChange={(e) => onUpdateAnnotation(ann.id, { color: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer flex-shrink-0"
                          style={{ padding: 0, border: "none", background: "none" }}
                          title="Custom color"
                        />
                      </div>
                    </div>

                    {/* Size + Position row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Size</div>
                        <div className="flex gap-1">
                          {ANNOTATION_SIZES.map((s) => (
                            <button
                              key={s.value}
                              onClick={() => onUpdateAnnotation(ann.id, { fontSize: s.value })}
                              className={`flex-1 py-0.5 rounded text-xs border transition-all ${
                                ann.fontSize === s.value
                                  ? "border-primary text-primary bg-primary/10"
                                  : "border-border text-muted-foreground hover:border-primary"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Position</div>
                        <div className="grid grid-cols-2 gap-1">
                          {ANNOTATION_POSITIONS.map((p) => (
                            <button
                              key={p}
                              onClick={() => onUpdateAnnotation(ann.id, { position: p })}
                              className={`py-0.5 rounded text-xs border capitalize transition-all ${
                                ann.position === p
                                  ? "border-primary text-primary bg-primary/10"
                                  : "border-border text-muted-foreground hover:border-primary"
                              }`}
                            >
                              {p.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary/10 border border-primary text-primary text-xs hover:bg-primary/20 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}