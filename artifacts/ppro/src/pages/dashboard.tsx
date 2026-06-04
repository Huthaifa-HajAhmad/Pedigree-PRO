import { useCallback, useState } from "react";
import { useGetDashboardStats, useGetRecentActivity, useListPedigrees, useClearActivity } from "@workspace/api-client-react";
import { Link } from "wouter";
import { UserCircle, Activity, TrendingUp, Clock, ChevronRight, ChevronDown, Dna, Plus, Upload, UserPlus, Calendar, GitBranch, Trash2 } from "lucide-react";
import { StatsGrid } from "@/components/shared/StatsGrid";

function ScrollFade({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1 min-h-0">
      <div className="absolute inset-0 overflow-y-auto divide-y divide-border">
        {children}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none rounded-b-xl bg-gradient-to-b from-transparent to-card" />
    </div>
  );
}

const quickActions = [
  { label: "New Pedigree", icon: Plus,     href: "/pedigrees", testId: "quick-new-pedigree" },
  { label: "New Patient",  icon: UserPlus, href: "/patients",  testId: "quick-new-patient"  },
  { label: "Import PED",   icon: Upload,   href: "/pedigrees", testId: "quick-import"        },
];

function formatDateSafe(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString(); } catch { return "—"; }
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recent, isLoading: recentLoading } = useGetRecentActivity(20);
  const { data: pedigrees, isLoading: pedigreesLoading } = useListPedigrees();
  const clearActivity = useClearActivity();
  const [showAllActivity, setShowAllActivity] = useState(false);

  const renderActivitySkeleton = useCallback((count: number) => [...Array(count)].map((_, i) => (
    <div key={i} className="px-5 py-3.5 flex items-center gap-4 animate-pulse">
      <div className="w-8 h-8 bg-muted rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-48" />
        <div className="h-2 bg-muted rounded w-32" />
      </div>
      <div className="h-2 bg-muted rounded w-16" />
    </div>
  )), []);

  const renderActivityItems = useCallback((items: typeof recent, max: number) => items?.length === 0 ? (
    <div className="px-5 py-8 text-center text-muted-foreground text-sm">No activity yet.</div>
  ) : items?.slice(0, max).map((a) => (
    <div key={a.id} data-testid={`activity-${a.id}`} className="px-5 py-3.5 flex items-center gap-4">
      <div className="w-8 h-8 border border-border rounded-lg flex items-center justify-center flex-shrink-0">
        <Activity className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{a.subject}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          <span className="text-primary font-medium">{a.action}</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        {formatDateSafe(a.timestamp)}
      </div>
    </div>
  )), []);

  const renderRecentPedigreesSkeleton = useCallback((count: number) => [...Array(count)].map((_, i) => (
    <div key={i} className="px-5 py-3.5 flex items-center gap-3 animate-pulse">
      <div className="w-8 h-8 bg-muted rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-32" />
        <div className="h-2 bg-muted rounded w-20" />
      </div>
    </div>
  )), []);

  const renderRecentPedigrees = useCallback(() => {
    if (!pedigrees || pedigrees.length === 0) {
      return <div className="px-5 py-8 text-xs text-muted-foreground text-center">No pedigrees yet</div>;
    }
    const recentPedigrees = [...pedigrees]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);
    return recentPedigrees.map((p) => (
      <Link key={p.id} href={`/pedigrees/${p.id}`}>
        <div data-testid={`recent-pedigree-${p.id}`} className="px-5 py-3.5 flex items-center gap-3 hover:bg-accent/50 cursor-pointer transition-colors group">
          <div className="w-8 h-8 border border-border rounded-lg flex items-center justify-center flex-shrink-0 group-hover:border-primary/50 group-hover:bg-primary/5 transition-colors">
            <Dna className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{p.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDateSafe(p.updated_at)}
              </span>
              {p.version_count > 0 && (
                <span className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  v{p.version_count}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
        </div>
      </Link>
    ));
  }, [pedigrees]);

  return (
    <section className="p-6 max-w-7xl mx-auto flex flex-col h-dvh">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Dna className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Clinical Dashboard</h1>
        </div>
        <p className="text-base text-muted-foreground ml-11">Design family pedigrees, compute inheritance risks, and collaborate securely</p>
      </div>

      {/* Stat cards */}
      <div className="flex-shrink-0 mb-5">
        <StatsGrid
          isLoading={statsLoading}
          stats={[
            { label: "Total Patients",  value: stats?.total_patients ?? 0,     icon: Activity,    sub: "Registered",     href: "/patients" },
            { label: "Pedigrees",       value: stats?.total_pedigrees ?? 0,    icon: Dna,         sub: "Active",         href: "/pedigrees" },
            { label: "This Week",       value: stats?.pedigrees_this_week ?? 0, icon: TrendingUp, sub: "New pedigrees",  href: "/pedigrees" },
            { label: "Profiles",        value: stats?.total_profiles ?? 0,     icon: UserCircle,  sub: "On this device", href: "/profiles" },
          ]}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">

        {/* Left: Recent Activity */}
        <div className="lg:col-span-2 border border-border rounded-xl bg-card flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Recent Activity</span>
              {recent && recent.length > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {Math.min(showAllActivity ? 20 : 10, recent.length)} of {recent.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {recent && recent.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllActivity(!showAllActivity)}
                  className={`text-xs flex items-center gap-1 cursor-pointer transition-opacity ${showAllActivity ? "text-primary font-semibold" : "text-primary hover:opacity-80"}`}
                >
                  {showAllActivity ? "Show Less" : "View All"}
                  {showAllActivity ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
              {recent && recent.length > 0 && (
                <button
                  type="button"
                  onClick={() => { if (confirm("Clear all activity history?")) clearActivity.mutate(); }}
                  className="text-xs flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear All
                </button>
              )}
            </div>
          </div>

          <ScrollFade>
            {recentLoading ? renderActivitySkeleton(5) : renderActivityItems(recent, showAllActivity ? 20 : 10)}
          </ScrollFade>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 min-h-0">

          {/* Recently Modified Pedigrees */}
          <div className="border border-border rounded-xl bg-card flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between flex-shrink-0">
              <span className="text-sm font-medium text-foreground">Recently Modified</span>
              <Link href="/pedigrees">
                <span className="text-xs flex items-center gap-1 cursor-pointer text-primary hover:opacity-80 transition-opacity">
                  All <ChevronRight className="w-3 h-3" />
                </span>
              </Link>
            </div>

            <ScrollFade>
              {pedigreesLoading ? renderRecentPedigreesSkeleton(5) : renderRecentPedigrees()}
            </ScrollFade>
          </div>

          {/* Quick Actions */}
          <div className="border border-border rounded-xl bg-card overflow-hidden flex-shrink-0">
            <div className="px-5 py-3.5 border-b border-border">
              <span className="text-sm font-medium text-foreground">Quick Actions</span>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {quickActions.map(({ label, icon: Icon, href, testId }) => (
                <Link key={label} href={href}>
                  <div
                    data-testid={testId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
