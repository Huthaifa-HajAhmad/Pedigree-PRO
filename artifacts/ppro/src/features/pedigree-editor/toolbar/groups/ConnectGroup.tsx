interface ConnectGroupProps {
  linkMode: "couple" | "parent-child" | "consanguinity" | null;
  setLinkMode: (mode: "couple" | "parent-child" | "consanguinity" | null) => void;
  setLinkSource: (sourceId: string | null) => void;
  labelHidden?: boolean;
}

export function ConnectGroup({ linkMode, setLinkMode, setLinkSource, labelHidden = false }: ConnectGroupProps) {
  return (
    <div className="flex flex-col justify-between border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="button-link-couple"
          onClick={() => { setLinkMode(linkMode === "couple" ? null : "couple"); setLinkSource(null); }}
          title="Draw couple link — click two nodes"
          aria-label="Draw couple link"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none transition-colors ${linkMode === "couple" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <svg width="26" height="13" viewBox="0 0 26 13">
            <rect x="1" y="2.5" width="7.5" height="7.5" rx="3.75" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <line x1="8.5" y1="6.25" x2="17.5" y2="6.25" stroke="currentColor" strokeWidth="1.1" />
            <rect x="17.5" y="2.5" width="7.5" height="7.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          <span>Couple</span>
        </button>
        <button
          type="button"
          data-testid="button-link-child"
          onClick={() => { setLinkMode(linkMode === "parent-child" ? null : "parent-child"); setLinkSource(null); }}
          title="Draw parent to child link"
          aria-label="Draw parent to child link"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none transition-colors ${linkMode === "parent-child" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <svg width="18" height="14" viewBox="0 0 18 14">
            <circle cx="9" cy="3" r="3" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <line x1="9" y1="6" x2="9" y2="10" stroke="currentColor" strokeWidth="1.1" />
            <rect x="5.5" y="10" width="7" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          <span>P→Child</span>
        </button>
        <button
          type="button"
          data-testid="button-link-consanguinity"
          onClick={() => { setLinkMode(linkMode === "consanguinity" ? null : "consanguinity"); setLinkSource(null); }}
          title="Draw consanguinity link (double bar) — K"
          aria-label="Draw consanguinity link"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none transition-colors ${linkMode === "consanguinity" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <svg width="26" height="12" viewBox="0 0 26 12">
            <line x1="0" y1="3.5" x2="26" y2="3.5" stroke="currentColor" strokeWidth="1.1" />
            <line x1="0" y1="8.5" x2="26" y2="8.5" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          <span>Consang.</span>
        </button>
      </div>
      {!labelHidden && <div className="text-xs text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Connect</div>}
    </div>
  );
}
