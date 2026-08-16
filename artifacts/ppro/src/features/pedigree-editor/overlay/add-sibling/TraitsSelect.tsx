import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Check } from "lucide-react";
import { SiblingEntry, renderMiniTraitIcon } from "./types";

export interface TraitsSelectProps {
  sibling: SiblingEntry;
  onChange: (patch: Partial<SiblingEntry>) => void;
}

export function TraitsSelect({ sibling, onChange }: TraitsSelectProps) {
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
