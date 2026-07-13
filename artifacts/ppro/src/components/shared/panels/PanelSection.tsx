import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface PanelSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

export function PanelSection({
  title,
  icon,
  defaultOpen = true,
  actions,
  children,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border/80 rounded-md overflow-hidden bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02)] transition-shadow duration-300 hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left bg-muted/60 hover:bg-muted/80 transition-colors border-b border-border/60"
      >
        {icon && <span className="flex-shrink-0 text-muted-foreground">{icon}</span>}
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">
          {title}
        </span>
        {actions && (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center">
            {actions}
          </div>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="p-3 space-y-3 bg-card text-foreground">{children}</div>}
    </div>
  );
}
