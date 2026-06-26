import { useState, useRef, useEffect } from "react";
import { Palette, Check, ChevronRight } from "lucide-react";
import { THEMES, COLOR_PALETTES, useTheme } from "@/lib/theme";

function useClickOutside(ref: React.RefObject<HTMLDivElement | null>, handler: () => void) {
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
  const { themeId, theme, setTheme, colorPalette, setColorPalette } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  const currentTheme = theme;
  const activePalette = COLOR_PALETTES.find((p) => p.id === colorPalette) ?? COLOR_PALETTES[0]!;

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
          <div className="text-xs font-semibold text-foreground truncate">{currentTheme.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{activePalette.name} Accent</div>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${open ? "rotate-90 text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 bottom-full mb-1.5 z-50 w-full border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 bg-popover p-3 space-y-3"
        >
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5">
              Theme Mode
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {THEMES.map((t) => {
                const isActive = themeId === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all text-center cursor-pointer ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                        : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border/30 pt-2.5">
            <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5">
              Accent Color
            </div>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PALETTES.map((palette) => {
                const isActive = colorPalette === palette.id;
                return (
                  <button
                    type="button"
                    key={palette.id}
                    onClick={() => setColorPalette(palette.id)}
                    title={palette.name}
                    className="w-6 h-6 rounded-full transition-all hover:scale-110 flex items-center justify-center cursor-pointer justify-self-center"
                    style={{
                      backgroundColor: palette.hex,
                      boxShadow: isActive ? `0 0 0 1.5px hsl(var(--background)), 0 0 0 3px ${palette.hex}` : `0 0 0 1px ${palette.hex}30`,
                    }}
                  >
                    {isActive && <Check className="w-3 h-3 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
