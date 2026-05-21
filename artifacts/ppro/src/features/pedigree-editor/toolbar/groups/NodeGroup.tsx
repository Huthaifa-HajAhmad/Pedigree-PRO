import { useState, useEffect, useRef, useCallback } from "react";
import { Baby, MoreHorizontal, Square, Circle, Diamond } from "lucide-react";
import { NodeIcon } from "@/features/pedigree-editor/toolbar/NodeIcon";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

interface NodeGroupProps {
  addNode: (type: PedigreeNode["type"]) => void;
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

export function NodeGroup({ addNode, labelHidden = false }: NodeGroupProps) {
  const [showMoreNodes, setShowMoreNodes] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const { pos: morePos, measure: measureMore } = useDropdownPosition(moreRef);

  useEffect(() => {
    if (!showMoreNodes) return;
    measureMore();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowMoreNodes(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showMoreNodes, measureMore]);

  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        {(["male", "female", "unknown"] as const).map((t) => (
          <button
            type="button"
            key={t}
            data-testid={`button-add-${t}`}
            onClick={() => addNode(t)}
            title={`Add ${t} node (${(t[0] ?? "").toUpperCase()})`}
            aria-label={`Add ${t} node`}
            className="flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              {t === "male" && <Square className="w-5 h-5" />}
              {t === "female" && <Circle className="w-5 h-5" />}
              {t === "unknown" && <Diamond className="w-5 h-5" />}
            </div>
            <span className="text-[11px] capitalize leading-tight font-medium">{(t[0] ?? "").toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
        <button
          type="button"
          ref={moreRef}
          onClick={() => setShowMoreNodes((v) => !v)}
          title="More node types"
          aria-label="More node types"
          aria-expanded={showMoreNodes}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${showMoreNodes ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span className="text-[11px] leading-tight font-medium">More</span>
        </button>
        {showMoreNodes && morePos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMoreNodes(false)} />
            <div className="fixed z-50 border border-border rounded-md shadow-lg overflow-hidden w-44 bg-popover" style={{ top: morePos.top, left: morePos.left }}>
              <div className="px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-widest border-b border-border">Rare types</div>
              <button type="button" onClick={() => { addNode("pregnancy"); setShowMoreNodes(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left">
                <Baby className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div><div className="font-medium">Pregnancy</div><div className="text-xs text-muted-foreground">Shortcut: P</div></div>
              </button>
              <button type="button" onClick={() => { addNode("sab"); setShowMoreNodes(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left border-t border-border">
                <NodeIcon type="sab" />
                <div><div className="font-medium">SAB / Stillbirth</div><div className="text-xs text-muted-foreground">Shortcut: S</div></div>
              </button>
            </div>
          </>
        )}
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Nodes</div>}
    </div>
  );
}
