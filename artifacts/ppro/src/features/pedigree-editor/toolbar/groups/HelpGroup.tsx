import { useState, useEffect, useRef, useCallback } from "react";
import {
  LifeBuoy, Keyboard, Lightbulb, Grid3x3,
  Stethoscope, Clock,
  AlertCircle, Wand2, HelpCircle, Shield
} from "lucide-react";

interface HelpGroupProps {
  labelHidden?: boolean;
}

function useDropdownPosition(ref: React.RefObject<HTMLButtonElement | null>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelHeight = 420;
    let top = r.bottom + 4;
    if (top + panelHeight > window.innerHeight) {
      top = Math.max(8, r.top - panelHeight);
    }
    setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - 400)) });
  }, [ref]);
  return { pos, measure };
}

type TabId = "features" | "shortcuts" | "tips";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "features", label: "Features", icon: Grid3x3 },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "tips", label: "Tips", icon: Lightbulb },
];

const FEATURE_HIGHLIGHTS = [
  { icon: Wand2, title: "Auto-layout", desc: "Instantly tidy complex pedigrees with generation-aligned layout.", shortcut: "Ctrl+L" },
  { icon: Stethoscope, title: "Risk Calculator", desc: "Compute recurrence risks from pedigree structure and inheritance patterns.", shortcut: null },
  { icon: AlertCircle, title: "Validation", desc: "Detect pedigree errors: disconnected nodes, missing parents, age inconsistencies.", shortcut: null },
  { icon: Shield, title: "Encrypted Sharing", desc: "End-to-end encrypt share links with a recipient's Ed25519 public key.", shortcut: null },
  { icon: Clock, title: "Version Timeline", desc: "Browse, preview, and restore any past version of your pedigree.", shortcut: null },
];

const SHORTCUTS = [
  { section: "Nodes", rows: [
    { key: "M", desc: "Male" },
    { key: "F", desc: "Female" },
    { key: "U", desc: "Unknown" },
    { key: "P", desc: "Pregnancy" },
    { key: "S", desc: "Stillbirth" },
  ]},
  { section: "Edit", rows: [
    { key: "Del", desc: "Delete selected" },
    { key: "Ctrl+Z", desc: "Undo" },
    { key: "Ctrl+Y", desc: "Redo" },
    { key: "Ctrl+A", desc: "Select all" },
  ]},
  { section: "Canvas", rows: [
    { key: "Ctrl+L", desc: "Auto-layout" },
    { key: "/", desc: "Search nodes" },
    { key: "Space+Drag", desc: "Pan canvas" },
    { key: "Ctrl+Drag", desc: "Extend lines" },
  ]},
  { section: "Selection", rows: [
    { key: "Click", desc: "Select node" },
    { key: "Ctrl+Click", desc: "Multi-select" },
    { key: "Drag empty", desc: "Lasso select" },
  ]},
];

const TIPS = [
  { title: "Set a proband", body: "Mark any node as proband (arrow indicator) to anchor risk calculations and auto-labeling." },
  { title: "Snap & auto-layout", body: "Enable Snap mode to keep generations aligned. Use Ctrl+L to tidy complex pedigrees instantly." },
  { title: "Share securely", body: "Paste a colleague's Ed25519 public key to encrypt the share link. No key = open link (not HIPAA-safe)." },
  { title: "Annotations", body: "Double-click any annotation to edit text. Drag to reposition. They snap to canonical spots near nodes." },
];

export function HelpGroup({ labelHidden = false }: HelpGroupProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("features");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { pos, measure } = useDropdownPosition(buttonRef);

  useEffect(() => {
    if (!open) return;
    measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, measure]);

  const kbd = (s: string) => (
    <kbd className="inline-block text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border leading-none">{s}</kbd>
  );

  return (
    <div className="flex flex-col justify-between h-full flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button
          type="button"
          ref={buttonRef}
          onClick={() => setOpen(!open)}
          title="Help & shortcuts"
          aria-label="Help & shortcuts"
          aria-expanded={open}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${open ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <LifeBuoy className="w-5 h-5" />
          <span>Help</span>
        </button>
        {open && pos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 w-[380px] max-h-[85vh] overflow-hidden border border-border rounded-lg shadow-xl bg-popover flex flex-col"
              style={{ top: pos.top, left: pos.left }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold">Help Center</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                  aria-label="Close help"
                >
                  <span className="text-xs">✕</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border flex-shrink-0">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${tab === t.id ? "text-primary bg-primary/5 border-b-2 border-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                    >
                      <Icon className="w-3 h-3" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-3">
                {tab === "features" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Key features to explore</p>
                    {FEATURE_HIGHLIGHTS.map((feat) => {
                      const Icon = feat.icon;
                      return (
                        <div key={feat.title} className="flex gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/40">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-foreground">{feat.title}</span>
                              {feat.shortcut && <kbd className="inline-block text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border leading-none">{feat.shortcut}</kbd>}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{feat.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {tab === "shortcuts" && (
                  <div className="space-y-3">
                    {SHORTCUTS.map((section) => (
                      <div key={section.section}>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1">{section.section}</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {section.rows.map((row) => (
                            <div key={row.key} className="flex items-center justify-between py-0.5">
                              <span className="text-[11px] text-muted-foreground truncate">{row.desc}</span>
                              {kbd(row.key)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "tips" && (
                  <div className="space-y-3">
                    {TIPS.map((tip, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        <div>
                          <p className="text-[11px] font-semibold text-foreground mb-0.5">{tip.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Help</div>}
    </div>
  );
}
