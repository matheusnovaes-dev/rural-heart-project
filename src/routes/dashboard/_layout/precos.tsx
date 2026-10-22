import { ehFonteMensal } from "@/lib/precoFonte";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, ChevronDown, LineChart as LineChartIcon, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";
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
import { culturas, filtrarPorProduto } from "@/config/culturas";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { ContextoMercado } from "@/components/dashboard/ContextoMercado";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/_layout/precos")({
  component: PrecosPage,
});

type PrecoRow = {
  uf: string;
  regiao: string;
  preco: number;
  data_referencia: string;
  produto: string;
  fonte?: string;
};

/** Chave de série do gráfico: "PR" quando é preço único do estado, "MG ·
 * Paracatú / Unaí" quando a fonte só publica por praça (BBM/IEA-SP) — nunca
 * junta as duas coisas debaixo do mesmo "MG" nem inventa uma média entre
 * regiões, só mostra a granularidade real que a fonte publica. */
function chaveSerie(r: { uf: string; regiao: string }) {
  return r.regiao ? `${r.uf} · ${r.regiao}` : r.uf;
}

const QTD_VISIVEL_PADRAO = 6;
// Cartões de cotação visíveis antes de "ver todas as praças" (a página chegava a ~9.300px no celular).
const QTD_CARTOES_INICIAL = 6;
// 2 anos inteiros de semanas espremidas num gráfico só viram ruído
// ilegível (era exatamente esse o bug: eixo X com dois anos de marcações,
// linhas praticamente invisíveis de tão finas/esparsas). 6 meses dá uma
// leitura de tendência de verdade sem sobrecarregar.
const JANELA_DIAS = 180;

