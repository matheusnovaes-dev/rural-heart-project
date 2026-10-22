import { useId, useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Gráfico do histórico de preço com dado REAL (a mesma série de 90 dias que o painel usa), para a prévia do painel no
 * desktop: passe o mouse e veja a data e o preço de cada dia. Só aparece em telas largas com mouse (`desk`); no celular
 * o contêiner é `display: none`, então nada é medido nem desenhado lá. SVG puro, sem biblioteca.
 */
type Ponto = { data: string; preco: number };

const L = 640;
const A = 150;
const MARGEM = { topo: 12, base: 20, lado: 6 };

const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function GraficoPrecoReal({ serie, titulo }: { serie: Ponto[]; titulo: string }) {
  const idGrad = useId().replace(/:/g, "");
  const [indice, setIndice] = useState<number | null>(null);

  const g = useMemo(() => {
    const valores = serie.map((p) => p.preco);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const folga = (max - min || 1) * 0.12;
    const lo = min - folga;
    const hi = max + folga;
    const x = (i: number) => MARGEM.lado + (i / (serie.length - 1)) * (L - 2 * MARGEM.lado);
    const y = (v: number) =>
      MARGEM.topo + (1 - (v - lo) / (hi - lo)) * (A - MARGEM.topo - MARGEM.base);
    const linha = serie
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.preco).toFixed(1)}`)
      .join(" ");
    const area = `${linha} L${x(serie.length - 1).toFixed(1)},${A - MARGEM.base} L${x(0).toFixed(1)},${A - MARGEM.base} Z`;
    return { min, max, x, y, linha, area };
  }, [serie]);

  const foco = indice ?? serie.length - 1;
  const p = serie[foco]!;
  const primeiro = serie[0]!;
  const variacao = ((serie[serie.length - 1]!.preco - primeiro.preco) / primeiro.preco) * 100;

  function aoMover(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - r.left) / r.width;
    setIndice(Math.max(0, Math.min(serie.length - 1, Math.round(rel * (serie.length - 1)))));
  }

  return (
    <Card className="spot-off rounded-xl border-border shadow hidden gap-2 py-3 desk:block">
      <CardContent className="px-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
          <p className="text-xs text-muted-foreground">
            <span className="mr-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              dado real
            </span>
            {variacao >= 0 ? "+" : "−"}
            {Math.abs(variacao).toFixed(1).replace(".", ",")}% no período
          </p>
        </div>
        <div className="mt-1 flex items-end gap-2">
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            <span className="mr-0.5 align-top font-sans text-xs text-muted-foreground">R$</span>
            {brl(p.preco)}
          </p>
          <p className="mb-1 text-xs text-muted-foreground">{dm(p.data)}</p>
        </div>
        <svg
          viewBox={`0 0 ${L} ${A}`}
          role="img"
          aria-label={`${titulo}: de R$ ${brl(primeiro.preco)} a R$ ${brl(serie[serie.length - 1]!.preco)}`}
          className="mt-1 h-auto w-full touch-none"
          onPointerMove={aoMover}
          onPointerLeave={() => setIndice(null)}
        >
          <defs>
            <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[g.min, g.max].map((v) => (
            <g key={v}>
              <line
                x1={MARGEM.lado}
                x2={L - MARGEM.lado}
                y1={g.y(v)}
                y2={g.y(v)}
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeDasharray="3 4"
              />
              <text
                x={L - MARGEM.lado}
                y={g.y(v) - 3}
                textAnchor="end"
                fontSize="10"
                fill="currentColor"
                opacity="0.5"
              >
                {brl(v)}
              </text>
            </g>
          ))}
          <path d={g.area} fill={`url(#${idGrad})`} />
          <path
            d={g.linha}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            className="grafico-linha"
          />
          <line
            x1={g.x(foco)}
            x2={g.x(foco)}
            y1={MARGEM.topo}
            y2={A - MARGEM.base}
            stroke="var(--primary)"
            strokeOpacity="0.35"
          />
          <circle
            cx={g.x(foco)}
            cy={g.y(p.preco)}
            r="5"
            fill="var(--background)"
            stroke="var(--primary)"
            strokeWidth="2.5"
          />
          <text x={MARGEM.lado} y={A - 4} fontSize="10" fill="currentColor" opacity="0.5">
            {dm(primeiro.data)}
          </text>
          <text
            x={L - MARGEM.lado}
            y={A - 4}
            textAnchor="end"
            fontSize="10"
            fill="currentColor"
            opacity="0.5"
          >
            {dm(serie[serie.length - 1]!.data)}
          </text>
        </svg>
      </CardContent>
    </Card>
  );
}
