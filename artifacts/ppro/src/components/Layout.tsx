import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, Dna, ChevronRight, UserCircle, Wifi, WifiOff, Menu, X, Settings, ShieldCheck, Lock, Tag, User } from "lucide-react";
import { SkipToContent } from "@/components/SkipToContent";
import { useTheme } from "@/lib/theme";
import { getAppVersion } from "@/lib/version";
import { useListProfiles } from "@workspace/api-client-react";
import { useIsMobile } from "@/hooks/use-mobile";

function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const go = () => setOnline(true);
    const goOff = () => setOnline(false);
    window.addEventListener("online", go);
    window.addEventListener("offline", goOff);
    return () => { window.removeEventListener("online", go); window.removeEventListener("offline", goOff); };
  }, []);
  return online;
}

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/pedigrees", label: "Pedigrees", icon: Dna },
  { path: "/patients", label: "Patients", icon: Activity },
  { path: "/profiles", label: "Profiles", icon: UserCircle },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/about", label: "About", icon: ShieldCheck },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme } = useTheme();
  const { data: profiles } = useListProfiles();
  const isOnline = useOnlineStatus();
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeProfile = profiles && profiles.length > 0
    ? profiles[0]
    : null;

  return (
    <div className="flex min-h-dvh bg-background">
      <SkipToContent />
      {isMobile && (
        <button
          type="button"
          aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setSidebarOpen((v) => !v)}
          className="fixed top-3 left-3 z-50 p-2 rounded-lg border border-border bg-card shadow-lg"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`flex-shrink-0 border-r border-border flex flex-col transition-transform duration-200 ${
          isMobile ? "fixed inset-y-0 left-0 z-50 w-60" : "w-60"
        } ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}`}
        style={{ background: "hsl(var(--sidebar))" }}
      >
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: `${theme.accent}28`, boxShadow: `0 0 0 1px ${theme.accent}30, 0 4px 12px ${theme.accent}20` }}>
              <Dna className="w-5 h-5" style={{ color: theme.accent }} />
            </div>
            <div>
              <div className="font-bold text-base leading-tight tracking-tight" style={{ color: theme.accent }}>
                Pedigree PRO
              </div>
              <div className="text-xs text-muted-foreground leading-tight mt-0.5 tracking-wide">Clinical Pedigree Editor</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = path === "/" ? location === "/" : location === path || location.startsWith(path + "/");
            return (
              <Link key={path} href={path}>
                <div
                  data-testid={`nav-${label.toLowerCase()}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    isActive
                      ? "font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                  style={isActive ? { background: `${theme.accent}20`, color: theme.accent } : {}}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => isMobile && setSidebarOpen(false)}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-60" aria-hidden="true" />}
                </div>
              </Link>
            );
          })}

        </nav>

        {/* Sidebar Footer — Profile Dock */}
        <div className="flex-shrink-0 border-t border-sidebar-border" style={{ background: "hsl(var(--sidebar) / 0.6)" }}>
          {/* Profile Identity Card */}
          {activeProfile ? (
            <Link href="/profiles" className="block">
              <div
                data-testid="active-profile-indicator"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left group transition-colors duration-150 hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-shadow duration-150 group-hover:shadow-sm"
                  style={{ background: `${theme.accent}18`, color: theme.accent }}
                >
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-sidebar-foreground truncate leading-tight">{activeProfile.display_name}</div>
                  <div className="text-xs text-sidebar-foreground/50 truncate leading-tight mt-0.5">{activeProfile.role_label}</div>
                </div>
              </div>
            </Link>
          ) : (
            <Link href="/profiles" className="block">
              <div
                data-testid="no-profile-indicator"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-none border-0 bg-transparent hover:bg-sidebar-accent/60 transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="text-sm text-muted-foreground font-medium">No active profile</div>
              </div>
            </Link>
          )}

          {/* Metadata Row */}
          <div className="px-3 py-2 border-t border-sidebar-border/60 flex items-center justify-between text-xs text-sidebar-foreground/40 leading-none">
            <span className="inline-flex items-center gap-1.5" title="Local & Encrypted">
              <Lock className="w-3 h-3 flex-shrink-0 opacity-50" />
              <span>Local</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              {isOnline ? <Wifi className="w-3 h-3 flex-shrink-0 opacity-50" /> : <WifiOff className="w-3 h-3 flex-shrink-0 opacity-50" />}
              <span>{isOnline ? "Online" : "Offline"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Tag className="w-3 h-3 flex-shrink-0 opacity-50" />
              <span>{getAppVersion()}</span>
            </span>
          </div>
        </div>
      </aside>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium bg-amber-500/90 text-amber-950 border-b border-amber-400" aria-live="polite">
          <WifiOff className="w-3 h-3" aria-hidden="true" />
          <span>You are offline — Pedigree PRO works locally. All data is saved on this device.</span>
        </div>
      )}
      <main id="main-content" className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}