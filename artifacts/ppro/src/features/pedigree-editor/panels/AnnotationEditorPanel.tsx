import { useState, useEffect, useRef } from "react";
import type { PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { ANNOTATION_COLORS, ANNOTATION_POSITIONS } from "@/features/pedigree-editor/canvas/types";
import { ChevronDown, Trash2, RotateCcw, Eye, EyeOff, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

const POSITION_ICONS: Record<string, React.ReactNode> = {
  above: <ArrowUp className="w-3 h-3" />,
  below: <ArrowDown className="w-3 h-3" />,
  left: <ArrowLeft className="w-3 h-3" />,
  right: <ArrowRight className="w-3 h-3" />,
};

export function AnnotationEditorPanel({
  annotation, isSelected, onSelect, onUpdate, onDelete,
}: {
  annotation: PedigreeAnnotation;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (u: Partial<PedigreeAnnotation>) => void;
  onDelete: () => void;
}) {
  const [draftText, setDraftText] = useState(annotation.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftText(annotation.text);
  }, [annotation.text]);

  const commitText = () => {
    const trimmed = draftText.trim();
    if (trimmed && trimmed !== annotation.text) {
      onUpdate({ text: trimmed });
    } else {
      setDraftText(annotation.text);
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${isSelected ? "border-primary/60 bg-primary/5" : "border-border"}`}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        onClick={onSelect}
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: annotation.color }}
        />
        <span className="text-xs truncate flex-1 min-w-0" style={{ color: annotation.color }}>
          {annotation.text || "—"}
        </span>
        <span className="text-[10px] text-muted-foreground capitalize bg-muted/60 rounded px-1.5 py-0.5">
          {annotation.position}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform flex-shrink-0 ${isSelected ? "rotate-180" : ""}`}
        />
      </button>

      {isSelected && (
        <div className="px-3 py-3 space-y-3 border-t border-border">
          {/* Text input */}
          <div>
            <input
              ref={inputRef}
              type="text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitText(); }
                if (e.key === "Escape") { setDraftText(annotation.text); (e.target as HTMLInputElement).blur(); }
              }}
              className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs focus:border-muted-foreground/45 focus-visible:ring-0 outline-none hover:bg-accent/20 transition-all duration-200 shadow-none"
              aria-label="Annotation text"
            />
            <div className="text-[10px] text-muted-foreground/50 mt-1">Press Enter to apply</div>
          </div>

          {/* Color swatches */}
          <div className="flex items-center gap-2 flex-wrap">
            {ANNOTATION_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => onUpdate({ color: c })}
                className="w-5 h-5 rounded-full flex-shrink-0 transition-all hover:scale-110 border border-border/50"
                style={{
                  background: c,
                  outline: annotation.color === c ? `2px solid ${c}` : "2px solid transparent",
                  outlineOffset: 2,
                }}
                title={c}
              />
            ))}
            <label
              className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0 transition-transform hover:scale-110 cursor-pointer"
              style={{
                boxShadow: "0 0 0 1px hsl(var(--border)/0.3)",
                background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
              }}
              title="Custom color"
            >
              <input
                type="color"
                value={annotation.color}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                style={{ padding: 0, border: "none", background: "none" }}
                aria-label="Custom color"
              />
            </label>
          </div>

          {/* Size + Position row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Size</span>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{annotation.fontSize}px</span>
              </div>
              <input
                type="range"
                min={8}
                max={20}
                step={1}
                value={annotation.fontSize}
                onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
                className="w-full accent-primary h-1"
              />
            </div>

            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1.5">Position</div>
              <div className="flex items-center gap-1">
                {ANNOTATION_POSITIONS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => onUpdate({ position: p })}
                    className={`flex-1 flex items-center justify-center py-1 rounded-lg text-xs border transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      annotation.position === p
                        ? "border-primary/60 text-primary bg-primary/5 hover:bg-primary/10"
                        : "border-border/80 text-muted-foreground hover:bg-accent/30 hover:border-muted-foreground/30 hover:text-foreground"
                    }`}
                    title={p}
                  >
                    {POSITION_ICONS[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => onUpdate({ hidden: !annotation.hidden })}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-accent/30 transition-all duration-200"
              title={annotation.hidden ? "Show annotation" : "Hide annotation"}
            >
              {annotation.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {annotation.hidden ? "Hidden" : "Visible"}
            </button>
 
            <div className="flex items-center gap-1.5">
              {((annotation.offsetX ?? 0) !== 0 || (annotation.offsetY ?? 0) !== 0) && (
                <button
                  type="button"
                  onClick={() => onUpdate({ offsetX: 0, offsetY: 0 })}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-accent/30 transition-all duration-200"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1 text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10 px-2 py-1 rounded-lg transition-all duration-200"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
