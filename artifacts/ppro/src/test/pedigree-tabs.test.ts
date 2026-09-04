import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePedigreeTabs } from "../hooks/use-pedigree-tabs";

describe("usePedigreeTabs hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with empty tabs if localStorage is empty", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    expect(result.current.tabs).toEqual([]);
  });

  it("opens a tab and persists to localStorage", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    act(() => {
      result.current.openTab(1, "Family 1");
    });
    expect(result.current.tabs).toEqual([{ id: 1, title: "Family 1" }]);
    expect(JSON.parse(localStorage.getItem("ppro_open_tabs") || "[]")).toEqual([
      { id: 1, title: "Family 1" },
    ]);
  });

  it("does not duplicate an existing tab if opened again with the same title", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    act(() => {
      result.current.openTab(1, "Family 1");
    });
    act(() => {
      result.current.openTab(1, "Family 1");
    });
    expect(result.current.tabs).toEqual([{ id: 1, title: "Family 1" }]);
  });

  it("updates title if existing tab ID is opened with an updated title", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    act(() => {
      result.current.openTab(1, "Family 1");
    });
    act(() => {
      result.current.openTab(1, "Updated Family 1");
    });
    expect(result.current.tabs).toEqual([{ id: 1, title: "Updated Family 1" }]);
  });

  it("caps tabs at MAX_TABS (8), evicting the oldest tab", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    act(() => {
      for (let i = 1; i <= 9; i++) {
        result.current.openTab(i, `Pedigree ${i}`);
      }
    });
    expect(result.current.tabs).toHaveLength(8);
    expect(result.current.tabs[0].id).toBe(2);
    expect(result.current.tabs[7].id).toBe(9);
  });

  it("closes a tab", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    act(() => {
      result.current.openTab(1, "Pedigree 1");
      result.current.openTab(2, "Pedigree 2");
    });
    expect(result.current.tabs).toHaveLength(2);

    act(() => {
      result.current.closeTab(1);
    });
    expect(result.current.tabs).toEqual([{ id: 2, title: "Pedigree 2" }]);
  });

  it("prunes stale tabs when valid IDs are provided", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    act(() => {
      result.current.openTab(1, "Pedigree 1");
      result.current.openTab(2, "Pedigree 2");
      result.current.openTab(3, "Pedigree 3");
    });

    act(() => {
      result.current.pruneStaleTabs(new Set([1, 3]));
    });

    expect(result.current.tabs).toEqual([
      { id: 1, title: "Pedigree 1" },
      { id: 3, title: "Pedigree 3" },
    ]);
  });

  it("syncWithPedigrees reconciles database pedigrees into tabs, appending missing ones up to MAX_TABS", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    // Simulate user having 3 tabs in localStorage
    act(() => {
      result.current.openTab(1, "Family1");
      result.current.openTab(2, "Test");
      result.current.openTab(3, "New Pedigree");
    });
    expect(result.current.tabs).toHaveLength(3);

    // Database returns 4 pedigrees (including Obaid)
    const dbPedigrees = [
      { id: 4, title: "Obaid" },
      { id: 2, title: "Test" },
      { id: 3, title: "New Pedigree" },
      { id: 1, title: "Family1" },
    ];

    act(() => {
      result.current.syncWithPedigrees(dbPedigrees);
    });

    // All 4 pedigrees must now be present in tabs
    expect(result.current.tabs).toHaveLength(4);
    expect(result.current.tabs.map((t) => t.id)).toEqual([1, 2, 3, 4]);
    expect(result.current.tabs.find((t) => t.id === 4)?.title).toBe("Obaid");
  });

  it("syncWithPedigrees prunes deleted pedigrees and updates changed titles", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    act(() => {
      result.current.openTab(1, "Old Family 1");
      result.current.openTab(2, "Test");
      result.current.openTab(3, "To Be Deleted");
    });

    const dbPedigrees = [
      { id: 1, title: "Renamed Family 1" },
      { id: 2, title: "Test" },
    ];

    act(() => {
      result.current.syncWithPedigrees(dbPedigrees);
    });

    expect(result.current.tabs).toEqual([
      { id: 1, title: "Renamed Family 1" },
      { id: 2, title: "Test" },
    ]);
  });

  it("syncWithPedigrees is idempotent and does not modify state if identical", () => {
    const { result } = renderHook(() => usePedigreeTabs());
    const dbPedigrees = [
      { id: 1, title: "Family 1" },
      { id: 2, title: "Family 2" },
    ];
    act(() => {
      result.current.syncWithPedigrees(dbPedigrees);
    });
    const tabsSnapshot = result.current.tabs;

    act(() => {
      result.current.syncWithPedigrees(dbPedigrees);
    });
    expect(result.current.tabs).toBe(tabsSnapshot);
  });
});

