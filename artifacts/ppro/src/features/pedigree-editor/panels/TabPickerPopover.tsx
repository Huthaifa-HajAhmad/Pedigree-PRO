import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useListPedigrees } from "@workspace/api-client-react";
import { Dna } from "lucide-react";

export function TabPickerPopover({
  currentId,
  onClose,
  onOpen,
}: {
  currentId: number;
  onClose: () => void;
  onOpen: (id: number, title: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);
  const { data: pedigrees } = useListPedigrees({ search: debouncedSearch || undefined });
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const trigger = document.querySelector<HTMLElement>("[data-tab-picker-trigger]");
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 272) });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (panelRef.current && !panelRef.current.contains(target) && !target.closest("[data-tab-picker-trigger]")) {
        onCloseRef.current();
      }
    };
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        document.addEventListener("mousedown", handler);
      }
    }, 0);
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  return createPortal(
    <div
      ref={panelRef}
      data-tab-picker
      className="fixed z-50 bg-card border border-border rounded shadow-xl w-64"
      style={pos ? { top: pos.top, left: pos.left } : { display: "none" }}
    >
      <div className="p-2 border-b border-border">
        <input
          autoFocus
          aria-label="Search pedigrees"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs bg-muted border border-border rounded px-2 py-1.5 outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {!pedigrees || pedigrees.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">No pedigrees found</div>
        ) : (
          pedigrees.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => p.id !== currentId && onOpen(p.id, p.title)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                p.id === currentId ? "opacity-40 cursor-not-allowed" : "hover:bg-accent cursor-pointer"
              }`}
            >
              <Dna className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="truncate flex-1">{p.title}</span>
              {p.id === currentId && <span className="text-primary text-xs flex-shrink-0">open</span>}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  );
}
