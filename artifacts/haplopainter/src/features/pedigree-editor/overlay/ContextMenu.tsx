import { useEffect, useRef } from "react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

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

  const partnerEdges = canvasEdges.filter(
    (e) => e.type === "couple" && (e.sourceId === ctxNode.id || e.targetId === ctxNode.id)
  );
  const hasPartner   = partnerEdges.length > 0;
  const hasParents   = canvasEdges.some((e) => e.type === "parent-child" && e.targetId === ctxNode.id);
  const hasChildren  = canvasEdges.some((e) => e.type === "parent-child" && e.sourceId === ctxNode.id);
  const otherProband = canvasNodes.find((n) => n.proband && n.id !== ctxNode.id);

  const menuW = 220;
  const menuH = 480;
  const ax = position.x + menuW > window.innerWidth  ? position.x - menuW : position.x;
  const ay = position.y + menuH > window.innerHeight ? position.y - menuH : position.y;

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([class*="opacity-40"])'));
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = currentIndex < items.length - 1 ? items[currentIndex + 1] : items[0];
        next?.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = currentIndex > 0 ? items[currentIndex - 1] : items[items.length - 1];
        prev?.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    menu.addEventListener("keydown", onKeyDown);
    return () => menu.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const btn  = "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2";
  const abtn = btn + " text-primary font-medium";
  const dbtn = btn + " text-red-400 hover:text-red-300";
  const mbtn = btn + " opacity-40 cursor-not-allowed pointer-events-none";
  const sep  = <div className="border-t border-border my-0.5" />;
  const grp  = (label: string, hint?: string) => (
    <div className="px-3 pt-2 pb-0.5 flex items-baseline gap-1.5">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {hint && <span className="text-[8px] text-muted-foreground/60 italic">{hint}</span>}
    </div>
  );
  const typeIcon = (t: string) =>
    t === "male" ? "□" : t === "female" ? "○" : t === "unknown" ? "◇" : t === "pregnancy" ? "◈" : "△";

  const contextSummary = [
    hasPartner && `${partnerEdges.length} partner${partnerEdges.length > 1 ? "s" : ""}`,
    hasParents && "has parents",
    hasChildren && "has children",
  ].filter(Boolean).join(" · ");

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }} role="presentation" />
      <div className="fixed z-50 min-w-[220px] border border-border rounded-lg shadow-2xl overflow-hidden"
        ref={menuRef}
        role="menu" aria-label="Node context menu"
        style={{ left: ax, top: ay, background: "hsl(var(--popover))" }}>

        {/* Header */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{typeIcon(ctxNode.type)}</span>
            <div>
              <div className="text-xs font-medium capitalize text-foreground">
                {ctxNode.label || ctxNode.type}
              </div>
              {contextSummary && (
                <div className="text-[9px] text-muted-foreground mt-0.5">{contextSummary}</div>
              )}
            </div>
          </div>
        </div>

        {/* Set Type */}
        {grp("Set Type")}
        {ctxNode.type !== "male"     && <button role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "male");     onClose(); }}>□ Male</button>}
        {ctxNode.type !== "female"   && <button role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "female");   onClose(); }}>○ Female</button>}
        {ctxNode.type !== "unknown"  && <button role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "unknown");  onClose(); }}>◇ Unknown sex</button>}
        {ctxNode.type !== "pregnancy" && !isMale && !isSab && (
          <button role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "pregnancy"); onClose(); }}>◈ Pregnancy</button>
        )}
        {isMale && (
          <button role="menuitem" className={mbtn} title="Males cannot carry a pregnancy">◈ Pregnancy <span className="ml-auto text-[9px]">N/A</span></button>
        )}
        {ctxNode.type !== "sab" && !isPregnancy && (
          <button role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "sab"); onClose(); }}>△ SAB / Stillbirth</button>
        )}
        {isPregnancy && (
          <button role="menuitem" className={btn} onClick={() => { onSetNodeType(ctxNode.id, "sab"); onClose(); }}>△ Mark as Loss (SAB)</button>
        )}

        {sep}

        {/* Status */}
        {grp("Status")}
        <button role="menuitem" className={ctxNode.affected ? abtn : btn} onClick={() => { onToggleNodeProp(ctxNode.id, "affected"); onClose(); }}>
          <span className="w-3">{ctxNode.affected ? "✓" : "○"}</span>
          {ctxNode.affected ? "Unmark Affected" : "Mark Affected"}
        </button>
        {!isSab ? (
          <button role="menuitem" className={ctxNode.carrier ? abtn : btn} onClick={() => { onToggleNodeProp(ctxNode.id, "carrier"); onClose(); }}>
            <span className="w-3">{ctxNode.carrier ? "✓" : "○"}</span>
            {ctxNode.carrier ? "Unmark Carrier" : "Mark Carrier"}
          </button>
        ) : (
          <button role="menuitem" className={mbtn} title="SABs are not marked as carriers">
            <span className="w-3">○</span>Carrier <span className="ml-auto text-[9px]">N/A</span>
          </button>
        )}
        {!isEndpoint ? (
          <button role="menuitem" className={ctxNode.deceased ? abtn : btn} onClick={() => { onToggleNodeProp(ctxNode.id, "deceased"); onClose(); }}>
            <span className="w-3">{ctxNode.deceased ? "✓" : "○"}</span>
            {ctxNode.deceased ? "Unmark Deceased" : "Mark Deceased"}
          </button>
        ) : (
          <button role="menuitem" className={mbtn} title={isPregnancy ? "Deceased pregnancy should be SAB" : "SAB implies deceased"}>
            <span className="w-3">○</span>Deceased
            <span className="ml-auto text-[9px]">{isPregnancy ? "→ use SAB" : "implicit"}</span>
          </button>
        )}
        {!isSab ? (
          <button role="menuitem" className={ctxNode.proband ? abtn : btn} onClick={() => { onToggleNodeProp(ctxNode.id, "proband"); onClose(); }}>
            <span className="w-3">{ctxNode.proband ? "✓" : "○"}</span>
            {ctxNode.proband ? "Remove Proband" : otherProband ? "Set Proband (replace)" : "Set as Proband"}
          </button>
        ) : (
          <button role="menuitem" className={mbtn}><span className="w-3">○</span>Proband <span className="ml-auto text-[9px]">N/A</span></button>
        )}

        {sep}

        {/* Add Related */}
        {grp("Add Related")}
        {!isEndpoint ? (
          <button role="menuitem" className={btn} onClick={() => { onAddContextNode("child"); onClose(); }}>
            ↓ Add Child <span className="ml-auto text-muted-foreground text-[9px]">C</span>
          </button>
        ) : (
          <button role="menuitem" className={mbtn} title={`${ctxNode.type}s cannot parent children`}>
            ↓ Add Child <span className="ml-auto text-[9px]">N/A</span>
          </button>
        )}
        {!isEndpoint ? (
          <button role="menuitem" className={btn} onClick={() => { onAddContextNode("partner"); onClose(); }}>
            → {hasPartner ? "Add Another Partner" : "Add Partner"}
            <span className="ml-auto text-muted-foreground text-[9px]">R</span>
          </button>
        ) : (
          <button role="menuitem" className={mbtn} title={`${ctxNode.type}s don't form couple links`}>
            → Add Partner <span className="ml-auto text-[9px]">N/A</span>
          </button>
        )}
        <button role="menuitem" className={btn} onClick={() => { onAddContextNode("sibling"); onClose(); }}>
          ↔ Add Sibling
          {!hasParents && <span className="ml-1 text-[9px] text-muted-foreground">(no parents yet)</span>}
          <span className="ml-auto text-muted-foreground text-[9px]">B</span>
        </button>

        {sep}

        {/* Connect */}
        {grp("Connect", isEndpoint ? "limited" : undefined)}
        {!isEndpoint ? (
          <button role="menuitem" className={btn} onClick={() => { onSetLinkMode("couple", ctxNode.id); onClose(); }}>
            ⬡ Couple link to…
          </button>
        ) : (
          <button role="menuitem" className={mbtn}>⬡ Couple link <span className="ml-auto text-[9px]">N/A</span></button>
        )}
        {!isEndpoint ? (
          <button role="menuitem" className={btn} onClick={() => { onSetLinkMode("parent-child", ctxNode.id); onClose(); }}>
            ↓ Parent→Child from here
          </button>
        ) : (
          <button role="menuitem" className={mbtn}>↓ Parent→Child <span className="ml-auto text-[9px]">N/A</span></button>
        )}
        {!isEndpoint ? (
          <button role="menuitem" className={btn} onClick={() => { onSetLinkMode("consanguinity", ctxNode.id); onClose(); }}>
            ⇌ Consanguinity to…
          </button>
        ) : (
          <button role="menuitem" className={mbtn}>⇌ Consanguinity <span className="ml-auto text-[9px]">N/A</span></button>
        )}

        {sep}

        {/* Danger */}
        <button role="menuitem" className={dbtn} onClick={() => { onClose(); onDeleteSelected(); }}>
          ✕ Delete {hasChildren || hasPartner ? [hasChildren && "children links", hasPartner && "couple link"].filter(Boolean).join(" & ") : "Node"}
        </button>
      </div>
    </>
  );
}