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
import { Minus, Plus, Square, Circle, Diamond, Baby, AlertTriangle, Users, Calendar, GripVertical, GitBranch } from "lucide-react";

interface SiblingEntry {
  type: PedigreeNode["type"];
  dob: string;
  twinGroup?: string;
  twinType?: "m" | "d";
}

interface AddSiblingDialogProps {
  sourceNode: PedigreeNode;
  onConfirm: (siblings: SiblingEntry[]) => void;
  onCancel: () => void;
}

const GENDER_OPTIONS: Array<{ value: PedigreeNode["type"]; label: string; icon: React.ReactNode }> = [
  { value: "male", label: "Male", icon: <Square className="w-5 h-5" /> },
  { value: "female", label: "Female", icon: <Circle className="w-5 h-5" /> },
  { value: "unknown", label: "Unknown", icon: <Diamond className="w-5 h-5" /> },
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
  return { type, dob: "" };
}

type GenderPreset = "same" | "mixed" | "all-male" | "all-female";

export function AddSiblingDialog({ sourceNode, onConfirm, onCancel, autoLabel }: AddSiblingDialogProps & { autoLabel?: string }) {
  const sameAsSource = (sourceNode.type === "sab" || sourceNode.type === "pregnancy") ? "unknown" : sourceNode.type;
  const displayName = sourceNode.label || autoLabel || sourceNode.notes?.slice(0, 20) || sourceNode.type;
  const [count, setCount] = useState(1);
  const [preset, setPreset] = useState<GenderPreset>("same");
  const [twinType, setTwinType] = useState<"none" | "m" | "d">("none");
  const [siblings, setSiblings] = useState<SiblingEntry[]>([makeSibling(sameAsSource)]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [buttonKey, setButtonKey] = useState(0);

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
    setButtonKey((k) => k + 1);
  }, [preset, applyPreset]);

  const handlePresetChange = useCallback((p: GenderPreset) => {
    setPreset(p);
    setSiblings(applyPreset(p, count));
  }, [count, applyPreset]);

  const handleTwinChange = useCallback((tt: "none" | "m" | "d") => {
    setTwinType(tt);
    if (tt === "none") {
      setSiblings((prev) => prev.map((s) => ({ ...s, twinGroup: undefined, twinType: undefined })));
    } else {
      const group = `twins_${Date.now()}`;
      setSiblings((prev) => prev.map((s) => ({ ...s, twinGroup: group, twinType: tt })));
    }
  }, []);

  const updateSibling = useCallback((idx: number, patch: Partial<SiblingEntry>) => {
    setSiblings((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }, []);

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
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            Add Siblings
          </DialogTitle>
          <DialogDescription>
            Adding siblings to <span className="font-medium text-foreground">{displayName}</span> — they will share the same parents.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Stepper */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Number</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateCount(count - 1)}
                disabled={count <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                aria-label="Decrease sibling count"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span key={buttonKey} className="min-w-[2rem] text-center text-sm font-semibold tabular-nums animate-in zoom-in-95 duration-150">{count}</span>
              <button
                type="button"
                onClick={() => updateCount(count + 1)}
                disabled={count >= 8}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                aria-label="Increase sibling count"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Gender preset segmented control */}
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">Gender preset</span>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { key: "same" as const, label: "Same", icon: <TypeIcon type={sameAsSource} /> },
                { key: "mixed" as const, label: "Mixed", icon: <Diamond className="w-3.5 h-3.5" /> },
                { key: "all-male" as const, label: "All ♂", icon: <Square className="w-3.5 h-3.5" /> },
                { key: "all-female" as const, label: "All ♀", icon: <Circle className="w-3.5 h-3.5" /> },
              ]).map((opt) => (
                <button
                  type="button"
                  key={opt.key}
                  onClick={() => handlePresetChange(opt.key)}
                  className={`py-1.5 rounded-lg text-xs border transition-all flex items-center justify-center gap-1 ${
                    preset === opt.key
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Twin options (only show when count >= 2) */}
          {count >= 2 && (
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">
                <GitBranch className="w-3 h-3 inline mr-1" />
                Twins
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { key: "none" as const, label: "None" },
                  { key: "m" as const, label: "Identical" },
                  { key: "d" as const, label: "Fraternal" },
                ]).map((opt) => (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => handleTwinChange(opt.key)}
                    className={`py-1.5 rounded-lg text-xs border transition-all ${
                      twinType === opt.key
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {twinType !== "none" && count >= 2 && (
                <p className="text-[10px] text-muted-foreground mt-1.5">Siblings will share a twin link on canvas.</p>
              )}
            </div>
          )}

          {/* Sibling cards */}
          <div ref={containerRef} className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            {siblings.map((sb, idx) => (
              <div
                key={idx}
                className="border border-border rounded-xl p-3 space-y-2.5 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 focus-within:border-l-2 focus-within:border-l-primary/40 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-3 h-3 text-muted-foreground/40" />
                    <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">Sibling</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {GENDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateSibling(idx, { type: opt.value })}
                        className={`w-9 h-9 rounded-lg text-xs font-medium transition-all border flex items-center justify-center ${
                          sb.type === opt.value
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "text-muted-foreground hover:bg-accent border-transparent"
                        }`}
                        title={opt.label}
                      >
                        {opt.icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                    <input
                      type="date"
                      value={sb.dob}
                      onChange={(e) => updateSibling(idx, { dob: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
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
            key={buttonKey}
            onClick={() => onConfirm(siblings)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors animate-in fade-in zoom-in-95 duration-150"
          >
            Add {count} Sibling{count > 1 ? "s" : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
