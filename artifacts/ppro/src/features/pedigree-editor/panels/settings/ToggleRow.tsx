import React from "react";

export interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
}

export function ToggleRow({ label, description, checked, onChange, icon }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-border/30 last:border-0">
      <div className="flex gap-2 min-w-0">
        {icon && <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground leading-normal">{description}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`w-9 h-5 rounded-full border transition-all relative flex-shrink-0 ${
          checked ? "border-primary bg-primary" : "border-border bg-muted"
        }`}
        aria-label={`Toggle ${label}`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-[1px] left-[1px] w-4 h-4 rounded-full shadow-sm transition-transform bg-card ${
            checked ? "translate-x-[16px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
