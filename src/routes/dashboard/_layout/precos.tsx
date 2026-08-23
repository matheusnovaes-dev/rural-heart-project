import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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

export const Route = createFileRoute("/dashboard/_layout/precos")({
  component: PrecosPage,
});

type PrecoRow = { uf: string; preco: number; data_referencia: string };

const chartConfig: ChartConfig = {
  preco: { label: "Preço (R$/saca)", color: "var(--color-primary)" },
};

function PrecosPage() {
  const [rows, setRows] = useState<PrecoRow[]>([]);
  const [uf, setUf] = useState<string>("todos");

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("precos")
      .select("uf, preco, data_referencia")
      .order("data_referencia", { ascending: true })
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const ufs = useMemo(() => [...new Set(rows.map((r) => r.uf))].sort(), [rows]);

  const chartData = useMemo(() => {
    const filtered = uf === "todos" ? rows : rows.filter((r) => r.uf === uf);
    return filtered.map((r) => ({
      data: new Date(r.data_referencia).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      preco: r.preco,
      uf: r.uf,
    }));
  }, [rows, uf]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Histórico de preço — Soja</CardTitle>
            <CardDescription>Fonte: Conab, atualizado diariamente</CardDescription>
          </div>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os UFs</SelectItem>
              {ufs.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Ainda sem dados de preço.
            </p>
          ) : (
            <ChartContainer config={chartConfig} className="h-72 w-full">
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
                <Line
                  dataKey="preco"
                  type="monotone"
                  stroke="var(--color-preco)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
