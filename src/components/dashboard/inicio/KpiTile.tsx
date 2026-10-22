import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { aoMoverSpotlight } from "@/lib/useSpotlight";

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export type DeltaKpi = { valor: number; sufixo?: string; casas?: number };

/**
 * Indicador do painel: rótulo pequeno em caixa-alta, número grande, variação e uma linha de contexto. Pode ser um link (o
 * cartão todo), mostrar um convite quando ainda não há dado ("vazio") e tem dois tons: claro (padrão) e ouro (destaque).
 */
export function KpiTile({
  icone: Icone,
  rotulo,
  valor,
  delta,
  rodape,
  carregando,
  vazio,
  tom = "claro",
  to,
  chip,
  children,
  testId,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor?: ReactNode;
  delta?: DeltaKpi | null;
  rodape?: ReactNode;
  carregando?: boolean;
  /** Quando ainda não há dado: o que dizer e qual o próximo passo. */
  vazio?: { texto: string; acao: string } | null;
  tom?: "claro" | "ouro";
  to?: string;
  chip?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  const ouro = tom === "ouro";
  const corpo = (
    <div
      onPointerMove={aoMoverSpotlight}
      data-testid={testId}
      className={`card-premium spot ${ouro ? "kpi-ouro" : "spot-suave"} group relative flex h-full min-h-[9rem] flex-col justify-between gap-3 overflow-hidden p-3.5 sm:min-h-[9.5rem] sm:p-5`}
    >
      <div className="relative flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
              ouro ? "bg-white/55 text-gold-foreground" : "bg-primary/10 text-primary"
            }`}
          >
            <Icone className="size-4" aria-hidden="true" />
          </span>
          <span
            className={`text-[0.68rem] leading-tight font-semibold tracking-[0.07em] uppercase sm:text-[0.7rem] ${
              ouro ? "text-gold-foreground/80" : "text-muted-foreground"
            }`}
          >
            {rotulo}
          </span>
        </span>
        {to && (
          <ArrowUpRight
            className="size-4 shrink-0 -translate-x-1 translate-y-1 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-60"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="relative flex flex-col gap-1.5">
        {carregando ? (
          <>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3.5 w-24" />
          </>
        ) : vazio ? (
          <>
            <p className="text-sm leading-snug text-balance text-foreground/85">{vazio.texto}</p>
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              {vazio.acao}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
              <p className="font-display text-[clamp(1.35rem,5.6vw,1.75rem)] leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-[2rem]">
                {valor}
              </p>
              {chip}
              {delta && Math.abs(delta.valor) >= 0.05 && (
                <span
                  className={`mb-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    delta.valor > 0
                      ? "bg-emerald-600/12 text-emerald-800"
                      : "bg-destructive/12 text-red-800"
                  }`}
                >
                  {delta.valor > 0 ? (
                    <ArrowUp className="size-3" aria-hidden="true" />
                  ) : delta.valor < 0 ? (
                    <ArrowDown className="size-3" aria-hidden="true" />
                  ) : (
                    <Minus className="size-3" aria-hidden="true" />
                  )}
                  <span className="font-mono tabular-nums">
                    {Math.abs(delta.valor).toLocaleString("pt-BR", {
                      minimumFractionDigits: delta.casas ?? 1,
                      maximumFractionDigits: delta.casas ?? 1,
                    })}
                    {delta.sufixo ?? "%"}
                  </span>
                </span>
              )}
            </div>
            {rodape && (
              <p
                className={`text-xs leading-snug ${ouro ? "text-gold-foreground/75" : "text-muted-foreground"}`}
              >
                {rodape}
              </p>
            )}
            {children}
          </>
        )}
      </div>
    </div>
  );

  return (
    <motion.div variants={itemVariants} className="min-w-0">
      {to ? (
        <Link
          to={to}
          className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {corpo}
        </Link>
      ) : (
        corpo
      )}
    </motion.div>
  );
}
