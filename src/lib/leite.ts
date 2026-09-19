import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarPrecosDaUf } from "@/lib/precos";
import { diasEntre, mediaDePracas } from "@/lib/precoFonte";

/**
 * Leite: não existe cotação pública diária por estado (a Cepea é paga e a
 * Conab só cobre AC e a cabra de AL), então o Safralume mostra três coisas,
 * sempre dizendo de onde vem cada uma:
 *  1. o preço médio pago ao produtor no ano, do IBGE (valor da produção /
 *     litros produzidos) — anual, defasado, serve de referência e não de
 *     cotação;
 *  2. a última cotação observada, quando alguma fonte cobre o estado (Conab
 *     em AC, EPAGRI em SC);
 *  3. a relação leite/milho, que compara o litro de leite com o quilo de
 *     milho da ração.
 */

/** Cotação observada mais velha que isso não entra como "preço recente". */
export const DIAS_COTACAO_RECENTE = 60;

export type LinhaLeite = {
  ano: number;
  uf: string;
  producao_mil_litros: number | null;
  valor_mil_reais: number | null;
  vacas_ordenhadas: number | null;
};

const arredonda = (n: number, casas: number) => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

/** R$/litro = valor da produção (mil R$) / produção (mil litros). Null se faltar um dos dois. */
export function precoMedioLitro(l: Pick<LinhaLeite, "producao_mil_litros" | "valor_mil_reais">) {
  if (!l.producao_mil_litros || l.producao_mil_litros <= 0) return null;
  if (l.valor_mil_reais == null || l.valor_mil_reais <= 0) return null;
  return arredonda(l.valor_mil_reais / l.producao_mil_litros, 2);
}

export type ResumoLeite = {
  ano: number;
  preco_medio_litro: number;
  ano_anterior: number | null;
  preco_ano_anterior: number | null;
  /** Variação do preço médio contra o ano anterior, em % (1 casa). */
  variacao_pct: number | null;
  producao_milhoes_litros: number | null;
  vacas_ordenhadas: number | null;
  litros_por_vaca_dia: number | null;
};

/** Resume o ano mais recente que tem preço calculável; null se nenhum ano serve. */
export function resumirLeite(linhas: LinhaLeite[]): ResumoLeite | null {
  const ordenadas = [...linhas].sort((a, b) => b.ano - a.ano);
  const atual = ordenadas.find((l) => precoMedioLitro(l) != null);
  if (!atual) return null;
  const preco = precoMedioLitro(atual)!;

  // Só compara com o ano imediatamente anterior: pular um ano compararia
  // preços de contextos diferentes sem o leitor perceber.
  const anterior = ordenadas.find((l) => l.ano === atual.ano - 1) ?? null;
  const precoAnterior = anterior ? precoMedioLitro(anterior) : null;

  const producao = atual.producao_mil_litros;
  const vacas = atual.vacas_ordenhadas;
  return {
    ano: atual.ano,
    preco_medio_litro: preco,
    ano_anterior: precoAnterior != null ? atual.ano - 1 : null,
    preco_ano_anterior: precoAnterior,
    variacao_pct: precoAnterior
      ? arredonda(((preco - precoAnterior) / precoAnterior) * 100, 1)
      : null,
    producao_milhoes_litros: producao ? arredonda(producao / 1000, 1) : null,
    vacas_ordenhadas: vacas,
    litros_por_vaca_dia:
      producao && vacas && vacas > 0 ? arredonda((producao * 1000) / vacas / 365, 1) : null,
  };
}

export type RelacaoLeiteMilho = {
  preco_litro: number;
  preco_saca_milho: number;
  /** Quantos litros de leite pagam uma saca de 60 kg de milho. */
  litros_por_saca: number;
  /** Quantos kg de milho um litro de leite compra. */
  kg_milho_por_litro: number;
};

/** Relação de troca leite/milho. Null se algum preço não for positivo. */
export function relacaoLeiteMilho(
  precoLitro: number,
  precoSacaMilho: number,
): RelacaoLeiteMilho | null {
  if (!(precoLitro > 0) || !(precoSacaMilho > 0)) return null;
  return {
    preco_litro: precoLitro,
    preco_saca_milho: precoSacaMilho,
    litros_por_saca: arredonda(precoSacaMilho / precoLitro, 1),
    kg_milho_por_litro: arredonda(precoLitro / (precoSacaMilho / 60), 1),
  };
}

export type CotacaoLeite = { preco: number; data_referencia: string; fonte: string };

/**
 * Última cotação de leite observada numa UF (Conab, EPAGRI...), só se tiver
 * até DIAS_COTACAO_RECENTE dias. Ignora leite de cabra e "posto plataforma
 * da indústria" (preço em outro ponto da cadeia, não comparável).
 */
export async function buscarCotacaoLeite(
  supabase: SupabaseClient,
  uf: string,
  hoje: Date = new Date(),
): Promise<CotacaoLeite | null> {
  const { data } = await supabase
    .from("precos")
    .select("preco, data_referencia, fonte")
    .ilike("produto", "%leite%")
    .not("produto", "ilike", "%cabra%")
    .not("produto", "ilike", "%plataforma%")
    .eq("uf", uf)
    .eq("regiao", "")
    .order("data_referencia", { ascending: false })
    .limit(1)
    .returns<CotacaoLeite[]>();
  const linha = data?.[0];
  if (!linha) return null;
  if (diasEntre(linha.data_referencia, hoje.toISOString().slice(0, 10)) > DIAS_COTACAO_RECENTE) {
    return null;
  }
  return linha;
}

export async function buscarLinhasLeite(
  supabase: SupabaseClient,
  uf: string,
): Promise<LinhaLeite[]> {
  const { data } = await supabase
    .from("leite_ibge")
    .select("ano, uf, producao_mil_litros, valor_mil_reais, vacas_ordenhadas")
    .eq("uf", uf)
    .order("ano", { ascending: false })
    .limit(6)
    .returns<LinhaLeite[]>();
  return data ?? [];
}

/** Preço atual do milho em grão (saca 60 kg) na UF, pela mesma regra de fonte mais recente do resto do app. */
export async function precoAtualMilho(
  supabase: SupabaseClient,
  uf: string,
): Promise<{ preco: number; data_referencia: string; origem: "estado" | "regional" } | null> {
  const { fonte, serieEstado, regionais } = await buscarPrecosDaUf(supabase, "milho", uf);
  if (fonte === "estado") {
    const ultima = serieEstado.at(-1);
    return ultima
      ? { preco: ultima.preco, data_referencia: ultima.data_referencia, origem: "estado" }
      : null;
  }
  if (fonte === "regional") {
    const media = mediaDePracas(regionais.map((r) => r.preco));
    return media != null && regionais[0]
      ? { preco: media, data_referencia: regionais[0].data_referencia, origem: "regional" }
      : null;
  }
  return null;
}
