import { createContext, useContext, useEffect, useState, createElement } from "react";

export type FontId = "inter" | "plus-jakarta" | "manrope";

export interface FontOption {
  id: FontId;
  name: string;
  desc: string;
  cssClass: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "inter", name: "Inter", desc: "Clean, highly legible", cssClass: "font-inter" },
  { id: "plus-jakarta", name: "Plus Jakarta", desc: "Geometric, modern", cssClass: "font-plus-jakarta" },
  { id: "manrope", name: "Manrope", desc: "Rounded, friendly", cssClass: "font-manrope" },
];

const FONT_IDS = new Set(FONT_OPTIONS.map((f) => f.id));
const STORAGE_KEY = "ppro_font";

export function getStoredFont(): FontId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && FONT_IDS.has(v as FontId)) return v as FontId;
  } catch {}
  return "inter";
}

export function applyFont(id: FontId) {
  const root = document.documentElement;
  for (const f of FONT_OPTIONS) {
    root.classList.remove(f.cssClass);
  }
  const opt = FONT_OPTIONS.find((f) => f.id === id);
  if (opt) root.classList.add(opt.cssClass);
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

export interface FontContextValue {
  fontId: FontId;
  font: FontOption;
  setFont: (id: FontId) => void;
}

export const FontContext = createContext<FontContextValue>({
  fontId: "inter",
  font: FONT_OPTIONS[0]!,
  setFont: () => {},
});

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontId, setFontId] = useState<FontId>(getStoredFont);

  useEffect(() => {
    applyFont(fontId);
  }, [fontId]);

  const setFont = (id: FontId) => {
    setFontId(id);
    applyFont(id);
  };

  const font = FONT_OPTIONS.find((f) => f.id === fontId) ?? FONT_OPTIONS[0]!;

  return createElement(
    FontContext.Provider,
    { value: { fontId, font, setFont } },
    children,
  );
}

export function useFont() {
  return useContext(FontContext);
}
