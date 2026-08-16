import { Ruler } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";
import { useCanvasConfig, DEFAULT_CANVAS_CONFIG } from "@/features/pedigree-editor/context/CanvasConfigContext";

export function NodeGeometrySection() {
  const { state, ops } = usePedigreeEditor();
  const { config, updateConfig } = useCanvasConfig();

  return (
    <PanelSection title="Node Geometry" icon={<Ruler className="w-3.5 h-3.5" />} defaultOpen={false}>
      <div className="space-y-4">
        {/* Node Configuration Group */}
        <div className="p-3 rounded-lg border border-border/50 bg-card/50 space-y-3.5 shadow-xs animate-in fade-in duration-200">
          <div className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5 border-b border-border/40 pb-1.5 mb-1">
            Node Configuration
          </div>

          {/* Node Size */}
          <div className="space-y-1 border-b border-border/35 pb-4 pt-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Node Size</span>
                {(config.nodeSize !== DEFAULT_CANVAS_CONFIG.nodeSize) && (
                  <button
                    type="button"
                    onClick={() => {
                      updateConfig({ nodeSize: DEFAULT_CANVAS_CONFIG.nodeSize });
                      if (state.liveLayout) {
                        setTimeout(() => ops.runAutoLayout(false, false, false, true), 50);
                      }
                    }}
                    className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                    title={`Reset to ${DEFAULT_CANVAS_CONFIG.nodeSize}px`}
                  >
                    Reset
                  </button>
                )}
              </div>
              <span className="font-mono text-foreground tabular-nums">{config.nodeSize}px</span>
            </div>
            <input
              type="range"
              min={28}
              max={64}
              step={2}
              value={config.nodeSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                updateConfig({ nodeSize: val });
                if (state.liveLayout) {
                  ops.runAutoLayout(false, false, false, true);
                }
              }}
              className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          {/* Carrier Dot Size */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Carrier Dot Size</span>
                {(config.carrierDotRadius !== DEFAULT_CANVAS_CONFIG.carrierDotRadius) && (
                  <button
                    type="button"
                    onClick={() => updateConfig({ carrierDotRadius: DEFAULT_CANVAS_CONFIG.carrierDotRadius })}
                    className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                    title={`Reset to ${DEFAULT_CANVAS_CONFIG.carrierDotRadius}px`}
                  >
                    Reset
                  </button>
                )}
              </div>
              <span className="font-mono text-foreground tabular-nums">{config.carrierDotRadius}px</span>
            </div>
            <input
              type="range"
              min={3}
              max={8}
              step={1}
              value={config.carrierDotRadius}
              onChange={(e) => updateConfig({ carrierDotRadius: Number(e.target.value) })}
              className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          {/* Node Border Color */}
          <div className="space-y-2.5 pt-1.5 pb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">Node Border Color</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateConfig({ nodeStrokeColor: "#000000" })}
                className="w-6 h-6 rounded-full border border-border/50 flex-shrink-0 transition-all hover:scale-110"
                style={{
                  background: "#000000",
                  outline: (!config.nodeStrokeColor || config.nodeStrokeColor === "#000000") ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  outlineOffset: 2,
                }}
                aria-label="Black node border color"
                title="Black"
              />
              <label
                className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 transition-all hover:scale-110 cursor-pointer"
                style={{
                  boxShadow: "0 0 0 1px hsl(var(--border)/0.3)",
                  background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                  outline: (config.nodeStrokeColor && config.nodeStrokeColor !== "#000000") ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  outlineOffset: 2,
                }}
                title="Custom color"
              >
                <input
                  type="color"
                  value={config.nodeStrokeColor?.startsWith("hsl(") ? "#000000" : (config.nodeStrokeColor ?? "#000000")}
                  onChange={(e) => updateConfig({ nodeStrokeColor: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Edge Configuration Group */}
        <div className="p-3 rounded-lg border border-border/50 bg-card/50 space-y-3 shadow-xs animate-in fade-in duration-200">
          <div className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5 border-b border-border/40 pb-1.5 mb-1">
            Edge Configuration
          </div>

          {/* Edge Width */}
          <div className="space-y-1 border-b border-border/35 pb-4 pt-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Edge Width</span>
                {(config.edgeWidthNormal !== DEFAULT_CANVAS_CONFIG.edgeWidthNormal) && (
                  <button
                    type="button"
                    onClick={() => updateConfig({ edgeWidthNormal: DEFAULT_CANVAS_CONFIG.edgeWidthNormal })}
                    className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                    title={`Reset to ${DEFAULT_CANVAS_CONFIG.edgeWidthNormal}px`}
                  >
                    Reset
                  </button>
                )}
              </div>
              <span className="font-mono text-foreground tabular-nums">{config.edgeWidthNormal}px</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.5}
              value={config.edgeWidthNormal}
              onChange={(e) => updateConfig({ edgeWidthNormal: Number(e.target.value) })}
              className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          {/* Edge Color */}
          <div className="space-y-2.5 pt-1.5 pb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">Edge Color</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateConfig({ edgeColor: "#000000" })}
                className="w-6 h-6 rounded-full border border-border/50 flex-shrink-0 transition-all hover:scale-110"
                style={{
                  background: "#000000",
                  outline: (!config.edgeColor || config.edgeColor === "#000000") ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  outlineOffset: 2,
                }}
                aria-label="Black edge color"
                title="Black"
              />
              <label
                className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 transition-all hover:scale-110 cursor-pointer"
                style={{
                  boxShadow: "0 0 0 1px hsl(var(--border)/0.3)",
                  background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                  outline: (config.edgeColor && config.edgeColor !== "#000000") ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  outlineOffset: 2,
                }}
                title="Custom color"
              >
                <input
                  type="color"
                  value={config.edgeColor?.startsWith("hsl(") ? "#000000" : (config.edgeColor ?? "#000000")}
                  onChange={(e) => updateConfig({ edgeColor: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </PanelSection>
  );
}
