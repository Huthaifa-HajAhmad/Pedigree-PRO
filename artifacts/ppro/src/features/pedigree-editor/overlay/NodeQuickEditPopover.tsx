import { useEffect, useRef, useState, useCallback } from "react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { X, Square, Circle, Diamond, Baby, AlertTriangle, ArrowRight } from "lucide-react";

function TypeIcon({ type }: { type: PedigreeNode["type"] }) {
  const cls = "w-3 h-3";
  switch (type) {
    case "male": return <Square className={cls} />;
    case "female": return <Circle className={cls} />;
    case "unknown": return <Diamond className={cls} />;
    case "pregnancy": return <Baby className={cls} />;
    case "sab": return <AlertTriangle className={cls} />;
  }
}

interface NodeQuickEditPopoverProps {
  node: PedigreeNode;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onClose: () => void;
  onUpdateNode: (updates: Partial<PedigreeNode>) => void;
  onOpenSidebar: () => void;
}

export function NodeQuickEditPopover({
  node, svgRef, onClose, onUpdateNode, onOpenSidebar,
}: NodeQuickEditPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState(node.insideText ?? "");

  useEffect(() => { setDraft(node.insideText ?? ""); }, [node.id, node.insideText]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const screenX = ctm.a * node.x + ctm.e;
    const screenY = ctm.d * node.y + ctm.f;
    const pw = 260;
    const ph = 280;
    let x = screenX + 36;
    let y = screenY - ph / 2;
    if (x + pw > window.innerWidth - 8) x = Math.max(8, screenX - pw - 36);
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

  const applyInsideText = () => {
    const trimmed = draft.trim();
    if (trimmed !== (node.insideText ?? "")) onUpdateNode({ insideText: trimmed || undefined });
  };

  const statusValue = node.affected ? "affected" : node.carrier ? "carrier" : "unaffected";

  if (!pos) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[260px] border border-border rounded-xl shadow-2xl bg-popover p-4 outline-none animate-in fade-in zoom-in-95 duration-150"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="Quick edit node"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TypeIcon type={node.type} />
          <span className="text-xs font-semibold text-foreground">Quick Edit</span>
        </div>
        <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-accent transition-colors" aria-label="Close">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Inside text (count) */}
      <div className="mb-3">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">Inside text</label>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={applyInsideText}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyInsideText(); onClose(); } }}
          placeholder="e.g. 3"
          className="w-full bg-transparent border border-border rounded-md px-2.5 py-1.5 text-xs focus:border-primary outline-none transition-colors"
          autoFocus
        />
      </div>

      {/* Type */}
      <div className="mb-3">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">Type</label>
        <div className="grid grid-cols-5 gap-1">
          {(["male", "female", "unknown", "pregnancy", "sab"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => onUpdateNode({ type: t })}
              className={`py-1 rounded-md text-[10px] border transition-all flex items-center justify-center ${
                node.type === t
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:border-primary"
              }`}
              title={t === "sab" ? "SAB" : t}
            >
              <TypeIcon type={t} />
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="mb-3">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">Status</label>
        <div className="grid grid-cols-3 gap-1">
          {(["unaffected", "affected", "carrier"] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => {
                if (s === "affected") onUpdateNode({ affected: true, carrier: false });
                else if (s === "carrier") onUpdateNode({ affected: false, carrier: true });
                else onUpdateNode({ affected: false, carrier: false });
              }}
              className={`py-1 rounded-md text-[10px] border transition-all ${
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

      {/* Flags */}
      <div className="mb-3 space-y-2">
        {([
          { key: "deceased" as const, label: "Deceased" },
          { key: "proband" as const, label: "Proband" },
        ]).map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            <button
              type="button"
              onClick={() => onUpdateNode({ [key]: !node[key] })}
              className={`w-9 h-5 rounded-full border transition-all relative ${node[key] ? "border-primary bg-primary" : "border-border bg-muted"}`}
              aria-pressed={!!node[key]}
            >
              <span className={`absolute top-[1px] left-[1px] w-4 h-4 rounded-full shadow-sm transition-transform bg-card ${node[key] ? "translate-x-[16px]" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <button
        type="button"
        onClick={() => { onClose(); onOpenSidebar(); }}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-primary transition-colors border-t border-border pt-2"
      >
        More in sidebar <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
