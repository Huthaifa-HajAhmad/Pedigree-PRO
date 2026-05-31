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
import { Minus, Plus, Users, Square, Circle, Diamond, Info } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

interface SiblingEntry {
  type: PedigreeNode["type"];
  dob: string;
  affected: boolean;
  carrier: boolean;
  condition: string;
}

interface AddSiblingDialogProps {
  sourceNode: PedigreeNode;
  onConfirm: (siblings: SiblingEntry[]) => void;
  onCancel: () => void;
  autoLabel?: string;
}

type GenderPreset = "same" | "mixed" | "all-male" | "all-female";

function makeSibling(type: PedigreeNode["type"]): SiblingEntry {
  return { type: type || "unknown", dob: "", affected: false, carrier: false, condition: "" };
}

const SEX_OPTIONS: Array<{ value: "male" | "female" | "unknown"; label: string; icon: React.ReactNode }> = [
  { value: "male", label: "Male", icon: <Square className="w-3.5 h-3.5" /> },
  { value: "female", label: "Female", icon: <Circle className="w-3.5 h-3.5" /> },
  { value: "unknown", label: "Unknown", icon: <Diamond className="w-3.5 h-3.5" /> },
];

const PRESET_OPTIONS: Array<{ key: GenderPreset; label: string }> = [
  { key: "same", label: "Same" },
  { key: "mixed", label: "Mixed" },
  { key: "all-male", label: "All Male" },
  { key: "all-female", label: "All Female" },
];

function sexSummary(siblings: SiblingEntry[]): string {
  const counts = { male: 0, female: 0, unknown: 0 };
  for (const s of siblings) {
    if (s.type === "male" || s.type === "female" || s.type === "unknown") {
      counts[s.type]++;
    }
  }
  const parts: string[] = [];
  if (counts.male) parts.push(`${counts.male}M`);
  if (counts.female) parts.push(`${counts.female}F`);
  if (counts.unknown) parts.push(`${counts.unknown}?`);
  return parts.join(" · ") || "—";
}

export function AddSiblingDialog({ sourceNode, onConfirm, onCancel, autoLabel }: AddSiblingDialogProps) {
  const sameAsSource = (sourceNode.type === "sab" || sourceNode.type === "pregnancy") ? "unknown" : sourceNode.type;
  const displayName = sourceNode.label || autoLabel || sourceNode.notes?.slice(0, 20) || sourceNode.type;
  const [count, setCount] = useState(1);
  const [preset, setPreset] = useState<GenderPreset>("same");
  const [siblings, setSiblings] = useState<SiblingEntry[]>([makeSibling(sameAsSource)]);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        return [...prev, ...applyPreset(preset, clamped - prev.length)];
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [siblings.length]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden border-border shadow-xl"
        onKeyDown={handleKeyDown}
      >
        {/* Header with accent bar */}
        <div className="relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/60" />
          <DialogHeader className="px-5 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/20">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <span>Add Siblings</span>
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Adding to <span className="font-medium text-foreground">{displayName}</span> — they will share the same parents.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Control Strip */}
        <div className="px-5 py-3.5 border-y border-border bg-muted/30 flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Count</span>
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background shadow-sm">
              <button
                type="button"
                onClick={() => updateCount(count - 1)}
                disabled={count <= 1}
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:z-10"
                aria-label="Decrease sibling count"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums border-x border-border">{count}</span>
              <button
                type="button"
                onClick={() => updateCount(count + 1)}
                disabled={count >= 8}
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:z-10"
                aria-label="Increase sibling count"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Preset</span>
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background shadow-sm">
              {PRESET_OPTIONS.map((opt, i) => (
                <button
                  type="button"
                  key={opt.key}
                  onClick={() => handlePresetChange(opt.key)}
                  className={`px-3 h-8 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:z-10 ${
                    i > 0 ? "border-l border-border" : ""
                  } ${
                    preset === opt.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Spreadsheet Table */}
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: "min(360px, 50vh)" }}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 sticky top-0 z-10">
                <th className="w-10 px-3 py-2.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">#</th>
                <th className="w-28 px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sex</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date of Birth</th>
                <th className="w-20 px-3 py-2.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Affected</th>
                <th className="w-20 px-3 py-2.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Carrier</th>
              </tr>
            </thead>
            <tbody>
              {siblings.map((sb, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-border/40 transition-colors duration-150 ${
                    idx % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                  } hover:bg-accent/20`}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {/* # */}
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-muted/80 text-[11px] font-bold text-muted-foreground/80 tabular-nums ring-1 ring-border/50">
                      {idx + 1}
                    </span>
                  </td>

                  {/* Sex */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {SEX_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateSibling(idx, { type: opt.value })}
                          className={`w-8 h-8 rounded-md flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                            sb.type === opt.value
                              ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                              : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/60 border border-transparent"
                          }`}
                          title={opt.label}
                        >
                          {opt.icon}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* DOB */}
                  <td className="px-3 py-2">
                    <DatePicker
                      value={sb.dob}
                      onChange={(val) => updateSibling(idx, { dob: val })}
                      maxDate={new Date()}
                      placeholder="Select date..."
                      aria-label={`Sibling ${idx + 1} date of birth`}
                      className="h-8 text-xs border-0 bg-transparent hover:bg-accent/40 px-2 rounded-md"
                    />
                  </td>

                  {/* Affected */}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => updateSibling(idx, { affected: !sb.affected })}
                      className={`w-7 h-7 rounded-md border transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mx-auto flex items-center justify-center ${
                        sb.affected
                          ? "bg-foreground border-foreground text-background shadow-sm"
                          : "border-border/80 hover:border-foreground/40 bg-background"
                      }`}
                      title={sb.affected ? "Affected" : "Not affected"}
                    >
                      {sb.affected && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </td>

                  {/* Carrier */}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => updateSibling(idx, { carrier: !sb.carrier })}
                      className={`w-7 h-7 rounded-md border transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mx-auto flex items-center justify-center ${
                        sb.carrier
                          ? "bg-primary border-primary text-primary-foreground shadow-sm"
                          : "border-border/80 hover:border-primary/40 bg-background"
                      }`}
                      title={sb.carrier ? "Carrier" : "Not carrier"}
                    >
                      {sb.carrier && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Strip */}
        <div className="px-5 py-2 border-t border-border bg-muted/20 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="tabular-nums font-medium">{count}</span> sibling{count > 1 ? "s" : ""}
          <span className="text-border mx-1">|</span>
          <span>{sexSummary(siblings)}</span>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3.5 border-t border-border flex items-center justify-end gap-2 bg-muted/10">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 h-9 text-xs rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(siblings)}
            className="px-5 h-9 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 shadow-sm"
          >
            Add {count} Sibling{count > 1 ? "s" : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
