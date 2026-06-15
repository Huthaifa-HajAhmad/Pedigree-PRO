import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronDown, Plus, X, Pencil, Trash2 } from "lucide-react";
import { TabPickerPopover } from "@/features/pedigree-editor/panels/TabPickerPopover";


interface TabEntry {
  id: number;
  title: string;
}

interface TabBarProps {
  tabs: TabEntry[];
  currentId: number;
  showTabPicker: boolean;
  onToggleTabPicker: () => void;
  onCloseTabPicker: () => void;
  onCloseTab: (tabId: number) => void;
  onRenameTab: (tabId: number, newTitle: string) => void;
  onNavigate: (path: string) => void;
  onOpenTab: (id: number, title: string) => void;
  onReorderTab?: (fromIndex: number, toIndex: number) => void;
  onDeletePedigree: (tabId: number, tabTitle: string) => void;
  saveStatus?: "idle" | "saving" | "saved";
}

export function TabBar({
  tabs,
  currentId,
  showTabPicker,
  onToggleTabPicker,
  onCloseTabPicker,
  onCloseTab,
  onRenameTab,
  onNavigate,
  onOpenTab,
  onReorderTab,
  onDeletePedigree,
  saveStatus = "idle",
}: TabBarProps) {
  const dragIndexRef = useRef<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tab: TabEntry } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollIndicators();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollIndicators, { passive: true });
    const observer = new ResizeObserver(updateScrollIndicators);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollIndicators);
      observer.disconnect();
    };
  }, [updateScrollIndicators, tabs]);

  const startRename = (tab: TabEntry) => {
    setRenamingId(tab.id);
    setRenameValue(tab.title);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (renamingId !== null && renameValue.trim()) {
      onRenameTab(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div
      className="tabs-bar relative flex items-stretch h-11 flex-shrink-0 border-b border-black/10 overflow-visible"
      style={{ background: "transparent" }}
    >
      {/* Scrollable tab rail */}
      <div className="relative flex-1 min-w-0 overflow-visible">
        {/* Left fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.05), transparent)" }} />
        )}

        <div
          ref={scrollContainerRef}
          className="flex items-end h-[calc(100%+2px)] overflow-x-auto overflow-y-hidden gap-1.5 pl-4 pr-1 pb-[2px] z-10"
          role="tablist"
          aria-label="Open pedigrees"
        >
          {tabs.map((tab, idx) => {
            const isActive = tab.id === currentId;
            const isDropTarget = dropIndex !== null && idx === dropIndex;
            const isRenaming = renamingId === tab.id;
            const showUnsavedDot = !isRenaming && (
              (isActive && saveStatus === "idle" && tabs.length > 1)
            );
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                draggable={!!onReorderTab && !isRenaming}
                onDragStart={(e) => {
                  dragIndexRef.current = idx;
                  setDraggingId(tab.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(idx));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropIndex(idx);
                }}
                onDragLeave={() => setDropIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIdx = dragIndexRef.current;
                  if (fromIdx !== null && fromIdx !== idx && onReorderTab) {
                    onReorderTab(fromIdx, idx);
                  }
                  dragIndexRef.current = null;
                  setDropIndex(null);
                  setDraggingId(null);
                }}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                  setDropIndex(null);
                  setDraggingId(null);
                }}
                onClick={() => {
                  if (!isActive && !isRenaming) onNavigate(`/pedigrees/${tab.id}`);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(tab);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTabCtxMenu({ x: e.clientX, y: e.clientY, tab });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isActive) onNavigate(`/pedigrees/${tab.id}`);
                  if (e.key === "Delete" || (e.key === "w" && (e.metaKey || e.ctrlKey))) {
                    e.preventDefault();
                    onCloseTab(tab.id);
                  }
                }}
                className={`
                  group relative flex items-center h-9 gap-1.5 px-4 pr-3 flex-shrink-0 cursor-pointer
                  transition-all duration-150 outline-none select-none
                  focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/60
                  ${isDropTarget ? "border-l-2 border-l-primary" : ""}
                  ${draggingId === tab.id ? "opacity-40" : ""}
                  ${isActive ? "skeuo-tab-active" : "skeuo-tab-inactive"}
                `}
              >
                {/* Unsaved indicator dot */}
                {showUnsavedDot && (
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-70" style={{ background: "hsl(var(--primary))" }} />
                )}

                {/* Tab title or rename input */}
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") cancelRename();
                    }}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs leading-5 bg-white border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-gray-400 text-gray-800 w-[120px]"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-semibold leading-5 truncate max-w-[140px] tracking-wide">
                    {tab.title}
                  </span>
                )}

                {/* Close button */}
                <button
                  type="button"
                  className={`
                    flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full
                    transition-all duration-100
                    ${isActive
                      ? "text-orange-950/60 hover:text-orange-950 hover:bg-black/5"
                      : "opacity-0 group-hover:opacity-60 hover:!opacity-100 text-gray-700/60 hover:text-gray-900 hover:bg-black/10"
                    }
                    focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-primary/60
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title="Close tab"
                  aria-label={`Close ${tab.title}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}

          {/* Add tab button inside rail */}
          <button
            type="button"
            data-tab-picker-trigger
            onClick={onToggleTabPicker}
            title="Open pedigree"
            aria-label="Open another pedigree"
            className="flex items-center justify-center w-8 h-8 mb-0.5 rounded-full flex-shrink-0 text-gray-700/50 hover:text-gray-900 hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Tab picker chevron button inside rail */}
          {tabs.length > 0 && (
            <button
              type="button"
              onClick={onToggleTabPicker}
              title="Switch pedigree"
              aria-label="Switch pedigree"
              className="flex items-center justify-center w-7 h-8 mb-0.5 rounded-full flex-shrink-0 text-gray-700/40 hover:text-gray-900 hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, rgba(0,0,0,0.05), transparent)" }} />
        )}
      </div>

      {/* Right: save status */}
      <div className="flex items-center px-3.5 flex-shrink-0">
        {saveStatus === "saving" && (
          <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-medium text-[10px] shadow-xs select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Saving</span>
          </div>
        )}
        {saveStatus === "saved" && (
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium text-[10px] shadow-xs select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Saved</span>
          </div>
        )}
      </div>

      {showTabPicker && (
        <TabPickerPopover
          currentId={currentId}
          openTabIds={new Set(tabs.map((t) => t.id))}
          onClose={onCloseTabPicker}
          onOpen={(pid, title) => {
            onOpenTab(pid, title);
          }}
        />
      )}

      {tabCtxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTabCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setTabCtxMenu(null); }} />
          <div
            className="fixed z-50 min-w-[160px] border border-border rounded-md shadow-xl py-1"
            style={{ background: "hsl(var(--popover))", left: tabCtxMenu.x, top: tabCtxMenu.y }}
          >
            <button type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2"
              onClick={() => { startRename(tabCtxMenu.tab); setTabCtxMenu(null); }}>
              <Pencil className="w-3 h-3" /> Rename
            </button>
            <button type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2 text-red-400 hover:text-red-300"
              onClick={() => { onDeletePedigree(tabCtxMenu.tab.id, tabCtxMenu.tab.title); setTabCtxMenu(null); }}>
              <Trash2 className="w-3 h-3" /> Delete Pedigree
            </button>
          </div>
        </>
      )}
    </div>
  );
}