import { Palette, Check } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { THEMES, COLOR_PALETTES, useTheme } from "@/lib/theme";

export function AppearanceSection() {
  const { themeId, setTheme, colorPalette, setColorPalette } = useTheme();

  return (
    <PanelSection title="Appearance" icon={<Palette className="w-3.5 h-3.5" />} defaultOpen={true}>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => {
          const isActive = themeId === t.id;
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`relative flex flex-col rounded-lg border transition-all text-left overflow-hidden p-2 group ${
                isActive
                  ? "border-primary ring-1 ring-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-accent/30"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${t.accent}, ${t.bg})`,
                    boxShadow: isActive ? `0 0 0 2px ${t.accent}` : `0 0 0 1px ${t.accent}40`,
                  }}
                />
                <span className="text-[11px] font-bold truncate flex-1">{t.name}</span>
                {isActive && <Check className="w-2.5 h-2.5 text-primary flex-shrink-0" />}
              </div>
              <span className="text-[9px] text-muted-foreground leading-tight group-hover:text-foreground/80 transition-colors">
                {t.desc}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-border/30">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-2">Accent Color</label>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_PALETTES.map((palette) => {
            const isActive = colorPalette === palette.id;
            return (
              <button
                type="button"
                key={palette.id}
                onClick={() => setColorPalette(palette.id)}
                title={palette.name}
                className="w-6 h-6 rounded-full transition-all hover:scale-110 flex items-center justify-center cursor-pointer"
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
    </PanelSection>
  );
}
