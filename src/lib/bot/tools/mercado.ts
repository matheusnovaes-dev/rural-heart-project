import type { SupabaseClient } from "@supabase/supabase-js";

import { CULTURA_PARA_B3 } from "@/config/b3";
import { CULTURA_PARA_CONAB_HISTORICO } from "@/config/conabSerieHistorica";
import { normalizarCultura } from "@/config/culturas";

export async function buscarCambio(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("cambio")
    .select("data, cotacao_compra, cotacao_venda")
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? { encontrado: false };
}

export async function buscarDiesel(supabase: SupabaseClient, args: { uf: string }) {
  const { data } = await supabase
    .from("diesel_precos")
    .select("produto, preco_medio, data_final")
    .eq("uf", args.uf)
    .order("data_final", { ascending: false })
    .limit(10)
    .returns<{ produto: string; preco_medio: number; data_final: string }[]>();

  const porProduto = new Map<
    string,
    { produto: string; preco_medio: number; data_final: string }
  >();
  for (const row of data ?? []) {
    if (!porProduto.has(row.produto)) porProduto.set(row.produto, row);
  }
  const rows = [...porProduto.values()];
  return rows.length > 0 ? { encontrado: true, precos: rows } : { encontrado: false };
}

export async function buscarProducaoIbge(
  supabase: SupabaseClient,
  args: { produto: string; uf: string },
) {
  const { data } = await supabase
    .from("ibge_producao")
    .select("produto, producao_ton, area_plantada_ha, area_colhida_ha, rendimento_kg_ha, periodo")
    .eq("uf", args.uf)
    .ilike("produto", `%${args.produto}%`)
    .order("periodo", { ascending: false })
    .limit(10)
    .returns<
      {
        produto: string;
        producao_ton: number | null;
        area_plantada_ha: number | null;
        area_colhida_ha: number | null;
        rendimento_kg_ha: number | null;
        periodo: string;
      }[]
    >();

  const rows = (data ?? []).filter((r) => r.producao_ton != null);
  rows.sort((a, b) => b.periodo.localeCompare(a.periodo) || b.producao_ton! - a.producao_ton!);
  return rows[0] ? { encontrado: true, ...rows[0] } : { encontrado: false };
}

/**
 * Área plantada / produção / produtividade por safra, painel público
 * "Série Histórica de Safra - Grãos" da Conab (voltando até 1976/77, mas só
 * devolve a safra mais recente e a anterior pra dar uma noção de tendência,
 * sem sobrecarregar o modelo com 50 anos de histórico numa resposta de
 * WhatsApp). Só cobre as 18 culturas de grãos do painel (ver
 * CULTURA_PARA_CONAB_HISTORICO) — nada de boi, café, suíno etc.
 * IMPORTANTE: isso é a área plantada TOTAL estimada pra safra inteira, não
 * quanto já foi plantado até agora (a Conab não publica esse percentual
 * semanal como dado estruturado, só em texto dentro do boletim mensal em
 * PDF) — o prompt precisa deixar essa diferença clara pro produtor.
 */
export async function buscarProducaoHistoricaConab(
  supabase: SupabaseClient,
  args: { produto: string; uf: string },
) {
  const produtoConab = CULTURA_PARA_CONAB_HISTORICO[normalizarCultura(args.produto)];
  if (!produtoConab) return { disponivel: false };

  const { data } = await supabase
    .from("producao_historica_conab")
    .select("safra, area_plantada_mil_ha, producao_mil_t, produtividade_kg_ha")
    .eq("produto", produtoConab)
    .eq("uf", args.uf)
    .order("safra", { ascending: false })
    .limit(2)
    .returns<
      {
        safra: string;
        area_plantada_mil_ha: number | null;
        producao_mil_t: number | null;
        produtividade_kg_ha: number | null;
      }[]
    >();

  const [atual, anterior] = data ?? [];
  if (!atual) return { disponivel: false };
  return { disponivel: true, atual, anterior: anterior ?? null };
}

/**
 * Rótulo de fonte escrito por código, não pelo modelo — achado real 2026-09-28:
 * o bot chamou o contrato SOY (preço de porto da Platts, FOB Santos) de "Bolsa
 * de Chicago", e só o SJC (cross listing do CME) tem relação de verdade com
 * Chicago, mesmo assim negociado na B3. Pedir pro modelo "não confundir" via
 * instrução de prompt piorou (ele passou a recusar a pergunta inteira quando o
 * produtor mencionava "Chicago"), então o rótulo certo vem pronto daqui —
 * o prompt só precisa mandar citar este campo, sem precisar raciocinar sobre
 * qual fonte é qual.
 */
function rotuloFonte(produtoCodigo: string): string {
  if (produtoCodigo === "SOY")
    return "preço de porto (Platts, FOB Santos) — não é futuro de Chicago";
  if (produtoCodigo === "SJC") return "negociado na B3, referenciado ao CME (Chicago)";
  return "negociado na B3";
}

export async function buscarFuturosB3(supabase: SupabaseClient, args: { produto: string }) {
  const codigos = CULTURA_PARA_B3[normalizarCultura(args.produto)];
  if (!codigos || codigos.length === 0) return { disponivel: false };

  const inicioMesAtual = new Date();
  inicioMesAtual.setDate(1);
  const { data } = await supabase
    .from("b3_futuros")
    .select(
      "produto, nome_produto, mes_ano_vencimento, preco_ajuste_atual, moeda, unidade, data_pregao",
    )
    .in("produto", codigos)
    .gte("mes_ano_vencimento", inicioMesAtual.toISOString().slice(0, 10))
    .order("data_pregao", { ascending: false })
    .order("mes_ano_vencimento", { ascending: true })
    .limit(60)
    .returns<
      {
        produto: string;
        nome_produto: string;
        mes_ano_vencimento: string;
        preco_ajuste_atual: number;
        moeda: string;
        unidade: string;
        data_pregao: string;
      }[]
    >();

  const rows = data ?? [];
  const pregaoMaisRecente = rows[0]?.data_pregao;
  const doDiaCerto = rows
    .filter((r) => r.data_pregao === pregaoMaisRecente)
    .slice(0, 6)
    .map((r) => ({ ...r, fonte: rotuloFonte(r.produto) }));
  return doDiaCerto.length > 0 ? { disponivel: true, futuros: doDiaCerto } : { disponivel: false };
}

export async function buscarProducaoWasde(
  supabase: SupabaseClient,
  args: { cultura: "soja" | "milho" | "algodao" },
) {
  const { data } = await supabase
    .from("wasde_brasil")
    .select("cultura, ano_safra, producao_mi_ton, exportacao_mi_ton, estoque_final_mi_ton, unidade")
    .eq("cultura", args.cultura)
    .order("relatorio_mes", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? { encontrado: false };
}

export async function buscarBoletimImea(supabase: SupabaseClient, args: { cadeia: string }) {
  const { data } = await supabase
    .from("imea_boletins")
    .select("titulo, manchete, resumo, data_publicacao, url_leitura")
    .ilike("cadeia", `%${args.cadeia}%`)
    .order("data_publicacao", { ascending: false })
    .limit(3)
    .returns<
      {
        titulo: string;
        manchete: string | null;
        resumo: string | null;
        data_publicacao: string;
        url_leitura: string;
      }[]
    >();
  return { encontrado: (data?.length ?? 0) > 0, boletins: data ?? [] };
}
