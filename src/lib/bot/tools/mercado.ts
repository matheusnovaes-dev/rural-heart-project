import type { SupabaseClient } from "@supabase/supabase-js";

import { CULTURA_PARA_B3 } from "@/config/b3";
import { CATEGORIA_PARA_SUBGRUPO_INSUMO } from "@/config/conabPrecoInsumo";
import { CULTURA_PARA_CONAB_PROGRESSO } from "@/config/conabProgressoSafra";
import { CULTURA_PARA_CONAB_HISTORICO } from "@/config/conabSerieHistorica";
import { normalizarCultura } from "@/config/culturas";
import { temAcessoPrata, type Plano } from "@/lib/planos.shared";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

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
 * % de área já semeada ou colhida NA SEMANA ATUAL — boletim semanal
 * "Plantio e Colheita" da Conab (achado 2026-09-30), fonte DIFERENTE da
 * série histórica acima (aquela só dá o total estimado pra safra inteira).
 * Isso é o dado que vira notícia tipo "Brasil já plantou X% da soja".
 * Culturas com mais de uma safra no ano (milho, feijão) vêm com "1ª"/"2ª"
 * no nome — o ilike pega todas de uma vez, e cada uma aparece como uma
 * linha própria no retorno. Só cobre a cultura/semana que o boletim mais
 * recente realmente trouxe (varia por época do ano — fora da janela de
 * plantio/colheita de uma cultura, ela nem aparece no arquivo daquela
 * semana).
 */
export async function buscarProgressoSafraConab(
  supabase: SupabaseClient,
  args: { produto: string; uf: string },
) {
  const produtoConab = CULTURA_PARA_CONAB_PROGRESSO[normalizarCultura(args.produto)];
  if (!produtoConab) return { disponivel: false };

  const { data } = await supabase
    .from("progresso_safra_conab")
    .select("produto, safra, tipo, uf, semana_referencia, percentual, media_5_anos")
    .ilike("produto", `${produtoConab}%`)
    .in("uf", [args.uf, "BR"])
    .order("semana_referencia", { ascending: false })
    .limit(12)
    .returns<
      {
        produto: string;
        safra: string;
        tipo: string;
        uf: string;
        semana_referencia: string;
        percentual: number;
        media_5_anos: number | null;
      }[]
    >();

  if (!data || data.length === 0) return { disponivel: false };

  // Só a semana mais recente que existir (pode ser diferente por cultura,
  // já que cada uma é atualizada quando a Conab tem dado novo pra ela).
  const semanaMaisRecente = data[0]!.semana_referencia;
  const linhas = data.filter((l) => l.semana_referencia === semanaMaisRecente);
  const daUf = linhas.filter((l) => l.uf === args.uf);
  const nacional = linhas.filter((l) => l.uf === "BR");
  return {
    disponivel: true,
    semana_referencia: semanaMaisRecente,
    // Vazio quando a UF pedida não está entre os estados que a Conab
    // acompanha pra essa cultura (só cobre os estados que somam ~90%+ da
    // área) — nesse caso só o nacional mesmo serve de referência.
    da_uf: daUf,
    nacional,
  };
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

type LinhaInsumo = {
  produto: string;
  grupo: string;
  subgrupo: string;
  uf: string;
  ano: number;
  mes: number;
  preco: number;
  unidade_medida: string;
};

// precos_insumos_conab é por produto COMERCIAL (marca), não categoria — a
// busca principal é por substring no nome (ex: "glifosato", "map", "ureia").
// Só cai pra busca por categoria (subgrupo exato) quando a busca por nome
// não acha nada, pra "e o fertilizante, como tá?" também dar uma resposta.
export async function buscarPrecoInsumo(
  supabase: SupabaseClient,
  args: { termo: string; uf: string },
  produtorId: string | null,
) {
  // Exclusivo Prata+ (mesmo padrão de checagem usada em criar_alerta_preco)
  // — pergunta pelo WhatsApp também é uma chamada dessa tool, então o
  // gating tem que valer aqui também, senão o card do painel vira a única
  // barreira real e dá pra contornar só perguntando pro bot.
  if (produtorId) {
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("plano")
      .eq("produtor_id", produtorId)
      .maybeSingle();
    const plano = (assinatura?.plano as Plano | undefined) ?? null;
    if (!temAcessoPrata(plano)) return { encontrado: false, disponivel_no_plano: false };
  }

  const termoBusca = args.termo.trim();
  const colunas = "produto, grupo, subgrupo, uf, ano, mes, preco, unidade_medida";

  let data = (
    await supabase
      .from("precos_insumos_conab")
      .select(colunas)
      .ilike("produto", `%${termoBusca}%`)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false })
      .limit(500)
      .returns<LinhaInsumo[]>()
  ).data;

  let buscaPorCategoria = false;
  if (!data || data.length === 0) {
    const subgrupo = CATEGORIA_PARA_SUBGRUPO_INSUMO[semAcento(termoBusca)];
    if (!subgrupo) return { encontrado: false };
    buscaPorCategoria = true;
    data = (
      await supabase
        .from("precos_insumos_conab")
        .select(colunas)
        .eq("subgrupo", subgrupo)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(500)
        .returns<LinhaInsumo[]>()
    ).data;
  }

  if (!data || data.length === 0) return { encontrado: false };

  // Período mais recente — mas DENTRO da UF pedida primeiro, não entre
  // todas as UFs. Achado real conferindo isso: a publicação não sai na
  // mesma data pra todo estado (ex: fungicida em GO só tinha mar/2026
  // enquanto outros estados já tinham ago/2026 pro mesmo subgrupo) — pegar
  // "o mais recente entre todos" antes de olhar pra UF fazia o produtor
  // ver preço de produto de OUTRO estado sem saber, mesmo quando a UF dele
  // tinha dado (só que mais antigo). "data" já vem ordenado (ano desc, mes
  // desc), então filtrar preserva essa ordem.
  const daUfTodosPeriodos = data.filter((l) => l.uf === args.uf);
  const usouOutraUf = daUfTodosPeriodos.length === 0;
  const base = usouOutraUf ? data : daUfTodosPeriodos;
  const maisRecente = base[0]!;
  const linhas = base.filter((l) => l.ano === maisRecente.ano && l.mes === maisRecente.mes);

  // Agrupa por unidade de medida — não faz sentido misturar faixa de preço
  // em R$/L com R$/KG no mesmo min/max.
  const porUnidade = new Map<string, LinhaInsumo[]>();
  for (const l of linhas) {
    if (!porUnidade.has(l.unidade_medida)) porUnidade.set(l.unidade_medida, []);
    porUnidade.get(l.unidade_medida)!.push(l);
  }

  const faixas_de_preco = [...porUnidade.entries()].map(([unidade_medida, itens]) => {
    const precos = itens.map((i) => i.preco);
    return {
      unidade_medida,
      quantidade_produtos: itens.length,
      preco_minimo: Math.min(...precos),
      preco_maximo: Math.max(...precos),
      produtos_exemplo: itens
        .slice(0, 5)
        .map((i) => ({ produto: i.produto, uf: i.uf, preco: i.preco })),
    };
  });

  return {
    encontrado: true,
    busca_por_categoria: buscaPorCategoria,
    ano: maisRecente.ano,
    mes: maisRecente.mes,
    cobertura: usouOutraUf ? "multiplas_ufs_sem_dado_na_uf_pedida" : "uf_do_produtor",
    grupo: maisRecente.grupo,
    subgrupo: maisRecente.subgrupo,
    faixas_de_preco,
  };
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
