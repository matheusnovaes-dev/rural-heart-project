import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizarCultura } from "@/config/culturas";
import { calcularValorProducao, type ResultadoCalculadora } from "@/lib/calculadora";

export type ResultadoCalcularMargem =
  (ResultadoCalculadora & { erro?: undefined }) | { erro: "uf_ausente" | "sacas_ausente" };

/**
 * Mesma conta da Calculadora de Safra do painel (src/lib/calculadora.ts) —
 * sacas × preço real, custo informado pelo produtor, margem. O bot nunca
 * calcula isso "de cabeça": sacas e custo vêm SEMPRE do que o produtor
 * escreveu na mensagem, nunca estimados.
 */
export async function calcularMargemSafra(
  supabase: SupabaseClient,
  args: {
    produto: string;
    uf: string | null;
    sacas: number | null;
    custo_saca: number | null;
    uf_referencia: string | null;
  },
  ctx: { lat: number | null; lon: number | null },
): Promise<ResultadoCalcularMargem> {
  if (!args.uf) return { erro: "uf_ausente" };
  if (args.sacas == null || args.sacas <= 0) return { erro: "sacas_ausente" };

  const cultura = normalizarCultura(args.produto);
  return calcularValorProducao(supabase, {
    cultura,
    uf: args.uf,
    sacas: args.sacas,
    custoSaca: args.custo_saca,
    lat: ctx.lat,
    lon: ctx.lon,
    ufReferencia: args.uf_referencia,
  });
}
