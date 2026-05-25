import { useState, useEffect, useRef, useCallback } from "react";
import { LifeBuoy, Keyboard, Lightbulb } from "lucide-react";

interface HelpGroupProps {
  labelHidden?: boolean;
}

function useDropdownPosition(ref: React.RefObject<HTMLButtonElement | null>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelHeight = 400;
    let top = r.bottom + 4;
    if (top + panelHeight > window.innerHeight) {
      top = Math.max(8, r.top - panelHeight);
    }
    setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - 310)) });
  }, [ref]);
  return { pos, measure };
}

const SHORTCUTS = {
  nodes: [
    { key: "M", desc: "Male" },
    { key: "F", desc: "Female" },
    { key: "U", desc: "Unknown" },
    { key: "P", desc: "Pregnancy" },
  ],
  edit: [
    { key: "Del", desc: "Delete" },
    { key: "Ctrl+Z", desc: "Undo" },
    { key: "Ctrl+Y", desc: "Redo" },
  ],
  canvas: [
    { key: "Ctrl+L", desc: "Auto-layout" },
    { key: "/", desc: "Search" },
    { key: "Space+Drag", desc: "Pan" },
  ],
  selection: [
    { key: "Click", desc: "Select" },
    { key: "Ctrl+Click", desc: "Multi-select" },
    { key: "Drag", desc: "Lasso" },
  ],
};

const TIPS = [
  "Ctrl+drag a node extends its couple/parent lines",
  "Drag an annotation to reposition; double-click to edit text",
  "Use Alt+click or Space+drag to pan the canvas",
  "Set a proband to anchor risk calculations",
  "Snap mode keeps nodes on generation rows",
  "Annotations snap to canonical positions when dragged close",
  "Ctrl+click to multi-select; lasso by dragging empty canvas",
];

export function HelpGroup({ labelHidden = false }: HelpGroupProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { pos, measure } = useDropdownPosition(buttonRef);

  useEffect(() => {
    if (!open) return;
    measure();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, measure]);

  const shortcutRow = (s: { key: string; desc: string }) => (
    <div key={s.key} className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{s.desc}</span>
      <kbd className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{s.key}</kbd>
    </div>
  );

  return (
    <div className="flex flex-col justify-between h-full flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button
          type="button"
          ref={buttonRef}
          onClick={() => setOpen(!open)}
          title="Help & shortcuts"
          aria-label="Help & shortcuts"
          aria-expanded={open}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${open ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <LifeBuoy className="w-5 h-5" />
          <span>Help</span>
        </button>
        {open && pos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="fixed z-50 w-[300px] max-h-[80vh] overflow-y-auto border border-border rounded-lg shadow-xl bg-popover" style={{ top: pos.top, left: pos.left }}>
              <div className="p-3 space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Keyboard className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Keyboard Shortcuts</span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(SHORTCUTS).map(([group, items]) => (
                      <div key={group} className="space-y-0.5">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">{group}</div>
                        {items.map(shortcutRow)}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">How-To</span>
                  </div>
                  <div className="space-y-1.5">
                    {TIPS.map((tip, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                        <span>{tip}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Help</div>}
    </div>
  );
}
