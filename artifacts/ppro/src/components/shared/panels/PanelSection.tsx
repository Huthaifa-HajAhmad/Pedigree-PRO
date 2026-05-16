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
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 py-1 text-left"
      >
        {icon && <span className="flex-shrink-0 text-muted-foreground">{icon}</span>}
        <span className="text-xs text-muted-foreground uppercase tracking-wider flex-1">
          {title}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}
