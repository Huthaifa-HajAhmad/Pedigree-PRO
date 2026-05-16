import { useState, useEffect, useRef } from "react";
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
  const { data: pedigrees } = useListPedigrees({ search: search || undefined });
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest("[data-tab-picker]")) onCloseRef.current();
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

  return (
    <div data-tab-picker className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded shadow-xl z-50" style={{ background: "hsl(var(--card))" }}>
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
    </div>
  );
}