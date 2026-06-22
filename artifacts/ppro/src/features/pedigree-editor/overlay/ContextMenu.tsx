import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import {
  Square, Circle, Diamond, Baby, AlertTriangle,
  CheckCircle2, CircleDot, X, Star, ArrowDown, ArrowRight, ArrowUp,
  ArrowLeftRight, Link2, GitBranch, GitMerge, Trash2,
  ChevronRight, Palette,
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
  onOpenColorPicker,
  selectedIds,
  onMarkAsTwins,
  onUnmarkTwins,
}: {
  ctxNode: PedigreeNode;
  canvasEdges: PedigreeEdge[];
  canvasNodes: PedigreeNode[];
  position: { x: number; y: number };
  onClose: () => void;
  onSetNodeType: (nodeId: string, type: PedigreeNode["type"]) => void;
  onToggleNodeProp: (nodeId: string, prop: "affected" | "carrier" | "deceased" | "proband") => void;
  onAddContextNode: (relationship: "child" | "sibling" | "partner" | "parents") => void;
  onDeleteSelected: () => void;
  onSetLinkMode: (mode: "couple" | "parent-child" | "consanguinity", sourceId: string) => void;
  onOpenColorPicker: (nodeId: string) => void;
  selectedIds?: Set<string>;
  onMarkAsTwins?: (nodeIds: string[], twinType: "m" | "d") => void;
  onUnmarkTwins?: (nodeIds: string[]) => void;
}) {
  const isMale      = ctxNode.type === "male";
  const isPregnancy = ctxNode.type === "pregnancy";
  const isSab       = ctxNode.type === "sab";
  const isUnknown   = ctxNode.type === "unknown";
  const isEndpoint  = isPregnancy || isSab;

  const { partnerEdges, hasPartner, hasParents, hasChildren, otherProband } = useMemo(() => {
    const pEdges = canvasEdges.filter(
      (e) => (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") && (e.sourceId === ctxNode.id || e.targetId === ctxNode.id)
    );
    return {
      partnerEdges: pEdges,
      hasPartner: pEdges.length > 0,
      hasParents: canvasEdges.some((e) => e.type === "parent-child" && e.targetId === ctxNode.id),
      hasChildren: canvasEdges.some((e) => e.type === "parent-child" && e.sourceId === ctxNode.id),
      otherProband: canvasNodes.find((n) => n.proband && n.id !== ctxNode.id),
    };
  }, [canvasEdges, canvasNodes, ctxNode.id]);

  const menuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const typeButtonRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const typeFlyoutRef = useRef<HTMLDivElement>(null);
  const addFlyoutRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: position.x, y: position.y });
  const [expandType, setExpandType] = useState(false);
  const [expandAdd, setExpandAdd] = useState(false);
  const expandTypeRef = useRef(expandType);
  const expandAddRef = useRef(expandAdd);
  expandTypeRef.current = expandType;
  expandAddRef.current = expandAdd;
  const [typeFlyoutPos, setTypeFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [addFlyoutPos, setAddFlyoutPos] = useState<{ top: number; left: number } | null>(null);

  const OPEN_DELAY = 75;
  const CLOSE_DELAY = 200;
  const hoverTypeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverAddTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimers = useCallback(() => {
    if (hoverTypeTimerRef.current !== null) { clearTimeout(hoverTypeTimerRef.current); hoverTypeTimerRef.current = null; }
    if (hoverAddTimerRef.current !== null) { clearTimeout(hoverAddTimerRef.current); hoverAddTimerRef.current = null; }
  }, []);

  const handleTypeEnter = useCallback(() => {
    if (hoverTypeTimerRef.current !== null) { clearTimeout(hoverTypeTimerRef.current); hoverTypeTimerRef.current = null; }
    if (hoverAddTimerRef.current !== null) { clearTimeout(hoverAddTimerRef.current); hoverAddTimerRef.current = null; }
    setExpandAdd(false);
    hoverTypeTimerRef.current = setTimeout(() => { setExpandType(true); }, OPEN_DELAY);
  }, []);

  const handleTypeLeave = useCallback(() => {
    if (hoverTypeTimerRef.current !== null) { clearTimeout(hoverTypeTimerRef.current); hoverTypeTimerRef.current = null; }
    hoverTypeTimerRef.current = setTimeout(() => { setExpandType(false); }, CLOSE_DELAY);
  }, []);

  const handleAddEnter = useCallback(() => {
    if (hoverAddTimerRef.current !== null) { clearTimeout(hoverAddTimerRef.current); hoverAddTimerRef.current = null; }
    if (hoverTypeTimerRef.current !== null) { clearTimeout(hoverTypeTimerRef.current); hoverTypeTimerRef.current = null; }
    setExpandType(false);
    hoverAddTimerRef.current = setTimeout(() => { setExpandAdd(true); }, OPEN_DELAY);
  }, []);

  const handleAddLeave = useCallback(() => {
    if (hoverAddTimerRef.current !== null) { clearTimeout(hoverAddTimerRef.current); hoverAddTimerRef.current = null; }
    hoverAddTimerRef.current = setTimeout(() => { setExpandAdd(false); }, CLOSE_DELAY);
  }, []);

  // Measure and position with ResizeObserver to avoid overflow
  useEffect(() => {
    const menu = menuRef.current;
    const content = contentRef.current;
    if (!menu || !content) return;

    const ro = new ResizeObserver(() => {
      const mh = menu.offsetHeight;
      const mw = 220;
      let x = position.x;
      let y = position.y;
      if (x + mw > window.innerWidth) x = Math.max(8, position.x - mw);
      if (y + mh > window.innerHeight - 16) y = Math.max(8, window.innerHeight - mh - 16);
      setPos({ x, y });
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [position]);

  // Measure flyout positions when expanded — with viewport overflow guard
  useEffect(() => {
    if (expandType && typeButtonRef.current) {
      const rect = typeButtonRef.current.getBoundingClientRect();
      const flyoutWidth = 180;
      const goesOffRight = rect.right + 4 + flyoutWidth > window.innerWidth;
      setTypeFlyoutPos({ top: rect.top, left: goesOffRight ? Math.max(8, rect.left - flyoutWidth - 4) : rect.right + 4 });
    }
  }, [expandType]);

  useEffect(() => {
    if (expandAdd && addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      const flyoutWidth = 180;
      const goesOffRight = rect.right + 4 + flyoutWidth > window.innerWidth;
      setAddFlyoutPos({ top: rect.top, left: goesOffRight ? Math.max(8, rect.left - flyoutWidth - 4) : rect.right + 4 });
    }
  }, [expandAdd]);

  // Focus first flyout item when opened
  useEffect(() => {
    if (!expandType) return;
    const first = typeFlyoutRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    first?.focus({ preventScroll: true });
  }, [expandType]);

  useEffect(() => {
    if (!expandAdd) return;
    const first = addFlyoutRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    first?.focus({ preventScroll: true });
  }, [expandAdd]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    menuRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Flyout keyboard handling
      const typeFlyoutItems = typeFlyoutRef.current ? Array.from(typeFlyoutRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')) : [];
      const addFlyoutItems = addFlyoutRef.current ? Array.from(addFlyoutRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')) : [];

      if (expandTypeRef.current && typeFlyoutItems.length > 0 && typeFlyoutRef.current?.contains(document.activeElement as Node)) {
        const idx = typeFlyoutItems.indexOf(document.activeElement as HTMLElement);
        if (e.key === "ArrowDown") { e.preventDefault(); typeFlyoutItems[Math.min(idx + 1, typeFlyoutItems.length - 1)]?.focus(); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); typeFlyoutItems[Math.max(idx - 1, 0)]?.focus(); return; }
        if (e.key === "Home") { e.preventDefault(); typeFlyoutItems[0]?.focus(); return; }
        if (e.key === "End") { e.preventDefault(); typeFlyoutItems[typeFlyoutItems.length - 1]?.focus(); return; }
        if (e.key === "Escape" || e.key === "ArrowLeft") { e.preventDefault(); setExpandType(false); typeButtonRef.current?.focus(); return; }
      }
      if (expandAddRef.current && addFlyoutItems.length > 0 && addFlyoutRef.current?.contains(document.activeElement as Node)) {
        const idx = addFlyoutItems.indexOf(document.activeElement as HTMLElement);
        if (e.key === "ArrowDown") { e.preventDefault(); addFlyoutItems[Math.min(idx + 1, addFlyoutItems.length - 1)]?.focus(); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); addFlyoutItems[Math.max(idx - 1, 0)]?.focus(); return; }
        if (e.key === "Home") { e.preventDefault(); addFlyoutItems[0]?.focus(); return; }
        if (e.key === "End") { e.preventDefault(); addFlyoutItems[addFlyoutItems.length - 1]?.focus(); return; }
        if (e.key === "Escape" || e.key === "ArrowLeft") { e.preventDefault(); setExpandAdd(false); addButtonRef.current?.focus(); return; }
      }

      // Main menu keyboard navigation
      const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'));
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[Math.min(currentIndex + 1, items.length - 1)]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[Math.max(currentIndex - 1, 0)]?.focus();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (document.activeElement === typeButtonRef.current) { setExpandType(true); return; }
        if (document.activeElement === addButtonRef.current) { setExpandAdd(true); return; }
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
        if (expandTypeRef.current) { setExpandType(false); return; }
        if (expandAddRef.current) { setExpandAdd(false); return; }
        onCloseRef.current();
      }
    };
    menu.addEventListener("keydown", onKeyDown);
    const onResize = () => {
      clearHoverTimers();
      setExpandType(false);
      setExpandAdd(false);
      onCloseRef.current();
    };
    window.addEventListener("resize", onResize);
    return () => {
      menu.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      clearHoverTimers();
    };
  }, [clearHoverTimers]);

  const btn  = "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2";
  const abtn = btn + " text-primary font-medium";
  const dbtn = btn + " text-red-400 hover:text-red-300";
  const mbtn = btn + " opacity-40 cursor-not-allowed";
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

  const typeOptions: Array<{ key: PedigreeNode["type"]; label: string; icon: React.ReactNode; disabled?: boolean; title?: string }> = [
    { key: "male", label: "Male", icon: <Square className={ICON_CLS} />, disabled: ctxNode.type === "male" },
    { key: "female", label: "Female", icon: <Circle className={ICON_CLS} />, disabled: ctxNode.type === "female" },
    { key: "unknown", label: "Unknown sex", icon: <Diamond className={ICON_CLS} />, disabled: ctxNode.type === "unknown" || hasChildren, title: hasChildren ? "Nodes with children cannot be unknown sex" : undefined },
    { key: "pregnancy", label: "Pregnancy", icon: <Baby className={ICON_CLS} />, disabled: isMale || isSab || hasChildren || ctxNode.type === "pregnancy", title: isMale ? "Males cannot carry a pregnancy" : hasChildren ? "Nodes with children cannot be pregnancy" : undefined },
    { key: "sab", label: isPregnancy ? "Mark as Loss (SAB)" : "SAB / Stillbirth", icon: <AlertTriangle className={ICON_CLS} />, disabled: (ctxNode.type === "sab" && !isPregnancy) || hasChildren, title: hasChildren ? "Nodes with children cannot be SAB" : isPregnancy ? undefined : "Already SAB" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => {
        clearHoverTimers();
        if (expandType || expandAdd) { setExpandType(false); setExpandAdd(false); return; }
        onClose();
      }}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }} role="presentation" />
      <div className="fixed z-50 min-w-[220px] max-h-[70vh] overflow-y-auto border border-border rounded-lg shadow-2xl bg-popover outline-none"
        ref={menuRef}
        role="menu" aria-label="Node context menu"
        tabIndex={0}
        style={{ left: pos.x, top: pos.y }}>

        <div ref={contentRef}>
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

          {/* Set Type — flyout submenu */}
          <div className="relative group">
            <button ref={typeButtonRef} type="button" role="menuitem" className={btn} onClick={() => { setExpandType((v) => !v); setExpandAdd(false); }} onMouseEnter={handleTypeEnter} onMouseLeave={handleTypeLeave} aria-haspopup="menu" aria-expanded={expandType}>
              <TypeIcon type={ctxNode.type} />
              <span className="flex-1">Set Type</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </button>
            {expandType && typeFlyoutPos && (
              <div ref={typeFlyoutRef} role="menu" className="fixed z-50 min-w-[180px] border border-border rounded-md shadow-xl bg-popover"
                style={{ left: typeFlyoutPos.left, top: typeFlyoutPos.top }}
                onMouseEnter={() => { if (hoverTypeTimerRef.current !== null) { clearTimeout(hoverTypeTimerRef.current); hoverTypeTimerRef.current = null; } }}
                onMouseLeave={handleTypeLeave}>
                {typeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    role="menuitem"
                    aria-disabled={opt.disabled}
                    title={opt.title}
                    className={opt.disabled ? mbtn : btn}
                    onClick={() => {
                      if (opt.disabled) return;
                      onSetNodeType(ctxNode.id, opt.key);
                      onClose();
                    }}
                  >
                    {opt.icon}
                    {opt.label}
                    {opt.disabled && <span className="ml-auto text-xs">N/A</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Set Color — opens standalone picker near node */}
          <button type="button" role="menuitem" className={btn} onClick={() => { onClose(); onOpenColorPicker(ctxNode.id); }}>
            <Palette className={ICON_CLS} />
            <span className="flex-1">Set Color</span>
            {ctxNode.color && <span className="w-3 h-3 rounded-full border border-border/50 flex-shrink-0" style={{ background: ctxNode.color }} />}
          </button>

          {/* Add Relatives — flyout submenu */}
          <div className="relative group">
            <button ref={addButtonRef} type="button" role="menuitem" className={btn} onClick={() => { setExpandAdd((v) => !v); setExpandType(false); }} onMouseEnter={handleAddEnter} onMouseLeave={handleAddLeave} aria-haspopup="menu" aria-expanded={expandAdd}>
              <ArrowDown className={ICON_CLS} />
              <span className="flex-1">Add Relatives</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </button>
            {expandAdd && addFlyoutPos && (
              <div ref={addFlyoutRef} role="menu" className="fixed z-50 min-w-[180px] border border-border rounded-md shadow-xl bg-popover"
                style={{ left: addFlyoutPos.left, top: addFlyoutPos.top }}
                onMouseEnter={() => { if (hoverAddTimerRef.current !== null) { clearTimeout(hoverAddTimerRef.current); hoverAddTimerRef.current = null; } }}
                onMouseLeave={handleAddLeave}>
                {!isEndpoint && !isUnknown ? (
                  <button type="button" role="menuitem" className={btn} onClick={() => { onAddContextNode("child"); onClose(); }}>
                    <ArrowDown className={ICON_CLS} /> Add Child <span className="ml-auto text-muted-foreground text-xs">C</span>
                  </button>
                ) : (
                  <button type="button" role="menuitem" aria-disabled className={mbtn} title={isUnknown ? "Unknown sex nodes cannot parent children" : `${ctxNode.type}s cannot parent children`}>
                    <ArrowDown className={ICON_CLS} /> Add Child <span className="ml-auto text-xs">N/A</span>
                  </button>
                )}
                {!isEndpoint && !isUnknown ? (
                  <button type="button" role="menuitem" className={btn} onClick={() => { onAddContextNode("partner"); onClose(); }}>
                    <ArrowRight className={ICON_CLS} /> {hasPartner ? "Add Another Partner" : "Add Partner"}
                    <span className="ml-auto text-muted-foreground text-xs">R</span>
                  </button>
                ) : (
                  <button type="button" role="menuitem" aria-disabled className={mbtn} title={isUnknown ? "Unknown sex nodes don't form couple links" : `${ctxNode.type}s don't form couple links`}>
                    <ArrowRight className={ICON_CLS} /> Add Partner <span className="ml-auto text-xs">N/A</span>
                  </button>
                )}
                <button type="button" role="menuitem" className={btn} onClick={() => { onAddContextNode("sibling"); onClose(); }}>
                  <ArrowLeftRight className={ICON_CLS} /> Add Sibling
                  {!hasParents && <span className="ml-1 text-xs text-muted-foreground">(no parents yet)</span>}
                  <span className="ml-auto text-muted-foreground text-xs">B</span>
                </button>
                {!hasParents && !isEndpoint ? (
                  <button type="button" role="menuitem" className={btn} onClick={() => { onAddContextNode("parents"); onClose(); }}>
                    <ArrowUp className={ICON_CLS} /> Add Parents
                  </button>
                ) : (
                  <button type="button" role="menuitem" aria-disabled className={mbtn} title={hasParents ? "Already has parents" : `${ctxNode.type}s cannot have parents`}>
                    <ArrowUp className={ICON_CLS} /> Add Parents <span className="ml-auto text-xs">N/A</span>
                  </button>
                )}
              </div>
            )}
          </div>

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
            <button type="button" role="menuitem" aria-disabled className={mbtn} title="SABs are not marked as carriers">
              <Circle className={ICON_CLS} />Carrier <span className="ml-auto text-xs">N/A</span>
            </button>
          )}
          {!isEndpoint ? (
            <button type="button" role="menuitem" className={ctxNode.deceased ? abtn : btn} onClick={() => { onToggleNodeProp(ctxNode.id, "deceased"); onClose(); }}>
              {ctxNode.deceased ? <X className={`${ICON_CLS} text-primary`} /> : <Circle className={ICON_CLS} />}
              {ctxNode.deceased ? "Unmark Deceased" : "Mark Deceased"}
            </button>
          ) : (
            <button type="button" role="menuitem" aria-disabled className={mbtn} title={isPregnancy ? "Deceased pregnancy should be SAB" : "SAB implies deceased"}>
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
            <button type="button" role="menuitem" aria-disabled className={mbtn}><Star className={ICON_CLS} />Proband <span className="ml-auto text-xs">N/A</span></button>
          )}

          {sep}

          {/* Connect */}
          {grp("Connect", isEndpoint ? "limited" : undefined)}
          {!isEndpoint ? (
            <button type="button" role="menuitem" className={btn} onClick={() => { onSetLinkMode("couple", ctxNode.id); onClose(); }}>
              <Link2 className={ICON_CLS} /> Couple link…
            </button>
          ) : (
            <button type="button" role="menuitem" aria-disabled className={mbtn}><Link2 className={ICON_CLS} /> Couple link <span className="ml-auto text-xs">N/A</span></button>
          )}
          {!isEndpoint ? (
            <button type="button" role="menuitem" className={btn} onClick={() => { onSetLinkMode("parent-child", ctxNode.id); onClose(); }}>
              <GitBranch className={ICON_CLS} /> Parent→Child…
            </button>
          ) : (
            <button type="button" role="menuitem" aria-disabled className={mbtn}><GitBranch className={ICON_CLS} /> Parent→Child <span className="ml-auto text-xs">N/A</span></button>
          )}
          {!isEndpoint ? (
            <button type="button" role="menuitem" className={btn} onClick={() => { onSetLinkMode("consanguinity", ctxNode.id); onClose(); }}>
              <GitMerge className={ICON_CLS} /> Consanguinity…
            </button>
          ) : (
            <button type="button" role="menuitem" aria-disabled className={mbtn}><GitMerge className={ICON_CLS} /> Consanguinity <span className="ml-auto text-xs">N/A</span></button>
          )}

          {/* Twins */}
          {(() => {
            if (!selectedIds || !onMarkAsTwins || !onUnmarkTwins) return null;
            const siblingSet = new Set<string>();
            const ctxParents = new Set(canvasEdges.filter((e) => e.type === "parent-child" && e.targetId === ctxNode.id).map((e) => e.sourceId));
            if (ctxParents.size === 0) return null;
            for (const sid of selectedIds) {
              if (sid === ctxNode.id) continue;
              const pids = canvasEdges.filter((e) => e.type === "parent-child" && e.targetId === sid).map((e) => e.sourceId);
              if (pids.length > 0 && pids.some((p) => ctxParents.has(p))) siblingSet.add(sid);
            }
            if (siblingSet.size === 0) return null;
            const allSibs = [ctxNode.id, ...siblingSet];
            const existingEdge = canvasEdges.find((e) => e.type === "parent-child" && e.twinGroup && allSibs.includes(e.targetId));
            return (
              <>
                {sep}
                {grp("Twins")}
                {existingEdge ? (
                  <button type="button" role="menuitem" className={btn} onClick={() => { onUnmarkTwins(allSibs); onClose(); }}>
                    <GitBranch className={ICON_CLS} /> Remove twin marking
                  </button>
                ) : (
                  <>
                    <button type="button" role="menuitem" className={btn} onClick={() => { onMarkAsTwins(allSibs, "m"); onClose(); }}>
                      <GitBranch className={ICON_CLS} /> Mark as Identical twins
                    </button>
                    <button type="button" role="menuitem" className={btn} onClick={() => { onMarkAsTwins(allSibs, "d"); onClose(); }}>
                      <GitBranch className={ICON_CLS} /> Mark as Fraternal twins
                    </button>
                  </>
                )}
              </>
            );
          })()}

          {sep}

          {/* Danger */}
          <button type="button" role="menuitem" className={dbtn} onClick={() => { onClose(); onDeleteSelected(); }}>
            <Trash2 className={`${ICON_CLS} text-red-400`} />
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
