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
      className="tabs-bar flex items-center gap-1 px-2 border-b border-border bg-background flex-shrink-0 overflow-x-auto"
      style={{ height: "44px", minHeight: "44px" }}
    >
      {/* Brand chip */}
      <div className="flex items-center pr-2 border-r border-border flex-shrink-0 self-stretch">
        <Dna className="w-3.5 h-3.5 my-auto" style={{ color: "hsl(var(--primary))" }} />
      </div>

      {/* Tabs */}
      {tabs.map((tab) => {
        const isActive = tab.id === currentId;
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-md flex-shrink-0 group cursor-pointer transition-all select-none ${
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            style={
              isActive
                ? {
                    background: `hsl(var(--primary) / 0.15)`,
                    outline: `1px solid hsl(var(--primary) / 0.35)`,
                  }
                : {}
            }
            onClick={() => {
              if (!isActive) onNavigate(`/pedigrees/${tab.id}`);
            }}
          >
            {isActive && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: "hsl(var(--primary))" }}
              />
            )}
            <span className="text-xs truncate" style={{ maxWidth: "130px" }}>
              {tab.title}
            </span>
            <button
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground transition-opacity flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded"
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
      <div className="relative flex-shrink-0 flex items-center">
        <button
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