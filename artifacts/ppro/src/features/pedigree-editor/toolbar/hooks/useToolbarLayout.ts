import { useState, useEffect, useRef, useCallback, type RefObject } from "react";

export type ToolbarMode = "full" | "compact" | "minimal" | "overflow";

const BREAKPOINTS = {
  full: 1050,
  compact: 820,
  minimal: 600,
};

export function useToolbarLayout(): { mode: ToolbarMode; ref: RefObject<HTMLDivElement | null> } {
  const [mode, setMode] = useState<ToolbarMode>("full");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.offsetWidth;
    if (w >= BREAKPOINTS.full) setMode("full");
    else if (w >= BREAKPOINTS.compact) setMode("compact");
    else if (w >= BREAKPOINTS.minimal) setMode("minimal");
    else setMode("overflow");
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [measure]);

  return { mode, ref: containerRef };
}
