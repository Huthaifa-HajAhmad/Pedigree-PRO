import { useEffect, useRef, useCallback, useState } from "react";
import { LayoutGrid, ChevronDown, Hash, PinOff } from "lucide-react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";

interface ArrangeGroupProps {
  showLayoutMenu: boolean;
  setShowLayoutMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showLabelsMenu: boolean;
  setShowLabelsMenu: React.Dispatch<React.SetStateAction<boolean>>;
  liveLayout: boolean;
  setLiveLayout: React.Dispatch<React.SetStateAction<boolean>>;
  showAutoLabels: boolean;
  setShowAutoLabels: React.Dispatch<React.SetStateAction<boolean>>;
  runAutoLayout: (respectPinned: boolean) => void;
  bakeEmptyLabels: () => void;
  bakeAllLabels: () => void;
  updateCanvas: (updater: (prev: CanvasData) => CanvasData) => void;
  canvasNodesLength: number;
  labelHidden?: boolean;
}

function useDropdownPosition(ref: React.RefObject<HTMLButtonElement | null>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, [ref]);
  return { pos, measure };
}

export function ArrangeGroup({
  showLayoutMenu, setShowLayoutMenu, showLabelsMenu, setShowLabelsMenu,
  liveLayout, setLiveLayout, showAutoLabels, setShowAutoLabels,
  runAutoLayout, bakeEmptyLabels, bakeAllLabels, updateCanvas, canvasNodesLength, labelHidden = false,
}: ArrangeGroupProps) {
  const layoutRef = useRef<HTMLButtonElement>(null);
  const labelsRef = useRef<HTMLButtonElement>(null);
  const { pos: layoutPos, measure: measureLayout } = useDropdownPosition(layoutRef);
  const { pos: labelsPos, measure: measureLabels } = useDropdownPosition(labelsRef);

  useEffect(() => {
    if (!showLayoutMenu) return;
    measureLayout();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowLayoutMenu(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showLayoutMenu, measureLayout, setShowLayoutMenu]);

  useEffect(() => {
    if (!showLabelsMenu) return;
    measureLabels();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowLabelsMenu(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showLabelsMenu, measureLabels, setShowLabelsMenu]);

  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button ref={layoutRef} type="button" data-testid="button-layout" onClick={() => setShowLayoutMenu((v) => !v)} title="Auto-arrange nodes" aria-label="Auto-arrange nodes"
          aria-expanded={showLayoutMenu}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${showLayoutMenu ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <div className="flex items-center gap-0.5"><LayoutGrid className="w-5 h-5" /><ChevronDown className="w-2.5 h-2.5" /></div>
          <span className="text-[11px] leading-tight font-medium">Layout</span>
        </button>
        <button ref={labelsRef} type="button" data-testid="button-labels" onClick={() => { setShowLabelsMenu((v) => !v); setShowLayoutMenu(false); }} title="Generation labels" aria-label="Generation labels"
          aria-expanded={showLabelsMenu}
          aria-pressed={showAutoLabels}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${showLabelsMenu || showAutoLabels ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <div className="flex items-center gap-0.5"><Hash className="w-5 h-5" /><ChevronDown className="w-2.5 h-2.5" /></div>
          <span className="text-[11px] leading-tight font-medium">Labels</span>
        </button>

        {showLayoutMenu && layoutPos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowLayoutMenu(false)} />
            <div className="fixed z-50 w-56 border border-border rounded-lg shadow-xl overflow-hidden bg-popover" style={{ top: layoutPos.top, left: layoutPos.left }}>
              <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">Auto Layout</div>
              <button type="button" onClick={() => { setLiveLayout((v) => !v); if (!liveLayout) runAutoLayout(true); }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 transition-colors text-left ${liveLayout ? "bg-primary/10" : "hover:bg-accent"}`}>
                <div className={`w-4 h-4 mt-0.5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${liveLayout ? "border-primary bg-primary/30" : "border-muted-foreground"}`}>
                  {liveLayout && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
                <div>
                  <div className={`text-xs font-medium ${liveLayout ? "text-primary" : ""}`}>Live Layout {liveLayout ? "ON" : "OFF"}</div>
                  <div className="text-xs text-muted-foreground">Auto-arrange as you add connections</div>
                </div>
              </button>
              <button type="button" onClick={() => { runAutoLayout(true); setShowLayoutMenu(false); }}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border">
                <LayoutGrid className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <div className="text-xs font-medium">Auto-arrange <span className="text-muted-foreground font-normal">(L)</span></div>
                  <div className="text-xs text-muted-foreground">Arrange unpinned nodes; pinned stay</div>
                </div>
              </button>
              <button type="button" onClick={() => { runAutoLayout(false); setShowLayoutMenu(false); }}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border">
                <LayoutGrid className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-400" />
                <div>
                  <div className="text-xs font-medium">Force layout all</div>
                  <div className="text-xs text-muted-foreground">Ignore pinning — rearrange everything</div>
                </div>
              </button>
              <button type="button" onClick={() => { updateCanvas((prev) => ({ ...prev, nodes: prev.nodes.map((n) => ({ ...n, pinned: false })) })); setShowLayoutMenu(false); }}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border">
                <PinOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs font-medium">Unpin all</div>
                  <div className="text-xs text-muted-foreground">Remove all manual pin locks</div>
                </div>
              </button>
            </div>
          </>
        )}

        {showLabelsMenu && labelsPos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowLabelsMenu(false)} />
            <div className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl min-w-[220px]" style={{ top: labelsPos.top, left: labelsPos.left }}>
              <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">Generation Labels</div>
              <button type="button" onClick={() => { setShowAutoLabels((v) => !v); setShowLabelsMenu(false); }}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left">
                <div>
                  <div className="text-xs font-medium text-foreground">{showAutoLabels ? "Hide labels" : "Show labels"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{showAutoLabels ? "Turn off overlay" : "Show I:1, II:3 … above each node"}</div>
                </div>
                <div className={`w-8 h-4 rounded-full flex-shrink-0 transition-colors ${showAutoLabels ? "bg-primary" : "bg-muted"}`}>
                  <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-all ${showAutoLabels ? "ml-4" : "ml-0.5"}`} />
                </div>
              </button>
              <button type="button" onClick={bakeEmptyLabels} disabled={canvasNodesLength === 0}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border disabled:opacity-40">
                <Hash className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <div className="text-xs font-medium text-foreground">Fill unlabeled nodes</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Write I:1, II:3 … into nodes without a name</div>
                </div>
              </button>
              <button type="button" onClick={bakeAllLabels} disabled={canvasNodesLength === 0}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border disabled:opacity-40">
                <Hash className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs font-medium text-foreground">Apply to all nodes</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Overwrite every label with generated identifier</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Arrange</div>}
    </div>
  );
}
