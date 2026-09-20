import type { SupabaseClient } from "@supabase/supabase-js";

import { diasEntre } from "@/lib/precoFonte";
import { escolherFreteReferencia, fretePorSaca, normalizarNome } from "@/lib/frete";

/**
 * Preço da região x paridade de porto.
 *
 * Os preços que o app mostra (DERAL, EMATER, Conab, praças do interior da BBM)
 * são o que o produtor RECEBE na região, ou seja, já vêm descontados do frete
 * até o porto. Descontar frete de novo (o "preço líquido" antigo) subestimava o
 * preço em 8% a 17%. O que o frete permite de verdade é comparar: preço no
 * porto menos frete até lá = paridade de porto, o valor que o porto pagaria
 * "na sua porteira". Se a região paga em linha com a paridade, tanto faz
 * vender aqui ou levar; se paga abaixo, dá pra negociar.
 *
 * Só há preço de porto pra soja (BBM, praças "CIF Porto": Santos, Paranaguá,
 * Rio Grande), e a tabela de frete só foi conferida contra a diferença real de
 * preço porto x praça em PR, SP, MS e MG (bate em ~R$1 por saca). Em GO fica
 * uns R$5 acima e em MT R$8-14 acima (a soja de MT também sai por outros
 * portos), então nesses estados o frete aparece só como referência, sem
 * paridade.
 */

export const UFS_COM_PARIDADE = new Set(["PR", "SP", "MS", "MG"]);
/** Preço de porto mais velho que isso não serve pra comparar com o preço de hoje. */
export const DIAS_PORTO_DEFASADO = 7;
/** Diferença menor que isso é "em linha" (ruído de cotação). */
const LIMITE_EM_LINHA = 0.5;

/** Destino da tabela de frete -> praça de porto da BBM que dá o preço dele. */
const PORTO_DE_PRECO: Record<string, "Santos" | "Paranaguá" | "Rio Grande"> = {
  [normalizarNome("Santos")]: "Santos",
  [normalizarNome("Guarujá")]: "Santos",
  [normalizarNome("Paranaguá")]: "Paranaguá",
  [normalizarNome("Rio Grande")]: "Rio Grande",
};

export function portoComPreco(municipioDestino: string) {
  return PORTO_DE_PRECO[normalizarNome(municipioDestino)] ?? null;
}

/**
 * Praça CIF da BBM ("Santos - SP (CIF Porto)", "Uberlândia (CIF Indústria)"):
 * preço entregue no porto/indústria, outro nível de preço. Nunca entra na média
 * do interior, senão mistura bases (achado: a média de SP misturava Santos com Ourinhos).
 */
export function ehPracaDePorto(regiao: string): boolean {
  return /\bcif\b/i.test(regiao);
}

export type RotaDeFrete = {
  municipio_origem: string;
  uf_origem: string;
  municipio_destino: string;
  uf_destino: string;
  frete_rt: number;
};
type RotaComCoordenada = RotaDeFrete & { lat_origem: number | null; lon_origem: number | null };

export type ResultadoFrete =
  | {
      tipo: "paridade";
      porto: string;
      preco_porto: number;
      data_porto: string;
      rota: RotaDeFrete;
      frete_por_saca: number;
      paridade: number;
      /** Média das praças do interior (BBM, mesma fonte e dia do porto) e quanto ela está acima (+) ou abaixo (-) da paridade. */
      preco_interior_bbm: number;
      diferenca: number;
      diferenca_abs: number;
      frase: string;
    }
  | {
      tipo: "frete_referencia";
      rota: RotaDeFrete;
      frete_por_saca: number;
      aviso: string;
      frase: string;
    };

const brl = (n: number) => `R$${n.toFixed(2).replace(".", ",")}`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const arredonda2 = (n: number) => Math.round(n * 100) / 100;

const AVISO_REFERENCIA =
  "Frete de referência (tabela Sifreca), não é desconto sobre o preço: o preço da região já vem descontado do frete até o porto.";

