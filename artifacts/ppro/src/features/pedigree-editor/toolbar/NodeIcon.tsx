export function NodeIcon({ type }: { type: "male" | "female" | "unknown" | "sab" }) {
  const s = 14;
  return (
    <svg width={s} height={s} viewBox={`-${s / 2} -${s / 2} ${s} ${s}`}>
      {type === "male" && <rect x={-s / 2 + 0.5} y={-s / 2 + 0.5} width={s - 1} height={s - 1} fill="none" stroke="currentColor" strokeWidth={1.5} rx={0} />}
      {type === "female" && <circle cx={0} cy={0} r={s / 2 - 1.5} fill="none" stroke="currentColor" strokeWidth={1.5} />}
      {type === "unknown" && <polygon points={`0,${-s / 2 + 1} ${s / 2 - 1},0 0,${s / 2 - 1} ${-s / 2 + 1},0`} fill="none" stroke="currentColor" strokeWidth={1.5} />}
      {type === "sab" && <polygon points={`0,${s * 0.44} ${-s * 0.46},${-s * 0.3} ${s * 0.46},${-s * 0.3}`} fill="currentColor" opacity={0.5} stroke="currentColor" strokeWidth={1.5} />}
    </svg>
  );
}
