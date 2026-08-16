import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { Users, Square, Circle, Diamond, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { SiblingEntry, makeSibling, sexSummary, traitsSummary } from "./add-sibling/types";
import { SiblingPreviewSVG } from "./add-sibling/SiblingPreviewSVG";
import { SiblingCardList } from "./add-sibling/SiblingCardList";
import { SiblingTableView } from "./add-sibling/SiblingTableView";

export interface AddSiblingDialogProps {
  sourceNode: PedigreeNode;
  onConfirm: (siblings: SiblingEntry[]) => void;
  onCancel: () => void;
  autoLabel?: string;
}

export function AddSiblingDialog({ sourceNode, onConfirm, onCancel, autoLabel }: AddSiblingDialogProps) {
  const sameAsSource = (sourceNode.type === "sab" || sourceNode.type === "pregnancy") ? "unknown" : sourceNode.type;
  const displayName = sourceNode.label || autoLabel || sourceNode.notes?.slice(0, 20) || sourceNode.type;

  const parseDobTime = (dob?: string): number => {
    if (!dob) return Infinity;
    const t = new Date(dob).getTime();
    return isNaN(t) ? Infinity : t;
  };

  const [siblings, setSiblings] = useState<SiblingEntry[]>(() => {
    const sourceEntry: SiblingEntry = {
      id: sourceNode.id,
      type: sourceNode.type === "sab" || sourceNode.type === "pregnancy" ? "unknown" : sourceNode.type,
      dob: sourceNode.dob || "",
      affected: !!sourceNode.affected,
      carrier: !!sourceNode.carrier,
      deceased: !!sourceNode.deceased,
      proband: !!sourceNode.proband,
      condition: sourceNode.condition || "",
      isSource: true,
    };
    const firstNew = makeSibling(sameAsSource);
    const initial = [sourceEntry, firstNew];
    return [...initial].sort((a, b) => parseDobTime(a.dob) - parseDobTime(b.dob));
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const [isDraggable, setIsDraggable] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [hasManuallyReordered, setHasManuallyReordered] = useState(false);

  const handleAddSibling = useCallback((types: Array<PedigreeNode["type"]>) => {
    setSiblings((prev) => {
      const newSibs = types.map(makeSibling);
      const next = [...prev, ...newSibs];
      if (!hasManuallyReordered) {
        return [...next].sort((a, b) => parseDobTime(a.dob) - parseDobTime(b.dob));
      }
      return next;
    });
  }, [hasManuallyReordered]);

  const updateSibling = useCallback((idx: number, patch: Partial<SiblingEntry>) => {
    setSiblings((prev) => {
      const updated = prev.map((s, i) => i === idx ? { ...s, ...patch } : s);
      if (!hasManuallyReordered && patch.dob !== undefined) {
        return [...updated].sort((a, b) => parseDobTime(a.dob) - parseDobTime(b.dob));
      }
      return updated;
    });
  }, [hasManuallyReordered]);

  const deleteSibling = useCallback((idx: number) => {
    setSiblings((prev) => prev.filter((s, i) => i !== idx && !s.isSource));
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const items = [...siblings];
    const draggedItem = items[draggedIdx]!;
    items.splice(draggedIdx, 1);
    items.splice(index, 0, draggedItem);
    setSiblings(items);
    setDraggedIdx(null);
    setHasManuallyReordered(true);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setIsDraggable(false);
  };

  const newSiblings = siblings.filter((s) => !s.isSource);
  const count = newSiblings.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT") {
        e.preventDefault();
        onConfirm(siblings);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [siblings.length]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent
        className="border border-slate-200 dark:border-slate-800 max-w-5xl p-0 overflow-hidden bg-background/95 backdrop-blur-lg shadow-2xl flex flex-col lg:flex-row h-[90vh] lg:h-[550px] max-h-[90vh]"
        onKeyDown={handleKeyDown}
      >
        {/* Left Column: Sidebar & SVG Preview */}
        <div className="w-full lg:w-[320px] bg-slate-50/50 dark:bg-slate-950/40 p-5 flex flex-col justify-between border-b lg:border-b-0 border-slate-200 dark:border-slate-800/60 shrink-0 overflow-y-auto">
          <div className="space-y-5">
            <div>
              <h3 className="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Pedigree Structure
              </h3>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Add Siblings
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground mt-1.5 leading-normal">
                Adding to <span className="font-semibold text-foreground">{displayName}</span>. Siblings will share parents.
              </DialogDescription>
            </div>

            {/* Sibling Live SVG Preview Card */}
            <SiblingPreviewSVG siblings={siblings} displayName={displayName} />

            {/* Dynamic Sibling Details List */}
            {newSiblings.length > 0 && (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pl-4 pr-6 py-3.5 bg-muted/10 border border-border/40 p-2.5 rounded-lg shadow-inner">
                <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest block mb-1">Staged Siblings</span>
                <div className="space-y-1">
                  {newSiblings.map((sb, idx) => {
                    const sexLabel = sb.type === "male" ? "Male" : sb.type === "female" ? "Female" : "Unknown";
                    const traits = [
                      sb.affected && "Affected",
                      sb.carrier && "Carrier",
                      sb.deceased && "Deceased",
                      sb.proband && "Proband",
                    ].filter(Boolean);
                    return (
                      <div key={sb.id} className="flex items-center justify-between text-[11px] py-1 border-b border-border/20 last:border-0 leading-tight">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold">
                          <span className="w-3.5 h-3.5 rounded bg-muted flex items-center justify-center text-[9px] font-mono font-bold text-muted-foreground">#{idx + 1}</span>
                          <span>{sexLabel}</span>
                        </div>
                        <div className="text-right">
                          {traits.length > 0 ? (
                            <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1 rounded">
                              {traits.join(", ")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 italic text-[9px]">Normal</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 mt-4 shrink-0">
            <Info className="w-3.5 h-3.5" />
            <span>Updates apply to live canvas</span>
          </div>
        </div>

        {/* Right Column: Sibling-first controls */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          {/* Preset Actions Header */}
          <div className="px-5 py-4 border-b border-border/60 bg-muted/10 lg:border-l lg:border-border/60">
            <h4 className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Quick Add Sibling</h4>
            <div className="inline-flex items-center rounded-lg border border-border bg-background overflow-hidden shadow-xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAddSibling(["male"])}
                className="flex items-center gap-1.5 text-xs font-semibold h-9 px-4 hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 transition-all duration-200 active:scale-95 rounded-none border-0"
              >
                <Square className="w-3.5 h-3.5 text-sky-500" />
                <span>Brother</span>
              </Button>
              <div className="w-px h-4 bg-border/80 shrink-0" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAddSibling(["female"])}
                className="flex items-center gap-1.5 text-xs font-semibold h-9 px-4 hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400 transition-all duration-200 active:scale-95 rounded-none border-0"
              >
                <Circle className="w-3.5 h-3.5 text-pink-500" />
                <span>Sister</span>
              </Button>
              <div className="w-px h-4 bg-border/80 shrink-0" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAddSibling(["unknown"])}
                className="flex items-center gap-1.5 text-xs font-semibold h-9 px-4 hover:bg-slate-500/10 hover:text-slate-600 dark:hover:text-slate-400 transition-all duration-200 active:scale-95 rounded-none border-0"
              >
                <Diamond className="w-3.5 h-3.5 text-slate-500" />
                <span>Unknown</span>
              </Button>
              <div className="w-px h-4 bg-border/80 shrink-0" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAddSibling(["male", "female"])}
                className="flex items-center gap-1.5 text-xs font-semibold h-9 px-4 hover:bg-primary/10 hover:text-primary transition-all duration-200 active:scale-95 rounded-none border-0"
              >
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>Mixed Siblings</span>
              </Button>
            </div>
          </div>

          {/* Sibling Card List (for 1-3 Siblings) or Table View (4+) */}
          {count === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 lg:border-l lg:border-border/60">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h5 className="text-sm font-semibold">No Siblings Staged</h5>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                  Click one of the Quick Add actions above to stage siblings for insertion into the pedigree.
                </p>
              </div>
            </div>
          ) : siblings.length <= 3 ? (
            <SiblingCardList
              siblings={siblings}
              scrollRef={scrollRef}
              isDraggable={isDraggable}
              setIsDraggable={setIsDraggable}
              draggedIdx={draggedIdx}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              handleDragEnd={handleDragEnd}
              deleteSibling={deleteSibling}
              updateSibling={updateSibling}
            />
          ) : (
            <SiblingTableView
              siblings={siblings}
              scrollRef={scrollRef}
              isDraggable={isDraggable}
              setIsDraggable={setIsDraggable}
              draggedIdx={draggedIdx}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              handleDragEnd={handleDragEnd}
              deleteSibling={deleteSibling}
              updateSibling={updateSibling}
            />
          )}

          {/* Sibling Summary & Actions Footer */}
          <div className="lg:border-l lg:border-border/60">
            {count > 0 && (
              <div className="px-5 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-semibold shrink-0">
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                  <span className="tabular-nums font-bold text-foreground">{count}</span> staged sibling{count > 1 ? "s" : ""}
                  <span className="text-border mx-1.5">|</span>
                  <span className="font-bold text-foreground">{sexSummary(newSiblings)}</span>
                  {traitsSummary(newSiblings) && (
                    <>
                      <span className="text-border mx-1.5">|</span>
                      <span className="font-bold text-foreground">{traitsSummary(newSiblings)}</span>
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSiblings(siblings.filter((s) => s.isSource))}
                  className="h-7 px-2.5 text-[10px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md flex items-center gap-1.5 transition-all normal-case tracking-normal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </Button>
              </div>
            )}

            <DialogFooter className="px-5 py-4 border-t border-border/60 flex items-center justify-end gap-2 bg-muted/10 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onConfirm(siblings)}
                disabled={count === 0}
              >
                Add {count} Sibling{count > 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
