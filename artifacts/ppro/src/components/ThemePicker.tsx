import { useState, useRef, useEffect } from "react";
import { Palette, Check, ChevronRight } from "lucide-react";
import { THEMES, useTheme } from "@/lib/theme";

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

export function ThemePicker() {
  const { themeId, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  const currentTheme = THEMES.find(t => t.id === themeId) ?? THEMES[0]!;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Change theme"
        aria-label="Change color theme"
        aria-expanded={open}
        className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left group ${
          open
            ? "border-primary text-primary bg-primary/10"
            : "border-border hover:border-primary/50 hover:bg-primary/5"
        }`}
      >
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: `${currentTheme.accent}20` }}
        >
          <Palette className="w-4 h-4" style={{ color: currentTheme.accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-foreground truncate">{currentTheme.name}</div>
          <div className="text-xs text-muted-foreground truncate">{currentTheme.desc}</div>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${open ? "rotate-90 text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 bottom-full mb-1 z-50 w-full border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 bg-popover"
        >
          <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest font-medium">
            Color Theme
          </div>
          <div className="p-1.5 flex flex-col gap-1">
            {THEMES.map((t) => {
              const isActive = themeId === t.id;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => { setTheme(t.id); setOpen(false); }}
                  className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded text-left w-full transition-all border ${
                    isActive
                      ? "border-primary/70 bg-primary/10"
                      : "border-transparent hover:border-primary/30 hover:bg-accent"
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    aria-label={`${t.name} theme color preview`}
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${t.accent}, ${t.bg})`,
                      boxShadow: isActive ? `0 0 0 2px ${t.accent}` : `0 0 0 1px ${t.accent}40`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium leading-tight">{t.name}</div>
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5">{t.desc}</div>
                  </div>
                  {isActive && (
                    <Check className="w-3 h-3 flex-shrink-0" style={{ color: t.accent }} />
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
