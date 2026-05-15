import { Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FindBarProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchMatchesCount: number;
  searchMatchIndex: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onEnterKey?: (shiftKey: boolean) => void;
}

export function FindBar({
  searchQuery,
  onSearchQueryChange,
  searchMatchesCount,
  searchMatchIndex,
  onPrevMatch,
  onNextMatch,
  onClose,
  inputRef,
  onEnterKey,
}: FindBarProps) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-background border border-primary rounded-md px-3 py-2 shadow-xl">
      <Search className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      <input
        ref={inputRef}
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (onEnterKey) {
              onEnterKey(e.shiftKey);
            } else if (searchMatchesCount === 0) return;
          }
          if (e.key === "Escape") onClose();
        }}
        placeholder="Find node…"
        className="bg-transparent outline-none text-xs w-40 placeholder:text-muted-foreground"
        aria-label="Find node"
        spellCheck={false}
      />
      {searchQuery.trim() && (
        <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[52px] text-right">
          {searchMatchesCount === 0
            ? "no match"
            : `${Math.min(searchMatchIndex + 1, searchMatchesCount)} / ${searchMatchesCount}`}
        </span>
      )}
      <Button
        size="icon"
        variant="ghost"
        onClick={onPrevMatch}
        title="Previous (Shift+Enter)"
        disabled={searchMatchesCount === 0}
        className="h-auto w-auto p-0 text-muted-foreground hover:text-primary"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={onNextMatch}
        title="Next (Enter)"
        disabled={searchMatchesCount === 0}
        className="h-auto w-auto p-0 text-muted-foreground hover:text-primary"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </Button>
      <button
        onClick={onClose}
        title="Close (Esc)"
        className="text-muted-foreground hover:text-primary transition-colors ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}