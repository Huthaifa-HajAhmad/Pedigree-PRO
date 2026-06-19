import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { Users, Square, Circle, Diamond, Info, Trash2, Check, GripVertical, Baby, Triangle } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface SiblingEntry {
  id: string;
  type: PedigreeNode["type"];
  dob: string;
  affected: boolean;
  carrier: boolean;
  deceased: boolean;
  proband: boolean;
  condition: string;
  isSource?: boolean;
}

interface AddSiblingDialogProps {
  sourceNode: PedigreeNode;
  onConfirm: (siblings: SiblingEntry[]) => void;
  onCancel: () => void;
  autoLabel?: string;
}

function makeSibling(type: PedigreeNode["type"]): SiblingEntry {
  return {
    id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type: type || "unknown",
    dob: "",
    affected: false,
    carrier: false,
    deceased: false,
    proband: false,
    condition: "",
  };
}

function sexSummary(siblings: SiblingEntry[]): string {
  const counts = { male: 0, female: 0, unknown: 0, pregnancy: 0, sab: 0 };
  for (const s of siblings) {
    if (s.type in counts) {
      counts[s.type]++;
    }
  }
  const parts: string[] = [];
  if (counts.male) parts.push(`${counts.male}M`);
  if (counts.female) parts.push(`${counts.female}F`);
  if (counts.unknown) parts.push(`${counts.unknown}?`);
  return parts.join(" · ") || "—";
}

function traitsSummary(siblings: SiblingEntry[]): string {
  const counts = { affected: 0, carrier: 0, deceased: 0, proband: 0 };
  for (const s of siblings) {
    if (s.affected) counts.affected++;
    if (s.carrier) counts.carrier++;
    if (s.deceased) counts.deceased++;
    if (s.proband) counts.proband++;
  }
  const parts: string[] = [];
  if (counts.affected) parts.push(`${counts.affected} Affected`);
  if (counts.carrier) parts.push(`${counts.carrier} Carrier`);
  if (counts.deceased) parts.push(`${counts.deceased} Deceased`);
  if (counts.proband) parts.push(`${counts.proband} Proband`);
  return parts.join(" · ");
}

