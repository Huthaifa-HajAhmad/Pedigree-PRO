import { PanelTop } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

export function ToolbarSection() {
  const { config, updateConfig } = useCanvasConfig();

  return (
    <PanelSection title="Toolbar" icon={<PanelTop className="w-3.5 h-3.5" />} defaultOpen={false}>
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Toolbar Height</span>
              {(config.toolbarHeight !== undefined && config.toolbarHeight !== 96) && (
                <button
                  type="button"
                  onClick={() => updateConfig({ toolbarHeight: undefined })}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.toolbarHeight ?? 96}px</span>
          </div>
          <input
            type="range"
            min={72}
            max={140}
            step={4}
            value={config.toolbarHeight ?? 96}
            onChange={(e) => updateConfig({ toolbarHeight: Number(e.target.value) })}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>
    </PanelSection>
  );
}
