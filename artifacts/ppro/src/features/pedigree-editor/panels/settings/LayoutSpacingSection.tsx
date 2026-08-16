import { Ruler } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { ToggleRow } from "./ToggleRow";

export function LayoutSpacingSection() {
  const { state, ops } = usePedigreeEditor();
  const { config, updateConfig } = useCanvasConfig();

  return (
    <PanelSection title="Layout Spacing" icon={<Ruler className="w-3.5 h-3.5" />} defaultOpen={false}>
      <div className="space-y-4">
        {/* Node Gap Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Node Gap</span>
              {(config.nodeGap !== 96.8) && (
                <button
                  type="button"
                  onClick={() => {
                    updateConfig({ nodeGap: 96.8 });
                    if (state.liveLayout) {
                      setTimeout(() => ops.runAutoLayout(false, false, false, true, { nodeGap: 96.8 }), 50);
                    }
                  }}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to 96.8"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.nodeGap ?? 96.8}px</span>
          </div>
          <input
            type="range"
            min={60}
            max={200}
            step={2}
            value={config.nodeGap ?? 96.8}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ nodeGap: val });
              if (state.liveLayout) {
                ops.runAutoLayout(false, false, false, true, { nodeGap: val });
              }
            }}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Generation Height / Grid Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Between Gen Gap</span>
              {(config.genGrid !== 120) && (
                <button
                  type="button"
                  onClick={() => {
                    updateConfig({ genGrid: 120 });
                    if (state.liveLayout) {
                      setTimeout(() => ops.runAutoLayout(false, false, false, true, { genGrid: 120 }), 50);
                    }
                  }}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to 120"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.genGrid ?? 120}px</span>
          </div>
          <input
            type="range"
            min={80}
            max={250}
            step={5}
            value={config.genGrid ?? 120}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ genGrid: val });
              if (state.liveLayout) {
                ops.runAutoLayout(false, false, false, true, { genGrid: val });
              }
            }}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Sibship Drop Height Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Sibship Drop Height</span>
              {(config.sibshipDropHeight !== 30) && (
                <button
                  type="button"
                  onClick={() => {
                    updateConfig({ sibshipDropHeight: 30 });
                    if (state.liveLayout) {
                      setTimeout(() => ops.runAutoLayout(false, false, false, true), 50);
                    }
                  }}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to 30"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.sibshipDropHeight ?? 30}px</span>
          </div>
          <input
            type="range"
            min={15}
            max={60}
            step={2}
            value={config.sibshipDropHeight ?? 30}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ sibshipDropHeight: val });
              if (state.liveLayout) {
                ops.runAutoLayout(false, false, false, true);
              }
            }}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Twin Spacing Mono Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Monozygotic Twin Gap</span>
              {(config.twinGapMono !== undefined && config.twinGapMono !== 22) && (
                <button
                  type="button"
                  onClick={() => {
                    updateConfig({ twinGapMono: undefined });
                    if (state.liveLayout) {
                      setTimeout(() => ops.runAutoLayout(false, false, false, true), 50);
                    }
                  }}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.twinGapMono ?? 22}px</span>
          </div>
          <input
            type="range"
            min={10}
            max={80}
            step={2}
            value={config.twinGapMono ?? 22}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ twinGapMono: val });
              if (state.liveLayout) {
                ops.runAutoLayout(false, false, false, true);
              }
            }}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Twin Spacing Dizygotic Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Dizygotic Twin Gap</span>
              {(config.twinGapDizygotic !== undefined && config.twinGapDizygotic !== 32) && (
                <button
                  type="button"
                  onClick={() => {
                    updateConfig({ twinGapDizygotic: undefined });
                    if (state.liveLayout) {
                      setTimeout(() => ops.runAutoLayout(false, false, false, true), 50);
                    }
                  }}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.twinGapDizygotic ?? 32}px</span>
          </div>
          <input
            type="range"
            min={15}
            max={100}
            step={2}
            value={config.twinGapDizygotic ?? 32}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ twinGapDizygotic: val });
              if (state.liveLayout) {
                ops.runAutoLayout(false, false, false, true);
              }
            }}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Couple Spacing Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Couple Spacing</span>
              {(config.coupleSpacing !== undefined && config.coupleSpacing !== 96.8) && (
                <button
                  type="button"
                  onClick={() => {
                    updateConfig({ coupleSpacing: undefined });
                    if (state.liveLayout) {
                      setTimeout(() => ops.runAutoLayout(false, false, false, true), 50);
                    }
                  }}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.coupleSpacing ?? 96.8}px</span>
          </div>
          <input
            type="range"
            min={50}
            max={200}
            step={2}
            value={config.coupleSpacing ?? 96.8}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ coupleSpacing: val });
              if (state.liveLayout) {
                ops.runAutoLayout(false, false, false, true);
              }
            }}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Horizontal Spacing Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Horizontal Node Spacing</span>
              {(config.hSpacing !== undefined && config.hSpacing !== 110) && (
                <button
                  type="button"
                  onClick={() => {
                    updateConfig({ hSpacing: undefined });
                    if (state.liveLayout) {
                      setTimeout(() => ops.runAutoLayout(false, false, false, true), 50);
                    }
                  }}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.hSpacing ?? 110}px</span>
          </div>
          <input
            type="range"
            min={60}
            max={220}
            step={2}
            value={config.hSpacing ?? 110}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ hSpacing: val });
              if (state.liveLayout) {
                ops.runAutoLayout(false, false, false, true);
              }
            }}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Edge Bridge Arc Radius Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Bridge Arc Radius</span>
              {(config.edgeArcRadius !== undefined && config.edgeArcRadius !== 6) && (
                <button
                  type="button"
                  onClick={() => {
                    updateConfig({ edgeArcRadius: undefined });
                  }}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.edgeArcRadius ?? 6}px</span>
          </div>
          <input
            type="range"
            min={2}
            max={15}
            step={1}
            value={config.edgeArcRadius ?? 6}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ edgeArcRadius: val });
            }}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Show Edge Bridges Toggle */}
        <ToggleRow
          label="Show Crossover Bridges"
          description="Enable arched bridges at edge crossing points"
          checked={config.showEdgeBridges !== false}
          onChange={() => {
            updateConfig({ showEdgeBridges: config.showEdgeBridges === false ? undefined : false });
          }}
        />

        {/* Crossing Minimization Sweeps Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Minimization Sweeps</span>
              {(config.crossingMinimizationSweeps !== undefined && config.crossingMinimizationSweeps !== 15) && (
                <button
                  type="button"
                  onClick={() => {
                    updateConfig({ crossingMinimizationSweeps: undefined });
                    if (state.liveLayout) {
                      setTimeout(() => ops.runAutoLayout(false, false, false, true), 50);
                    }
                  }}
                  className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="font-mono text-foreground tabular-nums">{config.crossingMinimizationSweeps ?? 15}</span>
          </div>
          <input
            type="range"
            min={5}
            max={40}
            step={1}
            value={config.crossingMinimizationSweeps ?? 15}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateConfig({ crossingMinimizationSweeps: val });
              if (state.liveLayout) {
                ops.runAutoLayout(false, false, false, true);
              }
            }}
            className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Apply spacing settings button */}
        <button
          type="button"
          onClick={() => ops.runAutoLayout(false)}
          className="w-full py-1.5 px-3 text-xs font-semibold rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-all"
        >
          Recalculate Auto-Layout
        </button>
      </div>
    </PanelSection>
  );
}
