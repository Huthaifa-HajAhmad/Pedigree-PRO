import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface PanelSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function PanelSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left bg-muted/50 hover:bg-muted transition-colors border-b border-border"
      >
        {icon && <span className="flex-shrink-0 text-muted-foreground">{icon}</span>}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex-1">
          {title}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="p-3 space-y-3 bg-card">{children}</div>}
    </div>
  );
}
