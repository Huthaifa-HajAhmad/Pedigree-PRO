import { X } from "lucide-react";
import type { ReactNode } from "react";

interface PanelShellProps {
  title: string;
  icon?: ReactNode;
  onClose?: () => void;
  actions?: ReactNode;
  width?: string;
  children: ReactNode;
}

export function PanelShell({
  title,
  icon,
  onClose,
  actions,
  width = "w-72",
  children,
}: PanelShellProps) {
  return (
    <div className={`${width} h-full border-l border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col flex-shrink-0 overflow-hidden shadow-[-6px_0_16px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.08)]`}>
      <div className="p-3 border-b border-sidebar-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="flex-shrink-0 text-muted-foreground">{icon}</span>}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {onClose && (
            <button
              type="button"
              aria-label={`Close ${title}`}
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 hover:bg-accent rounded-md transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-90 focus:outline-none focus:ring-1 focus:ring-ring z-50 group"
            >
              <X className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-90" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {children}
      </div>
    </div>
  );
}
