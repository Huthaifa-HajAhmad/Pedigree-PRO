import { Clock, History } from "lucide-react";

interface CollaborateGroupProps {
  showVersionTimeline: boolean;
  setShowVersionTimeline: React.Dispatch<React.SetStateAction<boolean>>;
  showFollowMode: boolean;
  setShowFollowMode: React.Dispatch<React.SetStateAction<boolean>>;
  labelHidden?: boolean;
}

export function CollaborateGroup({
  showVersionTimeline, setShowVersionTimeline,
  showFollowMode, setShowFollowMode, labelHidden = false,
}: CollaborateGroupProps) {
  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button type="button"
          data-testid="button-timeline"
          onClick={() => setShowVersionTimeline((v) => !v)}
          title="Version timeline"
          aria-label="Version timeline"
          aria-pressed={showVersionTimeline}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${showVersionTimeline ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <Clock className="w-5 h-5" />
          <span>Timeline</span>
        </button>
        <button type="button"
          data-testid="button-follow"
          onClick={() => setShowFollowMode((v) => !v)}
          title="Follow history playback"
          aria-label="Follow history playback"
          aria-pressed={showFollowMode}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${showFollowMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <History className="w-5 h-5" />
          <span>Follow</span>
        </button>
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Collaborate</div>}
    </div>
  );
}
