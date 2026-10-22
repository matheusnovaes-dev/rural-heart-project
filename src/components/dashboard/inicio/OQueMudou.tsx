import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CloudRain,
  Target,
  type LucideIcon,
} from "lucide-react";

import { reaisCompacto } from "@/lib/formatosPainel";
import type { ResumoDoCaderno } from "@/components/dashboard/inicio/useResumoDoCaderno";
import { rotuloDoDia, type Previsao } from "@/lib/clima";
import { formatarQuantidade, formatarReais as formatarReaisBruto } from "@/lib/fazenda.shared";

const formatarReais = (n: number) => formatarReaisBruto(n).replace("R$ ", "R$\u00a0");

type Item = {
  id: string;
  icone: LucideIcon;
  tom: "bom" | "alerta" | "neutro";
  titulo: string;
  detalhe?: string;
};

const TOM: Record<Item["tom"], string> = {
  bom: "bg-emerald-600/12 text-emerald-800",
  alerta: "bg-amber-500/18 text-amber-900",
  neutro: "bg-primary/10 text-primary",
};

/**
 * "O que mudou desde ontem": no máximo quatro linhas, escolhidas por urgência, todas calculadas com dados que a tela já
 * tem (preço, previsão, vencimentos e margem do Caderno). Sem nada relevante, diz isso com calma em vez de inventar.
 */
export function OQueMudou({
  cultura,
  uf,
  serie,
  previsao,
  resumo,
}: {
  cultura: string | null;
  uf: string | null;
  serie: { preco: number; data_referencia: string }[] | null;
  previsao: Previsao | null | undefined;
  resumo: ResumoDoCaderno;
}) {
  const itens: Item[] = [];
  const pend = resumo.pendencias;

  if (pend) {
    const todas = [...pend.aPagar, ...pend.aReceber].sort((a, b) => a.dias - b.dias);
    const urgente = todas.find((p) => p.dias <= 3);
    if (urgente) {
      const p = urgente;
      const quando =
        p.dias < 0
          ? "venceu"
          : p.dias === 0
            ? "vence hoje"
            : p.dias === 1
              ? "vence amanhã"
              : `vence em ${p.dias} dias`;
      itens.push({
        id: "vence",
        icone: CalendarClock,
        tom: p.dias < 0 ? "alerta" : p.tipo === "a_pagar" ? "alerta" : "bom",
        titulo: `${p.tipo === "a_pagar" ? "A pagar" : "A receber"} ${reaisCompacto(p.registro.valor ?? 0)}: ${p.registro.descricao}`,
        detalhe: quando,
      });
    }
  }

  const atual = serie?.at(-1);
  const anterior = serie?.at(-2);
  if (atual && anterior && anterior.preco > 0) {
    const v = ((atual.preco - anterior.preco) / anterior.preco) * 100;
    if (Math.abs(v) >= 0.3) {
      itens.push({
        id: "preco",
        icone: v > 0 ? ArrowUpRight : ArrowDownRight,
        tom: v > 0 ? "bom" : "alerta",
        titulo: `${(cultura ?? "Preço").replace(/^./, (c) => c.toUpperCase())} em ${uf ?? "sua região"} ${v > 0 ? "subiu" : "caiu"} ${formatarQuantidade(Math.abs(Math.round(v * 10) / 10))}%`,
        detalhe: `${formatarReais(anterior.preco)} → ${formatarReais(atual.preco)} por saca`,
      });
    }
  }

  if (previsao) {
    const i = previsao.chuvaPct.slice(0, 5).findIndex((p) => p >= 60);
    if (i >= 0) {
      itens.push({
        id: "chuva",
        icone: CloudRain,
        tom: "neutro",
        titulo: `Chuva forte prevista ${rotuloDoDia(previsao.dias[i]!).longo}`,
        detalhe: `${previsao.chuvaPct[i]}% de chance de chuva`,
      });
    }
  }

  const m = resumo.margem;
  if (m && m.pct != null && m.metaPct != null) {
    const acima = m.pct >= m.metaPct;
    itens.push({
      id: "margem",
      icone: Target,
      tom: acima ? "bom" : "neutro",
      titulo: acima
        ? `Margem em ${formatarQuantidade(m.pct)}%, acima da sua meta de ${formatarQuantidade(m.metaPct)}%`
        : `Margem em ${formatarQuantidade(m.pct)}%, faltam ${formatarQuantidade(Math.round((m.metaPct - m.pct) * 10) / 10)} pontos para a meta`,
      detalhe: "Conta com o que você lançou no Caderno",
    });
  }

  const mostrar = itens.slice(0, 4);
  const carregando = serie === null || resumo.carregando;

  return (
    <section className="card-premium p-5 sm:p-6" aria-labelledby="o-que-mudou">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 id="o-que-mudou" className="font-display text-lg font-semibold text-foreground">
            O que mudou desde ontem
          </h2>
          <p className="text-sm text-muted-foreground">Só o que pede a sua atenção.</p>
        </div>
      </div>
      {carregando ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-9 animate-pulse rounded-xl bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : mostrar.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3.5">
          <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-foreground/85">
            Tudo calmo por aqui. Preço estável, sem chuva forte no radar e nada vencendo nos
            próximos dias.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {mostrar.map((it, i) => (
            <motion.li
              key={it.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-start gap-3 border-t border-border/60 py-3 first:border-t-0 first:pt-0 last:pb-0"
            >
              <span
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${TOM[it.tom]}`}
              >
                <it.icone className="size-[1.1rem]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.95rem] leading-snug font-medium text-foreground text-pretty">
                  {it.titulo}
                </p>
                {it.detalhe && <p className="mt-0.5 text-sm text-muted-foreground">{it.detalhe}</p>}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
