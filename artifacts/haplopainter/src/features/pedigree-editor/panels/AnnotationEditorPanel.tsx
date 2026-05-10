import type { PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { ANNOTATION_COLORS, ANNOTATION_SIZES, ANNOTATION_POSITIONS } from "@/features/pedigree-editor/canvas/types";
import { ChevronDown, Trash2 } from "lucide-react";

export function AnnotationEditorPanel({
  annotation, isSelected, onSelect, onUpdate, onDelete,
}: {
  annotation: PedigreeAnnotation;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (u: Partial<PedigreeAnnotation>) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`mb-1.5 border rounded overflow-hidden transition-all ${isSelected ? "border-primary/70" : "border-border"}`}>
      <button className="w-full flex items-center justify-between px-2.5 py-1.5 text-left" onClick={onSelect}>
        <span className="text-xs truncate max-w-[110px]" style={{ color: annotation.color }}>
          {annotation.text || "—"}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-muted-foreground capitalize">{annotation.position}</span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isSelected ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isSelected && (
        <div className="px-2.5 pb-2.5 pt-1.5 space-y-2 border-t border-border">
          <input
            type="text"
            value={annotation.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            className="w-full bg-transparent border border-border rounded px-2 py-1 text-xs focus:border-primary outline-none"
            placeholder="Annotation text…"
            autoFocus
          />

          {/* Color swatches */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {ANNOTATION_COLORS.map((c) => (
              <button key={c} onClick={() => onUpdate({ color: c })}
                className="w-4 h-4 rounded-full flex-shrink-0 transition-all"
                style={{ background: c, outline: annotation.color === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset: 2 }}
                title={c}
              />
            ))}
            <input type="color" value={annotation.color}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-4 h-4 rounded cursor-pointer"
              title="Custom color"
              style={{ padding: 0, border: "none", background: "none" }}
            />
          </div>

          {/* Font size */}
          <div className="flex gap-1">
            {ANNOTATION_SIZES.map((s) => (
              <button key={s.value} onClick={() => onUpdate({ fontSize: s.value })}
                className={`flex-1 py-0.5 rounded text-xs border transition-all ${annotation.fontSize === s.value ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Position */}
          <div className="grid grid-cols-4 gap-1">
            {ANNOTATION_POSITIONS.map((p) => (
              <button key={p} onClick={() => onUpdate({ position: p })}
                className={`py-0.5 rounded text-xs border transition-all capitalize ${annotation.position === p ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"}`}>
                {p[0].toUpperCase() + p.slice(1, 3)}
              </button>
            ))}
          </div>

          <button onClick={onDelete}
            className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors">
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}