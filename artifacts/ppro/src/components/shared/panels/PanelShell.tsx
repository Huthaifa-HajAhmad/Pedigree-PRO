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
    <div className={`${width} h-full border-l border-border glass-panel flex flex-col flex-shrink-0 overflow-hidden shadow-[-4px_0_12px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08)]`}>
      <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
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
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            >
              <X className="w-3.5 h-3.5" />
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
