import { useId } from "react";

/**
 * Mini gráfico de linha com área degradê. Extraído de precos.tsx pra ser
 * reusado no StatCard e no card de preço do produtor.
 */
export function Sparkline({
  data,
  color = "var(--chart-1)",
  className = "h-11 w-full",
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  // useId em vez de derivar do `color`: duas sparklines da mesma cor na mesma
  // página gerariam o mesmo id de gradiente e uma sobrescreveria a outra.
  const gradId = `spark-${useId().replace(/:/g, "")}`;

  if (data.length < 2) {
    return <div className={className} />;
  }

  const w = 100;
  const h = 34;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = (max - min) * 0.25 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 4) + 2;
    const y = h - ((v - lo) / (hi - lo)) * (h - 6) - 3;
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const areaPath = `${linePath} L${last[0]},${h} L${first[0]},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`${className} overflow-visible`} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  );
}
