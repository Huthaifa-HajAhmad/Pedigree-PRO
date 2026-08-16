import React, { useState } from "react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { getQuadrantsForStyle } from "@/features/pedigree-editor/utils/helpers";

export function NodeQuadrantShadingSection({
  singleSelected,
  onUpdateSelectedNode,
}: {
  singleSelected: PedigreeNode;
  onUpdateSelectedNode: (updates: Partial<PedigreeNode>) => void;
}) {
  const [selectedQuad, setSelectedQuad] = useState<"q1" | "q2" | "q3" | "q4">("q1");

  const currentStyle = singleSelected.shading || "";
  const [q1, q2, q3, q4] = getQuadrantsForStyle(currentStyle);

  const updateQuadrant = (quad: "q1" | "q2" | "q3" | "q4", checked: boolean) => {
    const active: string[] = [];
    if (quad === "q1" ? checked : q1) active.push("q1");
    if (quad === "q2" ? checked : q2) active.push("q2");
    if (quad === "q3" ? checked : q3) active.push("q3");
    if (quad === "q4" ? checked : q4) active.push("q4");

    let nextShading: string | undefined = active.join(",");
    if (active.length === 0) nextShading = undefined;
    else if (active.length === 4) nextShading = "solid";

    onUpdateSelectedNode({
      shading: nextShading,
      affected: active.length > 0,
    });
  };

  const quads = [
    { id: "q1" as const, label: "Q1 (Top-Right)", active: q1, colorField: "colorQ1" as const },
    { id: "q2" as const, label: "Q2 (Top-Left)", active: q2, colorField: "colorQ2" as const },
    { id: "q3" as const, label: "Q3 (Bottom-Left)", active: q3, colorField: "colorQ3" as const },
    { id: "q4" as const, label: "Q4 (Bottom-Right)", active: q4, colorField: "colorQ4" as const },
  ];

  const activeQ = quads.find((q) => q.id === selectedQuad)!;
  const activeColor = (singleSelected[activeQ.colorField] as string) || singleSelected.color || "#000000";

  return (
    <div className="space-y-3 border-t border-border pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-3 bg-muted/15 p-2 rounded-lg border border-border/40">
        {/* 2x2 Grid Representation */}
        <div className="flex-shrink-0 grid grid-cols-2 gap-1 w-14 h-14 bg-card p-1 rounded-md border border-border/80 relative">
          {/* Q2 (Top-Left) */}
          <button
            type="button"
            onClick={() => setSelectedQuad("q2")}
            className={`w-5 h-5 rounded-tl-sm border transition-all ${
              selectedQuad === "q2" ? "ring-2 ring-primary ring-offset-1 z-10 scale-105" : "border-border/45"
            }`}
            style={{
              backgroundColor: q2 ? (singleSelected.colorQ2 || singleSelected.color || "hsl(var(--primary))") : "transparent",
            }}
            title="Q2 (Top-Left) — Click to select"
          />
          {/* Q1 (Top-Right) */}
          <button
            type="button"
            onClick={() => setSelectedQuad("q1")}
            className={`w-5 h-5 rounded-tr-sm border transition-all ${
              selectedQuad === "q1" ? "ring-2 ring-primary ring-offset-1 z-10 scale-105" : "border-border/45"
            }`}
            style={{
              backgroundColor: q1 ? (singleSelected.colorQ1 || singleSelected.color || "hsl(var(--primary))") : "transparent",
            }}
            title="Q1 (Top-Right) — Click to select"
          />
          {/* Q3 (Bottom-Left) */}
          <button
            type="button"
            onClick={() => setSelectedQuad("q3")}
            className={`w-5 h-5 rounded-bl-sm border transition-all ${
              selectedQuad === "q3" ? "ring-2 ring-primary ring-offset-1 z-10 scale-105" : "border-border/45"
            }`}
            style={{
              backgroundColor: q3 ? (singleSelected.colorQ3 || singleSelected.color || "hsl(var(--primary))") : "transparent",
            }}
            title="Q3 (Bottom-Left) — Click to select"
          />
          {/* Q4 (Bottom-Right) */}
          <button
            type="button"
            onClick={() => setSelectedQuad("q4")}
            className={`w-5 h-5 rounded-br-sm border transition-all ${
              selectedQuad === "q4" ? "ring-2 ring-primary ring-offset-1 z-10 scale-105" : "border-border/45"
            }`}
            style={{
              backgroundColor: q4 ? (singleSelected.colorQ4 || singleSelected.color || "hsl(var(--primary))") : "transparent",
            }}
            title="Q4 (Bottom-Right) — Click to select"
          />
        </div>

        {/* Selected Quadrant Status Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
            Selected Segment
          </span>
          <span className="text-xs font-bold text-foreground truncate">
            {activeQ.label}
          </span>
          <label className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              checked={activeQ.active}
              onChange={(e) => updateQuadrant(activeQ.id, e.target.checked)}
              className="rounded w-3 h-3 border-border/80 text-primary focus:ring-primary/40 focus:ring-offset-0 focus:ring-1"
            />
            <span>Shade this quadrant</span>
          </label>
        </div>
      </div>

      {/* Color selection row for the selected quadrant */}
      {activeQ.active && (
        <div className="space-y-1.5 bg-card/10 border border-border/30 p-2 rounded-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Shading Color
            </span>
            {singleSelected[activeQ.colorField] && (
              <button
                type="button"
                onClick={() => onUpdateSelectedNode({ [activeQ.colorField]: undefined })}
                className="text-[9px] text-primary hover:text-primary-foreground hover:bg-primary/20 px-1 rounded transition-colors"
                title="Reset to default shading color"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {["#ffb3b3", "#ffd9b3", "#ffffb3", "#c1f0c1", "#b3d9ff", "#d9b3ff", "#ffb3d9", "#e2e8f0"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdateSelectedNode({ [activeQ.colorField]: c })}
                className="w-4 h-4 rounded-full border border-border/30 transition-transform hover:scale-110 flex-shrink-0"
                style={{
                  background: c,
                  outline: singleSelected[activeQ.colorField] === c ? "2px solid hsl(var(--primary))" : "none",
                  outlineOffset: 1,
                }}
                title={c}
              />
            ))}
            <label
              className="relative w-4 h-4 rounded-full overflow-hidden flex-shrink-0 transition-transform hover:scale-110 cursor-pointer border border-border/30"
              style={{
                background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                outline: (singleSelected[activeQ.colorField] && !["#ffb3b3", "#ffd9b3", "#ffffb3", "#c1f0c1", "#b3d9ff", "#d9b3ff", "#ffb3d9", "#e2e8f0"].includes(singleSelected[activeQ.colorField] as string)) ? "2px solid hsl(var(--primary))" : "none",
                outlineOffset: 1,
              }}
              title="Custom quadrant color"
            >
              <input
                type="color"
                value={activeColor}
                onChange={(e) => onUpdateSelectedNode({ [activeQ.colorField]: e.target.value })}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label={`Custom color for ${activeQ.label}`}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
