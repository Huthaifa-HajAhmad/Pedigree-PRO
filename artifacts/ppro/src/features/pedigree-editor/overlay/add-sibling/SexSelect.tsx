import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Square, Circle, Diamond, Baby, Triangle, Check } from "lucide-react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

export interface SexSelectProps {
  value: PedigreeNode["type"];
  onChange: (val: PedigreeNode["type"]) => void;
}

export function SexSelect({ value, onChange }: SexSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const options = [
    { value: "male" as const, label: "Male", icon: <Square className="w-3.5 h-3.5 text-sky-500 stroke-[2.5px]" /> },
    { value: "female" as const, label: "Female", icon: <Circle className="w-3.5 h-3.5 text-pink-500 stroke-[2.5px]" /> },
    { value: "unknown" as const, label: "Unknown", icon: <Diamond className="w-3.5 h-3.5 text-slate-500 stroke-[2.5px]" /> },
    { value: "pregnancy" as const, label: "Pregnancy", icon: <Baby className="w-3.5 h-3.5 text-emerald-500 stroke-[2px]" /> },
    { value: "sab" as const, label: "Spontaneous Abortion (SAB)", icon: <Triangle className="w-3.5 h-3.5 text-amber-500 stroke-[2px]" /> },
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
