import { useState } from "react";
import { Palette, Check } from "lucide-react";
import { THEMES, useTheme } from "@/lib/theme";

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { themeId, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Change theme"
        aria-label="Change color theme"
        className={`flex items-center gap-1.5 rounded border text-xs transition-colors ${
          open
            ? "border-primary text-primary bg-primary/10"
            : "border-border hover:border-primary hover:text-primary"
        } ${compact ? "px-1.5 py-1" : "px-2 py-1.5"}`}
      >
        <Palette className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} aria-hidden="true" />
        {!compact && <span>Theme</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} role="presentation" aria-hidden="true" />
          <div
            className="absolute left-0 bottom-full mb-1 z-50 w-56 border border-border rounded shadow-lg overflow-hidden"
            style={{ background: "hsl(var(--popover))" }}
          >
            <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
              Color Theme
            </div>
            <div className="p-1.5 flex flex-col gap-1">
              {THEMES.map((t) => {
                const isActive = themeId === t.id;
                return (
                  <button
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
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.desc}</div>
                    </div>
                    {isActive && (
                      <Check className="w-3 h-3 flex-shrink-0" style={{ color: t.accent }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
