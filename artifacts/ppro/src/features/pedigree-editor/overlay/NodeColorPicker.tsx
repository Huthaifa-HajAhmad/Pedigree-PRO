import { useEffect, useRef, useState, useCallback } from "react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { X } from "lucide-react";

const PRESET_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#1f2937"];

export function NodeColorPicker({
  node,
  svgRef,
  onSetColor,
  onClose,
}: {
  node: PedigreeNode;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onSetColor: (nodeId: string, color: string | undefined) => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const screenX = ctm.a * node.x + ctm.e;
    const screenY = ctm.d * node.y + ctm.f;
    const pw = 180;
    const ph = 200;
    let x = screenX + 30;
    let y = screenY - ph / 2;
    if (x + pw > window.innerWidth - 8) x = Math.max(8, screenX - pw - 30);
    if (y < 8) y = 8;
    if (y + ph > window.innerHeight - 8) y = window.innerHeight - ph - 8;
    setPos({ x, y });
  }, [node.x, node.y, svgRef]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  if (!pos) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 min-w-[180px] border border-border rounded-lg shadow-2xl bg-popover p-2.5 outline-none"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="Node color picker"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground">Node Color</span>
        <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-accent transition-colors" aria-label="Close">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSetColor(node.id, c)}
            className="w-7 h-7 rounded-full border border-border/50 flex-shrink-0 transition-transform hover:scale-110"
            style={{ background: c, outline: node.color === c ? "2px solid hsl(var(--primary))" : "2px solid transparent", outlineOffset: 1 }}
            title={c}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border pt-2">
        <label
          className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0 transition-transform hover:scale-110 cursor-pointer"
          style={{
            boxShadow: "0 0 0 1px hsl(var(--border)/0.3)",
            background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
          }}
          title="Custom color"
        >
          <input
            type="color"
            value={node.color || "#000000"}
            onChange={(e) => onSetColor(node.id, e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ padding: 0, border: "none", background: "none" }}
            aria-label="Custom node color"
          />
        </label>
        <span className="text-xs text-muted-foreground">Custom</span>
      </div>
      {node.color && (
        <button
          type="button"
          onClick={() => { onSetColor(node.id, undefined); onClose(); }}
          className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 border-t border-border pt-1.5"
        >
          Reset to default
        </button>
      )}
    </div>
  );
}
