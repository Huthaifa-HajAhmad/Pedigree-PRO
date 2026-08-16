import { Type } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

export function AnnotationDefaultsSection() {
  const { state, ops } = usePedigreeEditor();
  const { config, updateConfig } = useCanvasConfig();

  return (
    <PanelSection title="Annotation Defaults" icon={<Type className="w-3.5 h-3.5" />} defaultOpen={false}>
      <div className="space-y-4">
        {/* Font Size */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Font Size</span>
            <span className="font-mono text-foreground">{config.annFontSize ?? 12}px</span>
          </div>
          <div className="flex gap-1">
            {[{ l: "S", v: 10 }, { l: "M", v: 12 }, { l: "L", v: 14 }, { l: "XL", v: 16 }].map((s) => (
              <button
                type="button"
                key={s.v}
                onClick={() => {
                  updateConfig({ annFontSize: s.v });
                  if (state.liveLayout) {
                    ops.runAutoLayout(false, false, false, true);
                  }
                }}
                className={`flex-1 py-1 rounded text-xs border transition-all ${
                  (config.annFontSize ?? 12) === s.v
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                {s.l}
              </button>
            ))}
          </div>
        </div>

        {/* Font Family */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Font Family</span>
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: "Inter, sans-serif", label: "Inter" },
              { id: "Arial, sans-serif", label: "Arial" },
              { id: "Calibri, sans-serif", label: "Calibri" },
              { id: "JetBrains Mono, monospace", label: "Mono" },
            ].map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => updateConfig({ annFontFamily: f.id })}
                className={`py-1 rounded text-xs border transition-all ${
                  (config.annFontFamily ?? "Inter, sans-serif") === f.id
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
                style={{ fontFamily: f.id }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Style</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => updateConfig({ annBold: !(config.annBold ?? true) })}
              className={`flex-1 py-1.5 rounded text-xs border transition-all ${
                (config.annBold ?? true)
                  ? "border-primary text-primary bg-primary/10 font-semibold"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              Bold
            </button>
            <button
              type="button"
              onClick={() => updateConfig({ annUppercase: !(config.annUppercase ?? false) })}
              className={`flex-1 py-1.5 rounded text-xs border transition-all ${
                (config.annUppercase ?? false)
                  ? "border-primary text-primary bg-primary/10 uppercase font-medium"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              Uppercase
            </button>
          </div>
        </div>

        {/* Default Position */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Default Position</span>
          <div className="grid grid-cols-2 gap-1">
            {(["above", "below", "left", "right"] as const).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => updateConfig({ annDefaultPos: p })}
                className={`py-1 rounded text-xs border capitalize transition-all ${
                  (config.annDefaultPos ?? "below") === p
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PanelSection>
  );
}
