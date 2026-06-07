import { useState } from "react";
import {
  LifeBuoy, Keyboard, Lightbulb, Grid3x3,
  Stethoscope, Clock,
  AlertCircle, Wand2, Shield,
  Share2, Wifi, GitMerge, FileDown, Search,
  BookOpen
} from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface HelpGroupProps {
  labelHidden?: boolean;
}

// useDropdownPosition removed: positioning is now handled natively by Radix Popover.

type TabId = "features" | "shortcuts" | "tips" | "collaborate" | "manual";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "features", label: "Features", icon: Grid3x3 },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "tips", label: "Tips", icon: Lightbulb },
  { id: "collaborate", label: "Collaborate", icon: Share2 },
  { id: "manual", label: "User Manual", icon: BookOpen },
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
  { title: "Add Siblings Quickly", body: "Select a node and click the '+' sibling handle to add multiple siblings at once. They will be ordered by date of birth automatically." },
  { title: "Change Relationship Lines", body: "Click on the horizontal line connecting a couple to mark it as consanguineous (double line), divorced (slashed line), or dissolved." },
  { title: "Twin group alignment", body: "Select sibling nodes, open the context menu, and click 'Mark as Twins'. You can toggle between monozygotic (identical) and dizygotic (fraternal) layouts." },
  { title: "Local network sharing", body: "Use WebRTC LAN sharing for instant real-time synchronization with colleagues on the same network without saving to the cloud." }
];

const MANUAL_SECTIONS = [
  {
    title: "1. Standard Clinical Symbols",
    items: [
      { term: "Male Symbol", desc: "Represented by a Square (□)." },
      { term: "Female Symbol", desc: "Represented by a Circle (○)." },
      { term: "Unknown Gender", desc: "Represented by a Diamond (◇)." },
      { term: "Affected Individual", desc: "Indicated by a fully colored/shaded symbol (solid fill)." },
      { term: "Deceased Individual", desc: "Indicated by a diagonal line (/) running through the symbol." },
      { term: "Asymptomatic Carrier", desc: "Indicated by a small dot inside the symbol." },
      { term: "Spontaneous Abortion / Stillbirth", desc: "Represented by a small triangle (△). Can be marked via the context menu or pressing 'S'." },
      { term: "Adopted Status", desc: "Represented by brackets [ ] enclosing the symbol. Can be toggled in the node properties panel." },
    ]
  },
  {
    title: "2. Pedigree Line Conventions",
    items: [
      { term: "Relationship Line", desc: "A horizontal line connecting two individuals indicates a relationship or marriage." },
      { term: "Consanguinity Line", desc: "A double horizontal line indicates a blood relationship (consanguineous couple / cousin marriage)." },
      { term: "Sibship Line", desc: "A horizontal line connecting siblings, ordered by birth order from oldest (left) to youngest (right)." },
      { term: "Twin Branching", desc: "A diagonal branch originating from the sibship line. Monozygotic (identical) twins have a horizontal bar connecting their diagonal branches; dizygotic (fraternal) twins do not." },
    ]
  },
  {
    title: "3. Step-by-Step Drawing Guide",
    items: [
      { term: "Step 1: Start with the Proband", desc: "Designate the index patient by selecting a node and checking 'Mark as Proband' in the sidebar to add the arrow indicator." },
      { term: "Step 2: Add Parents & Partner", desc: "Select a node and click the handles that appear around it (top for parents, sides for partners) to grow the pedigree." },
      { term: "Step 3: Add Siblings & Offspring", desc: "Use the '+' handle on the parent relationship line to add children, or select a node and click the sibling handle to add siblings." },
      { term: "Step 4: Resolve Collisions", desc: "Press 'Ctrl+L' at any time to run the auto-layout engine, aligning generations and fixing line overlaps automatically." },
    ]
  }
];

const sectionIcons: Record<string, React.ElementType> = {
  Nodes: Grid3x3,
  Edit: Wand2,
  Canvas: Keyboard,
  Selection: Search,
};

