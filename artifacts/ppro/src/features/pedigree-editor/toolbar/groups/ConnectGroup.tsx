import { useState, useEffect, useRef, useCallback } from "react";
import { Link2, GitBranch, GitMerge, MoreHorizontal } from "lucide-react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

interface ConnectGroupProps {
  linkMode: "couple" | "parent-child" | "consanguinity" | null;
  setLinkMode: (mode: "couple" | "parent-child" | "consanguinity" | null) => void;
  setLinkSource: (sourceId: string | null) => void;
  selectedIds: Set<string>;
  canvasNodes: PedigreeNode[];
  canvasEdges: { type: string; sourceId: string; targetId: string }[];
  createConsanguinityEdge: (sourceId: string, targetId: string) => void;
  createCoupleEdge: (sourceId: string, targetId: string) => void;
  twinSelectMode: boolean;
  twinCandidateIds: Set<string>;
  toggleTwinSelectMode: () => void;
  markAsTwins: (nodeIds: string[], twinType: "m" | "d") => void;
  clearTwinCandidates: () => void;
  labelHidden?: boolean;
}

function useDropdownPosition(ref: React.RefObject<HTMLButtonElement | null>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, [ref]);
  return { pos, measure };
}

export function ConnectGroup({
  linkMode, setLinkMode, setLinkSource, selectedIds, canvasNodes, canvasEdges,
  createConsanguinityEdge, createCoupleEdge, twinSelectMode, twinCandidateIds, toggleTwinSelectMode,
  markAsTwins, clearTwinCandidates, labelHidden = false,
}: ConnectGroupProps) {
  const [showTwinDropdown, setShowTwinDropdown] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const twinRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const { pos: twinPos, measure: measureTwin } = useDropdownPosition(twinRef);
  const { pos: morePos, measure: measureMore } = useDropdownPosition(moreRef);

  useEffect(() => {
    if (!showTwinDropdown) return;
    measureTwin();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowTwinDropdown(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showTwinDropdown, measureTwin]);

  useEffect(() => {
    if (!showMoreDropdown) return;
    measureMore();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowMoreDropdown(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showMoreDropdown, measureMore]);

  const handleConsanguinityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.size === 2) {
      const ids = [...selectedIds];
      const idA = ids[0]!, idB = ids[1]!;
      const nA = canvasNodes.find((n) => n.id === idA);
      const nB = canvasNodes.find((n) => n.id === idB);
      if (nA && nB && ((nA.type === "male" && nB.type === "female") || (nA.type === "female" && nB.type === "male"))) {
        createConsanguinityEdge(idA, idB);
        return;
      }
    }
    setLinkMode(linkMode === "consanguinity" ? null : "consanguinity");
    setLinkSource(null);
  };

  const handleCoupleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.size === 2) {
      const ids = [...selectedIds];
      createCoupleEdge(ids[0]!, ids[1]!);
      return;
    }
    setLinkMode(linkMode === "couple" ? null : "couple");
    setLinkSource(null);
    setShowMoreDropdown(false);
  };

  const areSelectedNodesSiblings = (): boolean => {
    if (selectedIds.size < 2) return false;
    const ids = [...selectedIds];
    const parentSets = ids.map((id) => {
      const parents = new Set<string>();
      for (const e of canvasEdges) {
        if (e.type === "parent-child" && e.targetId === id) {
          parents.add(e.sourceId);
        }
      }
      return parents;
    });
    // Check if all selected nodes share at least one common parent
    const firstParents = parentSets[0];
    if (!firstParents || firstParents.size === 0) return false;
    return parentSets.every((ps) => {
      for (const p of firstParents) {
        if (ps.has(p)) return true;
      }
      return false;
    });
  };

  const handleTwinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showTwinDropdown) {
      setShowTwinDropdown(false);
      return;
    }
    if (twinSelectMode) {
      if (twinCandidateIds.size >= 2) {
        setShowTwinDropdown(true);
      } else {
        toggleTwinSelectMode(); // exit mode if less than 2 candidates
      }
      return;
    }
    if (selectedIds.size >= 2 && areSelectedNodesSiblings()) {
      setShowTwinDropdown(true);
      return;
    }
    toggleTwinSelectMode();
  };

  const handlePickTwin = (type: "m" | "d") => {
    const ids = twinSelectMode ? [...twinCandidateIds] : [...selectedIds];
    markAsTwins(ids, type);
    setShowTwinDropdown(false);
    if (twinSelectMode) {
      toggleTwinSelectMode();
    }
  };

  // Auto-show twin type dropdown when 2+ candidates are selected in twin select mode
  useEffect(() => {
    if (twinSelectMode && twinCandidateIds.size >= 2 && !showTwinDropdown) {
      setShowTwinDropdown(true);
    }
  }, [twinSelectMode, twinCandidateIds.size, showTwinDropdown]);

  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2 relative">
      <div className="flex-1 flex items-center gap-1">
        <button
          type="button"
          data-testid="button-link-consanguinity"
          onClick={handleConsanguinityClick}
          onMouseDown={(e) => e.stopPropagation()}
          title="Draw consanguinity link — select 2 opposite-gender nodes, or click then pick second node"
          aria-label="Draw consanguinity link"
          aria-pressed={linkMode === "consanguinity"}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${linkMode === "consanguinity" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <GitMerge className="w-5 h-5" />
          <span>Consanguinity</span>
        </button>

        <button
          type="button"
          data-testid="button-twin"
          ref={twinRef}
          onClick={handleTwinClick}
          title={twinSelectMode ? `Twin select mode — ${twinCandidateIds.size} nodes selected` : "Mark twins — select 2+ siblings or enter twin select mode"}
          aria-label="Mark twins"
          aria-pressed={twinSelectMode}
          className={`flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${twinSelectMode ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <div className="relative w-6 h-6">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7.8" cy="7.8" r="3.84" />
              <path d="M7.8 12 v5.4 M5.4 16.2 h4.8" />
              <circle cx="16.2" cy="7.8" r="3.84" />
              <path d="M16.2 12 v5.4 M13.8 16.2 h4.8" />
            </svg>
            {twinSelectMode && twinCandidateIds.size > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-amber-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                {twinCandidateIds.size}
              </span>
            )}
          </div>
          <span>Twin</span>
        </button>

        <button
          type="button"
          ref={moreRef}
          onClick={(e) => { e.stopPropagation(); setShowMoreDropdown((v) => !v); }}
          title="More connection types"
          aria-label="More connection types"
          aria-expanded={showMoreDropdown}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${showMoreDropdown ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span>More</span>
        </button>
      </div>

      {showTwinDropdown && twinPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowTwinDropdown(false); }} />
          <div className="fixed z-50 border border-border rounded-md shadow-lg overflow-hidden w-48 bg-popover" style={{ top: twinPos.top, left: twinPos.left }} onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-widest border-b border-border">Twin type</div>
            <button type="button" onClick={(e) => { e.stopPropagation(); handlePickTwin("m"); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-accent transition-colors text-left">
              <span className="font-medium">Identical twins (MZ)</span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); handlePickTwin("d"); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-accent transition-colors text-left border-t border-border">
              <span className="font-medium">Fraternal twins (DZ)</span>
            </button>
          </div>
        </>
      )}

      {showMoreDropdown && morePos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMoreDropdown(false)} />
          <div className="fixed z-50 border border-border rounded-md shadow-lg overflow-hidden w-44 bg-popover" style={{ top: morePos.top, left: morePos.left }}>
            <div className="px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-widest border-b border-border">More connections</div>
            <button
              type="button"
              data-testid="button-link-couple"
              onClick={handleCoupleClick}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left ${linkMode === "couple" ? "text-primary bg-primary/5" : ""}`}
            >
              <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div><div className="font-medium">Couple</div><div className="text-xs text-muted-foreground">Click two nodes</div></div>
            </button>
            <button
              type="button"
              data-testid="button-link-child"
              onClick={(e) => { e.stopPropagation(); setLinkMode(linkMode === "parent-child" ? null : "parent-child"); setLinkSource(null); setShowMoreDropdown(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left border-t border-border ${linkMode === "parent-child" ? "text-primary bg-primary/5" : ""}`}
            >
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div><div className="font-medium">Parent-Child</div><div className="text-xs text-muted-foreground">Click parent then child</div></div>
            </button>
          </div>
        </>
      )}

      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Connect</div>}
    </div>
  );
}
