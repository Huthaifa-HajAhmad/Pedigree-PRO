import { useState } from "react";
import { BookOpen, X } from "lucide-react";

function LegendSymbol({ k }: { k: string }) {
  const G = "hsl(var(--primary))";
  const W = "hsl(var(--foreground) / 0.6)";
  if (k === "male") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <rect x={-5} y={-5} width={10} height={10} fill="none" stroke={W} strokeWidth={1.5} rx={1} />
    </svg>
  );
  if (k === "female") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <circle r={5} fill="none" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "unknown") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <polygon points="0,-5 5.5,3 -5.5,3" fill="none" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "pregnancy") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <polygon points="0,-5.5 5.5,0 0,5.5 -5.5,0" fill="none" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "sab") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <polygon points="0,5 -5.5,-3 5.5,-3" fill="hsl(var(--muted-foreground) / 0.3)" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "affected") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <circle r={5} fill={G} opacity={0.5} stroke={G} strokeWidth={1.5} />
    </svg>
  );
  if (k === "carrier") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <circle r={5} fill="none" stroke={W} strokeWidth={1.5} />
      <circle r={2.5} fill={G} opacity={0.9} />
    </svg>
  );
  if (k === "deceased") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <rect x={-5} y={-5} width={10} height={10} fill="none" stroke={W} strokeWidth={1.5} rx={1} />
      <line x1={-6} y1={6} x2={6} y2={-6} stroke={W} strokeWidth={1.2} />
    </svg>
  );
  if (k === "proband") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <path d="M-5,0 L3,0 M0,-3 L4,0 L0,3" fill="none" stroke={G} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
  if (k === "couple") return (
    <svg width={22} height={14} viewBox="-11 -7 22 14">
      <line x1={-6} y1={0} x2={6} y2={0} stroke={W} strokeWidth={1.5} />
      <circle cx={-7} cy={0} r={1.5} fill={W} />
      <circle cx={7} cy={0} r={1.5} fill={W} />
    </svg>
  );
  if (k === "consanguinity") return (
    <svg width={22} height={14} viewBox="-11 -7 22 14">
      <line x1={-6} y1={-2} x2={6} y2={-2} stroke={W} strokeWidth={1.5} />
      <line x1={-6} y1={2} x2={6} y2={2} stroke={W} strokeWidth={1.5} />
      <circle cx={-7} cy={0} r={1.5} fill={W} />
      <circle cx={7} cy={0} r={1.5} fill={W} />
    </svg>
  );
  if (k === "parent-child") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <line x1={0} y1={-5} x2={0} y2={1} stroke={W} strokeWidth={1.5} />
      <line x1={-4} y1={1} x2={4} y2={1} stroke={W} strokeWidth={1.5} />
      <line x1={0} y1={1} x2={0} y2={5} stroke={W} strokeWidth={1.5} />
    </svg>
  );
  return null;
}

export function LegendPanel({ entries, expanded: controlledExpanded, onToggle, className = "" }: {
  entries: Array<{ key: string; label: string }>;
  expanded?: boolean;
  onToggle?: (value: boolean) => void;
  className?: string;
}) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const setExpanded = (v: boolean) => {
    if (onToggle) onToggle(v);
    if (!isControlled) setInternalExpanded(v);
  };
  if (entries.length === 0) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        aria-label="Open legend"
        onClick={() => setExpanded(true)}
        className={`absolute bottom-4 left-4 z-10 rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm shadow-lg p-2 hover:bg-accent transition-colors ${className}`}
      >
        <BookOpen className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  return (
      <div className={`absolute bottom-4 left-4 z-10 rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm shadow-lg p-2 w-[180px] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
          Legend
        </span>
        {!isControlled && (
          <button
            type="button"
            aria-label="Close legend"
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {entries.map((e) => (
          <div key={e.key} className="flex items-center gap-2">
            <div className="flex-shrink-0 flex items-center justify-center w-[22px]">
              <LegendSymbol k={e.key} />
            </div>
            <span className="text-[10px] leading-tight text-muted-foreground truncate">
              {e.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
