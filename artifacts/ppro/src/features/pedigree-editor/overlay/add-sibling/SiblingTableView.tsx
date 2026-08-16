import React from "react";
import { GripVertical, Trash2, Square, Circle, Diamond } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { SexSelect } from "./SexSelect";
import { TraitsSelect } from "./TraitsSelect";
import { SiblingEntry, renderMiniTraitIcon } from "./types";

export interface SiblingTableViewProps {
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

export function SiblingTableView({
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
}: SiblingTableViewProps) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-auto p-4 lg:border-l lg:border-border/60">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border/60 bg-muted/20 sticky top-0 z-10 text-left">
            <th className="w-14 px-2 py-2.5 text-center text-[9px] uppercase tracking-widest text-muted-foreground/75 font-bold">Order</th>
            <th className="w-10 px-2 py-2.5 text-center text-[9px] uppercase tracking-widest text-muted-foreground/75 font-bold">#</th>
            <th className="w-[140px] px-2 py-2.5 text-[9px] uppercase tracking-widest text-muted-foreground/75 font-bold">Sex</th>
            <th className="w-[150px] px-2 py-2.5 text-[9px] uppercase tracking-widest text-muted-foreground/75 font-bold">Date of Birth</th>
            <th className="w-[180px] px-2 py-2.5 text-[9px] uppercase tracking-widest text-muted-foreground/75 font-bold">Traits</th>
            <th className="w-10 px-2 py-2.5 text-center text-[9px] uppercase tracking-widest text-muted-foreground/75 font-bold"></th>
          </tr>
        </thead>
        <tbody>
          {siblings.map((sb, idx) => {
            const isSource = !!sb.isSource;
            const sibNum = siblings.filter((s, i) => !s.isSource && i <= idx).length;

            return (
              <tr
                key={sb.id}
                draggable={isDraggable}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`border-b border-border/30 transition-colors align-middle ${
                  isSource
                    ? "bg-primary/5 dark:bg-primary/10 hover:bg-primary/10"
                    : idx % 2 === 0
                    ? "bg-transparent"
                    : "bg-muted/5 hover:bg-accent/10"
                } ${draggedIdx === idx ? "opacity-40 bg-accent/20" : ""}`}
              >
                {/* Drag Handle */}
                <td className="px-2 py-2.5 text-center align-middle">
                  <div
                    className="inline-block p-1 text-muted-foreground/40 hover:text-muted-foreground/75 cursor-grab active:cursor-grabbing transition-colors shrink-0"
                    onMouseEnter={() => setIsDraggable(true)}
                    onMouseLeave={() => setIsDraggable(false)}
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                </td>

                {/* # */}
                <td className="px-2 py-2.5 text-center">
                  {isSource ? (
                    <span className="text-[10px] font-extrabold text-primary tracking-wide uppercase">
                      Current
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-muted-foreground/60 tabular-nums">
                      {sibNum}
                    </span>
                  )}
                </td>

                {/* Sex dropdown */}
                <td className="px-2 py-2.5 w-[140px]">
                  {isSource ? (
                    <div className="w-full max-w-[120px] h-8 flex items-center gap-2 px-2.5 rounded-lg border border-border bg-muted/30 text-[11px] font-medium text-muted-foreground/80 cursor-not-allowed">
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
                </td>

                {/* DOB Date Picker */}
                <td className="px-2 py-2.5 w-[150px]">
                  {isSource ? (
                    <div className="w-full max-w-[140px] h-8 flex items-center px-2.5 rounded-lg border border-border bg-muted/30 text-[11px] font-medium text-muted-foreground/80 cursor-not-allowed">
                      {sb.dob ? sb.dob : <span className="italic text-muted-foreground/40">Not specified</span>}
                    </div>
                  ) : (
                    <DatePicker
                      value={sb.dob}
                      onChange={(val) => updateSibling(idx, { dob: val })}
                      maxDate={new Date()}
                      placeholder="Select date..."
                      aria-label={`Sibling ${sibNum} date of birth`}
                      className="h-8 w-full max-w-[140px] text-[11px] px-2.5 border-border rounded-lg bg-background hover:bg-accent/50 shadow-none font-medium"
                    />
                  )}
                </td>

                {/* Traits dropdown */}
                <td className="px-2 py-2.5 w-[180px]">
                  {isSource ? (
                    <div className="w-full max-w-[160px] h-8 flex items-center gap-1.5 px-2.5 rounded-lg border border-border bg-muted/30 text-[11px] font-medium text-muted-foreground/80 cursor-not-allowed overflow-x-auto">
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
                </td>

                {/* Delete button */}
                <td className="px-2 py-2.5 text-center">
                  {isSource ? (
                    <div className="w-[28px] h-6 flex items-center justify-center shrink-0" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => deleteSibling(idx)}
                      className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove sibling"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
