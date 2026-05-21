import { useState } from "react";
import { Palette, Type, Ruler, Info, Check, RotateCcw } from "lucide-react";
import { THEMES, useTheme } from "@/lib/theme";
import { FONT_OPTIONS, useFont } from "@/lib/font";
import { PanelSection } from "@/components/shared/panels/PanelSection";

const TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "canvas", label: "Canvas", icon: Ruler },
  { id: "about", label: "About", icon: Info },
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
  const configStr = localStorage.getItem("ppro_canvas_config");
  const [config, setConfig] = useState(() => {
    try {
      return configStr ? JSON.parse(configStr) : { nodeSize: 44, edgeWidthNormal: 1.5 };
    } catch {
      return { nodeSize: 44, edgeWidthNormal: 1.5 };
    }
  });

  const updateConfig = (key: string, value: number | string) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    try { localStorage.setItem("ppro_canvas_config", JSON.stringify(next)); } catch {}
    window.dispatchEvent(new CustomEvent("canvas-config-change", { detail: next }));
  };

  const resetConfig = () => {
    const defaults = { nodeSize: 44, edgeWidthNormal: 1.5 };
    setConfig(defaults);
    try { localStorage.setItem("ppro_canvas_config", JSON.stringify(defaults)); } catch {}
    window.dispatchEvent(new CustomEvent("canvas-config-change", { detail: defaults }));
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
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Default Position</div>
            <div className="grid grid-cols-4 gap-1">
              {(["above", "below", "left", "right"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => updateConfig("annDefaultPos", p)}
                  className={`py-1 rounded text-xs border capitalize transition-all ${
                    (config.annDefaultPos ?? "below") === p ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {p.slice(0, 3)}
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

function AboutTab() {
  return (
    <div className="space-y-6">
      <PanelSection title="Application" defaultOpen={true}>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Name</span>
            <span className="text-xs font-medium">Pedigree PRO</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Version</span>
            <span className="text-xs font-mono">0.1.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">License</span>
            <span className="text-xs">Proprietary</span>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Privacy & Compliance" defaultOpen={true}>
        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-foreground">HIPAA Compliant.</strong> All patient data stays on your local device. No cloud sync, no external servers.</span>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-0.5" />
            <span><strong className="text-foreground">Zero-Server Architecture.</strong> Database is encrypted at rest with AES-256-GCM. No data leaves your device unless you explicitly share it.</span>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-0.5" />
            <span><strong className="text-foreground">WebRTC LAN Sharing.</strong> Peer-to-peer only. No signaling server. Data stays on your local network.</span>
          </div>
        </div>
      </PanelSection>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("appearance");

  return (
    <div className="flex h-full">
      <nav className="w-56 flex-shrink-0 border-r border-border p-3 space-y-0.5" style={{ background: "hsl(var(--sidebar))" }}>
        <div className="px-3 py-2 mb-2">
          <h1 className="text-sm font-semibold">Settings</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">Customize your workspace</p>
        </div>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors text-left ${
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
          {activeTab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}
