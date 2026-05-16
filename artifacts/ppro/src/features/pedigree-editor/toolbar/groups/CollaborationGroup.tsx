import { GitBranch, History, Wifi } from "lucide-react";

interface CollaborationGroupProps {
  showVersionTimeline: boolean;
  setShowVersionTimeline: React.Dispatch<React.SetStateAction<boolean>>;
  showFollowMode: boolean;
  setShowFollowMode: React.Dispatch<React.SetStateAction<boolean>>;
  setShowLanShare: React.Dispatch<React.SetStateAction<boolean>>;
  labelHidden?: boolean;
}

export function CollaborationGroup({
  showVersionTimeline, setShowVersionTimeline,
  showFollowMode, setShowFollowMode, setShowLanShare, labelHidden = false,
}: CollaborationGroupProps) {
  return (
    <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex items-center gap-0.5">
        <button type="button"
          data-testid="button-timeline"
          onClick={() => setShowVersionTimeline((v) => !v)}
          title="Version timeline"
          aria-label="Version timeline"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none transition-colors ${showVersionTimeline ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Timeline</span>
        </button>
        <button type="button"
          data-testid="button-follow"
          onClick={() => setShowFollowMode((v) => !v)}
          title="Follow history playback"
          aria-label="Follow history playback"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none transition-colors ${showFollowMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <History className="w-4 h-4" />
          <span>Follow</span>
        </button>
        <button type="button"
          data-testid="button-lan-share"
          onClick={() => setShowLanShare(true)}
          title="LAN share (direct P2P)"
          aria-label="LAN share"
          className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Wifi className="w-4 h-4" />
          <span>LAN</span>
        </button>
      </div>
      {!labelHidden && <div className="text-xs text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Collab</div>}
    </div>
  );
}