const COLLABORATE_SECTIONS = [
  {
    icon: Share2,
    title: "Share Link",
    items: [
      "Generate a secure link via the unified Collaborate modal.",
      "Select view-only or full editor access permissions.",
      "Paste a recipient's Ed25519 public key to encrypt the database blob.",
      "Links expire automatically after 7 days.",
    ],
  },
  {
    icon: Wifi,
    title: "LAN Collaboration (P2P)",
    items: [
      "Direct peer-to-peer WebRTC transfer over your local network.",
      "Host creates a session and copies the signaling offer code.",
      "Guest pastes the offer and returns the signaling answer code.",
      "Completely serverless: data stays inside your local network.",
      "Supports optional E2E encryption with recipient public keys.",
    ],
  },
  {
    icon: Clock,
    title: "Version Timeline",
    items: [
      "Browse and manage previous pedigree versions.",
      "Click to preview, double-click to restore.",
      "Auto-play cycles through versions to inspect history.",
      "Shows cryptographic identity (Ed25519 key) of each saver.",
    ],
  },
  {
    icon: GitMerge,
    title: "Import & Merge",
    items: [
      "When loading shared pedigrees, review changes before merging.",
      "Merge — combine incoming updates into your current canvas.",
      "Branch — save as a separate, independent workspace.",
      "Visual diff highlights added (green), removed (red), and modified (yellow) nodes.",
    ],
  },
  {
    icon: FileDown,
    title: "Export Formats",
    items: [
      "PRO (.ppro) — complete encrypted archive with version history.",
      "Clinical Report — PDF with risk assessment and validation.",
      "Diagrams — PNG/SVG with optional transparent backgrounds.",
      "PowerPoint — fully editable slide deck with native shapes.",
    ],
  },
];

