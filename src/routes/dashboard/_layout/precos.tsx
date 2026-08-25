import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { culturas } from "@/config/culturas";

export const Route = createFileRoute("/dashboard/_layout/precos")({
  component: PrecosPage,
});

type PrecoRow = { uf: string; preco: number; data_referencia: string; produto: string };

const UF_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return <div className="h-11 w-full" />;
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
  const gradId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full overflow-visible" aria-hidden="true">
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

function PrecosPage() {
  const [cultura, setCultura] = useState("soja");
  const [rawRows, setRawRows] = useState<PrecoRow[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) return;
    setHidden(new Set());
    supabase
      .from("precos")
      .select("uf, preco, data_referencia, produto")
      .ilike("produto", `%${cultura}%`)
      .order("data_referencia", { ascending: true })
      .then(({ data }) => setRawRows(data ?? []));
  }, [cultura]);

  // A busca por substring pode casar mais de uma variante de embalagem da
  // mesma cultura (ex: "ALHO COMUM (10 kg)" e "ALHO EXTRA ROXO NOBRE 5
  // (kg)") — misturar as duas no mesmo ponto do gráfico (por uf+data) faria
  // o preço pular sem sentido. Fica só com a variante mais publicada.
  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rawRows) counts.set(r.produto, (counts.get(r.produto) ?? 0) + 1);
    let principal: string | null = null;
    let max = 0;
    for (const [produto, count] of counts) {
      if (count > max) {
        max = count;
        principal = produto;
      }
    }
    return rawRows.filter((r) => r.produto === principal);
  }, [rawRows]);

  const culturaLabel = culturas.find((c) => c.value === cultura)?.label ?? cultura;

  const ufs = useMemo(() => [...new Set(rows.map((r) => r.uf))].sort(), [rows]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    ufs.forEach((uf, i) => {
      config[uf] = { label: uf, color: UF_COLORS[i % UF_COLORS.length] ?? "var(--color-chart-1)" };
    });
    return config;
  }, [ufs]);

  // Pivota por data: cada ponto do gráfico vira { data, GO: 122.1, MT: 123.4, ... }
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, string | number>>();
    for (const r of rows) {
      const label = new Date(r.data_referencia).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      if (!byDate.has(r.data_referencia)) {
        byDate.set(r.data_referencia, { data: label, _iso: r.data_referencia });
      }
      byDate.get(r.data_referencia)![r.uf] = r.preco;
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [rows]);

  const stats = useMemo(() => {
    return ufs.map((uf, i) => {
      const series = rows
        .filter((r) => r.uf === uf)
        .sort((a, b) => a.data_referencia.localeCompare(b.data_referencia));
      const atual = series.at(-1);
      const semanaPassada = series.at(-2);
      const variacao =
        atual && semanaPassada
          ? ((atual.preco - semanaPassada.preco) / semanaPassada.preco) * 100
          : null;
      const precos = series.map((s) => s.preco);
      return {
        uf,
        atual: atual?.preco ?? null,
        variacao,
        min: precos.length ? Math.min(...precos) : null,
        max: precos.length ? Math.max(...precos) : null,
        sparkline: precos.slice(-14),
        color: UF_COLORS[i % UF_COLORS.length] ?? "var(--color-chart-1)",
      };
    });
  }, [rows, ufs]);

  function toggleUf(uf: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(uf)) next.delete(uf);
      else next.add(uf);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Preços
        </h1>
        <Select value={cultura} onValueChange={setCultura}>
          <SelectTrigger className="w-55">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {culturas.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stats.length > 0 && (
        <div className="@container">
          <div className="grid gap-4 @lg:grid-cols-2 @2xl:grid-cols-3">
            {stats.map((s) => (
              <Card key={s.uf} className="gap-3 py-4">
                <CardHeader className="gap-1 pb-0">
                  <CardDescription className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {culturaLabel} · {s.uf}
                  </CardDescription>
                  <CardTitle className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                    {s.atual != null ? (
                      <>
                        <span className="mr-0.5 align-top text-base font-sans font-semibold text-muted-foreground">
                          R$
                        </span>
                        {formatBRL(s.atual)}
                      </>
                    ) : (
                      "—"
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 pb-0">
                  <div className="flex items-center justify-between">
                    {s.variacao != null ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.variacao > 0
                            ? "bg-primary/10 text-primary"
                            : s.variacao < 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.variacao > 0 ? (
                          <ArrowUp className="size-3" />
                        ) : s.variacao < 0 ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <Minus className="size-3" />
                        )}
                        {Math.abs(s.variacao).toFixed(1)}% sem.
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem histórico</span>
                    )}
                    {s.min != null && s.max != null && (
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatBRL(s.min)} – {formatBRL(s.max)}
                      </span>
                    )}
                  </div>
                  <Sparkline data={s.sparkline} color={s.color} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg font-semibold">
            Histórico de preço — {culturaLabel}
          </CardTitle>
          <CardDescription>
            Fonte: Conab, atualizado diariamente. Clique num UF na legenda pra esconder/mostrar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Ainda sem dados de preço.
            </p>
          ) : (
            <ChartContainer config={chartConfig} className="h-80 w-full">
              <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="data"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fontFamily: "var(--font-mono)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tick={{ fontSize: 12, fontFamily: "var(--font-mono)" }}
                  tickFormatter={(v) => `R$${v}`}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin - 2),
                    (dataMax: number) => Math.ceil(dataMax + 2),
                  ]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend
                  onClick={(e) => toggleUf(String(e.dataKey))}
                  wrapperStyle={{ cursor: "pointer", fontSize: 13 }}
                />
                {ufs.map((uf) => (
                  <Line
                    key={uf}
                    dataKey={uf}
                    type="monotone"
                    stroke={`var(--color-${uf})`}
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 4 }}
                    hide={hidden.has(uf)}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
