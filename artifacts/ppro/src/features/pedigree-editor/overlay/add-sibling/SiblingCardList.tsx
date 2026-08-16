import React from "react";
import { GripVertical, Trash2, Square, Circle, Diamond } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { SexSelect } from "./SexSelect";
import { TraitsSelect } from "./TraitsSelect";
import { SiblingEntry, renderMiniTraitIcon } from "./types";

export interface SiblingCardListProps {
  siblings: SiblingEntry[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  isDraggable: boolean;
  setIsDraggable: (val: boolean) => void;
  draggedIdx: number | null;
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  deleteSibling: (idx: number) => void;
  updateSibling: (idx: number, patch: Partial<SiblingEntry>) => void;
}

export function SiblingCardList({
  siblings,
  scrollRef,
  isDraggable,
  setIsDraggable,
  draggedIdx,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  deleteSibling,
  updateSibling,
}: SiblingCardListProps) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 lg:border-l lg:border-border/60">
      {siblings.map((sb, idx) => {
        const isSource = !!sb.isSource;
        const sibNum = siblings.filter((s, i) => !s.isSource && i <= idx).length;

        return (
          <div
            key={sb.id}
            draggable={isDraggable}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`border rounded-xl pl-4 pr-5 py-3.5 shadow-xs transition-all flex flex-col sm:grid sm:grid-cols-[auto_120px_120px_160px] gap-3 sm:items-center relative ${
              isSource
                ? "bg-primary/5 border-primary/30 dark:bg-primary/10 dark:border-primary/50 shadow-inner"
                : "border-border/80 bg-card hover:border-border"
            } ${draggedIdx === idx ? "opacity-40 bg-accent/20" : ""}`}
          >
            {/* Card Header (Badge & Remove Button) */}
            <div className="flex items-center gap-2 border-b sm:border-b-0 sm:border-r border-border/40 pb-2 sm:pb-0 sm:pr-3.5 shrink-0">
              <div
                className="p-1 text-muted-foreground/40 hover:text-muted-foreground/75 cursor-grab active:cursor-grabbing transition-colors shrink-0"
                onMouseEnter={() => setIsDraggable(true)}
                onMouseLeave={() => setIsDraggable(false)}
                title="Drag to reorder"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              {isSource ? (
                <div className="w-[28px] h-6 flex items-center justify-center shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() => deleteSibling(idx)}
                  className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  title="Remove sibling"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <span className={`text-xs font-bold whitespace-nowrap ${isSource ? "text-primary" : "text-foreground"}`}>
                {isSource ? "Current Node" : `Sibling #${sibNum}`}
              </span>
            </div>

            {/* Sex Option */}
            <div className="space-y-1 shrink-0 w-full sm:w-[120px]">
              <label className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest block whitespace-nowrap">Sex</label>
              {isSource ? (
                <div className="w-full h-8 flex items-center gap-2 px-2.5 rounded-lg border border-border bg-muted/30 text-[11px] font-medium text-muted-foreground/80 cursor-not-allowed">
                  {sb.type === "male" ? (
                    <Square className="w-3.5 h-3.5 text-sky-500/70 stroke-[2.5px]" />
                  ) : sb.type === "female" ? (
                    <Circle className="w-3.5 h-3.5 text-pink-500/70 stroke-[2.5px]" />
                  ) : (
                    <Diamond className="w-3.5 h-3.5 text-slate-500/70 stroke-[2.5px]" />
                  )}
                  <span className="capitalize">{sb.type}</span>
                </div>
              ) : (
                <SexSelect
                  value={sb.type}
                  onChange={(val) => updateSibling(idx, { type: val })}
                />
              )}
            </div>

            {/* DOB Picker */}
            <div className="space-y-1 shrink-0 w-full sm:w-[120px]">
              <label className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest block whitespace-nowrap">Date of Birth</label>
              {isSource ? (
                <div className="w-full h-8 flex items-center px-2.5 rounded-lg border border-border bg-muted/30 text-[11px] font-medium text-muted-foreground/80 cursor-not-allowed">
                  {sb.dob ? sb.dob : <span className="italic text-muted-foreground/40">Not specified</span>}
                </div>
              ) : (
                <DatePicker
                  value={sb.dob}
                  onChange={(val) => updateSibling(idx, { dob: val })}
                  maxDate={new Date()}
                  placeholder="Select date..."
                  className="h-8 w-full text-[11px] px-2.5 border-border rounded-lg bg-background hover:bg-accent/50 shadow-none font-medium"
                />
              )}
            </div>

            {/* Traits checkboxes */}
            <div className="space-y-1 shrink-0 w-full sm:w-[160px]">
              <label className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest block whitespace-nowrap">Traits</label>
              {isSource ? (
                <div className="w-full h-8 flex items-center gap-1.5 px-2.5 rounded-lg border border-border bg-muted/30 text-[11px] font-medium text-muted-foreground/80 cursor-not-allowed overflow-x-auto">
                  {(() => {
                    const active = [
                      sb.affected && { label: "Affected", key: "affected" },
                      sb.carrier && { label: "Carrier", key: "carrier" },
                      sb.deceased && { label: "Deceased", key: "deceased" },
                      sb.proband && { label: "Proband", key: "proband" },
                    ].filter((t): t is { label: string; key: string } => !!t);
                    if (active.length === 0) return <span className="italic text-muted-foreground/40">Normal</span>;
                    return (
                      <div className="flex items-center gap-1">
                        {active.map((t) => (
                          <span key={t.key} className="inline-flex items-center gap-1 bg-primary/5 text-primary/70 border border-primary/10 px-1 py-0.5 rounded text-[9px] font-bold">
                            {renderMiniTraitIcon(sb.type, t.key as any, 10)}
                            <span>{t.label}</span>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <TraitsSelect
                  sibling={sb}
                  onChange={(patch) => updateSibling(idx, patch)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
