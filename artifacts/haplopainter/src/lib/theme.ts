import { createContext, useContext, useEffect, useRef, useState, createElement } from "react";

export type ThemeId = "terminal" | "clinical" | "midnight" | "amber" | "rose" | "arctic";

export interface Theme {
  id: ThemeId;
  name: string;
  desc: string;
  isDark: boolean;
  accent: string;
  bg: string;
  fg: string;
}

export const THEMES: Theme[] = [
  { id: "terminal", name: "Obsidian",       desc: "Modern indigo dark",   isDark: true,  accent: "#6475F7", bg: "#0B0D18", fg: "#EAECF4" },
  { id: "clinical", name: "Clinical White", desc: "Clean medical light",  isDark: false, accent: "#2563EB", bg: "#FAFAFA", fg: "#0F172A" },
  { id: "midnight", name: "Midnight",       desc: "Deep navy & sky-blue", isDark: true,  accent: "#38BDF8", bg: "#060F1E", fg: "#DDE5EF" },
  { id: "amber",    name: "Amber",          desc: "Warm dark & gold",     isDark: true,  accent: "#FBBF24", bg: "#0E0C09", fg: "#D1CEC9" },
  { id: "rose",     name: "Rose",           desc: "Dark with rose glow",  isDark: true,  accent: "#FB7185", bg: "#10080C", fg: "#EDD8DD" },
  { id: "arctic",   name: "Arctic",         desc: "Cool light & teal",    isDark: false, accent: "#0D9488", bg: "#F5F8FA", fg: "#1F2F45" },
];

const THEME_IDS = new Set(THEMES.map((t) => t.id));
const DEVICE_KEY  = "pedigree-pro-device-id";
const STORAGE_KEY = "pedigree-pro-theme";

// ── Device ID ─────────────────────────────────────────────────────────────────
function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "local";
  }
}

// ── Local helpers ─────────────────────────────────────────────────────────────
export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && THEME_IDS.has(v as ThemeId)) return v as ThemeId;
  } catch {}
  return "terminal";
}

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

export function getAccentHex(): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--accent-hex").trim();
    if (v) return v;
  } catch {}
  return "#6475F7";
}

// ── API helpers ───────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function fetchThemeFromApi(deviceId: string): Promise<ThemeId | null> {
  try {
    const res = await fetch(`${BASE}/api/preferences/${encodeURIComponent(deviceId)}`);
    if (!res.ok) return null;
    const data = await res.json() as { theme?: string };
    if (data.theme && THEME_IDS.has(data.theme as ThemeId)) return data.theme as ThemeId;
  } catch {}
  return null;
}

async function saveThemeToApi(deviceId: string, theme: ThemeId): Promise<void> {
  try {
    await fetch(`${BASE}/api/preferences/${encodeURIComponent(deviceId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
  } catch {}
}

// ── Context ───────────────────────────────────────────────────────────────────
export interface ThemeContextValue {
  themeId: ThemeId;
  theme: Theme;
  setTheme: (id: ThemeId) => void;
  synced: boolean;
}

export const ThemeContext = createContext<ThemeContextValue>({
  themeId: "terminal",
  theme: THEMES[0],
  setTheme: () => {},
  synced: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(getStoredTheme);
  const [synced, setSynced] = useState(false);
  const deviceId = useRef(getOrCreateDeviceId());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply CSS on every theme change
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // On mount: fetch saved theme from API and apply if found
  useEffect(() => {
    fetchThemeFromApi(deviceId.current).then((remote) => {
      if (remote && remote !== themeId) {
        setThemeId(remote);
      }
      setSynced(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = (id: ThemeId) => {
    setThemeId(id);
    applyTheme(id);
    // Debounce API save by 600ms to avoid hammering during quick switching
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveThemeToApi(deviceId.current, id);
    }, 600);
  };

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  return createElement(
    ThemeContext.Provider,
    { value: { themeId, theme, setTheme, synced } },
    children,
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}