export function montarResultadoFrete(params: {
  uf: string;
  /** Média das praças do interior da BBM na UF (nunca DERAL/Conab/EMATER: fonte e método diferentes do porto). Null se a BBM não cobre a UF. */
  precoRegiao: number | null;
  rota: RotaDeFrete;
  precoPorto: { preco: number; data_referencia: string } | null;
  hojeIso: string;
}): ResultadoFrete {
  const { uf, precoRegiao, rota, precoPorto, hojeIso } = params;
  const frete_por_saca = fretePorSaca(rota.frete_rt);
  const porto = portoComPreco(rota.municipio_destino);
  const portoEmDia =
    precoPorto != null && diasEntre(precoPorto.data_referencia, hojeIso) <= DIAS_PORTO_DEFASADO;

  if (UFS_COM_PARIDADE.has(uf) && porto && precoPorto && portoEmDia && precoRegiao != null) {
    const paridade = arredonda2(precoPorto.preco - frete_por_saca);
    const diferenca = arredonda2(precoRegiao - paridade);
    const diferenca_abs = Math.abs(diferenca);
    const comparacao =
      diferenca_abs < LIMITE_EM_LINHA
        ? "a média das praças do interior está em linha com o porto"
        : diferenca > 0
          ? `a média das praças do interior está ${brl(diferenca_abs)} acima da paridade`
          : `a média das praças do interior está ${brl(diferenca_abs)} abaixo da paridade`;
    const frase =
      `Porto de ${porto}: ${brl(precoPorto.preco)} (BBM, ${dataBr(precoPorto.data_referencia)}). ` +
      `Frete de referência de ${rota.municipio_origem} até ${rota.municipio_destino}: ${brl(frete_por_saca)} por saca. ` +
      `Paridade de porto: ${brl(paridade)}; ${comparacao}.`;
    return {
      tipo: "paridade",
      porto,
      preco_porto: precoPorto.preco,
      data_porto: precoPorto.data_referencia,
      rota,
      frete_por_saca,
      paridade,
      preco_interior_bbm: precoRegiao,
      diferenca,
      diferenca_abs,
      frase,
    };
  }

  return {
    tipo: "frete_referencia",
    rota,
    frete_por_saca,
    aviso: AVISO_REFERENCIA,
    frase: `Referência de frete de ${rota.municipio_origem} até ${rota.municipio_destino}: cerca de ${brl(frete_por_saca)} por saca (só referência, o preço da região já é o que você recebe).`,
  };
}

/** Preço de porto (soja) mais recente na BBM. Null se não houver. */
export async function buscarPrecoDoPorto(
  supabase: SupabaseClient,
  porto: string,
): Promise<{ preco: number; data_referencia: string } | null> {
  const { data } = await supabase
    .from("precos")
    .select("preco, data_referencia")
    .eq("fonte", "BBM")
    .eq("produto", "SOJA EM GRÃOS (60 kg)")
    .ilike("regiao", `%${porto}%`)
    .ilike("regiao", "%porto%")
    .order("data_referencia", { ascending: false })
    .limit(1)
    .returns<{ preco: number; data_referencia: string }[]>();
  return data?.[0] ?? null;
}

/**
 * Média das praças do interior da BBM (soja) na UF, no dia mais recente. É a
 * base da comparação com o porto: mesma fonte, mesmo dia, mesmo método. O preço
 * estadual (DERAL, Conab) é outra medida: em PR dá R$139 quando as praças da BBM
 * dão R$151-157, e compará-lo com o porto acusaria "preço baixo" que não existe.
 */
export async function buscarPrecoInteriorBBM(
  supabase: SupabaseClient,
  uf: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("precos")
    .select("preco, regiao, data_referencia")
    .eq("fonte", "BBM")
    .eq("produto", "SOJA EM GRÃOS (60 kg)")
    .eq("uf", uf)
    .order("data_referencia", { ascending: false })
    .limit(60)
    .returns<{ preco: number; regiao: string; data_referencia: string }[]>();
  const interior = (data ?? []).filter((r) => !ehPracaDePorto(r.regiao));
  const maisRecente = interior[0]?.data_referencia;
  if (!maisRecente) return null;
  const doDia = interior.filter((r) => r.data_referencia === maisRecente);
  return arredonda2(doDia.reduce((soma, r) => soma + r.preco, 0) / doDia.length);
}

/**
 * Frete de referência (e paridade de porto quando dá pra afirmar) pra uma
 * cultura numa UF. Null quando a UF não tem rota até porto (RS, TO, SE...).
 */
export async function buscarFrete(
  supabase: SupabaseClient,
  params: {
    cultura: string;
    uf: string;
    lat: number | null;
    lon: number | null;
    hoje?: Date;
  },
): Promise<ResultadoFrete | null> {
  const { cultura, uf, lat, lon } = params;
  const { data: rotas } = await supabase
    .from("fretes")
    .select(
      "municipio_origem, uf_origem, municipio_destino, uf_destino, frete_rt, lat_origem, lon_origem",
    )
    .ilike("cultura", `%${cultura}%`)
    .eq("uf_origem", uf)
    .limit(2000)
    .returns<RotaComCoordenada[]>();

  const soja = /soja/i.test(cultura);
  // Onde dá paridade (soja em UF conferida), a rota tem que ir a um porto que
  // tenha preço; nos outros casos, qualquer porto de exportação serve de referência.
  const paraParidade = soja && UFS_COM_PARIDADE.has(uf);
  const rota =
    (paraParidade
      ? escolherFreteReferencia(rotas ?? [], lat, lon, (d) => portoComPreco(d) != null)
      : null) ?? escolherFreteReferencia(rotas ?? [], lat, lon);
  if (!rota) return null;

  const porto = paraParidade ? portoComPreco(rota.municipio_destino) : null;
  const [precoPorto, precoInterior] = porto
    ? await Promise.all([buscarPrecoDoPorto(supabase, porto), buscarPrecoInteriorBBM(supabase, uf)])
    : [null, null];
  return montarResultadoFrete({
    uf,
    precoRegiao: precoInterior,
    rota,
    precoPorto,
    hojeIso: (params.hoje ?? new Date()).toISOString().slice(0, 10),
  });
}
