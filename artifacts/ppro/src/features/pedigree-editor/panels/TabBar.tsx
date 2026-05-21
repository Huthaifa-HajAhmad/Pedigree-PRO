import { useRef, useState } from "react";
import { Dna, Plus, X, Pencil, Trash2 } from "lucide-react";
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
}: TabBarProps) {
  const dragIndexRef = useRef<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tab: TabEntry } | null>(null);

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
      className="tabs-bar flex items-center gap-1 px-2 border-b border-border bg-background flex-shrink-0 overflow-hidden h-11"
    >
      {/* Brand chip */}
      <div className="flex items-center pr-2 border-r border-border flex-shrink-0 self-stretch">
        <Dna className="w-3.5 h-3.5 my-auto text-primary" />
      </div>

      {/* Tabs */}
      {tabs.map((tab, idx) => {
        const isActive = tab.id === currentId;
        const isDropTarget = dropIndex !== null && idx === dropIndex;
        const isRenaming = renamingId === tab.id;
        return (
          <div
            key={tab.id}
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
            className={`flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-md flex-shrink-0 group cursor-pointer transition-all select-none border-t-2 ${
              isActive
                ? "bg-primary/15 outline outline-1 outline-primary/35 text-foreground font-semibold border-t-primary"
                : "text-muted-foreground/80 hover:text-foreground bg-muted/10 border border-border/30 border-t-border hover:border-t-muted-foreground/50"
            } ${draggingId === tab.id ? "opacity-50" : ""} ${isDropTarget ? "border-l-2 border-l-primary" : ""}`}
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
          >
            {isActive && !isRenaming && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-primary" />
            )}
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
                className="text-xs bg-muted border border-border rounded px-1 py-0 outline-none focus:border-primary text-foreground w-[100px]"
                autoFocus
              />
            ) : (
              <span className="text-xs truncate max-w-[130px]">
                {tab.title}
              </span>
            )}
            <button
              type="button"
              className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-muted-foreground transition-opacity flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              title="Close tab"
              aria-label={`Close tab ${tab.title}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {/* Open another pedigree */}
      <div className="flex-shrink-0 flex items-center">
        <button
          type="button"
          data-tab-picker-trigger
          onClick={onToggleTabPicker}
          title="Open another pedigree in a tab"
          aria-label="Open another pedigree in a tab"
          className="flex items-center justify-center min-w-[44px] min-h-[44px] text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors rounded"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
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
      </div>

      {tabCtxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTabCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setTabCtxMenu(null); }} />
          <div className="fixed z-50 min-w-[160px] border border-border rounded-md shadow-xl bg-popover py-1"
            style={{ left: tabCtxMenu.x, top: tabCtxMenu.y }}>
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
