import type { ElementType } from "react";
import { Link } from "wouter";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ElementType;
  sub?: string;
  href?: string;
}

function StatCard({ label, value, icon: Icon, sub, href }: StatCardProps) {
  const content = (
    <div className={`border border-border rounded-xl p-5 bg-card flex flex-col gap-3 transition-colors duration-200 ${href ? "hover:border-primary/50 cursor-pointer" : "hover:border-primary/50"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</span>
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight text-primary">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

interface StatsGridProps {
  stats: StatCardProps[];
  isLoading?: boolean;
}

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: stats.length || 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-xl p-5 bg-card h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}