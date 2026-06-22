import { LayoutGrid, ChevronDown, Hash, PinOff, Eye } from "lucide-react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";
import { DEFAULT_CANVAS_CONFIG } from "@/features/pedigree-editor/context/CanvasConfigContext";

interface ArrangeGroupProps {
  showLayoutMenu: boolean;
  setShowLayoutMenu: (v: boolean) => void;
  showLabelsMenu: boolean;
  setShowLabelsMenu: (v: boolean) => void;
  liveLayout: boolean;
  setLiveLayout: React.Dispatch<React.SetStateAction<boolean>>;
  showAutoLabels: boolean;
  setShowAutoLabels: React.Dispatch<React.SetStateAction<boolean>>;
  runAutoLayout: (respectPinned: boolean, isManual?: boolean, selectedOnly?: boolean) => void;
  bakeEmptyLabels: () => void;
  bakeAllLabels: () => void;
  updateCanvas: (updater: (prev: CanvasData) => CanvasData) => void;
  canvasNodesLength: number;
  labelHidden?: boolean;
}

export function ArrangeGroup({
  showLayoutMenu, setShowLayoutMenu, showLabelsMenu, setShowLabelsMenu,
  liveLayout, setLiveLayout, showAutoLabels, setShowAutoLabels,
  runAutoLayout, bakeEmptyLabels, bakeAllLabels, updateCanvas, canvasNodesLength, labelHidden = false,
}: ArrangeGroupProps) {
  const { config, updateConfig } = useCanvasConfig();
  const { state } = usePedigreeEditor();
  const selectedCount = state.selectedIds.size;

  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        
        {/* Layout Popover */}
        <Popover open={showLayoutMenu} onOpenChange={setShowLayoutMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="button-layout"
              title="Auto-arrange nodes"
              aria-label="Auto-arrange nodes"
              className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${
                showLayoutMenu ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-0.5">
                <LayoutGrid className="w-5 h-5" />
                <ChevronDown className="w-2.5 h-2.5" />
              </div>
              <span className="text-[11px] leading-tight font-medium">Layout</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={4}
            className="w-80 p-0 bg-popover border border-border shadow-xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest font-semibold">
              Auto Layout
            </div>

            {/* Mode Section */}
            <div className="border-b border-border">
              <button
                type="button"
                onClick={() => {
                  setLiveLayout((v) => !v);
                  if (!liveLayout) runAutoLayout(true, true);
                }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
              >
                <div>
                  <div className="text-xs font-semibold text-foreground">Live Layout</div>
                  <div className="text-[11px] text-muted-foreground">Auto-arrange as you add connections</div>
                </div>
                <div
                  className={`w-9 h-5 rounded-full border transition-all relative flex-shrink-0 ${
                    liveLayout ? "border-primary bg-primary" : "border-border bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-[1px] left-[1px] w-4 h-4 rounded-full shadow-sm transition-transform bg-card ${
                      liveLayout ? "translate-x-[16px]" : "translate-x-0"
                    }`}
                  />
                </div>
              </button>
            </div>

            {/* Gaps & Spacing Section */}
            <div className="p-4 border-b border-border space-y-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Gaps & Spacing
              </div>

              {/* Sibling Gap (H) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-foreground font-medium">Sibling Gap (H)</span>
                    {config.nodeGap !== DEFAULT_CANVAS_CONFIG.nodeGap && (
                      <button
                        type="button"
                        onClick={() => updateConfig({ nodeGap: DEFAULT_CANVAS_CONFIG.nodeGap })}
                        className="text-[9px] text-primary hover:bg-primary/10 px-1 rounded transition-colors"
                        title={`Reset to ${DEFAULT_CANVAS_CONFIG.nodeGap}px`}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <span className="font-mono text-muted-foreground text-[11px] tabular-nums">{config.nodeGap}px</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={150}
                  step={5}
                  value={config.nodeGap}
                  onChange={(e) => updateConfig({ nodeGap: Number(e.target.value) })}
                  className="w-full cursor-pointer h-1 bg-secondary rounded-lg appearance-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              {/* Gen Gap (V) */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-foreground font-medium">Gen Gap (V)</span>
                    {config.genGrid !== DEFAULT_CANVAS_CONFIG.genGrid && (
                      <button
                        type="button"
                        onClick={() => updateConfig({ genGrid: DEFAULT_CANVAS_CONFIG.genGrid })}
                        className="text-[9px] text-primary hover:bg-primary/10 px-1 rounded transition-colors"
                        title={`Reset to ${DEFAULT_CANVAS_CONFIG.genGrid}px`}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <span className="font-mono text-muted-foreground text-[11px] tabular-nums">{config.genGrid}px</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={200}
                  step={10}
                  value={config.genGrid}
                  onChange={(e) => updateConfig({ genGrid: Number(e.target.value) })}
                  className="w-full cursor-pointer h-1 bg-secondary rounded-lg appearance-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              {/* Auto-Fit Toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => updateConfig({ autoFitLayout: !config.autoFitLayout })}
                  className="w-full flex items-center justify-between text-left hover:bg-transparent"
                >
                  <div>
                    <div className="text-xs font-semibold text-foreground">Auto-Fit Viewport</div>
                    <div className="text-[11px] text-muted-foreground">Center & zoom layout in screen</div>
                  </div>
                  <div
                    className={`w-9 h-5 rounded-full border transition-all relative flex-shrink-0 ${
                      config.autoFitLayout ? "border-primary bg-primary" : "border-border bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-[1px] left-[1px] w-4 h-4 rounded-full shadow-sm transition-transform bg-card ${
                        config.autoFitLayout ? "translate-x-[16px]" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Commands Section */}
            <div className="flex flex-col pb-2">
              <div className="px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Commands
              </div>

              {/* Arrange Selected */}
              <button
                type="button"
                onClick={() => {
                  runAutoLayout(true, true, true);
                  setShowLayoutMenu(false);
                }}
                disabled={selectedCount === 0}
                className="w-full flex items-start gap-3 px-4 py-2 hover:bg-accent transition-colors text-left disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <LayoutGrid className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <div className="text-xs font-semibold text-foreground">Arrange Selected</div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedCount > 0
                      ? `Rearrange the ${selectedCount} selected node(s)`
                      : "Select nodes to arrange only that branch"}
                  </div>
                </div>
              </button>

              {/* Arrange Unpinned */}
              <button
                type="button"
                onClick={() => {
                  runAutoLayout(true, true);
                  setShowLayoutMenu(false);
                }}
                className="w-full flex items-start gap-3 px-4 py-2 hover:bg-accent transition-colors text-left border-t border-border/50"
              >
                <LayoutGrid className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Arrange unpinned <span className="text-muted-foreground font-normal">(L)</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">Arrange unpinned nodes; pinned stay</div>
                </div>
              </button>

              {/* Force Rearrange All */}
              <button
                type="button"
                onClick={() => {
                  runAutoLayout(false, true);
                  setShowLayoutMenu(false);
                }}
                className="w-full flex items-start gap-3 px-4 py-2 hover:bg-accent transition-colors text-left border-t border-border/50"
              >
                <LayoutGrid className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <div>
                  <div className="text-xs font-semibold text-foreground">Force layout all</div>
                  <div className="text-[11px] text-muted-foreground">Ignore pinning — rearrange everything</div>
                </div>
              </button>

              {/* Unlock & Unpin All */}
              <button
                type="button"
                onClick={() => {
                  updateCanvas((prev) => ({ ...prev, nodes: prev.nodes.map((n) => ({ ...n, pinned: false })) }));
                  setShowLayoutMenu(false);
                }}
                className="w-full flex items-start gap-3 px-4 py-2 hover:bg-accent transition-colors text-left border-t border-border/50"
              >
                <PinOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs font-semibold text-foreground">Unpin all</div>
                  <div className="text-[11px] text-muted-foreground">Remove all manual pin locks</div>
                </div>
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Labels Popover */}
        <Popover open={showLabelsMenu} onOpenChange={setShowLabelsMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="button-labels"
              title="Generation labels"
              aria-label="Generation labels"
              className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${
                showLabelsMenu || showAutoLabels ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-0.5">
                <Hash className="w-5 h-5" />
                <ChevronDown className="w-2.5 h-2.5" />
              </div>
              <span className="text-[11px] leading-tight font-medium">Labels</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={4}
            className="min-w-[220px] p-0 bg-popover border border-border shadow-xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
              Generation Labels
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAutoLabels((v) => !v);
                setShowLabelsMenu(false);
              }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
            >
              <div>
                <div className="text-xs font-medium text-foreground">{showAutoLabels ? "Hide labels" : "Show labels"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {showAutoLabels ? "Turn off overlay" : "Show I:1, II:3 … above each node"}
                </div>
              </div>
              <div
                className={`w-9 h-5 rounded-full border transition-all relative flex-shrink-0 ${
                  showAutoLabels ? "border-primary bg-primary" : "border-border bg-muted"
                }`}
              >
                <span
                  className={`absolute top-[1px] left-[1px] w-4 h-4 rounded-full shadow-sm transition-transform bg-card ${
                    showAutoLabels ? "translate-x-[16px]" : "translate-x-0"
                  }`}
                />
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                updateCanvas((prev) => {
                  const anyVisible = prev.annotations.some((a) => !a.hidden);
                  return { ...prev, annotations: prev.annotations.map((a) => ({ ...a, hidden: anyVisible })) };
                });
                setShowLabelsMenu(false);
              }}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border"
            >
              <Eye className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                <div className="text-xs font-medium text-foreground">Toggle all annotations</div>
                <div className="text-xs text-muted-foreground mt-0.5">Hide or show every annotation</div>
              </div>
            </button>
            <button
              type="button"
              onClick={bakeEmptyLabels}
              disabled={canvasNodesLength === 0}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border disabled:opacity-40"
            >
              <Hash className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                <div className="text-xs font-medium text-foreground">Fill unlabeled nodes</div>
                <div className="text-xs text-muted-foreground mt-0.5">Write I:1, II:3 … into nodes without a name</div>
              </div>
            </button>
            <button
              type="button"
              onClick={bakeAllLabels}
              disabled={canvasNodesLength === 0}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border disabled:opacity-40"
            >
              <Hash className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div>
                <div className="text-xs font-medium text-foreground">Apply to all nodes</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Overwrite every label with generated identifier
                </div>
              </div>
            </button>
          </PopoverContent>
        </Popover>

      </div>
      {!labelHidden && (
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">
          Arrange
        </div>
      )}
    </div>
  );
}

