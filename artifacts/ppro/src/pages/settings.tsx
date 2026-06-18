import { useState } from "react";
import { Palette, Type, Ruler, Check, RotateCcw, PanelTop } from "lucide-react";
import { THEMES, useTheme, applyTheme } from "@/lib/theme";
import { FONT_OPTIONS, useFont } from "@/lib/font";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { useCanvasConfig, DEFAULT_CANVAS_CONFIG } from "@/features/pedigree-editor/context/CanvasConfigContext";

const TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "canvas", label: "Canvas", icon: Ruler },
  { id: "toolbar", label: "Toolbar", icon: PanelTop },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AppearanceTab() {
  const { themeId, setTheme } = useTheme();
  const { fontId, setFont } = useFont();

  return (
    <div className="space-y-6">
      <PanelSection title="Color Theme" icon={<Palette className="w-3.5 h-3.5" />}>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => {
            const isActive = themeId === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTheme(t.id)}
                onMouseEnter={() => applyTheme(t.id)}
                onMouseLeave={() => applyTheme(themeId)}
                className={`relative flex flex-col rounded-lg border transition-all text-left overflow-hidden ${
                  isActive ? "border-primary ring-1 ring-primary/50" : "border-border hover:border-primary/40"
                }`}
              >
                <div
                  className="h-14 w-full"
                  style={{
                    background: `linear-gradient(135deg, ${t.bg} 0%, ${t.bg} 60%, ${t.accent}22 100%)`,
                  }}
                >
                  <div className="flex items-center gap-1 p-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: t.accent, boxShadow: `0 0 4px ${t.accent}60` }}
                    />
                    <div className="flex gap-0.5">
                      {[t.accent, t.fg, `${t.fg}44`].map((c, i) => (
                        <div key={i} className="w-2 h-2 rounded-sm" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{t.name}</span>
                    {isActive && <Check className="w-3 h-3 text-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection title="Font Family" icon={<Type className="w-3.5 h-3.5" />}>
        <div className="space-y-2">
          {FONT_OPTIONS.map((f) => {
            const isActive = fontId === f.id;
            return (
              <button
                type="button"
                key={f.id}
                onClick={() => setFont(f.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                  isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <span
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold border border-border"
                  style={{
                    fontFamily:
                      f.id === "inter"
                        ? "'Inter', sans-serif"
                        : f.id === "plus-jakarta"
                        ? "'Plus Jakarta Sans', sans-serif"
                        : "'Manrope', sans-serif",
                  }}
                >
                  Aa
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">{f.name}</div>
                  <div className="text-[10px] text-muted-foreground">{f.desc}</div>
                </div>
                {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </PanelSection>
    </div>
  );
}

function CanvasTab() {
  const { config, updateConfig: ctxUpdate } = useCanvasConfig();

  const updateConfig = (key: string, value: number | string | boolean) => {
    ctxUpdate({ [key]: value } as Partial<typeof DEFAULT_CANVAS_CONFIG>);
  };

  const resetConfig = () => {
    ctxUpdate({ ...DEFAULT_CANVAS_CONFIG });
  };

  return (
    <div className="space-y-6">
      <PanelSection title="Node Geometry" icon={<Ruler className="w-3.5 h-3.5" />}>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Node Size</span>
              <span className="text-xs font-mono text-foreground tabular-nums">{config.nodeSize}px</span>
            </div>
            <input
              type="range"
              min={28}
              max={64}
              step={2}
              value={config.nodeSize}
              onChange={(e) => updateConfig("nodeSize", Number(e.target.value))}
              className="w-full accent-primary h-1.5"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/50 mt-0.5">
              <span>28</span><span>64</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Node Border Color</div>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => updateConfig("nodeStrokeColor", "#000000")}
                className="w-7 h-7 rounded-full border border-border/50 flex-shrink-0 transition-all hover:scale-110"
                style={{ background: "#000000", outline: (!config.nodeStrokeColor || config.nodeStrokeColor === "#000000") ? "2px solid hsl(var(--primary))" : "2px solid transparent", outlineOffset: 2 }}
                aria-label="Black node border color"
                title="Black"
              />
              <label className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0 transition-all hover:scale-110 cursor-pointer"
                style={{
                  boxShadow: "0 0 0 1px hsl(var(--border)/0.3)",
                  background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                  outline: config.nodeStrokeColor && config.nodeStrokeColor !== "#000000" ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  outlineOffset: 2,
                }}
                title="Custom color"
              >
                <input
                  type="color"
                  value={config.nodeStrokeColor?.startsWith("hsl(") ? "#000000" : (config.nodeStrokeColor ?? "#000000")}
                  onChange={(e) => updateConfig("nodeStrokeColor", e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ padding: 0, border: "none", background: "none" }}
                  aria-label="Custom node border color"
                />
              </label>
            </div>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Edge Styles" icon={<Ruler className="w-3.5 h-3.5" />}>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Edge Width</span>
              <span className="text-xs font-mono text-foreground tabular-nums">{config.edgeWidthNormal}px</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.5}
              value={config.edgeWidthNormal}
              onChange={(e) => updateConfig("edgeWidthNormal", Number(e.target.value))}
              className="w-full accent-primary h-1.5"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/50 mt-0.5">
              <span>0.5</span><span>4</span>
            </div>
          </div>
            <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Edge Color</div>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => updateConfig("edgeColor", "#000000")}
                className="w-7 h-7 rounded-full border border-border/50 flex-shrink-0 transition-all hover:scale-110"
                style={{ background: "#000000", outline: (!config.edgeColor || config.edgeColor === "#000000") ? "2px solid hsl(var(--primary))" : "2px solid transparent", outlineOffset: 2 }}
                aria-label="Black edge color"
                title="Black"
              />
              <label className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0 transition-all hover:scale-110 cursor-pointer"
                style={{
                  boxShadow: "0 0 0 1px hsl(var(--border)/0.3)",
                  background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                  outline: config.edgeColor && config.edgeColor !== "#000000" ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  outlineOffset: 2,
                }}
                title="Custom color"
              >
                <input
                  type="color"
                  value={config.edgeColor?.startsWith("hsl(") ? "#000000" : (config.edgeColor ?? "#000000")}
                  onChange={(e) => updateConfig("edgeColor", e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ padding: 0, border: "none", background: "none" }}
                  aria-label="Custom edge color"
                />
              </label>
            </div>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Annotation Defaults">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Default Font Size</span>
              <span className="text-xs font-mono text-foreground">{config.annFontSize ?? 12}px</span>
            </div>
            <div className="flex gap-1">
              {[{ l: "S", v: 10 }, { l: "M", v: 12 }, { l: "L", v: 14 }, { l: "XL", v: 16 }].map((s) => (
                <button
                  type="button"
                  key={s.v}
                  onClick={() => updateConfig("annFontSize", s.v)}
                  className={`flex-1 py-1 rounded text-xs border transition-all ${
                    (config.annFontSize ?? 12) === s.v ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Font Family</div>
            <div className="grid grid-cols-2 gap-1">
{([
                 { id: "Inter, sans-serif", label: "Inter" },
                 { id: "Arial, sans-serif", label: "Arial" },
                 { id: "Calibri, sans-serif", label: "Calibri" },
                 { id: "JetBrains Mono, monospace", label: "Mono" },
               ]).map((f) => (
                 <button
                   type="button"
                   key={f.id}
                   onClick={() => updateConfig("annFontFamily", f.id)}
                   className={`py-1 rounded text-xs border transition-all ${
                    (config.annFontFamily ?? "Inter, sans-serif") === f.id ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                   }`}
                  style={{ fontFamily: f.id }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Style</div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => updateConfig("annBold", !(config.annBold ?? true))}
                className={`flex-1 py-1 rounded text-xs border transition-all ${
                  (config.annBold ?? true) ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                }`}
                style={{ fontWeight: (config.annBold ?? true) ? 600 : 400 }}
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => updateConfig("annUppercase", !(config.annUppercase ?? false))}
                className={`flex-1 py-1 rounded text-xs border transition-all ${
                  (config.annUppercase ?? false) ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                }`}
                style={{ textTransform: (config.annUppercase ?? false) ? "uppercase" : "none" }}
              >
                Uppercase
              </button>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Default Position</div>
            <div className="grid grid-cols-2 gap-1">
              {(["above", "below", "left", "right"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => updateConfig("annDefaultPos", p)}
                  className={`py-1 rounded text-xs border capitalize transition-all ${
                    (config.annDefaultPos ?? "below") === p ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PanelSection>

      <button
        type="button"
        onClick={resetConfig}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RotateCcw className="w-3 h-3" /> Reset to defaults
      </button>
    </div>
  );
}

function ToolbarTab() {
  const { config, updateConfig: ctxUpdate } = useCanvasConfig();

  const updateConfig = (key: string, value: number | string | boolean) => {
    ctxUpdate({ [key]: value } as Partial<typeof DEFAULT_CANVAS_CONFIG>);
  };

  const resetConfig = () => {
    ctxUpdate({ toolbarHeight: 96 });
  };

  return (
    <div className="space-y-6">
      <PanelSection title="Toolbar Height" icon={<PanelTop className="w-3.5 h-3.5" />}>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Height</span>
              <span className="text-xs font-mono text-foreground tabular-nums">{config.toolbarHeight ?? 96}px</span>
            </div>
            <input
              type="range"
              min={72}
              max={140}
              step={4}
              value={config.toolbarHeight ?? 96}
              onChange={(e) => updateConfig("toolbarHeight", Number(e.target.value))}
              className="w-full accent-primary h-1.5"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/50 mt-0.5">
              <span>72px</span><span>140px</span>
            </div>
          </div>
        </div>
      </PanelSection>

      <button
        type="button"
        onClick={resetConfig}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RotateCcw className="w-3 h-3" /> Reset to defaults
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("appearance");

  return (
    <div className="flex h-full">
      <nav className="w-56 flex-shrink-0 border-r border-border p-3 flex flex-col" style={{ background: "hsl(var(--sidebar))" }}>
        <div className="px-3 py-2 mb-2">
          <h1 className="text-sm font-semibold">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Customize your workspace</p>
        </div>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              activeTab === id
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {label}
          </button>
        ))}

      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "canvas" && <CanvasTab />}
          {activeTab === "toolbar" && <ToolbarTab />}
        </div>
      </div>
    </div>
  );
}
