import { Dna, Plus, X } from "lucide-react";
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
  onCloseTab: (tabId: number) => void;
  onNavigate: (path: string) => void;
  onOpenTab: (id: number, title: string) => void;
}

export function TabBar({
  tabs,
  currentId,
  showTabPicker,
  onToggleTabPicker,
  onCloseTab,
  onNavigate,
  onOpenTab,
}: TabBarProps) {
  return (
    <div
      className="tabs-bar flex items-center gap-1 px-2 border-b border-border bg-background flex-shrink-0 overflow-hidden h-11"
    >
      {/* Brand chip */}
      <div className="flex items-center pr-2 border-r border-border flex-shrink-0 self-stretch">
        <Dna className="w-3.5 h-3.5 my-auto text-primary" />
      </div>

      {/* Tabs */}
      {tabs.map((tab) => {
        const isActive = tab.id === currentId;
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-md flex-shrink-0 group cursor-pointer transition-all select-none ${
              isActive
                ? "bg-primary/15 outline outline-1 outline-primary/35 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            onClick={() => {
              if (!isActive) onNavigate(`/pedigrees/${tab.id}`);
            }}
          >
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-primary" />
            )}
            <span className="text-xs truncate max-w-[130px]">
              {tab.title}
            </span>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground transition-opacity flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted"
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
            onClose={onToggleTabPicker}
            onOpen={(pid, title) => {
              onOpenTab(pid, title);
              onNavigate(`/pedigrees/${pid}`);
              onToggleTabPicker();
            }}
          />
        )}
      </div>
    </div>
  );
}