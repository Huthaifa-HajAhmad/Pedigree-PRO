import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { Minus, Plus, Square, Circle, Diamond, Baby, AlertTriangle } from "lucide-react";

interface SiblingEntry {
  type: PedigreeNode["type"];
  dob: string;
  annotation: string;
}

interface AddSiblingDialogProps {
  sourceNode: PedigreeNode;
  onConfirm: (siblings: SiblingEntry[]) => void;
  onCancel: () => void;
}

const GENDER_OPTIONS: Array<{ value: PedigreeNode["type"]; label: string; symbol: string }> = [
  { value: "male", label: "Male", symbol: "♂" },
  { value: "female", label: "Female", symbol: "♀" },
  { value: "unknown", label: "Unknown", symbol: "?" },
];

function TypeIcon({ type }: { type: PedigreeNode["type"] }) {
  const cls = "w-3.5 h-3.5";
  switch (type) {
    case "male": return <Square className={cls} />;
    case "female": return <Circle className={cls} />;
    case "unknown": return <Diamond className={cls} />;
    case "pregnancy": return <Baby className={cls} />;
    case "sab": return <AlertTriangle className={cls} />;
  }
}

function makeSibling(type: PedigreeNode["type"]): SiblingEntry {
  return { type, dob: "", annotation: "" };
}

export function AddSiblingDialog({ sourceNode, onConfirm, onCancel }: AddSiblingDialogProps) {
  const sameAsSource = (sourceNode.type === "sab" || sourceNode.type === "pregnancy") ? "unknown" : sourceNode.type;
  const [count, setCount] = useState(1);
  const [useSameGender, setUseSameGender] = useState(true);
  const [siblings, setSiblings] = useState<SiblingEntry[]>([makeSibling(sameAsSource)]);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateCount = useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(8, n));
    setCount(clamped);
    setSiblings((prev) => {
      if (prev.length < clamped) {
        const additions = Array.from({ length: clamped - prev.length }, () => makeSibling(useSameGender ? sameAsSource : "unknown"));
        return [...prev, ...additions];
      }
      return prev.slice(0, clamped);
    });
  }, [useSameGender, sameAsSource]);

  const updateSibling = useCallback((idx: number, patch: Partial<SiblingEntry>) => {
    setSiblings((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }, []);

  const handleSameGenderToggle = useCallback(() => {
    setUseSameGender((prev) => {
      const next = !prev;
      if (next) setSiblings((sbs) => sbs.map(() => makeSibling(sameAsSource)));
      else setSiblings((sbs) => sbs.map((s) => ({ ...s, type: "unknown" as const })));
      return next;
    });
  }, [sameAsSource]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm(siblings);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      const last = containerRef.current.lastElementChild;
      if (last) last.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [siblings.length]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0" onKeyDown={handleKeyDown}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <TypeIcon type={sourceNode.type} />
            Add Siblings to {sourceNode.label || sourceNode.type}
          </DialogTitle>
          <DialogDescription>
            Configure siblings below — they will share the same parents as the source node.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Stepper */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Number</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateCount(count - 1)}
                disabled={count <= 1}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                aria-label="Decrease sibling count"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center text-sm font-medium tabular-nums bg-muted/40 rounded-md py-1.5">{count}</span>
              <button
                type="button"
                onClick={() => updateCount(count + 1)}
                disabled={count >= 8}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                aria-label="Increase sibling count"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Same gender toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground">Same gender as source</span>
            <button
              type="button"
              onClick={handleSameGenderToggle}
              className={`w-11 h-6 rounded-full border transition-all relative flex-shrink-0 ${useSameGender ? "border-primary bg-primary" : "border-border bg-muted"}`}
              aria-pressed={useSameGender}
            >
              <span className={`absolute top-[1px] left-[1px] w-5 h-5 rounded-full shadow-sm transition-transform bg-card ${useSameGender ? "translate-x-[20px]" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Sibling cards */}
          {!useSameGender && (
            <div ref={containerRef} className="space-y-2">
              {siblings.map((sb, idx) => (
                <div
                  key={idx}
                  className="border border-border rounded-lg p-3 space-y-3 transition-all"
                  style={{ animation: "fadeIn 0.2s ease-out" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Sibling #{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      {GENDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateSibling(idx, { type: opt.value })}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                            sb.type === opt.value
                              ? "bg-primary/15 text-primary border-primary/30"
                              : "text-muted-foreground hover:bg-accent border-transparent"
                          }`}
                          title={opt.label}
                        >
                          {opt.symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={sb.dob}
                      onChange={(e) => updateSibling(idx, { dob: e.target.value })}
                      placeholder="Date of birth"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <input
                      type="text"
                      value={sb.annotation}
                      onChange={(e) => updateSibling(idx, { annotation: e.target.value })}
                      placeholder="Label / note"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(siblings)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add {count} Sibling{count > 1 ? "s" : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
