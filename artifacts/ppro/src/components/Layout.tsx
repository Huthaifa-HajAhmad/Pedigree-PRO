import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, Dna, ChevronRight, UserCircle, Shield, LogOut, WifiOff, Menu, X } from "lucide-react";
import { ThemePicker } from "@/components/ThemePicker";
import { SkipToContent } from "@/components/SkipToContent";
import { useTheme } from "@/lib/theme";
import { useListProfiles, useSwitchProfile } from "@workspace/api-client-react";
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

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/pedigrees", label: "Pedigrees", icon: Dna },
  { path: "/patients", label: "Patients", icon: Activity },
  { path: "/profiles", label: "Profiles", icon: UserCircle },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme } = useTheme();
  const { data: profiles } = useListProfiles();
  const switchProfile = useSwitchProfile();
  const isOnline = useOnlineStatus();
  const isMobile = useIsMobile();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const profileDropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(profileDropdownRef, () => setProfileMenuOpen(false));

  const activeProfile = profiles && profiles.length > 0
    ? profiles[0]
    : null;

  const handleSwitchProfile = (profileId: string) => {
    switchProfile.mutate(profileId);
    setProfileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <SkipToContent />
      {isMobile && (
        <button
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
          isMobile ? "fixed inset-y-0 left-0 z-50 w-56" : "w-56"
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
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 tracking-widest uppercase">Clinical v2.0</div>
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
                  tabIndex={0}
                  role="link"
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

        {/* Sidebar Footer — separated sections */}
        <div className="p-3 border-t border-border space-y-1">
          {/* Active Profile Section */}
          {activeProfile ? (
            <div className="relative" ref={profileDropdownRef}>
              <button
                data-testid="active-profile-indicator"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{activeProfile.display_name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{activeProfile.role_label}</div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${profileMenuOpen ? "rotate-90 text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
              </button>

              {profileMenuOpen && (
                <div
                  className="absolute bottom-full left-0 right-0 mb-1 z-50 border border-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2"
                  style={{ background: "hsl(var(--popover))" }}
                  role="menu"
                >
                  <div className="px-3 py-2.5 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                    Switch Profile
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {profiles?.map((p) => (
                      <button
                        key={p.id}
                        data-testid={`profile-option-${p.id}`}
                        onClick={() => handleSwitchProfile(p.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md transition-colors text-left ${
                          p.id === activeProfile.id ? "bg-primary/10 text-primary" : "hover:bg-accent"
                        }`}
                        role="menuitem"
                      >
                        <Shield className={`w-3.5 h-3.5 flex-shrink-0 ${p.id === activeProfile.id ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{p.display_name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{p.role_label}</div>
                        </div>
                        {p.id === activeProfile.id && (
                          <span className="text-[9px] text-primary font-semibold flex-shrink-0">Active</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <Link href="/profiles">
                    <div
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground hover:bg-accent transition-colors border-t border-border cursor-pointer"
                      onClick={() => setProfileMenuOpen(false)}
                      role="menuitem"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="font-medium">Manage Profiles</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Link href="/profiles">
              <div
                data-testid="no-profile-indicator"
                className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
              >
                <UserCircle className="w-4 h-4 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">No active profile</div>
              </div>
            </Link>
          )}

          {/* Divider */}
          <div className="my-2 border-t border-border/50" />

          {/* Theme Picker */}
          <ThemePicker />

          {/* Divider */}
          <div className="my-2 border-t border-border/50" />

          {/* Online Status */}
          <div className="px-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? "bg-emerald-500" : "bg-amber-500"} ${isOnline ? "animate-pulse" : ""}`} />
              <span className="text-[11px]">{isOnline ? "Online" : "Offline"}</span>
            </div>
            <div className="text-[10px] text-muted-foreground/40 mt-0.5">HIPAA Compliant</div>
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