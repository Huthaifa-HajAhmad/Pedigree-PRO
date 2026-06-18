import { createContext, useContext, useEffect, useRef, useState, createElement } from "react";
import { getPreferences, savePreferences as savePreferencesApi } from "@workspace/api-client-react";

export type ThemeId = "terminal" | "clinical" | "midnight" | "amber" | "rose" | "arctic" | "daylight" | "warm";

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
  { id: "clinical", name: "Clinical",     desc: "Clean medical light",     isDark: false, accent: "#2563EB", bg: "#FAFAFA", fg: "#0F172A" },
  { id: "daylight", name: "Daylight",      desc: "Professional sky-blue",   isDark: false, accent: "#0369A1", bg: "#F8FAFC", fg: "#1E293B" },
  { id: "arctic",   name: "Arctic",        desc: "Cool teal light",         isDark: false, accent: "#0D9488", bg: "#F0F8FA", fg: "#1A2E3F" },
  { id: "warm",     name: "Warm Neutral",  desc: "Paper-like warm light",  isDark: false, accent: "#B45309", bg: "#FCF9F4", fg: "#2D1F0E" },
  { id: "terminal", name: "Obsidian",      desc: "Modern indigo dark",      isDark: true,  accent: "#6475F7", bg: "#0B0D18", fg: "#EAECF4" },
  { id: "midnight", name: "Midnight",      desc: "Deep navy & cyan",        isDark: true,  accent: "#38BDF8", bg: "#060F1E", fg: "#DDE5EF" },
];

const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  amber: "warm",
  rose: "daylight",
};

const THEME_IDS = new Set(THEMES.map((t) => t.id));
const STORAGE_KEY = "ppro_theme";
const LEGACY_STORAGE_KEY = "pedigree-pro-theme";

function resolveThemeId(raw: string): ThemeId | null {
  const mapped = LEGACY_THEME_MAP[raw];
  if (mapped && THEME_IDS.has(mapped)) return mapped;
  if (THEME_IDS.has(raw as ThemeId)) return raw as ThemeId;
  return null;
}

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const resolved = resolveThemeId(v);
      if (resolved) {
        if (resolved !== v) localStorage.setItem(STORAGE_KEY, resolved);
        return resolved;
      }
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const resolved = resolveThemeId(legacy);
      if (resolved) {
        localStorage.setItem(STORAGE_KEY, resolved);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return resolved;
      }
    }
  } catch {}
  return "clinical";
}

export function applyThemeDom(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  const t = THEMES.find((x) => x.id === id);
  if (t?.isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function applyTheme(id: ThemeId) {
  applyThemeDom(id);
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

export interface ThemeContextValue {
  themeId: ThemeId;
  theme: Theme;
  setTheme: (id: ThemeId) => void;
  synced: boolean;
}

export const ThemeContext = createContext<ThemeContextValue>({
  themeId: "clinical",
  theme: THEMES[0]!,
  setTheme: () => {},
  synced: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(getStoredTheme);
  const [synced, setSynced] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    getPreferences().then((prefs) => {
      if (prefs?.theme) {
        const resolved = resolveThemeId(prefs.theme);
        if (resolved && resolved !== themeId) {
          setThemeId(resolved);
        }
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