import { useState, useRef, useEffect } from "react";
import { Type, Check, ChevronRight } from "lucide-react";
import { FONT_OPTIONS, useFont } from "@/lib/font";

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

export function FontPicker() {
  const { fontId, setFont } = useFont();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  const currentFont = FONT_OPTIONS.find((f) => f.id === fontId) ?? FONT_OPTIONS[0]!;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Change font"
        aria-label="Change UI font family"
        aria-expanded={open}
        className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left group ${
          open
            ? "border-primary text-primary bg-primary/10"
            : "border-border hover:border-primary/50 hover:bg-primary/5"
        }`}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors bg-muted"
        >
          <Type className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-foreground truncate">{currentFont.name}</div>
          <div className="text-xs text-muted-foreground truncate">{currentFont.desc}</div>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${open ? "rotate-90 text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 bottom-full mb-1 z-50 w-full border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 bg-popover"
        >
          <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest font-medium">
            Font Family
          </div>
          <div className="p-1.5 flex flex-col gap-1">
            {FONT_OPTIONS.map((f) => {
              const isActive = fontId === f.id;
              return (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => { setFont(f.id); setOpen(false); }}
                  className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded text-left w-full transition-all border ${
                    isActive
                      ? "border-primary/70 bg-primary/10"
                      : "border-transparent hover:border-primary/30 hover:bg-accent"
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-xs font-semibold bg-muted text-foreground"
                    style={{ fontFamily: f.id === "inter" ? "'Inter', sans-serif" : f.id === "plus-jakarta" ? "'Plus Jakarta Sans', sans-serif" : "'Manrope', sans-serif" }}
                  >
                    Aa
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium leading-tight">{f.name}</div>
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5">{f.desc}</div>
                  </div>
                  {isActive && (
                    <Check className="w-3 h-3 flex-shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
