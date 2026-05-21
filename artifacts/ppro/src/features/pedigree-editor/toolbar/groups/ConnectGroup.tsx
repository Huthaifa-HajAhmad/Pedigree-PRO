import { Link2, GitBranch, GitMerge } from "lucide-react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

interface ConnectGroupProps {
  linkMode: "couple" | "parent-child" | "consanguinity" | null;
  setLinkMode: (mode: "couple" | "parent-child" | "consanguinity" | null) => void;
  setLinkSource: (sourceId: string | null) => void;
  selectedIds: Set<string>;
  canvasNodes: PedigreeNode[];
  createConsanguinityEdge: (sourceId: string, targetId: string) => void;
  labelHidden?: boolean;
}

export function ConnectGroup({ linkMode, setLinkMode, setLinkSource, selectedIds, canvasNodes, createConsanguinityEdge, labelHidden = false }: ConnectGroupProps) {
  const handleConsanguinityClick = () => {
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
  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button
          type="button"
          data-testid="button-link-couple"
          onClick={() => { setLinkMode(linkMode === "couple" ? null : "couple"); setLinkSource(null); }}
          title="Draw couple link — click two nodes"
          aria-label="Draw couple link"
          aria-pressed={linkMode === "couple"}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${linkMode === "couple" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <Link2 className="w-5 h-5" />
          <span>Couple</span>
        </button>
        <button
          type="button"
          data-testid="button-link-child"
          onClick={() => { setLinkMode(linkMode === "parent-child" ? null : "parent-child"); setLinkSource(null); }}
          title="Draw parent to child link"
          aria-label="Draw parent to child link"
          aria-pressed={linkMode === "parent-child"}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${linkMode === "parent-child" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <GitBranch className="w-5 h-5" />
          <span>Parent-Child</span>
        </button>
        <button
          type="button"
          data-testid="button-link-consanguinity"
          onClick={handleConsanguinityClick}
          title="Draw consanguinity link — select 2 opposite-gender nodes, or click then pick second node"
          aria-label="Draw consanguinity link"
          aria-pressed={linkMode === "consanguinity"}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${linkMode === "consanguinity" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <GitMerge className="w-5 h-5" />
          <span>Consanguinity</span>
        </button>
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Connect</div>}
    </div>
  );
}
