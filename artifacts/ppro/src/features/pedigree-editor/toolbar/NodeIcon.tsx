export function NodeIcon({ type }: { type: "male" | "female" | "unknown" | "sab" }) {
  const s = 12;
  return (
    <svg width={s} height={s} viewBox={`-${s / 2} -${s / 2} ${s} ${s}`}>
      {type === "male" && <rect x={-s / 2} y={-s / 2} width={s} height={s} fill="none" stroke="currentColor" strokeWidth={1} rx={1} />}
      {type === "female" && <circle cx={0} cy={0} r={s / 2 - 0.75} fill="none" stroke="currentColor" strokeWidth={1} />}
      {type === "unknown" && <polygon points={`0,${-s / 2} ${s / 2},${s / 4} ${-s / 2},${s / 4}`} fill="none" stroke="currentColor" strokeWidth={1} />}
      {type === "sab" && <polygon points={`0,${s * 0.44} ${-s * 0.46},${-s * 0.3} ${s * 0.46},${-s * 0.3}`} fill="currentColor" opacity={0.5} stroke="currentColor" strokeWidth={1} />}
    </svg>
  );
}