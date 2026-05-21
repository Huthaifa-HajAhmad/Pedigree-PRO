import { createContext, useContext, useEffect, useRef, useState, createElement } from "react";
import { getPreferences, savePreferences as savePreferencesApi } from "@workspace/api-client-react";

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
const STORAGE_KEY = "ppro_theme";
const LEGACY_STORAGE_KEY = "pedigree-pro-theme";

// ── Local helpers ─────────────────────────────────────────────────────────────
export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy && THEME_IDS.has(legacy as ThemeId)) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return legacy as ThemeId;
      }
    } else if (THEME_IDS.has(v as ThemeId)) {
      return v as ThemeId;
    }
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

export function getDefaultAnnotationColor(): string {
  const id = getStoredTheme();
  const t = THEMES.find((th) => th.id === id);
  return t?.isDark ? "#FFFFFF" : "#1F2937";
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
  theme: THEMES[0]!,
  setTheme: () => {},
  synced: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(getStoredTheme);
  const [synced, setSynced] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply CSS on every theme change
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // On mount: fetch saved theme from backend and apply if found
  useEffect(() => {
    getPreferences().then((prefs) => {
      if (prefs?.theme && THEME_IDS.has(prefs.theme as ThemeId) && prefs.theme !== themeId) {
        setThemeId(prefs.theme as ThemeId);
      }
      setSynced(true);
    }).catch(() => {
      setSynced(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = (id: ThemeId) => {
    setThemeId(id);
    applyTheme(id);
    // Debounce backend save by 600ms to avoid hammering during quick switching
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferencesApi(id).catch(() => { /* silent */ });
    }, 600);
  };

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;

  return createElement(
    ThemeContext.Provider,
    { value: { themeId, theme, setTheme, synced } },
    children,
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}