// Os 5 primeiros UFs usam os tokens de marca já definidos em styles.css
// (--chart-1..5). A partir do 6º, gera cor no mesmo espaço OKLCH (mesma
// luminosidade/croma dos tokens), variando só o matiz — garante que nenhum
// UF repete cor, não importa quantos apareçam no gráfico.
function corDoUf(index: number) {
  // Atenção: o token real é --chart-N (sem "-color-"). --color-chart-N só
  // existe dentro do bloco @theme inline do Tailwind (vira classe utilitária
  // tipo bg-chart-1), não é uma custom property de verdade utilizável via
  // var() em atributo/estilo solto — usar ela faz o stroke resolver pra
  // "none" silenciosamente, sem erro nenhum no console.
  if (index < 5) return `var(--chart-${index + 1})`;
  const matiz = (index * 47) % 360;
  return `oklch(0.6 0.1 ${matiz})`;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PrecosPage() {
  const [cultura, setCultura] = useState("soja");
  const [rawRows, setRawRows] = useState<PrecoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [visiveis, setVisiveis] = useState<Set<string> | null>(null);
  const [todasAsPracas, setTodasAsPracas] = useState(false);
  useEffect(() => setTodasAsPracas(false), [cultura]);

  useEffect(() => {
    if (!supabase) return;
    setVisiveis(null);
    setCarregando(true);
    const desde = new Date();
    desde.setDate(desde.getDate() - JANELA_DIAS);
    // O servidor devolve no máximo 1000 linhas por consulta. Com histórico por praça (BBM) a janela de
    // 180 dias de soja passa de 2.700 linhas e, ordenando do mais antigo, cortava justamente as
    // cotações recentes: os cartões mostravam preço de meses atrás (achado 2026-10-15). Busca em páginas.
    const TAMANHO_PAGINA = 1000;
    let cancelado = false;
    (async () => {
      const acumuladas: PrecoRow[] = [];
      for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
        const { data, error } = await filtrarPorProduto(
          supabase!.from("precos").select("uf, regiao, preco, data_referencia, produto, fonte"),
          cultura,
        )
          .gte("data_referencia", desde.toISOString().slice(0, 10))
          .order("data_referencia", { ascending: true })
          .order("id", { ascending: true })
          .range(inicio, inicio + TAMANHO_PAGINA - 1);
        if (error || !data) break;
        acumuladas.push(...(data as PrecoRow[]));
        if (data.length < TAMANHO_PAGINA) break;
      }
      if (cancelado) return;
      setRawRows(acumuladas);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [cultura]);

  // A busca por substring pode casar mais de uma variante de embalagem da
  // mesma cultura (ex: "ALHO COMUM (10 kg)" e "ALHO EXTRA ROXO NOBRE 5
  // (kg)") — misturar as duas na mesma série faria o preço pular sem
  // sentido. Fica só com a variante mais publicada POR SÉRIE (uf ou uf ·
  // região), não globalmente — bug real achado testando: cortar
  // globalmente fazia o RS inteiro sumir do gráfico de trigo, porque
  // "TRIGO (DERAL-PR)" (373 linhas, PR) tinha mais histórico que qualquer
  // variante de trigo do RS, mesmo sendo de outro estado.
  const rows = useMemo(() => {
    const porSerie = new Map<string, PrecoRow[]>();
    for (const r of rawRows) {
      const serie = chaveSerie(r);
      const lista = porSerie.get(serie);
      if (lista) lista.push(r);
      else porSerie.set(serie, [r]);
    }

    const resultado: PrecoRow[] = [];
    for (const linhasDaSerie of porSerie.values()) {
      const counts = new Map<string, number>();
      for (const r of linhasDaSerie) counts.set(r.produto, (counts.get(r.produto) ?? 0) + 1);
      let principal: string | null = null;
      let max = 0;
      for (const [produto, count] of counts) {
        if (count > max) {
          max = count;
          principal = produto;
        }
      }
      resultado.push(...linhasDaSerie.filter((r) => r.produto === principal));
    }
    return resultado;
  }, [rawRows]);

  const culturaLabel = culturas.find((c) => c.value === cultura)?.label ?? cultura;

  // Ordenado por quantidade de pontos (série mais completa primeiro) — não
  // é alfabético porque ordem de série não carrega nenhum significado aqui.
  const series = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(chaveSerie(r), (counts.get(chaveSerie(r)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([serie]) => serie);
  }, [rows]);

  const corPorSerie = useMemo(() => {
    const map = new Map<string, string>();
    series.forEach((serie, i) => map.set(serie, corDoUf(i)));
    return map;
  }, [series]);

  // Começa mostrando só as séries com mais histórico — todo mundo junto de
  // uma vez, com 15+ estados/regiões, vira espaguete ilegível independente
  // de cor.
  useEffect(() => {
    if (visiveis !== null || series.length === 0) return;
    setVisiveis(new Set(series.slice(0, QTD_VISIVEL_PADRAO)));
  }, [series, visiveis]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    series.forEach((serie, i) => {
      config[serie] = { label: serie, color: corDoUf(i) };
    });
    return config;
  }, [series]);

  // Pivota por data: cada ponto do gráfico vira { data, GO: 122.1, "MG · Paracatú / Unaí": 143, ... }
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
      byDate.get(r.data_referencia)![chaveSerie(r)] = r.preco;
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [rows]);

  const stats = useMemo(() => {
    return series.map((serie) => {
      const pontos = rows
        .filter((r) => chaveSerie(r) === serie)
        .sort((a, b) => a.data_referencia.localeCompare(b.data_referencia));
      const atual = pontos.at(-1);
      const semanaPassada = pontos.at(-2);
      const variacao =
        atual && semanaPassada && semanaPassada.preco !== 0
          ? ((atual.preco - semanaPassada.preco) / semanaPassada.preco) * 100
          : null;
      const precos = pontos.map((p) => p.preco);
      return {
        serie,
        atual: atual?.preco ?? null,
        variacao,
        // Fonte mensal (IEA-SP): a variação é contra o MÊS anterior, não contra a semana passada.
        mensal: !!atual?.fonte && ehFonteMensal(atual.fonte),
        min: precos.length ? Math.min(...precos) : null,
        max: precos.length ? Math.max(...precos) : null,
        sparkline: precos.slice(-14),
        color: corPorSerie.get(serie) ?? corDoUf(0),
      };
    });
  }, [rows, series, corPorSerie]);

  // Colapsa só quando esconde ao menos 3 cartões (esconder 1 ou 2 não compensa o clique).
  const colapsavel = stats.length > QTD_CARTOES_INICIAL + 2;
  const cartoesMostrados =
    colapsavel && !todasAsPracas ? stats.slice(0, QTD_CARTOES_INICIAL) : stats;

  function toggleSerie(serie: string) {
    setVisiveis((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(serie)) next.delete(serie);
      else next.add(serie);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={IconesSafralume.preco}
        iconePersonalizado
        title="Preços"
        description="Cotação por estado, e por região onde só existir isso"
        action={
          <Select value={cultura} onValueChange={setCultura}>
            <SelectTrigger className="w-55" aria-label="Cultura">
              <SelectValue placeholder="Cultura" />
            </SelectTrigger>
            <SelectContent>
              {culturas.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <ContextoMercado cultura={cultura} />

      {carregando ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        stats.length > 0 && (
          <div className="@container">
            <div className="grid gap-4 @lg:grid-cols-2 @2xl:grid-cols-3">
              {cartoesMostrados.map((s, index) => (
                <motion.div
                  key={s.serie}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card className="card-premium gap-3 py-4">
                    <CardHeader className="gap-1 pb-0">
                      <CardDescription className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {culturaLabel} · {s.serie}
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
                          "-"
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
                                  ? "bg-destructive/10 text-red-800"
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
                            {Math.abs(s.variacao) < 0.05
                              ? "estável"
                              : `${Math.abs(s.variacao).toFixed(1)}% ${s.mensal ? "mês" : "sem."}`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem histórico</span>
                        )}
                        {s.min != null && s.max != null && (
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatBRL(s.min)} – {formatBRL(s.max)}
                          </span>
                        )}
                      </div>
                      <Sparkline data={s.sparkline} color={s.color} animar />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
            {colapsavel && (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  aria-expanded={todasAsPracas}
                  onClick={() => setTodasAsPracas((v) => !v)}
                >
                  {todasAsPracas ? "Mostrar menos" : `Ver todas as praças (${stats.length})`}
                  <ChevronDown
                    className={`size-4 transition-transform ${todasAsPracas ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </Button>
              </div>
            )}
          </div>
        )
      )}

      {/* Enquanto os preços carregam, o histórico nem aparece: o esqueleto dele ficava embaixo da grade e era
          empurrado centenas de pixels quando os cartões chegavam (maior pulo de layout da página). */}
      {!carregando && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg font-semibold">
              Histórico de preço · {culturaLabel}
            </CardTitle>
            <CardDescription>
              Últimos 6 meses · estado inteiro quando tem, por região quando a fonte só publica
              assim
              {series.length > QTD_VISIVEL_PADRAO &&
                ` · mostrando as ${QTD_VISIVEL_PADRAO} séries com mais histórico, clique pra ver outras`}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {series.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {series.map((serie) => {
                  const ativo = visiveis?.has(serie) ?? false;
                  const cor = corPorSerie.get(serie) ?? corDoUf(0);
                  return (
                    <button
                      key={serie}
                      type="button"
                      onClick={() => toggleSerie(serie)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-11 ${
                        ativo
                          ? "border-transparent bg-secondary text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full transition-opacity"
                        style={{ backgroundColor: cor, opacity: ativo ? 1 : 0.35 }}
                      />
                      {serie}
                    </button>
                  );
                })}
              </div>
            )}

            {carregando ? (
              <Skeleton className="h-80 w-full" />
            ) : chartData.length === 0 ? (
              <EmptyState
                icon={LineChartIcon}
                title="Sem dados pra essa cultura"
                description={`Ainda não temos preço de ${culturaLabel.toLowerCase()} nos últimos 6 meses, nem por estado nem por região. Tente outra cultura no seletor acima.`}
              />
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
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span
                                className="size-2 shrink-0 rounded-[2px]"
                                style={{ backgroundColor: corPorSerie.get(String(name)) }}
                              />
                              {name}
                            </span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              R$ {formatBRL(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  {series.map((serie) => (
                    <Line
                      key={serie}
                      dataKey={serie}
                      type="monotone"
                      stroke={corPorSerie.get(serie)}
                      strokeWidth={2.25}
                      dot={false}
                      activeDot={{ r: 4 }}
                      hide={!(visiveis?.has(serie) ?? false)}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
