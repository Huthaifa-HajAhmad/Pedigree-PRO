import type { PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { ANNOTATION_COLORS, ANNOTATION_SIZES, ANNOTATION_POSITIONS } from "@/features/pedigree-editor/canvas/types";
import { ArrowUp, ArrowDown, Trash2, Eye, EyeOff } from "lucide-react";
import React from "react";

export function AnnotationEditorPanel({
  annotation, isSelected, onSelect, onUpdate, onDelete, onReorder, isFirst = false, isLast = false,
}: {
  annotation: PedigreeAnnotation;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (u: Partial<PedigreeAnnotation>) => void;
  onDelete: () => void;
  onReorder?: (direction: "up" | "down") => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2.5 p-2.5 border rounded-lg transition-all duration-200 ${
        isSelected
          ? "border-primary bg-primary/5 shadow-xs"
          : "border-border hover:border-muted-foreground/30"
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center gap-2 w-full">
        {/* Color indicator dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-border/50"
          style={{ background: annotation.color || "currentColor" }}
        />

        {/* Text Label Button */}
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 text-left text-xs truncate min-w-0 font-medium hover:text-primary transition-colors focus:outline-none"
          style={{ color: annotation.color || undefined }}
          title={annotation.text || "Unnamed annotation"}
        >
          {annotation.text || "—"}
        </button>

        {/* Action buttons group */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Move Up */}
          {onReorder && (
            <button
              type="button"
              onClick={() => onReorder("up")}
              disabled={isFirst}
              className={`p-1 rounded-md transition-colors ${
                isFirst
                  ? "text-muted-foreground/20 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
              title="Move stack up"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Move Down */}
          {onReorder && (
            <button
              type="button"
              onClick={() => onReorder("down")}
              disabled={isLast}
              className={`p-1 rounded-md transition-colors ${
                isLast
                  ? "text-muted-foreground/20 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
              title="Move stack down"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Visibility toggle */}
          <button
            type="button"
            onClick={() => onUpdate({ hidden: !annotation.hidden })}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title={annotation.hidden ? "Show annotation" : "Hide annotation"}
          >
            {annotation.hidden ? (
              <EyeOff className="w-3.5 h-3.5 text-muted-foreground/50" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Remove button */}
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Remove annotation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Controls */}
      {isSelected && (
        <div className="space-y-3 pt-2 border-t border-border/40 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Text Input */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Note Text</label>
            <input
              type="text"
              value={annotation.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="Enter note text..."
              className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200"
            />
          </div>

          {/* Position and Size */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Position</label>
              <select
                value={annotation.position}
                onChange={(e) => onUpdate({ position: e.target.value as any })}
                className="w-full bg-background border border-border/80 rounded-lg px-2 py-1.5 text-xs outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 transition-all duration-200"
              >
                {ANNOTATION_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Size</label>
              <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
                {ANNOTATION_SIZES.map((sz, idx) => {
                  const isActive = annotation.fontSize === sz.value;
                  return (
                    <React.Fragment key={sz.value}>
                      {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                      <button
                        type="button"
                        onClick={() => onUpdate({ fontSize: sz.value })}
                        className={`flex-1 py-1 rounded-md text-[10px] border transition-all duration-200 ${
                          isActive
                            ? "bg-card text-primary border-border/75 shadow-xs font-bold"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                        }`}
                      >
                        {sz.label}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Color Presets */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Color</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {ANNOTATION_COLORS.map((c) => {
                const isActive = annotation.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdate({ color: c })}
                    className={`w-5.5 h-5.5 rounded-full border transition-all duration-200 hover:scale-115 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex items-center justify-center`}
                    style={{
                      backgroundColor: c,
                      borderColor: isActive ? "hsl(var(--primary))" : "hsl(var(--border)/0.5)",
                      boxShadow: isActive ? "0 0 0 1px hsl(var(--primary))" : "none",
                    }}
                    title={c}
                  />
                );
              })}
              {/* Custom Color Input */}
              <label
                className="relative w-5.5 h-5.5 rounded-full overflow-hidden flex-shrink-0 transition-transform hover:scale-110 cursor-pointer border border-border/50"
                style={{
                  background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                  outline: !ANNOTATION_COLORS.includes(annotation.color as any) ? "2px solid hsl(var(--primary))" : "none",
                  outlineOffset: 1,
                }}
                title="Custom color"
              >
                <input
                  type="color"
                  value={annotation.color || "#000000"}
                  onChange={(e) => onUpdate({ color: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Custom color"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
