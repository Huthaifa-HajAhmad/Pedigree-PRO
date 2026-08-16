import { Sparkles, Heart } from "lucide-react";
import { getAppVersion } from "@/lib/version";

export default function WhatsNewPage() {
  return (
    <div className="flex h-full bg-background animate-in fade-in duration-200">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          <div className="flex items-center gap-3 border-b border-border/60 pb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center shadow-sm shadow-primary/4 p-2">
              <Sparkles className="w-full h-full text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">What's New</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Recent updates, features, and fixes in Pedigree PRO</p>
            </div>
          </div>

          <div className="relative border-l border-border pl-6 ml-3 space-y-8 my-2">
            {/* Version 1.4.0 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-primary bg-background flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Version 1.4.0</span>
                <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Latest</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">August 2026</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Line Crossing Bridges (Line Hopping):</strong> Added automatic intersection detection between vertical sibling drop lines and relationship lines, rendering clear visual arc jump bridges to prevent ambiguity.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Clinical Symbols (SAB & Stillbirth):</strong> Standardized Spontaneous Abortion (SAB) to a clinical triangle shape (&Delta;) and implemented sex-specific Stillbirth (SB) symbols with diagonal slashes and validation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Multi-Family Generation Rails:</strong> Independent connected-component Roman numeral generation rails (<code className="text-primary">I</code>, <code className="text-primary">II</code>, <code className="text-primary">III</code>) for workspaces containing multiple discrete families.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Cross-Tab Copy & Paste:</strong> Seamlessly copy pedigree branches, subtrees, or individuals from one tab or project and paste into another while preserving relationships and clinical data.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Subtree Alignment & Spacing:</strong> Added family-aware alignment guides and one-click equal horizontal distribution tools for sibling groups and founders.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Apache 2.0 Open-Source Release:</strong> Full transition to open-source governance with zero-knowledge encrypted relay sharing, updated security disclosures, and HIPAA compliance mapping.</span>
                </li>
              </ul>
            </div>

            {/* Version 1.3.5 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-background flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Version 1.3.5</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">July 2026</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Layout Spacing Controls:</strong> Added dynamic "Between Gen Gap" and "Sibship Drop Height" sliders to easily customize pedigree layouts with immediate, smooth live redraws on the canvas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Topological Layout Engine:</strong> Upgraded the auto-layout engine to utilize topological Kahn sort longest-path layering, subtree-aware sibling spacing, and dynamic layout caching to prevent overlaps.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Visual Quadrant Shading Editor:</strong> Redesigned custom quadrant shading with a visual 2x2 grid segment selector, restricting segment customization strictly to the "Quadrant" shading style.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Age in Months & Suffix Support:</strong> Enabled typing custom age suffixes like months (`4m`). DOB calculator automatically outputs age in months (e.g. `3m`) for infants under 1 year.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Inbreeding Clinical Guidance:</strong> Added an intuitive clinical information and evidence validation modal next to the Inbreeding Coefficients card, citing Wright (1922) and Bennett et al. (2021).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>UI & Accessibility Refinements:</strong> Polished CSV/Spreadsheet warning contrast, added file upload extension hints (`.csv`/`.tsv`), and completed accessibility audits.</span>
                </li>
              </ul>
            </div>

            {/* Version 1.3.0 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-background flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Version 1.3.0</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">July 2026</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Coefficient of Inbreeding ($F$):</strong> Added dynamic inbreeding calculation for the entire family tree, displaying Wright's path coefficients for consanguineous couples in the Risk sidebar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Linkage/GATK PED File Support:</strong> Introduced raw data exchange support for importing and exporting standard pedigree `.ped` files.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Custom Pedigree Templates:</strong> Enabled saving any pedigree structure to local templates with custom names/descriptions and a confirmation-backed gallery view.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Dual-Phenotype Shading & Secondary Colors:</strong> Refactored quadrant split-shading styles and added a secondary color picker tool inside the Properties Panel.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Interactive UI Polish & Wizard Stability:</strong> Enhanced genotype input layouts, resolved wizard preview layout caching glitches, and prepended generation auto-labels in the risk panel.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold select-none mt-0.5">•</span>
                  <span><strong>Tauri Desktop Pinch Zoom & Native Support:</strong> Resolved Windows trackpad pinch zoom consumption bugs and refined platform-specific configuration parity.</span>
                </li>
              </ul>
            </div>

            {/* Version 1.2.5 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-background flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Version 1.2.5</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">June 2026</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
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

            {/* Version 1.2.2 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-background flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Version 1.2.2</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">June 2026</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
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

            {/* Version 1.2.0 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-background flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Version 1.2.0</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">June 2026</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
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

            {/* Version 1.1.0 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-background flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Version 1.1.0</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">May 2026</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/60 font-bold select-none mt-0.5">•</span>
                  <span><strong>Accessibility Benchmarks:</strong> Implemented axe-core accessibility checks, full keyboard navigation, and semantic ARIA labeling.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 border-t border-border/40 pt-5">
            <Heart className="w-3.5 h-3.5 text-destructive" />
            <span>Pedigree PRO {getAppVersion()} · Built for clinical genetics</span>
          </div>
        </div>
      </div>
    </div>
  );
}