function renderMiniTraitIcon(type: PedigreeNode["type"], trait: "affected" | "carrier" | "deceased" | "proband", size = 12) {
  const isMale = type === "male";
  const isFemale = type === "female";

  const stroke = "currentColor";
  const strokeWidth = 1.2;

  let shape: React.ReactNode;
  if (isMale) {
    shape = <rect x="2" y="2" width="8" height="8" fill={trait === "affected" ? "currentColor" : "none"} stroke={stroke} strokeWidth={strokeWidth} rx={0.5} />;
  } else if (isFemale) {
    shape = <circle cx="6" cy="6" r="4.5" fill={trait === "affected" ? "currentColor" : "none"} stroke={stroke} strokeWidth={strokeWidth} />;
  } else {
    shape = <polygon points="6,1.5 10.5,6 6,10.5 1.5,6" fill={trait === "affected" ? "currentColor" : "none"} stroke={stroke} strokeWidth={strokeWidth} />;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className="overflow-visible inline-block select-none flex-shrink-0">
      {shape}
      {trait === "carrier" && (
        <circle cx="6" cy="6" r="1.5" fill="currentColor" />
      )}
      {trait === "deceased" && (
        <line x1="0" y1="12" x2="12" y2="0" stroke="currentColor" strokeWidth={1.2} />
      )}
      {trait === "proband" && (
        <path d="M3.5 8.5 L0.5 11.5 M0.5 11.5 L3 11.5 M0.5 11.5 L0.5 9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

interface SexSelectProps {
  value: PedigreeNode["type"];
  onChange: (val: PedigreeNode["type"]) => void;
}

function SexSelect({ value, onChange }: SexSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const options = [
    { value: "male" as const, label: "Male", icon: <Square className="w-3.5 h-3.5 text-sky-500 stroke-[2.5px]" /> },
    { value: "female" as const, label: "Female", icon: <Circle className="w-3.5 h-3.5 text-pink-500 stroke-[2.5px]" /> },
    { value: "unknown" as const, label: "Unknown", icon: <Diamond className="w-3.5 h-3.5 text-slate-500 stroke-[2.5px]" /> },
    { value: "pregnancy" as const, label: "Pregnancy", icon: <Baby className="w-3.5 h-3.5 text-emerald-500 stroke-[2px]" /> },
    { value: "sab" as const, label: "SAB / Stillbirth", icon: <Triangle className="w-3.5 h-3.5 text-amber-500 stroke-[2px]" /> },
  ];

  const selected = options.find((opt) => opt.value === value) || options[2]!;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-8 flex items-center justify-between gap-2 px-2.5 rounded-lg border border-border bg-background hover:bg-accent/50 text-[11px] font-medium transition-colors focus:outline-none focus:border-muted-foreground/45 focus-visible:outline-none focus-visible:ring-0"
        >
          <div className="flex items-center gap-1.5">
            {selected.icon}
            <span>{selected.label}</span>
          </div>
          <svg
            className={`w-3 h-3 text-muted-foreground/60 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[120px] p-1 text-[11px] bg-popover border border-border shadow-md rounded-lg" align="start" sideOffset={4}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-all duration-150 text-[11px] font-medium focus-visible:outline-none ${
              value === opt.value
                ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              {opt.icon}
              <span>{opt.label}</span>
            </div>
            {value === opt.value && (
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

interface TraitsSelectProps {
  sibling: SiblingEntry;
  onChange: (patch: Partial<SiblingEntry>) => void;
}

function TraitsSelect({ sibling, onChange }: TraitsSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const traits = [
    { key: "affected" as const, label: "Affected" },
    { key: "carrier" as const, label: "Carrier" },
    { key: "deceased" as const, label: "Deceased" },
    { key: "proband" as const, label: "Proband" },
  ];

  const activeTraits = traits.filter((t) => sibling[t.key]);
  const firstActive = activeTraits[0];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-8 flex items-center justify-between gap-1.5 px-2.5 rounded-lg border border-border bg-background hover:bg-accent/50 text-[11px] font-medium transition-colors focus:outline-none focus:border-muted-foreground/45 focus-visible:outline-none focus-visible:ring-0"
        >
          <div className="flex items-center gap-1 truncate max-w-[calc(100%-14px)]">
            {firstActive ? (
              activeTraits.length === 1 ? (
                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded text-[9px] font-bold">
                  {renderMiniTraitIcon(sibling.type, firstActive.key)}
                  <span>{firstActive.label}</span>
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded text-[9px] font-bold">
                    {renderMiniTraitIcon(sibling.type, firstActive.key)}
                    <span>{firstActive.label}</span>
                  </span>
                  <span className="inline-flex items-center bg-muted text-muted-foreground border border-border px-1 py-0.5 rounded text-[9px] font-bold">
                    +{activeTraits.length - 1}
                  </span>
                </div>
              )
            ) : (
              <span className="text-muted-foreground/60 italic text-[11px]">Normal</span>
            )}
          </div>
          <svg
            className={`w-3 h-3 text-muted-foreground/60 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-1 text-[11px] bg-popover border border-border shadow-md rounded-lg space-y-0.5" align="start" sideOffset={4}>
        {traits.map((t) => {
          const isActive = !!sibling[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                onChange({ [t.key]: !sibling[t.key] });
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-all duration-150 text-[11px] font-medium focus-visible:outline-none ${
                isActive
                  ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                  : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 flex items-center justify-center w-4 h-4">
                  {renderMiniTraitIcon(sibling.type, t.key, 14)}
                </span>
                <span>{t.label}</span>
              </div>
              {isActive && (
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
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

  const W_SVG = 260;
  const H_SVG = 140;

  const allNodes = siblings.map((sb, idx) => {
    if (sb.isSource) {
      return {
        type: sb.type === "sab" || sb.type === "pregnancy" ? "unknown" : sb.type,
        affected: sb.affected,
        carrier: sb.carrier,
        deceased: sb.deceased,
        proband: sb.proband,
        isSource: true,
        label: displayName,
      };
    }
    const sibNum = siblings.filter((s, i) => !s.isSource && i <= idx).length;
    return {
      type: sb.type,
      affected: sb.affected,
      carrier: sb.carrier,
      deceased: sb.deceased,
      proband: sb.proband,
      isSource: false,
      label: `S${sibNum}`,
    };
  });

  const getSiblingCoords = (idx: number, total: number) => {
    if (total === 1) return W_SVG / 2;
    const padding = 30;
    const step = (W_SVG - padding * 2) / (total - 1);
    return padding + idx * step;
  };

  const lineY = 55;
  const nodeY = 85;

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
            <div className="rounded-xl border border-border bg-card/45 p-4 flex flex-col items-center justify-center shadow-inner">
              <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2.5">Live Pedigree Preview</span>
              <svg width={W_SVG} height={H_SVG} className="overflow-visible bg-transparent">
                <defs>
                  <radialGradient id="svgGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="hsl(var(--primary) / 0.12)" stopOpacity="1" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0)" stopOpacity="0" />
                  </radialGradient>
                  <pattern id="dotPattern" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="hsl(var(--foreground) / 0.04)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotPattern)" rx={6} />
                <rect width="100%" height="100%" fill="url(#svgGlow)" rx={6} />
                {allNodes.length > 0 && (
                  <>
                    {/* Sibship horizontal connector line */}
                    {allNodes.length > 1 && (
                      <>
                        <line
                          x1={getSiblingCoords(0, allNodes.length)}
                          y1={lineY}
                          x2={getSiblingCoords(allNodes.length - 1, allNodes.length)}
                          y2={lineY}
                          stroke="hsl(var(--foreground) / 0.25)"
                          strokeWidth={1.5}
                        />
                        {/* Parent connection line stem */}
                        <line
                          x1={W_SVG / 2}
                          y1={lineY}
                          x2={W_SVG / 2}
                          y2={lineY - 15}
                          stroke="hsl(var(--foreground) / 0.25)"
                          strokeWidth={1.5}
                        />
                      </>
                    )}

                    {allNodes.map((node, idx) => {
                      const cx = getSiblingCoords(idx, allNodes.length);
                      const cy = nodeY;
                      const r = 11;
                      const isSource = node.isSource;

                      // Source node is highlighted with primary theme colors
                      const fill = node.affected ? (isSource ? "hsl(var(--primary))" : "hsl(var(--foreground))") : "hsl(var(--card))";
                      const stroke = isSource ? "hsl(var(--primary))" : (node.affected ? "hsl(var(--foreground))" : "currentColor");
                      const sw = isSource ? 2.5 : 1.5;

                      // Vertical drop line to symbol
                      const dropLineY2 = cy - r;
                      let verticalLine: React.ReactNode;
                      if (allNodes.length > 1) {
                        verticalLine = (
                          <line
                            x1={cx}
                            y1={lineY}
                            x2={cx}
                            y2={dropLineY2}
                            stroke="hsl(var(--foreground) / 0.25)"
                            strokeWidth={1.5}
                          />
                        );
                      } else {
                        // Standard single parent stem connection
                        verticalLine = (
                          <line
                            x1={cx}
                            y1={dropLineY2}
                            x2={cx}
                            y2={dropLineY2 - 20}
                            stroke="hsl(var(--foreground) / 0.25)"
                            strokeWidth={1.5}
                          />
                        );
                      }

                      let shapeElement: React.ReactNode;
                      if (node.type === "male") {
                        shapeElement = <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={fill} stroke={stroke} strokeWidth={sw} rx={0.5} className="transition-all duration-300" />;
                      } else if (node.type === "female") {
                        shapeElement = <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw} className="transition-all duration-300" />;
                      } else {
                        shapeElement = <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={fill} stroke={stroke} strokeWidth={sw} className="transition-all duration-300" />;
                      }

                      return (
                        <g key={idx} className="text-foreground cursor-default">
                          {verticalLine}
                          {isSource && (
                            <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="hsl(var(--primary) / 0.3)" strokeWidth={1} strokeDasharray="3,3" />
                          )}
                          {shapeElement}
                          {node.carrier && !node.affected && (
                            <circle cx={cx} cy={cy} r={2.5} fill={isSource ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))"} />
                          )}
                          {node.deceased && (
                            <line x1={cx - r - 3} y1={cy + r + 3} x2={cx + r + 3} y2={cy - r - 3} stroke={isSource ? "hsl(var(--primary-foreground))" : "currentColor"} strokeWidth={1.5} />
                          )}
                          {node.proband && (
                            <g className={isSource ? "text-primary-foreground" : "text-foreground"}>
                              <line x1={cx - r - 6} y1={cy + r + 6} x2={cx - r - 2} y2={cy + r + 2} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                              <polygon points={`${cx - r},${cy + r} ${cx - r - 2},${cy + r + 4} ${cx - r - 4},${cy + r + 2}`} fill="currentColor" />
                            </g>
                          )}
                          <text
                            x={cx}
                            y={cy + r + 13}
                            fontSize={8}
                            fontWeight={isSource ? "bold" : "medium"}
                            textAnchor="middle"
                            fill={isSource ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                            className="font-mono"
                          >
                            {isSource ? "Current" : node.label}
                          </text>
                        </g>
                      );
                    })}
                  </>
                )}
              </svg>
            </div>

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

          {/* Sibling Card List (for 1-3 Siblings) */}
          {count === 0 ? (
            /* Empty state */
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
          ) : (
            /* Spreadsheet Table Scroll Container (for 4+ Siblings) */
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
