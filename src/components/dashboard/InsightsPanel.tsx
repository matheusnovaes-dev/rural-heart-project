import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CloudRain,
  Gauge,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { buscarPrevisao } from "@/lib/clima";
import { temAcessoPrata, useAssinatura } from "@/lib/planos";
import type { Produtor } from "@/lib/auth";

type PrecoPonto = { preco: number; data_referencia: string; produto: string; uf: string };

// Mesma proteção usada em precos.tsx: a busca por substring pode casar mais
// de uma variante de embalagem da mesma cultura — fica só com a mais
// publicada, senão a tendência mistura séries diferentes.
function serieUnica(rows: PrecoPonto[]) {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.produto, (counts.get(r.produto) ?? 0) + 1);
  let principal: string | null = null;
  let max = 0;
  for (const [produto, count] of counts) {
    if (count > max) {
      max = count;
      principal = produto;
    }
  }
  return rows
    .filter((r) => r.produto === principal)
    .sort((a, b) => a.data_referencia.localeCompare(b.data_referencia));
}

function variacaoDuasSemanas(serie: PrecoPonto[]) {
  const atual = serie.at(-1);
  if (!atual) return null;
  const limite = new Date(atual.data_referencia);
  limite.setDate(limite.getDate() - 14);
  const limiteIso = limite.toISOString().slice(0, 10);
  const referencia = [...serie].reverse().find((p) => p.data_referencia <= limiteIso);
  if (!referencia) return null;
  return {
    atual,
    referencia,
    variacao: ((atual.preco - referencia.preco) / referencia.preco) * 100,
  };
}

function mediana(valores: number[]) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1]! + ordenados[meio]!) / 2
    : ordenados[meio]!;
}

// Duas checagens sem IA pra separar "movimento de mercado real" de "erro de
// dado na fonte", sem esconder o número em nenhum dos dois casos:
// (1) erro clássico de vírgula/casa decimal — a razão bate quase exato em
//     10x/100x; (2) o UF anda descolado dos vizinhos — commodity costuma se
//     mover junto entre estados, se só um UF disparou é bandeira vermelha.
function detectarAnomalia(
  atual: number,
  referencia: number,
  variacao: number,
  variacoesOutrasUfs: number[],
) {
  const razao = atual / referencia;
  const fatorSuspeito = [10, 0.1, 100, 0.01].some((f) => Math.abs(razao / f - 1) < 0.05);
  if (fatorSuspeito) {
    return "Variação bate com um erro clássico de casa decimal na fonte — confira antes de decidir.";
  }

  if (variacoesOutrasUfs.length >= 3) {
    const medianaOutras = Math.abs(mediana(variacoesOutrasUfs) ?? 0);
    const destoante = Math.abs(variacao) > 15 && Math.abs(variacao) > medianaOutras * 3 + 5;
    if (destoante) {
      return "Os outros estados não mostraram movimento parecido essa semana — pode ser atualização pontual do dado, vale conferir.";
    }
  }

  return null;
}

function InsightCard({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof TrendingUp;
  tone: "up" | "down" | "neutral" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const toneClasses = {
    up: "bg-primary/10 text-primary",
    down: "bg-destructive/10 text-destructive",
    neutral: "bg-secondary text-muted-foreground",
    warn: "bg-cta/10 text-cta-foreground",
  }[tone];

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="gap-0 pb-0">
        <div className="flex items-center gap-2">
          <span className={`flex size-7 items-center justify-center rounded-full ${toneClasses}`}>
            <Icon className="size-3.5" />
          </span>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-0 text-sm text-foreground">{children}</CardContent>
    </Card>
  );
}

