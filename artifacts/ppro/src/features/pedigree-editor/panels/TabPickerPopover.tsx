import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useListPedigrees } from "@workspace/api-client-react";
import { Dna, Upload } from "lucide-react";
import { ImportDialog } from "@/components/ImportDialog";

export function TabPickerPopover({
  currentId,
  openTabIds,
  onClose,
  onOpen,
}: {
  currentId: number;
  openTabIds: Set<number>;
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
      if (panelRef.current && !panelRef.current.contains(target) && !target.closest("[data-tab-picker-trigger]") && !target.closest('[role="dialog"]')) {
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
      className="fixed z-50 bg-card/95 backdrop-blur-md border border-border/80 rounded-xl shadow-xl w-72"
      style={pos ? { top: pos.top, left: pos.left } : { display: "none" }}
    >
      <div className="p-2 border-b border-border">
        <input
          autoFocus
          aria-label="Search pedigrees"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs bg-background border border-border/80 rounded-lg px-2.5 py-1.5 outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 text-foreground placeholder:text-muted-foreground transition-all duration-200"
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
              onClick={() => {
                if (!openTabIds.has(p.id)) {
                  onOpen(p.id, p.title);
                  onClose();
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                openTabIds.has(p.id) ? "opacity-40 cursor-not-allowed" : "hover:bg-accent cursor-pointer"
              }`}
            >
              <Dna className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="truncate flex-1">{p.title}</span>
              {openTabIds.has(p.id) && <span className="text-muted-foreground text-xs flex-shrink-0">open</span>}
            </button>
          ))
        )}
      </div>
      <div className="border-t border-border p-1.5">
        <ImportDialog>
          <button type="button" className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md hover:bg-accent text-primary font-medium transition-colors">
            <Upload className="w-3 h-3" />
            <span>Import</span>
          </button>
        </ImportDialog>
      </div>
    </div>,
    document.body
  );
}
