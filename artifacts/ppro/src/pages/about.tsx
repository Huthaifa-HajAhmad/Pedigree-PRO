import { Server, Radio, Lock, Database, Fingerprint, Wifi, Hash, Code, Heart, Globe, GitBranch, CloudOff, Sparkles } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { getAppVersion } from "@/lib/version";
import { AppLogo } from "@/components/AppLogo";

export default function AboutPage() {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center p-2">
              <AppLogo className="w-full h-full text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Pedigree PRO</h1>
              <p className="text-sm text-muted-foreground">Local-first clinical pedigree editor</p>
            </div>
          </div>

          <PanelSection title="Privacy &amp; Compliance" icon={<Lock className="w-3.5 h-3.5" />}>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Server className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Local-first architecture</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All data stays on your device in local SQLite (desktop) or browser IndexedDB. An optional zero-knowledge relay enables encrypted link sharing — it never sees plaintext data.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Database className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Encrypted at rest</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Browser mode encrypts the database with AES-256-GCM before writing to IndexedDB. SQLCipher protects the desktop SQLite database.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Fingerprint className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">HIPAA-aligned &amp; Serverless</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No third-party analytics, telemetry trackers, or background logging. Private keys are saved securely via IndexedDB (never in plaintext localStorage).
                  </p>
                </div>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Networking" icon={<Wifi className="w-3.5 h-3.5" />}>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Radio className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">WebRTC peer-to-peer</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share pedigrees directly over your local network. No signaling server, no data leaves the LAN.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <CloudOff className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Zero-knowledge relay</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Optional encrypted link sharing via a relay that stores only encrypted blobs for 7 days. The relay never accesses plaintext. LAN sharing bypasses the relay entirely.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Hash className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Hybrid encryption</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ed25519 keypairs with AES-GCM envelopes. Each recipient decrypts with their own stored private key.
                  </p>
                </div>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Technology" icon={<Code className="w-3.5 h-3.5" />}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">React + Vite + TS</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">sql.js (WASM SQLite)</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Tauri + SQLCipher</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Fingerprint className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">AES-256-GCM + noble-crypto</span>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="What's New" icon={<Sparkles className="w-3.5 h-3.5" />} defaultOpen={false}>
            <div className="relative border-l border-border pl-6 ml-3 space-y-6 my-2">
              <div className="relative">
                <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-primary bg-background flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Version 1.2.5</span>
                  <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Latest</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">June 2026</p>
                <ul className="mt-2.5 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Genotype Customization:</strong> Custom font sizes, symbol offsets, and colors for mutant (+), wild-type (-), and separator (/) symbols dynamically rendered under nodes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Segmented Panel Controls:</strong> Upgraded Gender, Affection Status, and Genotype inputs to interactive segmented buttons with premium icons.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Interactive Onboarding Tour:</strong> Feature walkthrough modal explaining shortcuts, validation alerts, risk calculations, and offline capabilities.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Canvas Layout Integration:</strong> Cleaned up interface layouts by moving the TabBar inside the canvas area and aligning overlays with collapsible sidebars.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Skeuomorphic Planner Tabs:</strong> Redesigned tab bar and canvas page with cream paper texture, stacked index-tab aesthetic, 3D gradients, white background, scaled-up sizing, and aligned corner radii.</span>
                  </li>
                </ul>
              </div>

              <div className="relative">
                <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-background flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Version 1.2.2</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">June 2026</p>
                <ul className="mt-2.5 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Cross-platform macOS build:</strong> Full macOS build support — WebView2 zoom reset guarded with platform-specific compilation, cross-platform home directory resolution, and Windows-only DLLs moved to platform-specific config.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Pedigree Wizard:</strong> Guided step-by-step wizard for creating family pedigrees, accessible from the toolbar.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Onboarding flow:</strong> New users see a guided setup screen instead of a blank app.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Profile danger zone:</strong> Delete profiles with confirmation dialog and key revocation warning.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Sibling spacing:</strong> New evenOutSiblingSpacing algorithm and spouse placement optimization for cleaner layouts.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Canvas UX:</strong> Click canvas background to clear selection and close panels.</span>
                  </li>
                </ul>
              </div>

              <div className="relative">
                <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-background flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Version 1.2.0</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">June 2026</p>
                <ul className="mt-2.5 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Unified Sidebar:</strong> Merged version timeline scrubber and session history list into one seamless, vertical panel.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Visual Diff Engine:</strong> Highlight additions, deletions, and modifications directly on the pedigree canvas during session previews.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold select-none mt-0.5">•</span>
                    <span><strong>Minimap Enhancements:</strong> Optimized edge drawings, eliminated gap spacing, and added layout overflow clipping.</span>
                  </li>
                </ul>
              </div>

              <div className="relative">
                <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-background flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Version 1.1.0</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">May 2026</p>
                <ul className="mt-2.5 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/60 font-bold select-none mt-0.5">•</span>
                    <span><strong>Accessibility Benchmarks:</strong> Implemented axe-core accessibility checks, full keyboard navigation, and semantic ARIA labeling.</span>
                  </li>
                </ul>
              </div>
            </div>
          </PanelSection>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Heart className="w-3 h-3 text-destructive" />
            <span>Pedigree PRO {getAppVersion()} · Built for clinical genetics</span>
          </div>
        </div>
      </div>
    </div>
  );
}
