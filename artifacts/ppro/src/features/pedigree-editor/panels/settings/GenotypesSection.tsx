import { Dna, Hash } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { ToggleRow } from "./ToggleRow";

export function GenotypesSection() {
  const { state, ops } = usePedigreeEditor();
  const { config, updateConfig } = useCanvasConfig();

  return (
    <PanelSection title="Segregation & Genotypes" icon={<Dna className="w-3.5 h-3.5" />} defaultOpen={false}>
      <div className="space-y-4">
        <ToggleRow
          label="Show Genotypes"
          description="Show variant/wild-type status under symbols"
          checked={config.showGenotypes}
          onChange={() => updateConfig({ showGenotypes: !config.showGenotypes })}
          icon={<Hash className="w-3.5 h-3.5" />}
        />

        {config.showGenotypes && (
          <div className="pl-6 pt-1.5 pb-2 border-l-2 border-primary/20 space-y-4 mt-1 ml-1.5 animate-in slide-in-from-left-2 duration-200">
            {/* Font Size Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider">Genotype Size</span>
                <span className="font-mono text-primary font-bold">{config.genotypeFontSize ?? 12}px</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">8px</span>
                <input
                  type="range"
                  min={8}
                  max={24}
                  step={1}
                  value={config.genotypeFontSize ?? 12}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateConfig({ genotypeFontSize: val });
                    if (state.liveLayout) {
                      ops.runAutoLayout(false, false, false, true);
                    }
                  }}
                  className="flex-1 cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
                <span className="text-[10px] text-muted-foreground">24px</span>
              </div>
            </div>

            {/* Offset Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider">Genotype Offset</span>
                <span className="font-mono text-primary font-bold">{config.genotypeOffset ?? 3}px</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">0px</span>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={config.genotypeOffset ?? 3}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateConfig({ genotypeOffset: val });
                    if (state.liveLayout) {
                      ops.runAutoLayout(false, false, false, true);
                    }
                  }}
                  className="flex-1 cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
                <span className="text-[10px] text-muted-foreground">12px</span>
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">Genotype Colors</span>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { key: "genotypeMutantColor" as const, label: "Mutant (+)", defaultVal: "#EF4444" },
                  { key: "genotypeWildtypeColor" as const, label: "Wild-type (-)", defaultVal: "#4B5563" },
                  { key: "genotypeSeparatorColor" as const, label: "Separator (/)", defaultVal: "#9CA3AF" }
                ].map(({ key, label, defaultVal }) => (
                  <div key={key} className="flex flex-col gap-1 min-w-0">
                    <span className="text-[9px] text-muted-foreground truncate font-medium" title={label}>{label}</span>
                    <div className="flex items-center gap-1.5">
                      <label
                        className="relative w-5 h-5 rounded overflow-hidden flex-shrink-0 border border-border/85 cursor-pointer shadow-xs transition-transform hover:scale-110"
                        style={{ background: config[key] || defaultVal }}
                      >
                        <input
                          type="color"
                          value={config[key] || defaultVal}
                          onChange={(e) => updateConfig({ [key]: e.target.value })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </label>
                      <span className="text-[8px] font-mono text-muted-foreground/80 truncate uppercase">{(config[key] || defaultVal).slice(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelSection>
  );
}
