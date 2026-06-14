import { useEffect, useRef, useState, useCallback } from "react";
import type { PedigreeAnnotation, PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { ANNOTATION_COLORS, ANNOTATION_POSITIONS } from "@/features/pedigree-editor/canvas/types";
import { X, Trash2, Eye, EyeOff, MessageSquare, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

const POSITION_ICONS: Record<string, React.ReactNode> = {
  above: <ArrowUp className="w-3.5 h-3.5" />,
  below: <ArrowDown className="w-3.5 h-3.5" />,
  left: <ArrowLeft className="w-3.5 h-3.5" />,
  right: <ArrowRight className="w-3.5 h-3.5" />,
};

interface AnnotationQuickEditPopoverProps {
  annotation: PedigreeAnnotation;
  svgRef: React.RefObject<SVGSVGElement | null>;
  canvasNodes: PedigreeNode[];
  onClose: () => void;
  onUpdateAnnotation: (updates: Partial<PedigreeAnnotation>) => void;
  onDeleteAnnotation: () => void;
}

export function AnnotationQuickEditPopover({
  annotation, svgRef, canvasNodes, onClose, onUpdateAnnotation, onDeleteAnnotation,
}: AnnotationQuickEditPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; placement: "left" | "right" } | null>(null);
  const [draftText, setDraftText] = useState(annotation.text);
  const cfg = useCanvasConfig();

  useEffect(() => {
    setDraftText(annotation.text);
  }, [annotation.id, annotation.text]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [annotation.id]);

  const updatePosition = useCallback(() => {
    const el = document.getElementById(`ann-element-${annotation.id}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pw = 300;
    const ph = annotation.nodeId ? 385 : 325; // Node-attached annotations have the position selector row, making them taller

    let placement: "left" | "right" = "right";
    let x = rect.right + 12;
    let y = rect.top + rect.height / 2 - ph / 2;

    if (x + pw > window.innerWidth - 8) {
      x = Math.max(8, rect.left - pw - 12);
      placement = "left";
    }
    if (y < 8) y = 8;
    if (y + ph > window.innerHeight - 8) y = window.innerHeight - ph - 8;
    setPos({ x, y, placement });
  }, [annotation.id, annotation.nodeId]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [updatePosition]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  const commitText = () => {
    const trimmed = draftText.trim();
    if (trimmed !== annotation.text) {
      onUpdateAnnotation({ text: trimmed || "Note" });
    }
  };

  const resolvedBold = annotation.bold !== undefined ? annotation.bold : cfg.config.annBold;
  const resolvedUppercase = annotation.uppercase !== undefined ? annotation.uppercase : cfg.config.annUppercase;

  const toggleBold = () => {
    onUpdateAnnotation({ bold: !resolvedBold });
  };

  const toggleUppercase = () => {
    onUpdateAnnotation({ uppercase: !resolvedUppercase });
  };

  if (!pos) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[300px] border border-border/80 rounded-xl shadow-2xl bg-background/95 backdrop-blur-md p-4 flex flex-col gap-3.5 outline-none animate-in fade-in zoom-in-95 duration-200"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="Edit annotation"
    >
      {/* Anchor Caret Arrow */}
      <div
        className={`absolute w-2.5 h-2.5 bg-background border-l border-t border-border/80 z-[-1] transition-transform duration-300 ${
          pos.placement === "right"
            ? "-left-[6px] top-[calc(50%-5px)] rotate-[-45deg]"
            : "-right-[6px] top-[calc(50%-5px)] rotate-[135deg]"
        }`}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/25">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground">
              {annotation.nodeId ? "Node Annotation" : "Floating Text Note"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Text Input */}
      <div className="space-y-1">
        <label htmlFor="quick-ann-text" className="text-[10px] font-semibold text-foreground/80">Text Content</label>
        <input
          ref={inputRef}
          id="quick-ann-text"
          type="text"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitText(); onClose(); } }}
          placeholder="Enter note text..."
          className="w-full bg-muted/20 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
          style={{
            fontStyle: annotation.italic ? "italic" : "normal",
            fontWeight: resolvedBold ? 600 : 400,
            textTransform: resolvedUppercase ? "uppercase" : "none",
          }}
        />
      </div>

      {/* Font Size & Colors */}
      <div className="grid grid-cols-2 gap-3">
        {/* Size Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="quick-ann-size" className="text-[10px] font-semibold text-foreground/80">Font Size</label>
            <span className="text-[10px] font-mono text-muted-foreground">{annotation.fontSize}px</span>
          </div>
          <div className="flex items-center h-8">
            <input
              id="quick-ann-size"
              type="range"
              min={8}
              max={24}
              step={1}
              value={annotation.fontSize}
              onChange={(e) => onUpdateAnnotation({ fontSize: Number(e.target.value) })}
              className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Formatting Buttons */}
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-foreground/80 block">Formatting</span>
          <div className="flex items-center gap-1 h-8">
            <button
              type="button"
              onClick={toggleBold}
              className={`flex-1 h-7 rounded-md text-xs font-bold border transition-all ${
                resolvedBold
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent/40"
              }`}
              title="Toggle Bold"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => onUpdateAnnotation({ italic: !annotation.italic })}
              className={`flex-1 h-7 rounded-md text-xs italic border transition-all ${
                annotation.italic
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border text-muted-foreground hover:bg-accent/40"
              }`}
              title="Toggle Italic"
            >
              I
            </button>
            <button
              type="button"
              onClick={toggleUppercase}
              className={`flex-1 h-7 rounded-md text-[9px] uppercase border transition-all ${
                resolvedUppercase
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border text-muted-foreground hover:bg-accent/40"
              }`}
              title="Toggle Uppercase"
            >
              TT
            </button>
          </div>
        </div>
      </div>

      {/* Colors Swatches */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold text-foreground/80 block">Text Color</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {ANNOTATION_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => onUpdateAnnotation({ color: c })}
              className="w-5 h-5 rounded-full flex-shrink-0 transition-all hover:scale-110 border border-border/50"
              style={{
                background: c,
                outline: annotation.color === c ? `2.5px solid ${c}` : "2px solid transparent",
                outlineOffset: 1.5,
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
              onChange={(e) => onUpdateAnnotation({ color: e.target.value })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ padding: 0, border: "none", background: "none" }}
              aria-label="Custom color"
            />
          </label>
        </div>
      </div>

      {/* Position selector row (only for node-attached annotations) */}
      {annotation.nodeId && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-foreground/80 block">Position Relative to Node</label>
          <div className="grid grid-cols-4 gap-1 bg-muted/20 p-1 rounded-lg border border-border/40">
            {ANNOTATION_POSITIONS.map((p) => {
              const isActive = annotation.position === p;
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => onUpdateAnnotation({ position: p })}
                  className={`py-1 rounded-md text-[10px] transition-all flex items-center justify-center gap-1 capitalize ${
                    isActive
                      ? "bg-background text-foreground shadow-xs border border-border/30 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  {POSITION_ICONS[p]}
                  <span>{p}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Visibility and Remove Actions */}
      <div className="flex items-center justify-between border-t border-border/40 pt-3 mt-1">
        <button
          type="button"
          onClick={() => onUpdateAnnotation({ hidden: !annotation.hidden })}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-1 px-2.5 rounded-lg hover:bg-accent/40 transition-all"
        >
          {annotation.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{annotation.hidden ? "Hidden" : "Visible"}</span>
        </button>

        <button
          type="button"
          onClick={() => { onDeleteAnnotation(); onClose(); }}
          className="flex items-center gap-1.5 text-xs text-destructive hover:bg-destructive/10 py-1 px-2.5 rounded-lg transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove Note</span>
        </button>
      </div>
    </div>
  );
}
