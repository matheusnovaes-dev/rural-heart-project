import { createServerFn } from "@tanstack/react-start";

import { supabaseServiceRole } from "@/lib/supabase.server";
import type { ItemDoMercado, MercadoDoDia, SojaParaDemo } from "@/lib/mercadoLanding";

// Dado de mercado muda no máximo 1x por dia: 30 min de cache por isolate evita uma consulta por visita.
const TTL_MS = 30 * 60 * 1000;
let cache: { em: number; dados: MercadoDoDia } | null = null;

type Serie = { data: string; valor: number }[];

/** Média das praças por dia (BBM), do mais antigo ao mais novo. */
async function serieBbm(
  supabase: ReturnType<typeof supabaseServiceRole>,
  padraoProduto: string,
  uf: string,
  dias: number,
): Promise<Serie> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("precos")
    .select("preco, data_referencia")
    .ilike("produto", padraoProduto)
    .eq("uf", uf)
    .eq("fonte", "BBM")
    .gte("data_referencia", desde)
    .order("data_referencia", { ascending: true })
    .limit(1000)
    .returns<{ preco: number; data_referencia: string }[]>();
  const porDia = new Map<string, number[]>();
  for (const r of data ?? []) {
    const v = Number(r.preco);
    if (!Number.isFinite(v) || v <= 0) continue;
    porDia.set(r.data_referencia, [...(porDia.get(r.data_referencia) ?? []), v]);
  }
  return [...porDia.entries()].map(([d, vs]) => ({
    data: d,
    valor: vs.reduce((a, b) => a + b, 0) / vs.length,
  }));
}

function item(
  id: string,
  rotulo: string,
  unidade: ItemDoMercado["unidade"],
  s: Serie,
): ItemDoMercado | null {
  const ultimo = s[s.length - 1];
  if (!ultimo) return null;
  const alvo = new Date(new Date(`${ultimo.data}T00:00:00Z`).getTime() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const base = [...s].reverse().find((x) => x.data <= alvo);
  return {
    id,
    rotulo,
    valor: ultimo.valor,
    unidade,
    varPct: base ? (ultimo.valor / base.valor - 1) * 100 : null,
    data: ultimo.data,
  };
}

/**
 * Preços reais do dia pra faixa e a demo da landing. Cada fonte falha sozinha (some só aquele item);
 * devolve só valores agregados, nunca linhas cruas. Roda com service role (as tabelas não são públicas).
 */
export const mercadoDoDiaLanding = createServerFn({ method: "GET" }).handler(
  async (): Promise<MercadoDoDia> => {
    if (cache && Date.now() - cache.em < TTL_MS) return cache.dados;
    const supabase = supabaseServiceRole();

    const [soja, milho, cafe, trigo, dolar] = await Promise.all([
      serieBbm(supabase, "SOJA%", "MT", 100).catch(() => [] as Serie),
      serieBbm(supabase, "MILHO%", "MT", 20).catch(() => [] as Serie),
      serieBbm(supabase, "%CAF%ARÁBICA%", "MG", 20).catch(() => [] as Serie),
      serieBbm(supabase, "TRIGO%", "PR", 20).catch(() => [] as Serie),
      (async (): Promise<Serie> => {
        const desde = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
        const { data } = await supabase
          .from("cambio")
          .select("data, cotacao_venda")
          .gte("data", desde)
          .order("data", { ascending: true })
          .returns<{ data: string; cotacao_venda: number }[]>();
        return (data ?? []).map((r) => ({ data: r.data, valor: Number(r.cotacao_venda) }));
      })().catch(() => [] as Serie),
    ]);

    const itens = [
      item("soja", "Soja MT", "saca", soja),
      item("milho", "Milho MT", "saca", milho),
      item("cafe", "Café arábica MG", "saca", cafe),
      item("trigo", "Trigo PR", "saca", trigo),
      item("dolar", "Dólar", "dolar", dolar),
    ].filter((x): x is ItemDoMercado => x !== null);

    let sojaDemo: SojaParaDemo | null = null;
    if (soja.length >= 10) {
      const ult = soja[soja.length - 1]!;
      const ult90 = soja.filter(
        (p) => p.data >= new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
      );
      const media90 = ult90.reduce((a, p) => a + p.valor, 0) / ult90.length;
      sojaDemo = {
        uf: "MT",
        valor: ult.valor,
        data: ult.data,
        serie: soja.slice(-45).map((p) => p.valor),
        media90,
        vsMedia90Pct: (ult.valor / media90 - 1) * 100,
      };
    }

    const dados: MercadoDoDia = { itens, soja: sojaDemo };
    if (itens.length > 0) cache = { em: Date.now(), dados };
    return dados;
  },
);
