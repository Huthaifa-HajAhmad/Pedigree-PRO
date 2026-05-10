function LegendSymbol({ k }: { k: string }) {
  const G = "hsl(var(--primary))";
  const W = "rgba(255,255,255,0.6)";
  if (k === "male") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <rect x={-5} y={-5} width={10} height={10} fill="none" stroke={W} strokeWidth={1.5} rx={1} />
    </svg>
  );
  if (k === "female") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <circle r={5} fill="none" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "unknown") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <polygon points="0,-5 5.5,3 -5.5,3" fill="none" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "pregnancy") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <polygon points="0,-5.5 5.5,0 0,5.5 -5.5,0" fill="none" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "sab") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <polygon points="0,5 -5.5,-3 5.5,-3" fill="rgba(200,200,200,0.3)" stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "affected") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <circle r={5} fill={G} opacity={0.5} stroke={G} strokeWidth={1.5} />
    </svg>
  );
  if (k === "carrier") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <circle r={5} fill="none" stroke={W} strokeWidth={1.5} />
      <circle r={2.5} fill={G} opacity={0.9} />
    </svg>
  );
  if (k === "deceased") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <rect x={-5} y={-5} width={10} height={10} fill="none" stroke={W} strokeWidth={1.5} rx={1} />
      <line x1={-6} y1={6} x2={6} y2={-6} stroke={W} strokeWidth={1.2} />
    </svg>
  );
  if (k === "proband") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <text x={-6} y={5} fontSize={11} fill={G} style={{ fontFamily: "monospace" }}>→</text>
    </svg>
  );
  if (k === "couple") return (
    <svg width={22} height={14} viewBox="-11 -7 22 14">
      <line x1={-9} y1={0} x2={9} y2={0} stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "consanguinity") return (
    <svg width={22} height={14} viewBox="-11 -7 22 14">
      <line x1={-9} y1={-2.5} x2={9} y2={-2.5} stroke={W} strokeWidth={1.5} />
      <line x1={-9} y1={2.5} x2={9} y2={2.5} stroke={W} strokeWidth={1.5} />
    </svg>
  );
  if (k === "parent-child") return (
    <svg width={14} height={14} viewBox="-7 -7 14 14">
      <line x1={0} y1={-5} x2={0} y2={5} stroke={W} strokeWidth={1.5} />
      <line x1={-4} y1={0} x2={4} y2={0} stroke={W} strokeWidth={1.5} />
    </svg>
  );
  return null;
}

export function LegendPanel({ entries }: { entries: Array<{ key: string; label: string }> }) {
  if (entries.length === 0) return null;
  return (
    <div
      className="absolute bottom-10 right-3 z-10 rounded border border-border p-3 pointer-events-none"
      style={{ background: "rgba(8,8,8,0.92)", backdropFilter: "blur(8px)", minWidth: 176 }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-widest mb-2.5"
        style={{ color: "rgba(255,255,255,0.35)", fontFamily: "JetBrains Mono, monospace" }}
      >
        Legend
      </div>
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.key} className="flex items-center gap-2.5">
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 22 }}>
              <LegendSymbol k={e.key} />
            </div>
            <span
              className="text-xs leading-tight"
              style={{ color: "rgba(255,255,255,0.55)", fontFamily: "JetBrains Mono, monospace" }}
            >
              {e.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}