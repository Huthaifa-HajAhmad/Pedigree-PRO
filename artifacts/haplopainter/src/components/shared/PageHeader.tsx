import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

export function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Icon className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold tracking-wider uppercase text-primary">{title}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}