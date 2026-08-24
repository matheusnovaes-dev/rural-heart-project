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
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/dashboard/_layout/precos")({
  component: PrecosPage,
});

type PrecoRow = { uf: string; preco: number; data_referencia: string };

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

function PrecosPage() {
  const [rows, setRows] = useState<PrecoRow[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("precos")
      .select("uf, preco, data_referencia")
      .order("data_referencia", { ascending: true })
      .then(({ data }) => setRows(data ?? []));
  }, []);

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
    return ufs.map((uf) => {
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
      {stats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Card key={s.uf}>
              <CardHeader className="pb-2">
                <CardDescription>Soja — {s.uf}</CardDescription>
                <CardTitle className="text-2xl">
                  {s.atual != null ? `R$ ${formatBRL(s.atual)}` : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                {s.variacao != null ? (
                  <span
                    className={`flex items-center gap-1 font-medium ${
                      s.variacao > 0
                        ? "text-primary"
                        : s.variacao < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {s.variacao > 0 ? (
                      <ArrowUp className="size-3.5" />
                    ) : s.variacao < 0 ? (
                      <ArrowDown className="size-3.5" />
                    ) : (
                      <Minus className="size-3.5" />
                    )}
                    {Math.abs(s.variacao).toFixed(1)}% na semana
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sem histórico suficiente</span>
                )}
                {s.min != null && s.max != null && (
                  <span className="text-muted-foreground">
                    Mín R${formatBRL(s.min)} · Máx R${formatBRL(s.max)}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de preço — Soja</CardTitle>
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
                <CartesianGrid vertical={false} />
                <XAxis dataKey="data" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => `R$${v}`}
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
                    strokeWidth={2}
                    dot={false}
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