export function InsightsPanel({ produtor }: { produtor: Produtor }) {
  const { plano, loading: loadingPlano } = useAssinatura();
  const [serie, setSerie] = useState<PrecoPonto[] | null>(null);
  const [todasUfs, setTodasUfs] = useState<PrecoPonto[]>([]);
  const [temAlertaAtivo, setTemAlertaAtivo] = useState<boolean | null>(null);
  const [diasDeChuva, setDiasDeChuva] = useState<number | null>(null);

  const cultura = produtor.cultura_principal;
  const uf = produtor.uf;

  useEffect(() => {
    if (!supabase || !cultura || !uf) return;
    const desde = new Date();
    desde.setDate(desde.getDate() - 90);

    // Sem filtro de UF de propósito: além da série do próprio produtor,
    // precisamos do preço da mesma cultura nos outros estados pra checar se
    // uma variação grande é um evento de mercado real (todo mundo se move
    // junto) ou só um dado estranho desse UF específico.
    supabase
      .from("precos")
      .select("preco, data_referencia, produto, uf")
      .ilike("produto", `%${cultura}%`)
      .gte("data_referencia", desde.toISOString().slice(0, 10))
      .order("data_referencia", { ascending: true })
      .then(({ data }) => {
        const deduped = serieUnica(data ?? []);
        setSerie(deduped.filter((r) => r.uf === uf));
        setTodasUfs(deduped);
      });

    supabase
      .from("alertas_preco")
      .select("id, cultura")
      .eq("produtor_id", produtor.id)
      .eq("ativo", true)
      .is("disparado_em", null)
      .then(({ data }) => {
        const match = (data ?? []).some(
          (a) =>
            a.cultura.toLowerCase().includes(cultura) || cultura.includes(a.cultura.toLowerCase()),
        );
        setTemAlertaAtivo(match);
      });
  }, [cultura, uf, produtor.id]);

  useEffect(() => {
    if (!uf || !temAcessoPrata(plano)) return;
    buscarPrevisao(uf).then((previsao) => {
      if (!previsao) return;
      const riscosos = previsao.chuvaPct.filter((p) => p >= 60).length;
      setDiasDeChuva(riscosos);
    });
  }, [uf, plano]);

  if (!cultura || !uf) return null;
  if (serie === null || loadingPlano) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (serie.length === 0) return null;

  const tendencia = variacaoDuasSemanas(serie);
  const precos = serie.map((p) => p.preco);
  const min = Math.min(...precos);
  const max = Math.max(...precos);
  const posicao = max > min ? ((serie.at(-1)!.preco - min) / (max - min)) * 100 : null;

  let anomalia: string | null = null;
  if (tendencia) {
    const outrasUfs = [...new Set(todasUfs.map((r) => r.uf))].filter((u) => u !== uf);
    const variacoesOutrasUfs = outrasUfs
      .map((u) => variacaoDuasSemanas(todasUfs.filter((r) => r.uf === u))?.variacao)
      .filter((v): v is number => v != null);
    anomalia = detectarAnomalia(
      tendencia.atual.preco,
      tendencia.referencia.preco,
      tendencia.variacao,
      variacoesOutrasUfs,
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tendencia && (
        <InsightCard
          icon={anomalia ? AlertTriangle : tendencia.variacao >= 0 ? TrendingUp : TrendingDown}
          tone={
            anomalia
              ? "warn"
              : tendencia.variacao > 0.5
                ? "up"
                : tendencia.variacao < -0.5
                  ? "down"
                  : "neutral"
          }
          title="Tendência (2 semanas)"
        >
          {Math.abs(tendencia.variacao) < 0.5 ? (
            "Preço estável, sem variação relevante."
          ) : (
            <>
              {tendencia.variacao > 0 ? "Subiu" : "Caiu"}{" "}
              <span className="font-mono font-semibold tabular-nums">
                {Math.abs(tendencia.variacao).toFixed(1)}%
              </span>{" "}
              nas últimas 2 semanas.
            </>
          )}
          {anomalia && <p className="mt-1.5 text-xs text-cta-foreground/80">{anomalia}</p>}
        </InsightCard>
      )}

      {posicao != null && (
        <InsightCard icon={Gauge} tone="neutral" title="Faixa de 90 dias">
          Preço atual está{" "}
          <span className="font-mono font-semibold tabular-nums">{posicao.toFixed(0)}%</span> do
          caminho entre a mínima (
          <span className="font-mono tabular-nums">R$ {min.toFixed(2)}</span>) e a máxima (
          <span className="font-mono tabular-nums">R$ {max.toFixed(2)}</span>) do período.
        </InsightCard>
      )}

      {temAlertaAtivo === false && (
        <InsightCard icon={Bell} tone="warn" title="Sem alerta ativo">
          <p className="mb-2">
            Você não tem nenhum alerta de preço pra essa cultura. Crie um pra ser avisado quando o
            preço cruzar um valor.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/alertas">Criar alerta</Link>
          </Button>
        </InsightCard>
      )}

      {temAcessoPrata(plano) && diasDeChuva != null && diasDeChuva >= 2 && (
        <InsightCard icon={CloudRain} tone="warn" title="Atenção ao clima">
          Chuva prevista em{" "}
          <span className="font-mono font-semibold tabular-nums">{diasDeChuva}</span> dos próximos 5
          dias em {uf} — pode afetar colheita ou transporte.
        </InsightCard>
      )}
    </div>
  );
}
