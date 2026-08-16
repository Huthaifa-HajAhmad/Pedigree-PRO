import { Hash, User, Calendar, Eye, Settings } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { ToggleRow } from "./ToggleRow";

export function LabelsAndLayoutSection() {
  const { state, dispatch, ops } = usePedigreeEditor();
  const { config, updateConfig } = useCanvasConfig();

  return (
    <PanelSection title="Labels & Layout" icon={<Hash className="w-3.5 h-3.5" />} defaultOpen={false}>
      <div className="space-y-3">
        <ToggleRow
          label="Generation Labels"
          description="Show auto-generated labels (I-1, II-3)"
          checked={state.showAutoLabels}
          onChange={() => dispatch({ type: "SET_STATE", patch: { showAutoLabels: !state.showAutoLabels } })}
          icon={<Hash className="w-3.5 h-3.5" />}
        />
        {state.showAutoLabels && (
          <div className="pl-6 pt-1.5 pb-2 border-l-2 border-primary/20 space-y-4 mt-1 ml-1.5 animate-in slide-in-from-left-2 duration-200">
            {/* Size Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider">Label Size</span>
                <span className="font-mono text-primary font-bold">{config.autoLabelFontSize ?? 12}px</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">6px</span>
                <input
                  type="range"
                  min={6}
                  max={18}
                  step={1}
                  value={config.autoLabelFontSize ?? 12}
                  onChange={(e) => updateConfig({ autoLabelFontSize: parseInt(e.target.value) })}
                  className="flex-1 cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
                <span className="text-[10px] text-muted-foreground">18px</span>
              </div>
            </div>

            {/* Separator / Divider */}
            <div className="border-t border-border/40 my-2" />

            {/* Colorpicker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">Label Color</span>
                {config.autoLabelColor && (
                  <button
                    type="button"
                    onClick={() => updateConfig({ autoLabelColor: "" })}
                    className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                  >
                    Reset Default
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <label
                  className="relative w-5 h-5 rounded overflow-hidden flex-shrink-0 border border-border/85 cursor-pointer shadow-xs transition-transform hover:scale-110"
                  style={{ background: config.autoLabelColor || "#6B7280" }}
                >
                  <input
                    type="color"
                    value={config.autoLabelColor || "#6B7280"}
                    onChange={(e) => updateConfig({ autoLabelColor: e.target.value })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
                <span className="text-[8px] font-mono text-muted-foreground/80 truncate uppercase">
                  {config.autoLabelColor ? config.autoLabelColor.toUpperCase() : "DEFAULT (GRAY)"}
                </span>
              </div>
            </div>
          </div>
        )}
        <ToggleRow
          label="Relationship Labels"
          description="Show relationship names (e.g., Uncle, Sister) under node symbols"
          checked={config.showRelationshipLabels ?? true}
          onChange={() => updateConfig({ showRelationshipLabels: !(config.showRelationshipLabels ?? true) })}
          icon={<User className="w-3.5 h-3.5" />}
        />
        <ToggleRow
          label="Show Node Age"
          description="Show age/DOB under node symbols"
          checked={config.showAge ?? true}
          onChange={() => updateConfig({ showAge: !(config.showAge ?? true) })}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
        {(config.showAge ?? true) && (
          <div className="pl-6 pt-1.5 pb-2 border-l-2 border-primary/20 space-y-4 mt-1 ml-1.5 animate-in slide-in-from-left-2 duration-200">
            {/* Size Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider">Age Font Size</span>
                <span className="font-mono text-primary font-bold">{config.ageFontSize ?? 10}px</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">6px</span>
                <input
                  type="range"
                  min={6}
                  max={18}
                  step={1}
                  value={config.ageFontSize ?? 10}
                  onChange={(e) => updateConfig({ ageFontSize: parseInt(e.target.value) })}
                  className="flex-1 cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
                <span className="text-[10px] text-muted-foreground">18px</span>
              </div>
            </div>
          </div>
        )}
        <ToggleRow
          label="Generation Rail"
          description="Show vertical Roman numeral rail on the left"
          checked={state.showGenerationRail}
          onChange={() => dispatch({ type: "SET_STATE", patch: { showGenerationRail: !state.showGenerationRail } })}
          icon={<Eye className="w-3.5 h-3.5" />}
        />
        {state.showGenerationRail && (
          <div className="pl-6 border-l border-border/40 space-y-2 mt-1 select-none">
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Rail Layout Mode</span>
              <div className="grid grid-cols-2 gap-1">
                {(["per-family", "global"] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => dispatch({ type: "SET_STATE", patch: { generationRailMode: mode } })}
                    className={`px-2 py-1.5 text-[10px] font-semibold rounded border transition-all ${
                      state.generationRailMode === mode
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:bg-accent/40 text-muted-foreground"
                    }`}
                  >
                    {mode === "per-family" ? "Per Family" : "Global Canvas"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <ToggleRow
          label="Live Layout"
          description="Auto-arrange canvas during drawing"
          checked={state.liveLayout}
          onChange={() => {
            dispatch({ type: "SET_STATE", patch: { liveLayout: !state.liveLayout } });
            if (!state.liveLayout) ops.runAutoLayout(true, true);
          }}
          icon={<Settings className="w-3.5 h-3.5" />}
        />
        <div className="pt-2 space-y-2 border-t border-border/40">
          <button
            type="button"
            disabled={state.canvas.nodes.length === 0}
            onClick={ops.bakeEmptyLabels}
            className="w-full text-left flex items-center gap-2 p-2 rounded border border-border bg-card hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs"
          >
            <Hash className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">Fill unlabeled nodes</div>
              <div className="text-[10px] text-muted-foreground leading-normal mt-0.5">Write identifiers into nodes without a name</div>
            </div>
          </button>

          <button
            type="button"
            disabled={state.canvas.nodes.length === 0}
            onClick={ops.bakeAllLabels}
            className="w-full text-left flex items-center gap-2 p-2 rounded border border-border bg-card hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs"
          >
            <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">Apply to all nodes</div>
              <div className="text-[10px] text-muted-foreground leading-normal mt-0.5">Overwrite all labels with generation identifiers</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              ops.updateCanvas((prev) => {
                const anyVisible = prev.annotations.some((a) => !a.hidden);
                return { ...prev, annotations: prev.annotations.map((a) => ({ ...a, hidden: anyVisible })) };
              });
            }}
            className="w-full text-left flex items-center gap-2 p-2 rounded border border-border bg-card hover:bg-accent/40 transition-all text-xs"
          >
            <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">Toggle all annotations</div>
              <div className="text-[10px] text-muted-foreground leading-normal mt-0.5">Hide or show manually added text annotations</div>
            </div>
          </button>
        </div>
      </div>
    </PanelSection>
  );
}
