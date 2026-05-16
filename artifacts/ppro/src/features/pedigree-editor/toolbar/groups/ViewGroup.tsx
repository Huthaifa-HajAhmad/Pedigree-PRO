import { ZoomIn, ZoomOut, Maximize2, Pin, LayoutGrid, Map as MapIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

interface ViewGroupProps {
  viewBox: { x: number; y: number; zoom: number };
  setViewBox: Dispatch<SetStateAction<{ x: number; y: number; zoom: number }>>;
  snapEnabled: boolean;
  setSnapEnabled: Dispatch<SetStateAction<boolean>>;
  showGrid: boolean;
  setShowGrid: Dispatch<SetStateAction<boolean>>;
  showMinimap: boolean;
  setShowMinimap: Dispatch<SetStateAction<boolean>>;
  fitToScreen: () => void;
  W: number;
  H: number;
  canvasNodesLength: number;
  labelHidden?: boolean;
}

export function ViewGroup({ viewBox, setViewBox, snapEnabled, setSnapEnabled, showGrid, setShowGrid, showMinimap, setShowMinimap, fitToScreen, W, H, canvasNodesLength, labelHidden = false }: ViewGroupProps) {
  const zoomIn = () => setViewBox((v) => { const nz = Math.max(0.25, v.zoom * 0.82); const cx = v.x + W * v.zoom / 2; const cy = v.y + H * v.zoom / 2; return { x: cx - W * nz / 2, y: cy - H * nz / 2, zoom: nz }; });
  const zoomOut = () => setViewBox((v) => { const nz = Math.min(4, v.zoom * 1.22); const cx = v.x + W * v.zoom / 2; const cy = v.y + H * v.zoom / 2; return { x: cx - W * nz / 2, y: cy - H * nz / 2, zoom: nz }; });

  return (
    <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex items-center gap-0.5">
        <button type="button" data-testid="button-zoom-in" title="Zoom in (Numpad+)" aria-label="Zoom in"
          onClick={zoomIn}
          className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <ZoomIn className="w-4 h-4" />
          <span className="text-xs leading-none">In</span>
        </button>
        <button type="button" data-testid="button-fit" onClick={fitToScreen} disabled={canvasNodesLength === 0} title="Fit all (Numpad0)" aria-label="Fit all"
          className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Maximize2 className="w-4 h-4" />
          <span className="text-xs leading-none">Fit</span>
        </button>
        <button type="button" data-testid="button-zoom-out" title="Zoom out (Numpad-)" aria-label="Zoom out"
          onClick={zoomOut}
          className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <ZoomOut className="w-4 h-4" />
          <span className="text-xs leading-none">Out</span>
        </button>
        <div className="w-px self-stretch bg-border mx-0.5 my-1" />
        <button type="button" data-testid="button-snap" onClick={() => setSnapEnabled((s) => !s)} title="Toggle generation row snapping" aria-label="Toggle generation row snapping"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${snapEnabled ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <Pin className="w-4 h-4" />
          <span className="text-xs leading-none">Snap</span>
        </button>
        <button type="button" data-testid="button-grid" onClick={() => setShowGrid((g) => !g)} title="Toggle background grid" aria-label="Toggle background grid"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${showGrid ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <LayoutGrid className="w-4 h-4" />
          <span className="text-xs leading-none">Grid</span>
        </button>
        <button type="button" data-testid="button-minimap" onClick={() => setShowMinimap((m) => !m)} title="Toggle minimap" aria-label="Toggle minimap"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${showMinimap ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <MapIcon className="w-4 h-4" />
          <span className="text-xs leading-none">Map</span>
        </button>
      </div>
      {!labelHidden && <div className="text-xs text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">View</div>}
    </div>
  );
}
