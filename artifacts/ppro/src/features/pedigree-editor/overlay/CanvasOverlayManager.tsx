import { useRef } from "react";
import { Minimap } from "@/features/pedigree-editor/overlay/Minimap";
import { LegendPanel } from "@/features/pedigree-editor/overlay/LegendPanel";
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
  anySelected,
  showRiskPanel,
  showValidation,
  showVersions,
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
  onMinimapPan: (cx: number, cy: number) => void;
  showLegend: boolean;
  legendEntries: Array<{ key: string; label: string }>;
  singleSelected: boolean;
  anySelected: boolean;
  showRiskPanel: boolean;
  showValidation: boolean;
  showVersions: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapVisible = showMinimap && nodeCount > 0;
  const propertiesPanelOpen = anySelected && !showRiskPanel && !showValidation && !showVersions;
  const panelOpen = propertiesPanelOpen || showRiskPanel || showValidation;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      {/* Stacked overlay container: legend above minimap on the right side */}
      {(minimapVisible || showLegend) && (
        <div className={`absolute bottom-4 flex flex-col-reverse gap-2 pointer-events-auto transition-all duration-300 ${panelOpen ? "right-[296px]" : "right-4"}`}>
          {minimapVisible && (
            <Minimap
              shifted={panelOpen}
              containerClassName="!relative !bottom-0 !right-0"
              nodes={minimapNodes}
              edges={minimapEdges}
              viewBox={viewBox}
              vbW={vbW}
              vbH={vbH}
              mmW={mmW}
              mmH={mmH}
              onPan={onMinimapPan}
            />
          )}
          {showLegend && (
            <LegendPanel
              entries={legendEntries}
              expanded={true}
              onToggle={() => {}}
              className="!relative !bottom-0 !right-0 !left-auto"
            />
          )}
        </div>
      )}
    </div>
  );
}
