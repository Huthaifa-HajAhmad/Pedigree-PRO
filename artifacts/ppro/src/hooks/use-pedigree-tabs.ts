import { useState, useEffect, useCallback } from "react";

export interface PedigreeTab {
  id: number;
  title: string;
}

const TABS_KEY = "ppro_open_tabs";
const LEGACY_TABS_KEY = "pedigree-pro_open_tabs";
const MAX_TABS = 8;
const TABS_CHANGE_EVENT = "ppro-tabs-change";

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
    window.dispatchEvent(new CustomEvent(TABS_CHANGE_EVENT, { detail: tabs }));
  } catch {}
}

export function usePedigreeTabs() {
  const [tabs, setTabs] = useState<PedigreeTab[]>(() => { migrateTabsKey(); return readTabs(); });

  useEffect(() => {
    const storageHandler = (e: StorageEvent) => {
      if (e.key === TABS_KEY) setTabs(readTabs());
    };
    const customHandler = (e: Event) => {
      const detail = (e as CustomEvent<PedigreeTab[]>).detail;
      if (detail) setTabs(detail);
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener(TABS_CHANGE_EVENT, customHandler);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener(TABS_CHANGE_EVENT, customHandler);
    };
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

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      const moved = prev[fromIndex];
      if (!moved) return prev;
      const without = prev.filter((_, i) => i !== fromIndex);
      const insertAt = Math.min(toIndex, without.length);
      const reordered = [...without.slice(0, insertAt), moved, ...without.slice(insertAt)];
      writeTabs(reordered);
      return reordered;
    });
  }, []);

  const pruneStaleTabs = useCallback((validIds: Set<number>) => {
    setTabs((prev) => {
      const pruned = prev.filter((t) => validIds.has(t.id));
      if (pruned.length !== prev.length) {
        writeTabs(pruned);
        return pruned;
      }
      return prev;
    });
  }, []);

  const renameTab = useCallback((id: number, title: string) => {
    setTabs((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, title } : t));
      writeTabs(updated);
      return updated;
    });
  }, []);

  const syncWithPedigrees = useCallback((pedigrees: Array<{ id: number; title: string }>) => {
    if (!pedigrees || pedigrees.length === 0) return;
    setTabs((prev) => {
      const validMap = new Map(pedigrees.map((p) => [p.id, p.title]));
      let updated: PedigreeTab[] = prev
        .filter((t) => validMap.has(t.id))
        .map((t) => {
          const freshTitle = validMap.get(t.id);
          return freshTitle && freshTitle !== t.title ? { ...t, title: freshTitle } : t;
        });

      const existingIds = new Set(updated.map((t) => t.id));
      for (const p of pedigrees) {
        if (updated.length >= MAX_TABS) break;
        if (!existingIds.has(p.id)) {
          updated.push({ id: p.id, title: p.title });
          existingIds.add(p.id);
        }
      }

      const isSame =
        updated.length === prev.length &&
        updated.every((t, i) => prev[i]?.id === t.id && prev[i]?.title === t.title);

      if (isSame) return prev;

      writeTabs(updated);
      return updated;
    });
  }, []);

  return { tabs, openTab, closeTab, reorderTabs, pruneStaleTabs, renameTab, syncWithPedigrees };
}
