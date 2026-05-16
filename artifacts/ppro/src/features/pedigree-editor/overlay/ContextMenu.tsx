import { useEffect, useRef, useMemo } from "react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import {
  Square, Circle, Diamond, Baby, AlertTriangle,
  CheckCircle2, CircleDot, X, Star, ArrowDown, ArrowRight,
  ArrowLeftRight, Link2, GitBranch, GitMerge, Trash2,
} from "lucide-react";

const ICON_CLS = "w-3 h-3 flex-shrink-0";

function TypeIcon({ type }: { type: PedigreeNode["type"] }) {
  switch (type) {
    case "male":       return <Square className={ICON_CLS} />;
    case "female":     return <Circle className={ICON_CLS} />;
    case "unknown":    return <Diamond className={ICON_CLS} />;
    case "pregnancy":  return <Baby className={ICON_CLS} />;
    case "sab":        return <AlertTriangle className={ICON_CLS} />;
  }
}

export function ContextMenu({
  ctxNode,
  canvasEdges,
  canvasNodes,
  position,
  onClose,
  onSetNodeType,
  onToggleNodeProp,
  onAddContextNode,
  onDeleteSelected,
  onSetLinkMode,
}: {
  ctxNode: PedigreeNode;
  canvasEdges: PedigreeEdge[];
  canvasNodes: PedigreeNode[];
  position: { x: number; y: number };
  onClose: () => void;
  onSetNodeType: (nodeId: string, type: PedigreeNode["type"]) => void;
  onToggleNodeProp: (nodeId: string, prop: "affected" | "carrier" | "deceased" | "proband") => void;
  onAddContextNode: (relationship: "child" | "sibling" | "partner") => void;
  onDeleteSelected: () => void;
  onSetLinkMode: (mode: "couple" | "parent-child" | "consanguinity", sourceId: string) => void;
}) {
  const isMale      = ctxNode.type === "male";
  const isPregnancy = ctxNode.type === "pregnancy";
  const isSab       = ctxNode.type === "sab";
  const isEndpoint  = isPregnancy || isSab;

  const { partnerEdges, hasPartner, hasParents, hasChildren, otherProband } = useMemo(() => {
    const pEdges = canvasEdges.filter(
      (e) => e.type === "couple" && (e.sourceId === ctxNode.id || e.targetId === ctxNode.id)
    );
    return {
      partnerEdges: pEdges,
      hasPartner: pEdges.length > 0,
      hasParents: canvasEdges.some((e) => e.type === "parent-child" && e.targetId === ctxNode.id),
      hasChildren: canvasEdges.some((e) => e.type === "parent-child" && e.sourceId === ctxNode.id),
      otherProband: canvasNodes.find((n) => n.proband && n.id !== ctxNode.id),
    };
  }, [canvasEdges, canvasNodes, ctxNode.id]);

  const menuW = 220;
  const ax = position.x + menuW > window.innerWidth  ? position.x - menuW : position.x;
  const ay = position.y > window.innerHeight - 480 ? Math.max(8, position.y - 480) : position.y;

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    menu.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([class*="opacity-40"])'));
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        items[Math.min(currentIndex + 1, items.length - 1)]?.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        items[Math.max(currentIndex - 1, 0)]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          items[currentIndex <= 0 ? items.length - 1 : currentIndex - 1]?.focus();
        } else {
          items[currentIndex >= items.length - 1 ? 0 : currentIndex + 1]?.focus();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    menu.addEventListener("keydown", onKeyDown);
    const onResize = () => onClose();
    window.addEventListener("resize", onResize);
    return () => {
      menu.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [onClose]);

  const btn  = "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2";
  const abtn = btn + " text-primary font-medium";
  const dbtn = btn + " text-red-400 hover:text-red-300";
  const mbtn = btn + " opacity-40 cursor-not-allowed pointer-events-none";
  const sep  = <div className="border-t border-border my-0.5" />;
  const grp  = (label: string, hint?: string) => (
    <div className="px-3 pt-2 pb-0.5 flex items-baseline gap-1.5">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {hint && <span className="text-xs text-muted-foreground/60 italic">{hint}</span>}
    </div>
  );

  const contextSummary = [
    hasPartner && `${partnerEdges.length} partner${partnerEdges.length > 1 ? "s" : ""}`,
    hasParents && "has parents",
    hasChildren && "has children",
  ].filter(Boolean).join(" · ");

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }} role="presentation" />
      <div className="fixed z-50 min-w-[220px] max-h-[80vh] overflow-y-auto border border-border rounded-lg shadow-2xl bg-popover"
        ref={menuRef}
        role="menu" aria-label="Node context menu"
        tabIndex={0}
        style={{ left: ax, top: ay }}>

        {/* Header */}
        <div className="px-3 py-2 border-b border-border sticky top-0 bg-popover z-10">
          <div className="flex items-center gap-2">
            <TypeIcon type={ctxNode.type} />
            <div>
              <div className="text-xs font-medium capitalize text-foreground">
                {ctxNode.label || ctxNode.type}
              </div>
              {contextSummary && (
                <div className="text-xs text-muted-foreground mt-0.5">{contextSummary}</div>
              )}
            </div>
          </div>
        </div>

        {/* Set Type */}
        {grp("Set Type")}
        {ctxNode.type !== "male"     && <button type="button" role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "male");     onClose(); }}><Square className={ICON_CLS} /> Male</button>}
        {ctxNode.type !== "female"   && <button type="button" role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "female");   onClose(); }}><Circle className={ICON_CLS} /> Female</button>}
        {ctxNode.type !== "unknown"  && <button type="button" role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "unknown");  onClose(); }}><Diamond className={ICON_CLS} /> Unknown sex</button>}
        {ctxNode.type !== "pregnancy" && !isMale && !isSab && (
          <button type="button" role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "pregnancy"); onClose(); }}><Baby className={ICON_CLS} /> Pregnancy</button>
        )}
        {isMale && (
          <button type="button" role="menuitem" className={mbtn} title="Males cannot carry a pregnancy"><Baby className={ICON_CLS} /> Pregnancy <span className="ml-auto text-xs">N/A</span></button>
        )}
        {ctxNode.type !== "sab" && !isPregnancy && (
          <button type="button" role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "sab"); onClose(); }}><AlertTriangle className={ICON_CLS} /> SAB / Stillbirth</button>
        )}
        {isPregnancy && (
          <button type="button" role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "sab"); onClose(); }}><AlertTriangle className={ICON_CLS} /> Mark as Loss (SAB)</button>
        )}

        {sep}

        {/* Status */}
        {grp("Status")}
        <button type="button" role="menuitem" className={ctxNode.affected ? abtn : btn} onClick={() => { onToggleNodeProp(ctxNode.id, "affected"); onClose(); }}>
          {ctxNode.affected ? <CheckCircle2 className={`${ICON_CLS} text-primary`} /> : <Circle className={ICON_CLS} />}
          {ctxNode.affected ? "Unmark Affected" : "Mark Affected"}
        </button>
        {!isSab ? (
          <button type="button" role="menuitem" className={ctxNode.carrier ? abtn : btn} onClick={() => { onToggleNodeProp(ctxNode.id, "carrier"); onClose(); }}>
            {ctxNode.carrier ? <CircleDot className={`${ICON_CLS} text-primary`} /> : <Circle className={ICON_CLS} />}
            {ctxNode.carrier ? "Unmark Carrier" : "Mark Carrier"}
          </button>
        ) : (
          <button type="button" role="menuitem" className={mbtn} title="SABs are not marked as carriers">
            <Circle className={ICON_CLS} />Carrier <span className="ml-auto text-xs">N/A</span>
          </button>
        )}
        {!isEndpoint ? (
          <button type="button" role="menuitem" className={ctxNode.deceased ? abtn : btn} onClick={() => { onToggleNodeProp(ctxNode.id, "deceased"); onClose(); }}>
            {ctxNode.deceased ? <X className={`${ICON_CLS} text-primary`} /> : <Circle className={ICON_CLS} />}
            {ctxNode.deceased ? "Unmark Deceased" : "Mark Deceased"}
          </button>
        ) : (
          <button type="button" role="menuitem" className={mbtn} title={isPregnancy ? "Deceased pregnancy should be SAB" : "SAB implies deceased"}>
            <X className={ICON_CLS} />Deceased
            <span className="ml-auto text-xs">{isPregnancy ? "→ use SAB" : "implicit"}</span>
          </button>
        )}
        {!isSab ? (
          <button type="button" role="menuitem" className={ctxNode.proband ? abtn : btn} onClick={() => { onToggleNodeProp(ctxNode.id, "proband"); onClose(); }}>
            {ctxNode.proband ? <Star className={`${ICON_CLS} text-primary`} /> : <Circle className={ICON_CLS} />}
            {ctxNode.proband ? "Remove Proband" : otherProband ? "Set Proband (replace)" : "Set as Proband"}
          </button>
        ) : (
          <button type="button" role="menuitem" className={mbtn}><Star className={ICON_CLS} />Proband <span className="ml-auto text-xs">N/A</span></button>
        )}

        {sep}

        {/* Add Related */}
        {grp("Add Related")}
        {!isEndpoint ? (
          <button type="button" role="menuitem" className={btn} onClick={() => { onAddContextNode("child"); onClose(); }}>
            <ArrowDown className={ICON_CLS} /> Add Child <span className="ml-auto text-muted-foreground text-xs">C</span>
          </button>
        ) : (
          <button type="button" role="menuitem" className={mbtn} title={`${ctxNode.type}s cannot parent children`}>
            <ArrowDown className={ICON_CLS} /> Add Child <span className="ml-auto text-xs">N/A</span>
          </button>
        )}
        {!isEndpoint ? (
          <button type="button" role="menuitem" className={btn} onClick={() => { onAddContextNode("partner"); onClose(); }}>
            <ArrowRight className={ICON_CLS} /> {hasPartner ? "Add Another Partner" : "Add Partner"}
            <span className="ml-auto text-muted-foreground text-xs">R</span>
          </button>
        ) : (
          <button type="button" role="menuitem" className={mbtn} title={`${ctxNode.type}s don't form couple links`}>
            <ArrowRight className={ICON_CLS} /> Add Partner <span className="ml-auto text-xs">N/A</span>
          </button>
        )}
        <button type="button" role="menuitem" className={btn} onClick={() => { onAddContextNode("sibling"); onClose(); }}>
          <ArrowLeftRight className={ICON_CLS} /> Add Sibling
          {!hasParents && <span className="ml-1 text-xs text-muted-foreground">(no parents yet)</span>}
          <span className="ml-auto text-muted-foreground text-xs">B</span>
        </button>

        {sep}

        {/* Connect */}
        {grp("Connect", isEndpoint ? "limited" : undefined)}
        {!isEndpoint ? (
          <button type="button" role="menuitem" className={btn} onClick={() => { onSetLinkMode("couple", ctxNode.id); onClose(); }}>
            <Link2 className={ICON_CLS} /> Couple link to…
          </button>
        ) : (
          <button type="button" role="menuitem" className={mbtn}><Link2 className={ICON_CLS} /> Couple link <span className="ml-auto text-xs">N/A</span></button>
        )}
        {!isEndpoint ? (
          <button type="button" role="menuitem" className={btn} onClick={() => { onSetLinkMode("parent-child", ctxNode.id); onClose(); }}>
            <GitBranch className={ICON_CLS} /> Parent→Child from here
          </button>
        ) : (
          <button type="button" role="menuitem" className={mbtn}><GitBranch className={ICON_CLS} /> Parent→Child <span className="ml-auto text-xs">N/A</span></button>
        )}
        {!isEndpoint ? (
          <button type="button" role="menuitem" className={btn} onClick={() => { onSetLinkMode("consanguinity", ctxNode.id); onClose(); }}>
            <GitMerge className={ICON_CLS} /> Consanguinity to…
          </button>
        ) : (
          <button type="button" role="menuitem" className={mbtn}><GitMerge className={ICON_CLS} /> Consanguinity <span className="ml-auto text-xs">N/A</span></button>
        )}

        {sep}

        {/* Danger */}
        <button type="button" role="menuitem" className={dbtn} onClick={() => { onClose(); onDeleteSelected(); }}>
          <Trash2 className={`${ICON_CLS} text-red-400`} />
          Delete {hasChildren || hasPartner ? [hasChildren && "children links", hasPartner && "couple link"].filter(Boolean).join(" & ") : "Node"}
        </button>
      </div>
    </>
  );
}
