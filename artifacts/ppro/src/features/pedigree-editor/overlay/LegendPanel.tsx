import { useState, useEffect } from "react";
import { BookOpen, X, Camera } from "lucide-react";
import { getQuadrantsForStyle } from "../utils/helpers";

function LegendSymbol({ k, isPublication }: { k: string; isPublication?: boolean }) {
  const G = isPublication ? "#0284c7" : "hsl(var(--primary))";
  const W = isPublication ? "#1e293b" : "hsl(var(--foreground) / 0.6)";
  const fillCol = isPublication ? "#1e293b" : "hsl(var(--foreground))";
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
      <polygon points="0,-5.5 5.5,0 0,5.5 -5.5,0" fill="none" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "pregnancy") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <polygon points="0,-5.5 5.5,0 0,5.5 -5.5,0" fill="none" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "sab") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <polygon points="0,-5.5 -5.5,3 5.5,3" fill="none" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "stillbirth") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <rect x={-3.5} y={-3.5} width={7} height={7} fill="none" stroke={W} strokeWidth={1.2} />
      <line x1={-4.5} y1={4.5} x2={4.5} y2={-4.5} stroke={W} strokeWidth={1.0} />
      <text x={2} y={3.5} fontSize={5} fill={W} style={{ fontWeight: "bold", fontFamily: "sans-serif" }}>SB</text>
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
      <path d="M5,0 L-3,0 M0,-3 L-4,0 L0,3" fill="none" stroke={G} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
  if (k === "couple") return (
    <svg width={22} height={14} viewBox="-11 -7 22 14">
      <line x1={-7} y1={0} x2={7} y2={0} stroke={W} strokeWidth={1.5} />
      <circle cx={-7} cy={0} r={1.5} fill={W} />
      <circle cx={7} cy={0} r={1.5} fill={W} />
    </svg>
  );
  if (k === "consanguinity") return (
    <svg width={22} height={14} viewBox="-11 -7 22 14">
      <line x1={-7} y1={-2.5} x2={7} y2={-2.5} stroke={W} strokeWidth={1.5} />
      <line x1={-7} y1={2.5} x2={7} y2={2.5} stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "parent-child") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <line x1={0} y1={-5} x2={0} y2={1} stroke={W} strokeWidth={1.5} />
      <line x1={-4} y1={1} x2={4} y2={1} stroke={W} strokeWidth={1.5} />
      <line x1={0} y1={1} x2={0} y2={5} stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k.startsWith("shading-")) {
    const style = k.replace("shading-", "");
    const strokeColor = W;

    if (style === "striped") {
      return (
        <svg width={14} height={14} viewBox="-7 -7 14 14">
          <circle r={5} fill="url(#shading-striped)" stroke={strokeColor} strokeWidth={1.5} />
        </svg>
      );
    }
    if (style === "cross-hatched") {
      return (
        <svg width={14} height={14} viewBox="-7 -7 14 14">
          <circle r={5} fill="url(#shading-cross-hatched)" stroke={strokeColor} strokeWidth={1.5} />
        </svg>
      );
    }
    if (style === "dots") {
      return (
        <svg width={14} height={14} viewBox="-7 -7 14 14">
          <circle r={5} fill="url(#shading-dots)" stroke={strokeColor} strokeWidth={1.5} />
        </svg>
      );
    }
    const [q1, q2, q3, q4] = getQuadrantsForStyle(style);
    if (q1 || q2 || q3 || q4) {
      const R = 5;
      return (
        <svg width={14} height={14} viewBox="-7 -7 14 14">
          <circle r={R} fill="none" stroke={strokeColor} strokeWidth={1.5} />
          {q1 && <path d={`M 0 0 L 0 ${-R} A ${R} ${R} 0 0 1 ${R} 0 Z`} fill={fillCol} />}
          {q2 && <path d={`M 0 0 L ${-R} 0 A ${R} ${R} 0 0 1 0 ${-R} Z`} fill={fillCol} />}
          {q3 && <path d={`M 0 0 L 0 ${R} A ${R} ${R} 0 0 1 ${-R} 0 Z`} fill={fillCol} />}
          {q4 && <path d={`M 0 0 L ${R} 0 A ${R} ${R} 0 0 1 0 ${R} Z`} fill={fillCol} />}
        </svg>
      );
    }
    if (style === "solid") {
      return (
        <svg width={14} height={14} viewBox="-7 -7 14 14">
          <circle r={5} fill={fillCol} stroke={strokeColor} strokeWidth={1.5} />
        </svg>
      );
    }
  }
  return null;
}

