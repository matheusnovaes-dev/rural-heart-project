import type { SupabaseClient } from "@supabase/supabase-js";

import { diasEntre } from "@/lib/precoFonte";

/**
 * Referência de ATACADO (IEA-SP, mercado atacadista da Grande São Paulo) para culturas em que o produtor de SP quase não tem
 * preço recebido atualizado. NÃO é o que o produtor recebe: a frase diz isso, e os dados ficam numa tabela própria
 * (`precos_atacado`, ver supabase/precos-atacado.sql) para nunca entrarem no preço do produtor nem nas médias de praças.
 */

/** Cultura do catálogo -> produtos do atacado (como o IEA escreve). Só SP. */
const PRODUTOS_DO_ATACADO: Record<string, string[]> = {
  cebola: ["CEBOLA"],
  batata: ["BATATA"],
  alho: ["ALHO"],
  feijão: ["FEIJÃO"],
  frango: ["FRANGO"],
  "ovos de galinha": ["OVO BRANCO", "OVO VERMELHO"],
  suíno: ["CARNE SUÍNA"],
};

/** Atacado é diário: passou disso, melhor não citar como referência do momento. */
export const DIAS_ATACADO_VALIDO = 10;

export type LinhaAtacado = {
  produto: string;
  descricao: string;
  preco: number;
  preco_min: number | null;
  preco_max: number | null;
  unidade: string | null;
  tendencia: string | null;
  data_referencia: string;
};

export type ReferenciaAtacado = {
  fonte: string;
  praca: string;
  data_referencia: string;
  linhas: LinhaAtacado[];
  /** Texto pronto, escrito por código: cite como está. */
  frase: string;
};

const brl = (n: number) => `R$${n.toFixed(2).replace(".", ",")}`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

const nomeLegivel = (l: Pick<LinhaAtacado, "produto" | "descricao">) => {
  const produto = l.produto.charAt(0) + l.produto.slice(1).toLowerCase();
  return l.descricao
    ? `${produto.toLowerCase()} ${l.descricao.toLowerCase()}`
    : produto.toLowerCase();
};

/** Função pura: monta a referência a partir das linhas do dia mais recente. */
export function montarReferenciaAtacado(
  linhas: LinhaAtacado[],
  hojeIso: string,
): ReferenciaAtacado | null {
  if (linhas.length === 0) return null;
  const data = linhas
    .map((l) => l.data_referencia)
    .sort()
    .at(-1)!;
  if (diasEntre(data, hojeIso) > DIAS_ATACADO_VALIDO) return null;
  const doDia = linhas.filter((l) => l.data_referencia === data);
  const partes = doDia.map((l) => {
    const faixa =
      l.preco_min != null && l.preco_max != null && l.preco_min !== l.preco_max
        ? ` (de ${brl(l.preco_min)} a ${brl(l.preco_max)})`
        : "";
    const un = l.unidade ? ` por ${l.unidade}` : "";
    const mercado = l.tendencia ? `, mercado ${l.tendencia.toLowerCase()}` : "";
    return `${nomeLegivel(l)} ${brl(l.preco)}${un}${faixa}${mercado}`;
  });
  return {
    fonte: "IEA-SP (atacado)",
    praca: "Grande São Paulo",
    data_referencia: data,
    linhas: doDia,
    frase: `Referência de ATACADO na Grande São Paulo (IEA-SP, ${dataBr(data)}), que não é o preço que o produtor recebe: ${partes.join("; ")}.`,
  };
}

/** Busca o dia mais recente do atacado para a cultura em SP; null se a UF não é SP, a cultura não tem atacado ou não há dado em dia. */
export async function buscarReferenciaAtacado(
  supabase: SupabaseClient,
  cultura: string,
  uf: string,
  hoje: Date = new Date(),
): Promise<ReferenciaAtacado | null> {
  if (uf.toUpperCase() !== "SP") return null;
  const produtos = PRODUTOS_DO_ATACADO[cultura];
  if (!produtos) return null;
  const hojeIso = hoje.toISOString().slice(0, 10);
  const desde = new Date(hoje);
  desde.setDate(desde.getDate() - DIAS_ATACADO_VALIDO);
  const { data, error } = await supabase
    .from("precos_atacado")
    .select("produto, descricao, preco, preco_min, preco_max, unidade, tendencia, data_referencia")
    .eq("uf", "SP")
    .in("produto", produtos)
    .gte("data_referencia", desde.toISOString().slice(0, 10))
    .order("data_referencia", { ascending: false })
    .limit(40)
    .returns<LinhaAtacado[]>();
  // Tabela ainda não criada ou erro de rede: o preço do produtor segue normal, só sem a referência.
  if (error || !data) return null;
  return montarReferenciaAtacado(
    data.map((l) => ({
      ...l,
      preco: Number(l.preco),
      preco_min: l.preco_min == null ? null : Number(l.preco_min),
      preco_max: l.preco_max == null ? null : Number(l.preco_max),
    })),
    hojeIso,
  );
}
