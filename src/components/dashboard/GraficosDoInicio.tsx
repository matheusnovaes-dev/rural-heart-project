import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type PrecoHistorico = { preco: number; data_referencia: string; updated_at: string | null };
type PrecoRegionalHistorico = { regiao: string; preco: number; data_referencia: string };

function dataEixo(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

/**
 * Gráfico de verdade (eixo, tooltip) pro preço hoje, não só a sparkline
 * minúscula de antes — achado real 2026-10-08: o painel de preços
 * (/dashboard/precos) já tinha um gráfico completo com recharts, mas a
 * primeira tela que o produtor vê (essa aqui) só mostrava uma linha SVG sem
 * nenhum eixo. "Bater o olho e parecer profissional" significa ter o
 * gráfico de verdade logo na entrada, não só no segundo clique. Usa a MESMA
 * série de 90 dias que buscarPrecosDaUf já busca (lib/precos.ts,
 * DIAS_DE_HISTORICO), só visualizada melhor — nenhum dado novo.
 */
export function PrecoHeroChart({
  serie,
  cultura,
}: {
  serie: PrecoHistorico[];
  cultura: string | null;
}) {
  const gradId = `preco-hero-${useId().replace(/:/g, "")}`;
  const dados = serie.map((s) => ({ data: dataEixo(s.data_referencia), preco: s.preco }));
  const config: ChartConfig = {
    preco: { label: cultura ?? "Preço", color: "var(--primary-foreground)" },
  };

  return (
    <ChartContainer config={config} className="aspect-auto h-36 w-full sm:h-40">
      <AreaChart data={dados} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary-foreground)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary-foreground)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          stroke="color-mix(in oklab, var(--primary-foreground) 15%, transparent)"
        />
        <XAxis
          dataKey="data"
          tickLine={false}
          axisLine={false}
          minTickGap={48}
          tick={{ fontSize: 12, fill: "var(--primary-foreground)", fillOpacity: 0.8 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value) => (
                <span className="font-mono font-medium tabular-nums text-foreground">
                  R$ {Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="preco"
          type="monotone"
          stroke="var(--primary-foreground)"
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4, fill: "var(--primary-foreground)", strokeWidth: 0 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

// Até 4 praças de cada vez na prática (mais que isso vira espaguete difícil
// de ler de qualquer forma) — cores claras o bastante pra aparecer no fundo
// escuro do card, a 1ª igual ao PrecoHeroChart (branco) pra manter o mesmo
// idioma visual entre os dois casos.
const CORES_REGIAO = [
  "var(--primary-foreground)",
  "var(--gold)",
  "oklch(0.78 0.12 200)",
  "oklch(0.8 0.12 320)",
];

/**
 * Mesma ideia do PrecoHeroChart, pro caso em que o estado não tem preço
 * único (só praças regionais, ex: MG/SP na soja) — achado real 2026-10-09:
 * esse caminho nunca teve elemento gráfico nenhum, só a lista de texto
 * abaixo continua. Usa regionaisHistorico (90 dias por praça, de
 * buscarPrecosDaUf) em vez de uma consulta nova.
 */
export function PrecoRegionalHeroChart({ regioes }: { regioes: PrecoRegionalHistorico[] }) {
  const porData = new Map<string, Record<string, string | number>>();
  for (const r of regioes) {
    const chave = r.data_referencia;
    if (!porData.has(chave)) porData.set(chave, { data: dataEixo(chave) });
    porData.get(chave)![r.regiao] = r.preco;
  }
  const dados = [...porData.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const nomesRegiao = [...new Set(regioes.map((r) => r.regiao))];

  // Sem pontos suficientes pra desenhar uma linha de verdade, nem tenta —
  // melhor a lista de texto sozinha do que um gráfico quase vazio.
  if (dados.length < 3 || nomesRegiao.length === 0) return null;

  const config: ChartConfig = {};
  nomesRegiao.forEach((nome, i) => {
    config[nome] = { label: nome, color: CORES_REGIAO[i % CORES_REGIAO.length]! };
  });

  return (
    <ChartContainer config={config} className="aspect-auto h-36 w-full sm:h-40">
      <LineChart data={dados} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          stroke="color-mix(in oklab, var(--primary-foreground) 15%, transparent)"
        />
        <XAxis
          dataKey="data"
          tickLine={false}
          axisLine={false}
          minTickGap={48}
          tick={{ fontSize: 12, fill: "var(--primary-foreground)", fillOpacity: 0.8 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value) => (
                <span className="font-mono font-medium tabular-nums text-foreground">
                  R$ {Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              )}
            />
          }
        />
        {nomesRegiao.map((nome, i) => (
          <Line
            key={nome}
            dataKey={nome}
            type="monotone"
            stroke={CORES_REGIAO[i % CORES_REGIAO.length]!}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
