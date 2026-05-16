import { useState, useCallback, useEffect, useRef } from "react";
import { Minimap } from "@/features/pedigree-editor/overlay/Minimap";
import { LegendPanel } from "@/features/pedigree-editor/overlay/LegendPanel";
import { KeyboardShortcutHint } from "@/features/pedigree-editor/overlay/KeyboardShortcutHint";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

export function CanvasOverlayManager({
  showMinimap,
  minimapNodes,
  minimapEdges,
  viewBox,
  vbW,
  vbH,
  mmW,
  mmH,
  nodeCount,
  onMinimapPan,
  showLegend,
  legendEntries,
  singleSelected,
}: {
  showMinimap: boolean;
  minimapNodes: PedigreeNode[];
  minimapEdges: PedigreeEdge[];
  viewBox: { x: number; y: number };
  vbW: number;
  vbH: number;
  mmW: number;
  mmH: number;
  nodeCount: number;
  onMinimapPan: (fx: number, fy: number) => void;
  showLegend: boolean;
  legendEntries: Array<{ key: string; label: string }>;
  singleSelected: boolean;
}) {
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    if (containerRef.current) {
      setNarrow(containerRef.current.clientWidth < 480);
    }
  }, []);

  useEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const minimapVisible = showMinimap
    && nodeCount > 0
    && !(narrow && legendExpanded);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      {minimapVisible && (
        <div className="pointer-events-auto">
          <Minimap
            nodes={minimapNodes}
            edges={minimapEdges}
            viewBox={viewBox}
            vbW={vbW}
            vbH={vbH}
            mmW={mmW}
            mmH={mmH}
            onPan={onMinimapPan}
          />
        </div>
      )}

      <KeyboardShortcutHint singleSelected={singleSelected} />

      {showLegend && (
        <div className="pointer-events-auto">
          <LegendPanel
            entries={legendEntries}
            expanded={legendExpanded}
            onToggle={setLegendExpanded}
          />
        </div>
      )}
    </div>
  );
}
