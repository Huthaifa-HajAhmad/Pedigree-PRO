import { useState } from "react";
import { Plus, ChevronDown, Baby } from "lucide-react";
import { NodeIcon } from "@/features/pedigree-editor/toolbar/NodeIcon";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

interface NodeGroupProps {
  addNode: (type: PedigreeNode["type"]) => void;
  labelHidden?: boolean;
}

export function NodeGroup({ addNode, labelHidden = false }: NodeGroupProps) {
  const [showMoreNodes, setShowMoreNodes] = useState(false);

  return (
    <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex items-center gap-0.5">
        {(["male", "female", "unknown"] as const).map((t) => (
          <button
            type="button"
            key={t}
            data-testid={`button-add-${t}`}
            onClick={() => addNode(t)}
            title={`Add ${t} (${(t[0] ?? "").toUpperCase()})`}
            aria-label={`Add ${t} node`}
            className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {t === "male" && <NodeIcon type="male" />}
            {t === "female" && <NodeIcon type="female" />}
            {t === "unknown" && <NodeIcon type="unknown" />}
            <span className="text-xs capitalize leading-none">{t}</span>
          </button>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreNodes((v) => !v)}
            title="More node types (Pregnancy, SAB)"
            aria-label="More node types"
            className={`flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${showMoreNodes ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <Plus className="w-3 h-3" />
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {showMoreNodes && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreNodes(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 border border-border rounded-md shadow-lg overflow-hidden w-44 bg-popover">
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
      </div>
      {!labelHidden && <div className="text-xs text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Nodes</div>}
    </div>
  );
}
