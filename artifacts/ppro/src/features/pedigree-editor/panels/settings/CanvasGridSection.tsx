import { Grid } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { ToggleRow } from "./ToggleRow";

export function CanvasGridSection() {
  const { state, dispatch } = usePedigreeEditor();
  const { config, updateConfig } = useCanvasConfig();

  return (
    <PanelSection title="Canvas Grid" icon={<Grid className="w-3.5 h-3.5" />} defaultOpen={false}>
      <div className="space-y-4">
        {/* Grid Line Intensity Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Grid Intensity</span>
              {(config.gridOpacity !== 0.10) && (
                <button
                  type="button"
                  onClick={() => updateConfig({ gridOpacity: 0.10 })}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to 10%"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{Math.round((config.gridOpacity ?? 0.10) * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1.00}
            step={0.05}
            value={config.gridOpacity ?? 0.10}
            onChange={(e) => updateConfig({ gridOpacity: Number(e.target.value) })}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Grid Style selector */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Grid Style</span>
          <div className="grid grid-cols-3 gap-1">
            {(["lines", "dots", "crosses"] as const).map((style) => (
              <button
                type="button"
                key={style}
                onClick={() => updateConfig({ gridStyle: style })}
                className={`px-2 py-1 text-[10px] font-semibold rounded border capitalize transition-all ${
                  (config.gridStyle ?? "lines") === style
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-accent/40 text-muted-foreground"
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* Show Grid Toggle */}
        <div className="pt-2 border-t border-border/30">
          <ToggleRow
            label="Show Grid"
            description="Display helper grid lines in canvas background"
            checked={state.showGrid}
            onChange={() => dispatch({ type: "SET_STATE", patch: { showGrid: !state.showGrid } })}
            icon={<Grid className="w-3.5 h-3.5" />}
          />
        </div>
      </div>
    </PanelSection>
  );
}