export function LegendPanel({ entries, expanded: controlledExpanded, onToggle, className = "" }: {
  entries: Array<{ key: string; label: string }>;
  expanded?: boolean;
  onToggle?: (value: boolean) => void;
  className?: string;
}) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [showPubModal, setShowPubModal] = useState(false);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const setExpanded = (v: boolean) => {
    if (onToggle) onToggle(v);
    if (!isControlled) setInternalExpanded(v);
  };

  useEffect(() => {
    if (!showPubModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPubModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPubModal]);

  if (entries.length === 0) return null;

  const categories = {
    shapes: entries.filter(e => ["male", "female", "unknown", "pregnancy", "sab", "stillbirth"].includes(e.key)),
    status: entries.filter(e => ["affected", "carrier", "deceased", "proband"].includes(e.key)),
    shading: entries.filter(e => e.key.startsWith("shading-")),
    relations: entries.filter(e => ["couple", "consanguinity"].includes(e.key)),
  };

  const renderPublicationModal = () => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-100 max-w-4xl w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-primary" />
              Publication-Ready Legend
            </h3>
            <p className="text-[11px] text-slate-500">Optimized layout for presentation slides, publication figures, or screenshots.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPubModal(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-200/50"
            aria-label="Close publication legend"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-8 grid grid-cols-4 gap-8 bg-white overflow-y-auto max-h-[70vh]">
          {/* Column 1: Gender & Shapes */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Gender & Shapes
            </h4>
            {categories.shapes.length > 0 ? (
              <div className="space-y-3">
                {categories.shapes.map((e) => (
                  <div key={e.key} className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded bg-slate-50 border border-slate-100 shadow-xs">
                      <LegendSymbol k={e.key} isPublication={true} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700">{e.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 italic block pt-1">None active</span>
            )}
          </div>

          {/* Column 2: Status & Flags */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Status & Flags
            </h4>
            {categories.status.length > 0 ? (
              <div className="space-y-3">
                {categories.status.map((e) => (
                  <div key={e.key} className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded bg-slate-50 border border-slate-100 shadow-xs">
                      <LegendSymbol k={e.key} isPublication={true} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700">{e.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 italic block pt-1">None active</span>
            )}
          </div>

          {/* Column 3: Phenotypes / Shading */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Phenotypes / Shading
            </h4>
            {categories.shading.length > 0 ? (
              <div className="space-y-3">
                {categories.shading.map((e) => (
                  <div key={e.key} className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded bg-slate-50 border border-slate-100 shadow-xs">
                      <LegendSymbol k={e.key} isPublication={true} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700">{e.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 italic block pt-1">None active</span>
            )}
          </div>

          {/* Column 4: Relationships */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Relationships
            </h4>
            {categories.relations.length > 0 ? (
              <div className="space-y-3">
                {categories.relations.map((e) => (
                  <div key={e.key} className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded bg-slate-50 border border-slate-100 shadow-xs">
                      <LegendSymbol k={e.key} isPublication={true} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700">{e.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 italic block pt-1">None active</span>
            )}
          </div>
        </div>
        
        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[10px] text-slate-400">
          <span>Press <kbd className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono text-[9px] shadow-xs">Esc</kbd> to close modal</span>
          <span className="font-semibold text-primary/80">Pedigree PRO Publication Suite</span>
        </div>
      </div>
    </div>
  );

  if (!expanded) {
    return (
      <>
        <button
          type="button"
          aria-label="Open legend"
          onClick={() => setExpanded(true)}
          className={`absolute bottom-4 left-4 z-10 rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm shadow-lg p-2 hover:bg-accent transition-colors ${className}`}
        >
          <BookOpen className="w-4 h-4 text-muted-foreground" />
        </button>
        {showPubModal && renderPublicationModal()}
      </>
    );
  }

  return (
    <>
      <div className={`absolute bottom-4 left-4 z-10 rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm shadow-lg p-2 w-[180px] overflow-hidden ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            Legend
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="Publication Layout"
              onClick={() => setShowPubModal(true)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent/40"
              aria-label="Open publication legend"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
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
        </div>
        <div className="max-h-[240px] overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            {entries.map((e) => (
              <div key={e.key} className="flex items-center gap-2">
                <div className="flex-shrink-0 flex items-center justify-center w-[22px]">
                  <LegendSymbol k={e.key} />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {e.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showPubModal && renderPublicationModal()}
    </>
  );
}
