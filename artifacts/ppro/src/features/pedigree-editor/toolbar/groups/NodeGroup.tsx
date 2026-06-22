import { useState } from "react";
import { Baby, MoreHorizontal, Square, Circle, Diamond, Sparkles } from "lucide-react";
import { NodeIcon } from "@/features/pedigree-editor/toolbar/NodeIcon";
import type { PedigreeNode, CanvasData } from "@/features/pedigree-editor/canvas/types";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { PedigreeWizardDialog } from "./PedigreeWizardDialog";

interface NodeGroupProps {
  addNode: (type: PedigreeNode["type"]) => void;
  labelHidden?: boolean;
  updateCanvas: (updater: (prev: CanvasData) => CanvasData) => void;
  canvasNodes: any[];
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
  runAutoLayout: (respectPinned: boolean, isManual?: boolean, selectedOnly?: boolean) => void;
}

export function NodeGroup({
  addNode,
  labelHidden = false,
  updateCanvas,
  canvasNodes,
  openConfirm,
  runAutoLayout,
}: NodeGroupProps) {
  const [showMoreNodes, setShowMoreNodes] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        {(["male", "female"] as const).map((t) => (
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
            </div>
            <span className="text-[11px] capitalize leading-tight font-medium">{(t[0] ?? "").toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
        <Popover open={showMoreNodes} onOpenChange={setShowMoreNodes}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="More node types"
              aria-label="More node types"
              className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded transition-colors ${showMoreNodes ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <MoreHorizontal className="w-5 h-5" />
              </div>
              <span className="text-[11px] leading-tight font-medium">More</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={4}
            className="w-44 p-0 bg-popover border border-border shadow-lg rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <div className="px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-widest border-b border-border">Rare types</div>
            <button type="button" onClick={() => { addNode("pregnancy"); setShowMoreNodes(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left">
              <Baby className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div><div className="font-medium">Pregnancy</div><div className="text-xs text-muted-foreground">Shortcut: P</div></div>
            </button>
            <button type="button" onClick={() => { addNode("sab"); setShowMoreNodes(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left border-t border-border">
              <NodeIcon type="sab" />
              <div><div className="font-medium">SAB / Stillbirth</div><div className="text-xs text-muted-foreground">Shortcut: S</div></div>
            </button>
            <button
              type="button"
              data-testid="button-add-unknown"
              onClick={() => { addNode("unknown"); setShowMoreNodes(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left border-t border-border"
            >
              <Diamond className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div><div className="font-medium">Unknown</div><div className="text-xs text-muted-foreground">Shortcut: U</div></div>
            </button>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          data-testid="button-wizard"
          onClick={() => { setShowWizard(true); }}
          title="Pedigree wizard builder"
          aria-label="Pedigree wizard builder"
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${
            showWizard ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <span className="text-[11px] leading-tight font-medium">Wizard</span>
        </button>

        <PedigreeWizardDialog
          open={showWizard}
          onClose={() => setShowWizard(false)}
          updateCanvas={updateCanvas}
          canvasNodes={canvasNodes}
          openConfirm={openConfirm}
          runAutoLayout={runAutoLayout}
        />
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Nodes</div>}
    </div>
  );
}
