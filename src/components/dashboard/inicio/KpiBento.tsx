import { motion } from "framer-motion";
import { CalendarClock, CloudSun, DollarSign, PiggyBank, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";

import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { KpiTile } from "@/components/dashboard/inicio/KpiTile";
import type { ResumoDoCaderno } from "@/components/dashboard/inicio/useResumoDoCaderno";
import { buscarVariacaoCambio } from "@/lib/bot/tools/mercado";
import { indiceDoDia, rotuloDoDia, type Previsao } from "@/lib/clima";
import { formatarQuantidade, formatarReais as formatarReaisBruto } from "@/lib/fazenda.shared";

/** "R$ 60" sem quebra de linha entre o R$ e o número. */
const formatarReais = (n: number) => formatarReaisBruto(n).replace("R$ ", "R$\u00a0");
import { reaisCompacto } from "@/lib/formatosPainel";
import { supabase } from "@/lib/supabase";

type VariacaoCambio = Awaited<ReturnType<typeof buscarVariacaoCambio>>;

function dataCurta(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

/**
 * Os quatro indicadores ao lado do preço: margem (destaque), estoque ou clima, o que vence e o dólar. Cada um é um link para
 * a tela de onde o número vem e, quando ainda não há dado, vira um convite com o próximo passo.
 */
export function KpiBento({
  resumo,
  previsao,
  uf,
  municipio,
}: {
  resumo: ResumoDoCaderno;
  previsao: Previsao | null | undefined;
  uf: string | null;
  municipio: string | null;
}) {
  const [cambio, setCambio] = useState<VariacaoCambio | null | undefined>(undefined);
  const [serieCambio, setSerieCambio] = useState<number[]>([]);
  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    supabase
      .from("cambio")
      .select("data, cotacao_venda")
      .order("data", { ascending: false })
      .limit(24)
      .then(({ data }) => {
        if (vivo && data) setSerieCambio(data.map((d) => Number(d.cotacao_venda)).reverse());
      });
    buscarVariacaoCambio(supabase)
      .then((v) => vivo && setCambio(v))
      .catch(() => vivo && setCambio(null));
    return () => {
      vivo = false;
    };
  }, []);

  const { margem, estoque, pendencias, carregando, prata } = resumo;
  // dia do tile de clima: hoje, ou o primeiro dia que a fonte traz (o CPTEC começa em amanhã)
  const idxClima = previsao ? Math.max(0, indiceDoDia(previsao, "hoje")) : 0;
  const quandoClima = previsao?.dias[idxClima]
    ? rotuloDoDia(previsao.dias[idxClima]!).longo
    : "hoje";
  const pend = pendencias;
  const proximo = pend
    ? [...pend.aPagar, ...pend.aReceber].sort((a, b) => a.dias - b.dias)[0]
    : null;
  const temPend = !!pend && (pend.aPagar.length > 0 || pend.aReceber.length > 0);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-3 sm:gap-4"
    >
      {/* 1. Margem: o indicador em destaque */}
      <KpiTile
        testId="kpi-margem"
        tom="ouro"
        icone={PiggyBank}
        rotulo="Margem estimada"
        to="/dashboard/fazenda"
        carregando={carregando}
        vazio={
          !margem
            ? {
                texto: "Informe a área e lance seus gastos para ver a margem da safra.",
                acao: "Abrir o Caderno",
              }
            : null
        }
        valor={
          margem?.pct != null ? (
            <>
              <AnimatedNumber value={margem.pct} decimals={1} />
              <span className="ml-0.5 text-xl font-medium opacity-70">%</span>
            </>
          ) : (
            "—"
          )
        }
        chip={
          margem?.metaPct != null && margem.pct != null ? (
            <span
              className={`mb-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${
                margem.pct >= margem.metaPct
                  ? "bg-emerald-700/15 text-emerald-900"
                  : "bg-amber-700/15 text-amber-900"
              }`}
            >
              meta {formatarQuantidade(margem.metaPct)}%
            </span>
          ) : undefined
        }
        rodape={
          margem ? (
            <>
              Custo {formatarReais(margem.custoPorSaca)}/saca
              {margem.precoHoje != null
                ? ` · preço ${formatarReais(margem.precoHoje)}`
                : " · sem preço de hoje"}
            </>
          ) : undefined
        }
      />

      {/* 2. Estoque (Prata) ou clima de hoje */}
      {prata ? (
        <KpiTile
          testId="kpi-estoque"
          icone={Warehouse}
          rotulo="Estoque"
          to="/dashboard/fazenda"
          carregando={carregando}
          vazio={
            !estoque
              ? {
                  texto: "Diga quantas sacas guarda e eu calculo quanto valem hoje.",
                  acao: "Informar estoque",
                }
              : null
          }
          valor={
            estoque?.precoHoje != null
              ? reaisCompacto(Math.round(estoque.sacas * estoque.precoHoje))
              : estoque
                ? `${formatarQuantidade(estoque.sacas)} sc`
                : undefined
          }
          rodape={
            estoque ? (
              <>
                {formatarQuantidade(estoque.sacas)} sacas de {estoque.cultura.toLowerCase()}
                {estoque.precoHoje != null ? ` × ${formatarReais(estoque.precoHoje)}` : ""}
              </>
            ) : undefined
          }
        />
      ) : (
        <KpiTile
          testId="kpi-clima"
          icone={CloudSun}
          rotulo="Clima"
          to="/dashboard/clima"
          carregando={previsao === undefined}
          vazio={
            previsao === null
              ? { texto: "Previsão indisponível agora.", acao: "Ver o clima" }
              : null
          }
          valor={previsao ? `${Math.round(previsao.tempMax[idxClima] ?? 0)}°` : undefined}
          rodape={
            previsao ? (
              <>
                Chuva {previsao.chuvaPct[idxClima] ?? 0}% {quandoClima} ·{" "}
                {municipio ?? uf ?? "sua região"}
              </>
            ) : undefined
          }
        />
      )}

      {/* 3. O que vence */}
      <KpiTile
        testId="kpi-vencimentos"
        icone={CalendarClock}
        rotulo="A pagar e receber"
        to="/dashboard/fazenda"
        carregando={carregando}
        vazio={
          !temPend
            ? {
                texto: "Nada a vencer. Lance o que vai pagar ou receber e eu te lembro.",
                acao: "Lançar no Caderno",
              }
            : null
        }
        valor={pend ? reaisCompacto(pend.totalAPagar) : undefined}
        chip={
          pend && pend.vencidas > 0 ? (
            <span className="mb-0.5 whitespace-nowrap rounded-full bg-destructive/12 px-2 py-0.5 text-[0.68rem] font-bold text-red-800">
              {pend.vencidas} vencida{pend.vencidas > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
        rodape={
          pend && proximo ? (
            <>
              A receber {reaisCompacto(pend.totalAReceber)} · próximo{" "}
              {proximo.dias === 0
                ? "hoje"
                : proximo.dias === 1
                  ? "amanhã"
                  : proximo.dias < 0
                    ? `venceu ${dataCurta(proximo.vencimento)}`
                    : dataCurta(proximo.vencimento)}
            </>
          ) : undefined
        }
      />

      {/* 4. Dólar */}
      <KpiTile
        testId="kpi-dolar"
        icone={DollarSign}
        rotulo="Dólar"
        to="/dashboard/alertas"
        carregando={cambio === undefined}
        vazio={
          cambio === null ? { texto: "Cotação indisponível agora.", acao: "Criar alerta" } : null
        }
        valor={
          cambio ? (
            <>
              R$ <AnimatedNumber value={cambio.atual} decimals={2} />
            </>
          ) : undefined
        }
        delta={cambio ? { valor: cambio.variacao } : null}
        rodape={cambio ? "variação desde o último pregão" : undefined}
      >
        {serieCambio.length >= 3 && (
          <Sparkline data={serieCambio} animar className="mt-1 h-7 w-full" color="var(--chart-1)" />
        )}
      </KpiTile>
    </motion.div>
  );
}
