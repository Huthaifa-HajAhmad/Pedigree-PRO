import { Palette, Ruler, Hash, Check, RotateCcw, Settings, Type, Grid, Eye, Dna, PanelTop, Calendar } from "lucide-react";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";
import { THEMES, COLOR_PALETTES, useTheme } from "@/lib/theme";
import { useCanvasConfig, DEFAULT_CANVAS_CONFIG, CanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

interface SettingsPanelProps {
  onClose: () => void;
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
}

function ToggleRow({ label, description, checked, onChange, icon }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-border/30 last:border-0">
      <div className="flex gap-2 min-w-0">
        {icon && <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground leading-normal">{description}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`w-9 h-5 rounded-full border transition-all relative flex-shrink-0 ${
          checked ? "border-primary bg-primary" : "border-border bg-muted"
        }`}
        aria-label={`Toggle ${label}`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-[1px] left-[1px] w-4 h-4 rounded-full shadow-sm transition-transform bg-card ${
            checked ? "translate-x-[16px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { themeId, setTheme, colorPalette, setColorPalette } = useTheme();
  const { state, dispatch, ops } = usePedigreeEditor();
  const { config, updateConfig } = useCanvasConfig();

  const handleResetToDefaults = () => {
    setTheme(undefined as any);
    const cleared: Partial<CanvasConfig> = {};
    Object.keys(DEFAULT_CANVAS_CONFIG).forEach((key) => {
      cleared[key as keyof CanvasConfig] = undefined;
    });
    updateConfig(cleared);
  };

  return (
    <PanelShell
      title="Canvas Settings"
      icon={<Settings className="w-3.5 h-3.5" />}
      onClose={onClose}
      width="w-80"
    >
      <div className="space-y-4">
        {/* Section 1: Appearance (Theme Selection) */}
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

          {/* Color Palette Selector */}
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

        {/* Section 2: Canvas Grid */}
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

        {/* Section: Layout Spacing */}
        <PanelSection title="Layout Spacing" icon={<Ruler className="w-3.5 h-3.5" />} defaultOpen={true}>
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
                        setTimeout(() => ops.runAutoLayout(false), 50);
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
                  updateConfig({ nodeGap: Number(e.target.value) });
                  ops.runAutoLayout(false);
                }}
                className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {/* Generation Height / Grid Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Row Height</span>
                  {(config.genGrid !== 120) && (
                    <button
                      type="button"
                      onClick={() => {
                        updateConfig({ genGrid: 120 });
                        setTimeout(() => ops.runAutoLayout(false), 50);
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
                  updateConfig({ genGrid: Number(e.target.value) });
                  ops.runAutoLayout(false);
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

        {/* Section: Toolbar */}
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

        {/* Section 3: Labels & Layout */}
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

        {/* Section: Segregation & Genotypes */}
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
                      onChange={(e) => updateConfig({ genotypeFontSize: parseInt(e.target.value) })}
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
                      onChange={(e) => updateConfig({ genotypeOffset: parseInt(e.target.value) })}
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

        {/* Section 4: Canvas Geometry & Spacing */}
        <PanelSection title="Geometry & Spacing" icon={<Ruler className="w-3.5 h-3.5" />} defaultOpen={false}>
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
                        onClick={() => updateConfig({ nodeSize: DEFAULT_CANVAS_CONFIG.nodeSize })}
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
                  onChange={(e) => updateConfig({ nodeSize: Number(e.target.value) })}
                  className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              {/* Sibling Gap */}
              <div className="space-y-1 border-b border-border/35 pb-4 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Sibling Gap (H)</span>
                    {(config.nodeGap !== DEFAULT_CANVAS_CONFIG.nodeGap) && (
                      <button
                        type="button"
                        onClick={() => updateConfig({ nodeGap: DEFAULT_CANVAS_CONFIG.nodeGap })}
                        className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                        title={`Reset to ${DEFAULT_CANVAS_CONFIG.nodeGap}px`}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <span className="font-mono text-foreground tabular-nums">{config.nodeGap}px</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={150}
                  step={5}
                  value={config.nodeGap}
                  onChange={(e) => updateConfig({ nodeGap: Number(e.target.value) })}
                  className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              {/* Generation Spacing */}
              <div className="space-y-1 border-b border-border/35 pb-4 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Gen Gap (V)</span>
                    {(config.genGrid !== DEFAULT_CANVAS_CONFIG.genGrid) && (
                      <button
                        type="button"
                        onClick={() => updateConfig({ genGrid: DEFAULT_CANVAS_CONFIG.genGrid })}
                        className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                        title={`Reset to ${DEFAULT_CANVAS_CONFIG.genGrid}px`}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <span className="font-mono text-foreground tabular-nums">{config.genGrid}px</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={200}
                  step={10}
                  value={config.genGrid}
                  onChange={(e) => updateConfig({ genGrid: Number(e.target.value) })}
                  className="w-full cursor-pointer border-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              {/* Carrier Dot Size */}
              <div className="space-y-1 border-b border-border/35 pb-4 pt-1">
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

        {/* Section 5: Annotation Defaults */}
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
                    onClick={() => updateConfig({ annFontSize: s.v })}
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

        {/* Reset Button */}
        <button
          type="button"
          onClick={handleResetToDefaults}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-border hover:border-primary rounded text-xs text-muted-foreground hover:text-foreground transition-all duration-200 mt-2"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
        </button>
      </div>
    </PanelShell>
  );
}
