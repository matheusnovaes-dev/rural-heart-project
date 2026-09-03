import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Gauge,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { buscarPrevisaoServidor } from "@/lib/clima.server";
import { temAcessoPrata, useAssinatura } from "@/lib/planos";
import type { Produtor } from "@/lib/auth";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { CULTURA_PARA_B3 } from "@/config/b3";
import {
  calcularPosicao,
  combinarComClima,
  combinarSinalVenda,
  serieUnica,
  sinalDaCurvaFuturos,
  sinalDaPosicao,
} from "@/lib/sinalVenda";

type PrecoPonto = { preco: number; data_referencia: string; produto: string; uf: string };

// Segunda fonte (Imea), só Mato Grosso e só pra cultura onde já confirmamos
// que a unidade bate 1:1 com a Conab (R$/saca de 60kg) — soja e milho. Boi e
// algodão em pluma também têm boletim Imea, mas em R$/@ (arroba), e não
// sabemos ainda se a Conab publica na mesma unidade pra essas duas; até
// confirmar, não comparamos números que podem estar em bases diferentes.
const IMEA_CULTURAS: Record<string, { cadeia: string; indicador: string }> = {
  soja: { cadeia: "soja", indicador: "Soja Disponível" },
  milho: { cadeia: "milho", indicador: "Milho Disponível" },
};

type ImeaPonto = { valor: number; data_referencia: string };

function variacaoDuasSemanas(serie: PrecoPonto[]) {
  const atual = serie.at(-1);
  if (!atual) return null;
  const limite = new Date(atual.data_referencia);
  limite.setDate(limite.getDate() - 14);
  const limiteIso = limite.toISOString().slice(0, 10);
  const referencia = [...serie].reverse().find((p) => p.data_referencia <= limiteIso);
  // preco 0 é sempre erro de dado (nenhuma commodity real zera), nunca um
  // ponto de referência válido — dividir por ele daria Infinity/NaN na tela.
  if (!referencia || referencia.preco === 0) return null;
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
    return "Esse número parece ter vírgula ou zero fora do lugar na fonte oficial. Confira antes de decidir com ele.";
  }

  if (variacoesOutrasUfs.length >= 3) {
    const medianaOutras = Math.abs(mediana(variacoesOutrasUfs) ?? 0);
    const destoante = Math.abs(variacao) > 15 && Math.abs(variacao) > medianaOutras * 3 + 5;
    if (destoante) {
      return "Os outros estados não subiram ou caíram parecido essa semana. Pode ter sido um erro só nesse número, vale conferir.";
    }
  }

  return null;
}

