import type { PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { ArrowUp, ArrowDown, Trash2, Eye, EyeOff } from "lucide-react";

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
      className={`flex items-center gap-2 px-2.5 py-1.5 border rounded-lg transition-all ${
        isSelected
          ? "border-primary bg-primary/5 shadow-xs"
          : "border-border hover:border-muted-foreground/30"
      }`}
    >
      {/* Color indicator dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: annotation.color }}
      />

      {/* Text Label Button */}
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left text-xs truncate min-w-0 font-medium hover:text-primary transition-colors focus:outline-none"
        style={{ color: annotation.color }}
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
  );
}
