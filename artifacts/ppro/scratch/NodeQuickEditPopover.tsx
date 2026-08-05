import React, { useEffect, useRef, useState, useCallback } from "react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { X, ArrowRight } from "lucide-react";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";

interface NodeQuickEditPopoverProps {
  node: PedigreeNode;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onClose: () => void;
  onUpdateNode: (updates: Partial<PedigreeNode>) => void;
  onOpenSidebar: () => void;
}

export function NodeQuickEditPopover({
  node, svgRef, onClose, onUpdateNode, onOpenSidebar,
}: NodeQuickEditPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; placement: "left" | "right" } | null>(null);
  const [draft, setDraft] = useState(node.insideText ?? "");
  const { memo: { autoLabels } } = usePedigreeEditor();
  useEffect(() => {
    setDraft(node.insideText ?? "");
  }, [node.id, node.insideText]);

  useEffect(() => {
    // Select text on input mount or when node changes
    if (inputRef.current) {
      inputRef.current.select();
    }
  }, [node.id]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const screenX = ctm.a * node.x + ctm.e;
    const screenY = ctm.d * node.y + ctm.f;
    const pw = 330;
    const ph = 375;
    let placement: "left" | "right" = "right";
    let x = screenX + 36;
    let y = screenY - ph / 2;

    if (x + pw > window.innerWidth - 12) {
      const leftX = screenX - pw - 36;
      if (leftX >= 12) {
        x = leftX;
        placement = "left";
      } else {
        x = Math.max(12, window.innerWidth - pw - 12);
        placement = "right";
      }
    }

    // Clamp to viewport
    x = Math.max(12, Math.min(x, window.innerWidth - pw - 12));
    y = Math.max(12, Math.min(y, window.innerHeight - ph - 12));
    setPos({ x, y, placement });
  }, [node.x, node.y, svgRef]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  const applyInsideText = () => {
    const trimmed = draft.trim();
    if (trimmed !== (node.insideText ?? "")) onUpdateNode({ insideText: trimmed || undefined });
  };

  const handleStatusChange = (val: "unaffected" | "affected" | "carrier") => {
    onUpdateNode({ affected: val === "affected", carrier: val === "carrier" });
  };

  if (!pos) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[330px] border border-border/80 rounded-xl shadow-2xl bg-background/95 backdrop-blur-md p-4.5 outline-none animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] flex flex-col gap-3.5"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="Quick edit node"
    >
      {/* Anchor Caret Arrow */}
      <div
        className={`absolute w-2.5 h-2.5 bg-background border-l border-t border-border/80 z-[-1] transition-transform duration-300 ${
          pos.placement === "right"
            ? "-left-[6px] top-[calc(50%-5px)] rotate-[-45deg]"
            : "-right-[6px] top-[calc(50%-5px)] rotate-[135deg]"
        }`}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/25">
            <svg className="w-5 h-5 text-primary overflow-visible" viewBox="0 0 24 24" fill="none">
              {(() => {
                const sw = 2;
                const stroke = "currentColor";
                const fill = node.affected ? "currentColor" : "none";
                const r = 6;
                const cx = 12;
                const cy = 12;
                let shapeElement: React.ReactNode;
                if (node.type === "male") {
                  shapeElement = <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={fill} stroke={stroke} strokeWidth={sw} rx={0.5} />;
                } else if (node.type === "female") {
                  shapeElement = <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />;
                } else if (node.type === "sab") {
                  shapeElement = <polygon points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`} fill={fill} stroke={stroke} strokeWidth={sw} />;
                } else {
                  shapeElement = <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={fill} stroke={stroke} strokeWidth={sw} />;
                }
                return (
                  <g>
                    {shapeElement}
                    {node.carrier && !node.affected && (
                      <circle cx={cx} cy={cy} r={1.8} fill="hsl(var(--primary))" />
                    )}
                    {node.deceased && (
                      <line x1={3} y1={21} x2={21} y2={3} stroke="hsl(var(--foreground) / 0.6)" strokeWidth={1.5} />
                    )}
                    {node.proband && (
                      <g className="text-foreground">
                        <line x1={1} y1={23} x2={5} y2={19} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                        <polygon points="6,18 3.5,21.5 6.5,22.5" fill="currentColor" />
                      </g>
                    )}
                  </g>
                );
              })()}
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground">Quick Edit</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
              {(() => {
                const romanLabel = autoLabels.get(node.id);
                return romanLabel ? `ID: ${romanLabel}` : `Node ID: ${node.id}`;
              })()}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-90 group"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-90" />
        </button>
      </div>

      {/* SECTION 1: Basic Information */}
      <div className="flex flex-col gap-2.5">
        {/* Inside Text */}
        <div className="space-y-1">
          <label htmlFor="quick-inside-text" className="text-[10px] font-semibold text-foreground/80">Inside Text</label>
          <input
            ref={inputRef}
            id="quick-inside-text"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={applyInsideText}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyInsideText(); onClose(); } }}
            placeholder="e.g. 3"
            className="w-full bg-muted/20 border border-border/80 hover:border-border rounded-lg px-2.5 py-1.5 text-xs focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
            autoFocus
          />
        </div>

        {/* Type Segmented Controls */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider block">Type</label>
          <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
            {(["male", "female", "unknown", "pregnancy", "sab"] as const).map((t, idx) => {
              const isActive = node.type === t;
              const labelText = t === "sab" ? "SAB" : t.charAt(0).toUpperCase() + t.slice(1);
              return (
                <React.Fragment key={t}>
                  {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                  <button
                    type="button"
                    key={t}
                    onClick={() => onUpdateNode({ type: t })}
                    title={labelText}
                    className={`flex-1 py-1 rounded-md text-[10px] transition-all duration-200 border flex flex-col items-center justify-center gap-0.5 min-w-0 ${
                      isActive
                        ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      {(() => {
                        const sw = 2.2;
                        const r = 6;
                        const cx = 12;
                        const cy = 12;
                        if (t === "male") return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} strokeWidth={sw} rx={0.5} />;
                        if (t === "female") return <circle cx={cx} cy={cy} r={r} strokeWidth={sw} />;
                        if (t === "sab") return <polygon points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`} strokeWidth={sw} />;
                        return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} strokeWidth={sw} />;
                      })()}
                    </svg>
                    <span className="text-[8px] leading-none tracking-tight">{labelText}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <hr className="border-border/30 my-0.5" />

      {/* SECTION 2: Clinical Information */}
      <div className="flex flex-col gap-2.5">
        {/* Status Segmented Controls */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider block">Status</label>
          <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full">
            {([
              { value: "unaffected", label: "Unaffected" },
              { value: "affected", label: "Affected" },
              { value: "carrier", label: "Carrier" }
            ] as const).map((opt, idx) => {
              const isActive = (node.affected ? "affected" : node.carrier ? "carrier" : "unaffected") === opt.value;
              return (
                <React.Fragment key={opt.value}>
                  {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(opt.value)}
                    className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all border text-center ${
                      isActive
                        ? "bg-card text-primary border-border/75 shadow-xs font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                    }`}
                  >
                    {opt.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Genotype */}
        <div className="space-y-1">
          <label htmlFor="quick-node-genotype" className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider block">Genotype</label>
          <input
            id="quick-node-genotype"
            type="text"
            value={node.genotype ?? ""}
            onChange={(e) => onUpdateNode({ genotype: e.target.value || undefined })}
            placeholder="e.g. +/- or custom"
            className="w-full bg-muted/20 border border-border/80 hover:border-border rounded-lg px-2.5 py-1.5 text-xs focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
          />
          <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 items-stretch w-full mt-1.5">
            {(["+/-", "+/+", "-/-", "+/Y", "-/Y"] as const).map((g, idx) => {
              const isActive = node.genotype === g;
              return (
                <React.Fragment key={g}>
                  {idx > 0 && <div className="w-[1px] h-3.5 bg-border/50 shrink-0 self-center" />}
                  <button
                    type="button"
                    onClick={() => onUpdateNode({ genotype: isActive ? undefined : g })}
                    className={`flex-1 py-1 rounded-md text-[10px] border font-mono transition-all duration-200 ${
                      isActive
                        ? "bg-card text-primary border-border/75 shadow-xs font-bold"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/25"
                    }`}
                  >
                    {g}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <hr className="border-border/30 my-0.5" />

      {/* SECTION 3: Traits */}
      <div className="flex flex-col gap-2.5">

        <div className="grid grid-cols-3 gap-1.5">
          {([
            { key: "carrier" as const, label: "Carrier" },
            { key: "deceased" as const, label: "Deceased" },
            { key: "proband" as const, label: "Proband" },
          ]).map(({ key, label }) => {
            const isActive = !!node[key];
            return (
              <button
                type="button"
                key={key}
                onClick={() => onUpdateNode({ [key]: !node[key] })}
                className={`py-1.5 rounded-md text-[11px] transition-all duration-200 border flex items-center justify-center gap-1.5 ${
                  isActive
                    ? "border-primary text-primary bg-primary/10 font-semibold shadow-xs"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:bg-background/25 bg-background"
                }`}
              >
                <span className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-all ${
                  isActive ? "border-primary bg-primary text-white" : "border-border bg-muted/20"
                }`}>
                  {isActive && (
                    <svg width="8" height="8" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <button
        type="button"
        onClick={() => { onClose(); onOpenSidebar(); }}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground hover:text-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 border-t border-border/40 pt-2.5"
      >
        More options in sidebar <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
