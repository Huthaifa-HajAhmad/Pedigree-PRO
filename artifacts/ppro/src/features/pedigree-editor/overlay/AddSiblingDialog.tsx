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
import { Minus, Plus, Users, Calendar, Square, Circle, Diamond } from "lucide-react";

interface SiblingEntry {
  type: PedigreeNode["type"];
  dob: string;
}

interface AddSiblingDialogProps {
  sourceNode: PedigreeNode;
  onConfirm: (siblings: SiblingEntry[]) => void;
  onCancel: () => void;
  autoLabel?: string;
}

type GenderPreset = "same" | "mixed" | "all-male" | "all-female";

function makeSibling(type: PedigreeNode["type"]): SiblingEntry {
  return { type, dob: "" };
}

const GENDER_TOGGLE_OPTIONS: Array<{ value: PedigreeNode["type"]; label: string; icon: React.ReactNode }> = [
  { value: "male", label: "Male", icon: <Square className="w-3.5 h-3.5" /> },
  { value: "female", label: "Female", icon: <Circle className="w-3.5 h-3.5" /> },
  { value: "unknown", label: "Unknown", icon: <Diamond className="w-3.5 h-3.5" /> },
];

export function AddSiblingDialog({ sourceNode, onConfirm, onCancel, autoLabel }: AddSiblingDialogProps) {
  const sameAsSource = (sourceNode.type === "sab" || sourceNode.type === "pregnancy") ? "unknown" : sourceNode.type;
  const displayName = sourceNode.label || autoLabel || sourceNode.notes?.slice(0, 20) || sourceNode.type;
  const [count, setCount] = useState(1);
  const [preset, setPreset] = useState<GenderPreset>("same");
  const [siblings, setSiblings] = useState<SiblingEntry[]>([makeSibling(sameAsSource)]);
  const listRef = useRef<HTMLDivElement>(null);

  const applyPreset = useCallback((p: GenderPreset, len: number): SiblingEntry[] => {
    switch (p) {
      case "same": return Array.from({ length: len }, () => makeSibling(sameAsSource));
      case "mixed": return Array.from({ length: len }, () => makeSibling("unknown"));
      case "all-male": return Array.from({ length: len }, () => makeSibling("male"));
      case "all-female": return Array.from({ length: len }, () => makeSibling("female"));
    }
  }, [sameAsSource]);

  const updateCount = useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(8, n));
    setCount(clamped);
    setSiblings((prev) => {
      if (prev.length < clamped) {
        const additions = applyPreset(preset, clamped - prev.length);
        return [...prev, ...additions];
      }
      return prev.slice(0, clamped);
    });
  }, [preset, applyPreset]);

  const handlePresetChange = useCallback((p: GenderPreset) => {
    setPreset(p);
    setSiblings(applyPreset(p, count));
  }, [count, applyPreset]);

  const updateSibling = useCallback((idx: number, patch: Partial<SiblingEntry>) => {
    setSiblings((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onConfirm(siblings);
    }
  };

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [siblings.length]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-3.5 h-3.5 text-primary" />
            </div>
            Add Siblings
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-xs leading-relaxed">
            Adding to <span className="font-medium text-foreground">{displayName}</span> — they will share the same parents.
          </DialogDescription>
        </DialogHeader>

        {/* Control Strip */}
        <div className="px-5 py-3 border-y border-border flex flex-wrap items-center gap-4">
          {/* Stepper */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Count</span>
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => updateCount(count - 1)}
                disabled={count <= 1}
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:z-10"
                aria-label="Decrease sibling count"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums border-x border-border">{count}</span>
              <button
                type="button"
                onClick={() => updateCount(count + 1)}
                disabled={count >= 8}
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:z-10"
                aria-label="Increase sibling count"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Gender preset segmented */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Preset</span>
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              {([
                { key: "same" as const, label: "Same" },
                { key: "mixed" as const, label: "Mixed" },
                { key: "all-male" as const, label: "Male" },
                { key: "all-female" as const, label: "Female" },
              ]).map((opt, i) => (
                <button
                  type="button"
                  key={opt.key}
                  onClick={() => handlePresetChange(opt.key)}
                  className={`px-2.5 h-7 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:z-10 ${
                    i > 0 ? "border-l border-border" : ""
                  } ${
                    preset === opt.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sibling List */}
        <div
          ref={listRef}
          className="px-5 py-3 overflow-y-auto"
          style={{ maxHeight: "min(320px, 45vh)" }}
          role="list"
          aria-label="Sibling entries"
        >
          <div className="space-y-1.5">
            {siblings.map((sb, idx) => (
              <div
                key={idx}
                role="listitem"
                className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-transparent hover:border-border hover:bg-accent/40 transition-colors focus-within:border-primary/40 focus-within:bg-accent/40"
              >
                {/* Index badge */}
                <span className="w-5 h-5 rounded-sm bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground flex-shrink-0 tabular-nums">
                  {idx + 1}
                </span>

                {/* Sex selector — icon toggle group */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {GENDER_TOGGLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateSibling(idx, { type: opt.value })}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                        sb.type === opt.value
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent"
                      }`}
                      title={opt.label}
                      aria-label={`Set sibling ${idx + 1} gender to ${opt.label}`}
                    >
                      {opt.icon}
                    </button>
                  ))}
                </div>

                {/* DOB field */}
                <div className="flex-1 min-w-0 relative">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
                  <input
                    type="date"
                    value={sb.dob}
                    onChange={(e) => updateSibling(idx, { dob: e.target.value })}
                    className="w-full h-7 rounded-md border border-input bg-transparent pl-7 pr-2 text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 [color-scheme:inherit]"
                    aria-label={`Sibling ${idx + 1} date of birth`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 h-8 text-xs rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(siblings)}
            className="px-4 h-8 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            Add {count} Sibling{count > 1 ? "s" : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
