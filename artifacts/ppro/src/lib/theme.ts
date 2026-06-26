import { createContext, useContext, useEffect, useRef, useState, createElement, useMemo } from "react";
import { getPreferences, savePreferences as savePreferencesApi } from "@workspace/api-client-react";

export type ThemeId = "light" | "dark";
export type ThemeColor = "blue" | "sky" | "teal" | "amber" | "indigo" | "rose" | "purple";

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
  { id: "light", name: "Light Mode", desc: "Clean professional light", isDark: false, accent: "#2563EB", bg: "#FAFAFA", fg: "#0F172A" },
  { id: "dark",  name: "Dark Mode",  desc: "Modern immersive dark",  isDark: true,  accent: "#6475F7", bg: "#0B0D18", fg: "#EAECF4" },
];

export const COLOR_PALETTES: Array<{ id: ThemeColor; name: string; hex: string }> = [
  { id: "blue",   name: "Blue",   hex: "#2563EB" },
  { id: "sky",    name: "Sky",    hex: "#0284C7" },
  { id: "teal",   name: "Teal",   hex: "#0D9488" },
  { id: "indigo", name: "Indigo", hex: "#6366F1" },
  { id: "purple", name: "Purple", hex: "#A855F7" },
  { id: "rose",   name: "Rose",   hex: "#E11D48" },
  { id: "amber",  name: "Amber",  hex: "#D97706" },
];

const PALETTE_ACCENTS: Record<ThemeColor, string> = {
  blue: "#2563EB",
  sky: "#0284C7",
  teal: "#0D9488",
  amber: "#D97706",
  indigo: "#6366F1",
  rose: "#E11D48",
  purple: "#A855F7",
};

const STORAGE_KEY = "ppro_theme_v2";
const LEGACY_STORAGE_KEY = "ppro_theme";
const LEGACY_PED_PRO_KEY = "pedigree-pro-theme";

export function parseThemeString(raw: string): { mode: ThemeId; color: ThemeColor } {
  if (raw && raw.includes(":")) {
    const [mode, color] = raw.split(":");
    const resolvedMode: ThemeId = (mode === "dark" || mode === "light") ? mode : "light";
    const resolvedColor: ThemeColor = COLOR_PALETTES.some(c => c.id === color) ? (color as ThemeColor) : "blue";
    return { mode: resolvedMode, color: resolvedColor };
  }
  
  const legacyMap: Record<string, { mode: ThemeId; color: ThemeColor }> = {
    clinical: { mode: "light", color: "blue" },
    daylight: { mode: "light", color: "sky" },
    arctic: { mode: "light", color: "teal" },
    warm: { mode: "light", color: "amber" },
    terminal: { mode: "dark", color: "indigo" },
    obsidian: { mode: "dark", color: "indigo" },
    midnight: { mode: "dark", color: "sky" },
    amber: { mode: "light", color: "amber" },
    rose: { mode: "light", color: "rose" },
  };

  return legacyMap[raw] || { mode: "light", color: "blue" };
}

export function getStoredThemeInfo(): { mode: ThemeId; color: ThemeColor } {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return parseThemeString(v);
    
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY) || localStorage.getItem(LEGACY_PED_PRO_KEY);
    if (legacy) {
      const resolved = parseThemeString(legacy);
      // Migrate immediately
      localStorage.setItem(STORAGE_KEY, `${resolved.mode}:${resolved.color}`);
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        localStorage.removeItem(LEGACY_PED_PRO_KEY);
      } catch {}
      return resolved;
    }
  } catch {}
  return { mode: "light", color: "blue" };
}

export function getStoredTheme(): ThemeId {
  return getStoredThemeInfo().mode;
}

export function applyThemeDom(mode: ThemeId, color: ThemeColor = "blue") {
  document.documentElement.setAttribute("data-theme", mode);
  document.documentElement.setAttribute("data-color", color);
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function applyTheme(mode: ThemeId, color: ThemeColor = "blue") {
  applyThemeDom(mode, color);
  try {
    localStorage.setItem(STORAGE_KEY, `${mode}:${color}`);
  } catch {}
}

export function getAccentHex(): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--accent-hex").trim();
    if (v) return v;
  } catch {}
  return "#2563EB";
}

export function getDefaultAnnotationColor(): string {
  const { mode } = getStoredThemeInfo();
  return mode === "dark" ? "#FFFFFF" : "#1F2937";
}

export interface ThemeContextValue {
  themeId: ThemeId;
  theme: Theme;
  setTheme: (id: ThemeId) => void;
  colorPalette: ThemeColor;
  setColorPalette: (color: ThemeColor) => void;
  synced: boolean;
}

export const ThemeContext = createContext<ThemeContextValue>({
  themeId: "light",
  theme: THEMES[0]!,
  setTheme: () => {},
  colorPalette: "blue",
  setColorPalette: () => {},
  synced: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initialInfo = useMemo(getStoredThemeInfo, []);
  const [themeId, setThemeId] = useState<ThemeId>(initialInfo.mode);
  const [colorPalette, setColorPaletteState] = useState<ThemeColor>(initialInfo.color);
  const [synced, setSynced] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    applyTheme(themeId, colorPalette);
  }, [themeId, colorPalette]);

  useEffect(() => {
    getPreferences().then((prefs) => {
      if (prefs?.theme) {
        const resolved = parseThemeString(prefs.theme);
        if (resolved.mode !== themeId || resolved.color !== colorPalette) {
          setThemeId(resolved.mode);
          setColorPaletteState(resolved.color);
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
    const combined = `${id}:${colorPalette}`;
    applyTheme(id, colorPalette);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferencesApi(combined).catch(() => { /* silent */ });
    }, 600);
  };

  const setColorPalette = (color: ThemeColor) => {
    setColorPaletteState(color);
    const combined = `${themeId}:${color}`;
    applyTheme(themeId, color);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferencesApi(combined).catch(() => { /* silent */ });
    }, 600);
  };

  const baseTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;
  const theme = useMemo(() => ({
    ...baseTheme,
    accent: PALETTE_ACCENTS[colorPalette] || baseTheme.accent,
  }), [baseTheme, colorPalette]);

  return createElement(
    ThemeContext.Provider,
    { value: { themeId, theme, setTheme, colorPalette, setColorPalette, synced } },
    children,
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}