export function InsightsPanel({ produtor }: { produtor: Produtor }) {
  const { plano, loading: loadingPlano } = useAssinatura();
  const [serie, setSerie] = useState<PrecoPonto[] | null>(null);
  const [todasUfs, setTodasUfs] = useState<PrecoPonto[]>([]);
  const [temAlertaAtivo, setTemAlertaAtivo] = useState<boolean | null>(null);
  const [diasDeChuva, setDiasDeChuva] = useState<number | null>(null);
  const [imeaPonto, setImeaPonto] = useState<ImeaPonto | null>(null);
  const [futurosB3, setFuturosB3] = useState<{ mesAnoVencimento: string; preco: number }[] | null>(
    null,
  );

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
      .eq("regiao", "")
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
    // Cross-check entre fontes é insight avançado, mesmo nível de "Clima" —
    // Bronze não busca nem paga o request à toa.
    if (!supabase || !cultura || uf !== "MT" || !temAcessoPrata(plano)) {
      setImeaPonto(null);
      return;
    }
    const config = IMEA_CULTURAS[cultura];
    if (!config) {
      setImeaPonto(null);
      return;
    }
    supabase
      .from("imea_indicadores")
      .select("valor, data_referencia")
      .eq("cadeia", config.cadeia)
      .eq("indicador", config.indicador)
      .eq("periodicidade", "diario")
      .order("data_referencia", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setImeaPonto(data));
  }, [cultura, uf, plano]);

  useEffect(() => {
    // Só o primeiro código mapeado por cultura (ex: soja usa SJC, não
    // mistura com SOY) — evita cruzar contratos em moedas/referências
    // diferentes na mesma curva.
    const codigo = cultura ? CULTURA_PARA_B3[cultura]?.[0] : undefined;
    if (!supabase || !codigo) {
      setFuturosB3(null);
      return;
    }
    const inicioMesAtual = new Date();
    inicioMesAtual.setDate(1);
    supabase
      .from("b3_futuros")
      .select("mes_ano_vencimento, preco_ajuste_atual, data_pregao")
      .eq("produto", codigo)
      .gte("mes_ano_vencimento", inicioMesAtual.toISOString().slice(0, 10))
      .order("data_pregao", { ascending: false })
      .order("mes_ano_vencimento", { ascending: true })
      .limit(10)
      .then(({ data }) => {
        const rows = data ?? [];
        const pregaoMaisRecente = rows[0]?.data_pregao;
        const doDiaCerto = rows.filter((r) => r.data_pregao === pregaoMaisRecente);
        // Só os 3 vencimentos mais próximos (mesmo padrão do ContextoMercado)
        // — contratos de mais de um ano à frente distorcem o sinal pra quem
        // está decidindo vender a safra atual, não uma safra futura.
        setFuturosB3(
          doDiaCerto.slice(0, 3).map((r) => ({
            mesAnoVencimento: r.mes_ano_vencimento,
            preco: r.preco_ajuste_atual,
          })),
        );
      });
  }, [cultura]);

  useEffect(() => {
    if (!uf) return;
    buscarPrevisaoServidor({ data: { uf } }).then((previsao) => {
      if (!previsao) return;
      const riscosos = previsao.chuvaPct.filter((p) => p >= 60).length;
      setDiasDeChuva(riscosos);
    });
  }, [uf]);

  if (!cultura || !uf) return null;
  if (serie === null || loadingPlano) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Nem toda combinação cultura+UF tem preço publicado ainda (a Conab não
  // cobre as 77 culturas em todos os 27 estados). Sem histórico não dá pra
  // calcular tendência/faixa, mas o painel inteiro sumir deixa a home vazia
  // à toa — os cards de alerta e clima abaixo não dependem de preço, e um
  // aviso explicando o motivo é melhor que nada aparecer.
  const semHistorico = serie.length === 0;
  const tendencia = semHistorico ? null : variacaoDuasSemanas(serie);
  const precos = serie.map((p) => p.preco);
  const min = Math.min(...precos);
  const max = Math.max(...precos);
  const posicao = calcularPosicao(serie);

  const sinalVenda = combinarComClima(
    combinarSinalVenda(sinalDaPosicao(posicao), futurosB3 ? sinalDaCurvaFuturos(futurosB3) : null),
    diasDeChuva,
  );

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

  // Cross-check entre fontes independentes (Conab x Imea) — diferente da
  // anomalia acima, que só olha a Conab contra ela mesma. Só roda quando as
  // duas fontes têm preço pra comparar e a unidade já foi confirmada
  // compatível (ver IMEA_CULTURAS).
  let divergenciaFonte: { conab: number; imea: number; diferenca: number } | null = null;
  const precoConabAtual = serie.at(-1)?.preco;
  if (imeaPonto && precoConabAtual != null && imeaPonto.valor !== 0) {
    const diferenca = ((precoConabAtual - imeaPonto.valor) / imeaPonto.valor) * 100;
    if (Math.abs(diferenca) > 8) {
      divergenciaFonte = { conab: precoConabAtual, imea: imeaPonto.valor, diferenca };
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {semHistorico && (
        <InsightCard icon={Gauge} tone="neutral" title="Sem histórico ainda">
          Ainda não temos preço registrado pra <strong>{cultura}</strong> em <strong>{uf}</strong>.
          Assim que a Conab publicar, a tendência aparece aqui automaticamente.
        </InsightCard>
      )}

      {sinalVenda && (
        <InsightCard icon={Target} tone={sinalVenda.tone} title="Sinal de venda">
          {sinalVenda.texto}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Cruza a posição do preço nos últimos 90 dias, a curva de futuros da B3 e o risco de
            clima na sua região — não é recomendação de investimento.
          </p>
        </InsightCard>
      )}

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

      {divergenciaFonte && (
        <InsightCard icon={AlertTriangle} tone="warn" title="Divergência entre fontes">
          Conab está em{" "}
          <span className="font-mono font-semibold tabular-nums">
            R$ {divergenciaFonte.conab.toFixed(2)}
          </span>{" "}
          e o boletim da Imea (referência MT) está em{" "}
          <span className="font-mono font-semibold tabular-nums">
            R$ {divergenciaFonte.imea.toFixed(2)}
          </span>{" "}
          , uma diferença de{" "}
          <span className="font-mono font-semibold tabular-nums">
            {Math.abs(divergenciaFonte.diferenca).toFixed(1)}%
          </span>
          . Vale conferir antes de decidir com esse número.
        </InsightCard>
      )}

      {posicao != null && (
        <InsightCard icon={Gauge} tone="neutral" title="Variação dos últimos 90 dias">
          Nesse período, o preço ficou entre{" "}
          <span className="font-mono font-semibold tabular-nums">R$ {min.toFixed(2)}</span> e{" "}
          <span className="font-mono font-semibold tabular-nums">R$ {max.toFixed(2)}</span>. Hoje
          está{" "}
          {posicao <= 25
            ? "perto do menor preço desse período."
            : posicao >= 75
              ? "perto do maior preço desse período."
              : "mais ou menos no meio, nem no menor nem no maior preço."}
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
    </div>
  );
}
