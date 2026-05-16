import { useState, useEffect, useCallback } from "react";

export interface PedigreeTab {
  id: number;
  title: string;
}

const TABS_KEY = "ppro_open_tabs";
const LEGACY_TABS_KEY = "pedigree-pro_open_tabs";
const MAX_TABS = 8;

function migrateTabsKey(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_TABS_KEY);
    if (legacy) {
      localStorage.setItem(TABS_KEY, legacy);
      localStorage.removeItem(LEGACY_TABS_KEY);
    }
  } catch {}
}

function readTabs(): PedigreeTab[] {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (t): t is PedigreeTab => typeof t?.id === "number" && typeof t?.title === "string",
      );
    }
    return [];
  } catch {
    return [];
  }
}

function writeTabs(tabs: PedigreeTab[]): void {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch {}
}

export function usePedigreeTabs() {
  const [tabs, setTabs] = useState<PedigreeTab[]>(() => { migrateTabsKey(); return readTabs(); });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === TABS_KEY) setTabs(readTabs());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const openTab = useCallback((id: number, title: string) => {
    setTabs((prev) => {
      const exists = prev.find((t) => t.id === id);
      if (exists) {
        if (exists.title === title) return prev;
        const updated = prev.map((t) => (t.id === id ? { ...t, title } : t));
        writeTabs(updated);
        return updated;
      }
      const newTabs = [...prev, { id, title }].slice(-MAX_TABS);
      writeTabs(newTabs);
      return newTabs;
    });
  }, []);

  const closeTab = useCallback((id: number) => {
    setTabs((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      writeTabs(updated);
      return updated;
    });
  }, []);

  return { tabs, openTab, closeTab };
}
