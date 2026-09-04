import { useState, useRef, useEffect } from "react";
import { Palette, Type, Ruler, Check, RotateCcw, PanelTop, ShieldCheck, Lock, Info, Trash2, Download, Upload, KeyRound, Database, RefreshCw, AlertTriangle, History, Undo2 } from "lucide-react";
import { THEMES, COLOR_PALETTES, useTheme, applyTheme } from "@/lib/theme";
import { FONT_OPTIONS, useFont } from "@/lib/font";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { useCanvasConfig, DEFAULT_CANVAS_CONFIG } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { secureDisposalWithConfirmation } from "@/lib/secure-disposal";
import { backupDatabase, restoreDatabase, getSafetySnapshots, restoreSafetySnapshot, rotateEncryptionKey, detectApiMode, type SafetySnapshot } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "canvas", label: "Canvas", icon: Ruler },
  { id: "toolbar", label: "Toolbar", icon: PanelTop },
  { id: "security", label: "Security & Encryption", icon: ShieldCheck },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AppearanceTab() {
  const { themeId, setTheme, colorPalette, setColorPalette } = useTheme();
  const { fontId, setFont } = useFont();

  return (
    <div className="space-y-6">
      <PanelSection title="Color Theme Mode" icon={<Palette className="w-3.5 h-3.5" />}>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => {
            const isActive = themeId === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTheme(t.id)}
                onMouseEnter={() => applyTheme(t.id, colorPalette)}
                onMouseLeave={() => applyTheme(themeId, colorPalette)}
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

        {/* Color Palette Selector */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-2.5">Accent Color</label>
          <div className="flex flex-wrap items-center gap-3">
            {COLOR_PALETTES.map((palette) => {
              const isActive = colorPalette === palette.id;
              return (
                <button
                  type="button"
                  key={palette.id}
                  onClick={() => setColorPalette(palette.id)}
                  title={palette.name}
                  className="w-7 h-7 rounded-full transition-all hover:scale-110 flex items-center justify-center cursor-pointer"
                  style={{
                    backgroundColor: palette.hex,
                    boxShadow: isActive ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${palette.hex}` : `0 0 0 1px ${palette.hex}40`,
                  }}
                >
                  {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              );
            })}
          </div>
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

function SecurityTab() {
  return (
    <div className="space-y-6">
      <PanelSection title="Data Encryption at Rest" icon={<Lock className="w-3.5 h-3.5" />}>
        <div className="space-y-4 text-sm text-foreground">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pedigree PRO is designed as a serverless clinical pedigree editor. All patient data, family trees, and annotations remain strictly on your local device.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="p-3 rounded-lg border border-border bg-card/40 flex flex-col space-y-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Browser Mode (sql.js)
              </span>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                Database blob is encrypted with AES-256-GCM before writing to IndexedDB. Private profile keys are isolated in IndexedDB.
              </span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card/40 flex flex-col space-y-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Desktop Mode (Tauri)
              </span>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                Database file is protected via SQLCipher. Master keys are securely stored in your operating system's native credential keychain.
              </span>
            </div>
          </div>
        </div>
      </PanelSection>

      <DatabaseBackupSection />

      <PanelSection title="Key Protection & Storage Architecture" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
        <div className="space-y-4">
          <div className="flex gap-3 p-3.5 rounded-lg border border-warning/20 bg-warning/5 text-warning-foreground">
            <Info className="w-4.5 h-4.5 text-warning flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-semibold block text-amber-500">Security Architecture Note</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                In browser standalone mode, database blobs, autosaved drafts, and exported backups are encrypted with AES-256-GCM within your local browser storage partition. To enable seamless single-session workflows without a login server, wrapping keys are stored in IndexedDB.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 flex flex-col space-y-2">
            <span className="text-xs font-semibold text-primary">Clinical Workstations & HIPAA Compliance Recommendation</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              For clinical environments and multi-user workstations, we recommend running the native <strong>Pedigree PRO Desktop App</strong> (Tauri), which leverages native SQLCipher database encryption paired with your operating system's hardware-backed credential keychain (Windows Credential Manager / macOS Keychain / Linux Secret Service).
            </p>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Data Erasure & Right-to-Erasure (GDPR / HIPAA)" icon={<Trash2 className="w-3.5 h-3.5 text-destructive" />}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Permanently destroy all clinical records, patients, pedigrees, saved templates, and cryptographic profile keys stored on this device.
          </p>
          <button
            type="button"
            onClick={() => secureDisposalWithConfirmation()}
            className="px-3.5 py-2 text-xs font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-md transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Erase All Local Data
          </button>
        </div>
      </PanelSection>
    </div>
  );
}

function DatabaseBackupSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDesktop = detectApiMode() === "tauri";
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Restore states
  const [restorePassphraseModalOpen, setRestorePassphraseModalOpen] = useState(false);
  const [restoreConfirmModalOpen, setRestoreConfirmModalOpen] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [pendingRestoreData, setPendingRestoreData] = useState<string | null>(null);
  const [pendingDesktopPath, setPendingDesktopPath] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Safety snapshots state
  const [safetySnapshots, setSafetySnapshots] = useState<SafetySnapshot[]>([]);
  const [recoverConfirmOpen, setRecoverConfirmOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SafetySnapshot | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  // Key rotation state
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const loadSafetySnapshots = async () => {
    try {
      const snapshots = await getSafetySnapshots();
      setSafetySnapshots(snapshots || []);
    } catch {
      setSafetySnapshots([]);
    }
  };

  useEffect(() => {
    loadSafetySnapshots();
  }, []);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      if (isDesktop) {
        const path = await backupDatabase();
        toast({ title: "Backup Created", description: `Database snapshot saved: ${path || "local data folder"}` });
      } else {
        const json = await backupDatabase(exportPassphrase.trim() || undefined);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `pedigree_pro_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Backup Exported", description: "Encrypted database backup downloaded." });
      }
      setExportModalOpen(false);
      setExportPassphrase("");
    } catch (e) {
      toast({
        title: "Backup Failed",
        description: e instanceof Error ? e.message : "Failed to create database backup",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDesktopRestoreClick = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        filters: [{ name: "Database Backup", extensions: ["db", "sqlite", "sqlite3"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setPendingDesktopPath(selected);
        setRestoreConfirmModalOpen(true);
      }
    } catch (err) {
      toast({
        title: "File Selection Failed",
        description: err instanceof Error ? err.message : "Failed to open file dialog",
        variant: "destructive",
      });
    }
  };

  const handleBrowserFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;
      try {
        const parsed = JSON.parse(content);
        if (parsed.v === "ppro-encrypted-backup-v2") {
          setPendingRestoreData(content);
          setRestorePassphrase("");
          setRestorePassphraseModalOpen(true);
          return;
        }
      } catch {}
      setPendingRestoreData(content);
      setRestoreConfirmModalOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const executeRestore = async (backupDataOrPath: string, passphrase?: string) => {
    setIsRestoring(true);
    try {
      await restoreDatabase(backupDataOrPath, passphrase?.trim() || undefined);
      toast({ title: "Database Restored", description: "Clinic database successfully restored." });
      setRestorePassphraseModalOpen(false);
      setRestoreConfirmModalOpen(false);
      setPendingRestoreData(null);
      setPendingDesktopPath(null);
      setRestorePassphrase("");
      await loadSafetySnapshots();
      queryClient.invalidateQueries();
    } catch (e) {
      toast({
        title: "Restore Failed",
        description: e instanceof Error ? e.message : "Invalid backup file or incorrect passphrase.",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const executeRecoverSnapshot = async (snapshot: SafetySnapshot) => {
    setIsRecovering(true);
    try {
      await restoreSafetySnapshot(snapshot.id);
      toast({ title: "Snapshot Recovered", description: "Database rolled back to pre-restore state." });
      setRecoverConfirmOpen(false);
      setSelectedSnapshot(null);
      await loadSafetySnapshots();
      queryClient.invalidateQueries();
    } catch (e) {
      toast({
        title: "Recovery Failed",
        description: e instanceof Error ? e.message : "Failed to recover safety snapshot.",
        variant: "destructive",
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleRotateKey = async () => {
    setIsRotating(true);
    try {
      await rotateEncryptionKey();
      toast({ title: "Key Rotated", description: "Database re-encrypted with a fresh encryption key." });
      setRotateConfirmOpen(false);
    } catch (e) {
      toast({
        title: "Key Rotation Failed",
        description: e instanceof Error ? e.message : "Failed to rotate database encryption key.",
        variant: "destructive",
      });
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <>
      <PanelSection title="Database Backup & Disaster Recovery" icon={<Database className="w-3.5 h-3.5 text-primary" />}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Create portable encrypted snapshots of your complete clinic database, restore previous backups, or rotate local storage keys.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-lg border border-border bg-card/40 flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-primary" /> Export Encrypted Backup
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {isDesktop
                    ? "Generate a snapshot of the SQLCipher database file in your application directory."
                    : "Export a portable AES-256-GCM encrypted backup (.json) with optional PBKDF2 passphrase protection."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isDesktop) {
                    handleExportBackup();
                  } else {
                    setExportPassphrase("");
                    setExportModalOpen(true);
                  }
                }}
                className="w-full text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export Backup
              </Button>
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-card/40 flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-primary" /> Restore Database
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {isDesktop
                    ? "Restore from a previous SQLCipher database snapshot (.db)."
                    : "Restore all clinical records from a portable JSON backup file."}
                </p>
              </div>
              {isDesktop ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDesktopRestoreClick}
                  className="w-full text-xs"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Select Backup File
                </Button>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleBrowserFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Restore from JSON
                  </Button>
                </>
              )}
            </div>
          </div>

          {safetySnapshots.length > 0 && (
            <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-primary" /> Safety Snapshot (Pre-Restore)
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Preserved before last restore:{" "}
                  <span className="font-medium text-foreground">
                    {new Date(safetySnapshots[0]!.created_at).toLocaleString()}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSnapshot(safetySnapshots[0]!);
                  setRecoverConfirmOpen(true);
                }}
                className="text-xs flex-shrink-0"
              >
                <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                Recover Snapshot
              </Button>
            </div>
          )}

          {isDesktop && (
            <div className="p-3 rounded-lg border border-border bg-card/40 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-muted-foreground" /> Rotate Encryption Key
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Re-encrypt local SQLCipher database at rest with a fresh master key stored in OS Keychain.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRotateConfirmOpen(true)}
                className="text-xs flex-shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Rotate Key
              </Button>
            </div>
          )}
        </div>
      </PanelSection>

      {/* Export Passphrase Modal (Browser) */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Download className="w-4 h-4 text-primary" /> Export Portable Database Backup
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set a passphrase to encrypt your backup with PBKDF2 + AES-256-GCM. You will need this passphrase to restore your records on another machine.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-foreground">
              Backup Passphrase (recommended)
            </label>
            <Input
              type="password"
              placeholder="Enter passphrase or leave empty for device key"
              value={exportPassphrase}
              onChange={(e) => setExportPassphrase(e.target.value)}
              className="text-xs"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setExportModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleExportBackup} disabled={isExporting}>
              {isExporting ? "Exporting..." : "Download Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Passphrase Modal (Browser v2) */}
      <Dialog open={restorePassphraseModalOpen} onOpenChange={setRestorePassphraseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Upload className="w-4 h-4 text-primary" /> Enter Backup Passphrase
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This backup envelope is protected with passphrase-derived PBKDF2 encryption. Enter the passphrase used during export.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-foreground">
              Passphrase
            </label>
            <Input
              type="password"
              placeholder="Enter backup passphrase"
              value={restorePassphrase}
              onChange={(e) => setRestorePassphrase(e.target.value)}
              className="text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && pendingRestoreData && restorePassphrase) {
                  executeRestore(pendingRestoreData, restorePassphrase);
                }
              }}
            />
            <p className="text-[11px] text-amber-500 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Restoring will replace the active database. A safety snapshot is created automatically.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => { setRestorePassphraseModalOpen(false); setPendingRestoreData(null); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => pendingRestoreData && executeRestore(pendingRestoreData, restorePassphrase)}
              disabled={isRestoring || !restorePassphrase}
            >
              {isRestoring ? "Restoring..." : "Restore Database"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Modal (General / Legacy / Desktop) */}
      <Dialog open={restoreConfirmModalOpen} onOpenChange={setRestoreConfirmModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-amber-500">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Confirm Database Restore
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to restore the database? This action will overwrite your current patient records, pedigrees, and version history.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg border border-border bg-card/50 text-[11px] text-muted-foreground space-y-1">
            <span className="font-semibold text-foreground block">Safety Snapshot Protection</span>
            <p>
              A pre-restore backup snapshot will be preserved automatically before any changes are applied.
            </p>
            {pendingDesktopPath && (
              <p className="truncate font-mono text-[10px] text-primary pt-1">
                Source: {pendingDesktopPath}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRestoreConfirmModalOpen(false);
                setPendingRestoreData(null);
                setPendingDesktopPath(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (isDesktop && pendingDesktopPath) {
                  executeRestore(pendingDesktopPath, undefined);
                } else if (pendingRestoreData) {
                  executeRestore(pendingRestoreData, undefined);
                }
              }}
              disabled={isRestoring}
            >
              {isRestoring ? "Restoring..." : "Confirm & Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recover Safety Snapshot Modal */}
      <Dialog open={recoverConfirmOpen} onOpenChange={setRecoverConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-primary">
              <Undo2 className="w-4 h-4 text-primary" /> Recover Safety Snapshot
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Revert your database to the state preserved immediately prior to your previous restore?
            </DialogDescription>
          </DialogHeader>
          {selectedSnapshot && (
            <div className="p-3 rounded-lg border border-border bg-card/50 text-[11px] text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground block">Snapshot Details</span>
              <p>
                Recorded: <span className="font-medium text-foreground">{new Date(selectedSnapshot.created_at).toLocaleString()}</span>
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setRecoverConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => selectedSnapshot && executeRecoverSnapshot(selectedSnapshot)}
              disabled={isRecovering}
            >
              {isRecovering ? "Recovering..." : "Revert to Snapshot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate Key Confirmation Dialog */}
      <Dialog open={rotateConfirmOpen} onOpenChange={setRotateConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-amber-500">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Rotate Encryption Key
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will re-encrypt your local database at rest with a newly generated cryptographic key. Existing records will remain intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setRotateConfirmOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleRotateKey} disabled={isRotating}>
              {isRotating ? "Rotating..." : "Rotate Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
          {activeTab === "security" && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}