export function HelpGroup({ labelHidden = false }: HelpGroupProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("features");
  const [searchQuery, setSearchQuery] = useState("");
  const [testKey, setTestKey] = useState("");
  const [matchedAction, setMatchedAction] = useState<{ key: string; desc: string } | null>(null);

  const kbd = (s: string) => (
    <kbd className="inline-block text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border leading-none">{s}</kbd>
  );

  const handleTestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    let key = e.key;
    if (key === "Control" || key === "Alt" || key === "Shift") {
      setTestKey(parts.join("+"));
      return;
    }

    if (key === "Escape") {
      setTestKey("");
      setMatchedAction(null);
      return;
    }

    if (key === "Delete") key = "Del";
    if (key === " ") key = "Space";

    if (key.length === 1) {
      key = key.toUpperCase();
    }

    parts.push(key);
    const shortcutStr = parts.join("+");
    setTestKey(shortcutStr);

    let found: { key: string; desc: string } | null = null;
    for (const section of SHORTCUTS) {
      for (const row of section.rows) {
        if (row.key.toLowerCase() === shortcutStr.toLowerCase()) {
          found = row;
          break;
        }
      }
      if (found) break;
    }

    setMatchedAction(found);

    // Auto-navigate to shortcuts tab if tested key matches a shortcut
    if (found) {
      setTab("shortcuts");
    }
  };

  // Search filtering logic
  const filteredFeatures = FEATURE_HIGHLIGHTS.filter(f =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.shortcut && f.shortcut.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredShortcuts = SHORTCUTS.map(sec => {
    const matchedRows = sec.rows.filter(r =>
      r.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.key.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...sec, rows: matchedRows };
  }).filter(sec => sec.rows.length > 0);

  const filteredTips = TIPS.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCollaborate = COLLABORATE_SECTIONS.filter(sec =>
    sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.items.some(item => item.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredManual = MANUAL_SECTIONS.map(sec => {
    const matchedItems = sec.items.filter(item =>
      item.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...sec, items: matchedItems };
  }).filter(sec => sec.items.length > 0);

  const hasLocalMatches = () => {
    if (tab === "features") return filteredFeatures.length > 0;
    if (tab === "shortcuts") return filteredShortcuts.length > 0;
    if (tab === "tips") return filteredTips.length > 0;
    if (tab === "collaborate") return filteredCollaborate.length > 0;
    if (tab === "manual") return filteredManual.length > 0;
    return false;
  };

  const otherTabsWithMatches: TabId[] = [];
  if (searchQuery) {
    const queryLower = searchQuery.toLowerCase();
    if (tab !== "features" && FEATURE_HIGHLIGHTS.some(f => f.title.toLowerCase().includes(queryLower) || f.desc.toLowerCase().includes(queryLower) || (f.shortcut && f.shortcut.toLowerCase().includes(queryLower)))) {
      otherTabsWithMatches.push("features");
    }
    if (tab !== "shortcuts" && SHORTCUTS.some(sec => sec.rows.some(r => r.desc.toLowerCase().includes(queryLower) || r.key.toLowerCase().includes(queryLower)))) {
      otherTabsWithMatches.push("shortcuts");
    }
    if (tab !== "tips" && TIPS.some(t => t.title.toLowerCase().includes(queryLower) || t.body.toLowerCase().includes(queryLower))) {
      otherTabsWithMatches.push("tips");
    }
    if (tab !== "collaborate" && COLLABORATE_SECTIONS.some(sec => sec.title.toLowerCase().includes(queryLower) || sec.items.some(item => item.toLowerCase().includes(queryLower)))) {
      otherTabsWithMatches.push("collaborate");
    }
    if (tab !== "manual" && MANUAL_SECTIONS.some(sec => sec.items.some(item => item.term.toLowerCase().includes(queryLower) || item.desc.toLowerCase().includes(queryLower)))) {
      otherTabsWithMatches.push("manual");
    }
  }

  return (
    <div className="flex flex-col justify-between h-full flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              title="Help & shortcuts"
              aria-label="Help & shortcuts"
              className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${open ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <LifeBuoy className="w-5 h-5" />
              <span>Help</span>
            </button>
          </DialogTrigger>
          <DialogContent className="border border-slate-200 dark:border-slate-800 max-w-5xl p-0 overflow-hidden bg-background/95 backdrop-blur-lg shadow-2xl flex flex-col md:flex-row h-[80vh] md:h-[580px] max-h-[90vh]">
            
            {/* Left Column: Sidebar (title, search, nav, tester) */}
            <div className="w-full md:w-[280px] bg-slate-50/50 dark:bg-slate-950/40 p-5 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/60 shrink-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                    <LifeBuoy className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "6s" }} /> Pedigree PRO
                  </h3>
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                    Help Center
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                    Documentation, shortcuts, and sharing tutorials.
                  </DialogDescription>
                </div>

                {/* Global Search Bar */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search help topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background border-border/80 focus-visible:ring-primary/20"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Vertical Category Navigation */}
                <nav className="space-y-1" aria-label="Help categories">
                  {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all text-left ${
                          tab === t.id
                            ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold border-l-2 border-teal-500 rounded-l-none"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Left Sidebar Bottom: Interactive Shortcut Tester */}
              <div className="bg-muted/40 p-3 rounded-lg border border-border/60 mt-4 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Interactive Shortcut Tester</span>
                  {testKey && (
                    <button
                      type="button"
                      onClick={() => { setTestKey(""); setMatchedAction(null); }}
                      className="text-[9px] hover:underline text-muted-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <Input
                  type="text"
                  placeholder="Focus & press key to test..."
                  value={testKey}
                  onKeyDown={handleTestKeyDown}
                  onChange={(e) => {}}
                  className="h-8 text-xs font-mono text-center bg-background border-border/80 focus-visible:ring-teal-500/30 focus-visible:border-teal-500/60"
                />
                {matchedAction ? (
                  <div className="text-[10px] text-center text-teal-600 dark:text-teal-400 font-semibold animate-pulse leading-snug">
                    Matched: <span className="underline">{matchedAction.desc}</span> ({matchedAction.key})
                  </div>
                ) : testKey ? (
                  <div className="text-[9px] text-center text-muted-foreground leading-snug">
                    No action mapped to "{testKey}"
                  </div>
                ) : (
                  <div className="text-[9px] text-center text-muted-foreground/70 leading-snug">
                    Press any key combo (e.g. M, F, Delete, Ctrl+Z)
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Main Content area */}
            <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto bg-background">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-foreground capitalize">
                    {TABS.find(t => t.id === tab)?.label ?? "Help Manual"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {tab === "features" && "Discover the powerful clinical tools built directly into the pedigree canvas."}
                    {tab === "shortcuts" && "Optimize your workflow with keyboard hotkeys for rapid pedigree construction."}
                    {tab === "tips" && "Useful best practices, styling tips, and Canvas operations."}
                    {tab === "collaborate" && "Learn how serverless links, WebRTC LAN, imports, and formats work."}
                    {tab === "manual" && "Nomenclature standards, pedigree conventions, and step-by-step drawing instructions."}
                  </p>
                </div>

                <div className="space-y-4">
                  {searchQuery && !hasLocalMatches() ? (
                    <div className="py-12 text-center space-y-4">
                      <p className="text-xs text-muted-foreground">No matches found in <strong>{TABS.find(t => t.id === tab)?.label}</strong>.</p>
                      {otherTabsWithMatches.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Matches found in other tabs:</p>
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {otherTabsWithMatches.map(tId => (
                              <button
                                key={tId}
                                type="button"
                                onClick={() => setTab(tId)}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-semibold transition-all shadow-sm"
                              >
                                {TABS.find(t => t.id === tId)?.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/70">No matches found anywhere in the help documents.</p>
                      )}
                    </div>
                  ) : (
                    <>
                      {tab === "features" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {filteredFeatures.map((feat) => {
                            const Icon = feat.icon;
                            return (
                              <div key={feat.title} className="flex gap-3.5 p-3.5 rounded-xl border border-border/60 bg-card hover:bg-accent/40 transition-all shadow-sm">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-foreground">{feat.title}</span>
                                    {feat.shortcut && kbd(feat.shortcut)}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">{feat.desc}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {tab === "shortcuts" && (
                        <div className="space-y-4">
                          {filteredShortcuts.map((section) => (
                            <div key={section.section} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                              <h5 className="text-[10px] uppercase tracking-wider text-teal-600 dark:text-teal-400 font-bold mb-2.5 flex items-center gap-1.5">
                                {(() => {
                                  const IconComponent = sectionIcons[section.section] || Keyboard;
                                  return <IconComponent className="w-3.5 h-3.5" />;
                                })()}
                                <span>{section.section}</span>
                              </h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                {section.rows.map((row) => {
                                  const isMatched = matchedAction && row.key.toLowerCase() === matchedAction.key.toLowerCase();
                                  return (
                                    <div
                                      key={row.key}
                                      className={`flex items-center justify-between py-1.5 px-3 rounded-lg border transition-all duration-200 ${
                                        isMatched
                                          ? "bg-teal-500/15 border-teal-500/40 text-teal-600 dark:text-teal-400 font-bold scale-[1.02] shadow-sm animate-pulse"
                                          : "border-border/30 bg-slate-50/25 dark:bg-slate-900/10 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:border-border/60"
                                      }`}
                                    >
                                      <span className={`text-xs truncate ${isMatched ? "text-teal-600 dark:text-teal-400 font-bold" : "text-muted-foreground"}`}>
                                        {row.desc}
                                      </span>
                                      {kbd(row.key)}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {tab === "manual" && (
                        <div className="space-y-4">
                          {filteredManual.map((section) => (
                            <div key={section.title} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                              <h5 className="text-[10px] uppercase tracking-wider text-teal-600 dark:text-teal-400 font-bold mb-2.5">{section.title}</h5>
                              <div className="space-y-2.5">
                                {section.items.map((item, i) => (
                                  <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-1.5 px-2.5 rounded-lg border border-border/40 bg-slate-50/20 dark:bg-slate-900/10">
                                    <span className="text-xs font-bold text-foreground sm:w-48 shrink-0">
                                      {item.term}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground leading-relaxed">
                                      {item.desc}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {tab === "tips" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {filteredTips.map((tip, i) => (
                            <div key={i} className="flex gap-3 p-4 rounded-xl border border-border/60 bg-card shadow-sm">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-foreground mb-1">{tip.title}</p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.body}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {tab === "collaborate" && (
                        <div className="space-y-4">
                          {filteredCollaborate.map((section) => {
                            const SectionIcon = section.icon;
                            return (
                              <div key={section.title} className="flex gap-4 p-4 rounded-xl border border-border/60 bg-card shadow-sm">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <SectionIcon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-foreground mb-1.5">{section.title}</p>
                                  <ul className="space-y-1 list-disc pl-4 text-muted-foreground">
                                    {section.items.map((item, i) => (
                                      <li key={i} className="text-[11px] leading-relaxed">
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

          </DialogContent>
        </Dialog>
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Help</div>}
    </div>
  );
}
