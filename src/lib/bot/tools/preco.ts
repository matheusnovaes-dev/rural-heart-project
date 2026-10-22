import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarFrete, ehPracaDePorto, type ResultadoFrete } from "@/lib/paridade";
import {
  buscarReferenciaMercado,
  buscarBenchmarkRegional,
  type ReferenciaMercado,
  type BenchmarkRegional,
} from "@/lib/referenciaMercado";
import { filtrarPorProduto, normalizarCultura, tipoDeCafePadrao } from "@/config/culturas";
import { ehFonteMensal, escolherFontePreco, mediaDePracas, mesPorExtenso } from "@/lib/precoFonte";
import { produtoPrincipal } from "@/lib/precos";

type PrecoRow = {
  produto: string;
  preco: number;
  unidade: string | null;
  regiao: string;
  data_referencia: string;
  fonte: string;
  /** Só nas fontes mensais (ex: "junho/2026"): é a média do mês, NÃO um dia. Citar este texto no lugar de dd/mm/aaaa. */
  periodo_referencia?: string;
};

/** Linhas de fonte mensal ganham o mês por extenso; as demais passam como estão. */
export { ehFonteMensal, mesPorExtenso };

export function comPeriodo<T extends PrecoRow>(linhas: T[]): T[] {
  return linhas.map((r) =>
    ehFonteMensal(r.fonte) ? { ...r, periodo_referencia: mesPorExtenso(r.data_referencia) } : r,
  );
}

type FreteRow = {
  municipio_origem: string;
  uf_origem: string;
  municipio_destino: string;
  uf_destino: string;
  frete_rt: number;
};

export type ResultadoBuscarPreco = {
  encontrado: boolean;
  precos?: PrecoRow[];
  /**
   * Rota de frete de referência (origem e destino), pra citar a rota completa. O
   * frete NÃO é descontado do preço: o preço da região já vem descontado.
   */
  frete?: FreteRow | null;
  /** Paridade de porto (porto menos frete) quando dá pra afirmar, ou só o frete de referência. */
  frete_e_paridade?: ResultadoFrete | null;
  ufs_com_dado?: string[];
  /** De onde veio o preço: o número único do estado ou os preços por praça (quando o do estado está defasado ou não existe). */
  origem_preco?: "estado" | "regional";
  /** Só quando origem_preco="regional": média das praças do interior. */
  preco_medio_regioes?: number | null;
  /**
   * Quando o estado não tem preço recente (ou nenhum) da cultura: preço em
   * outros estados e, no boi, o futuro da B3. `frase` é texto pronto pra citar.
   */
  referencia_mercado?: ReferenciaMercado;
  /**
   * "Como o meu estado tá vendendo em relação aos outros" — sempre presente
   * quando existe preço de verdade (diferente de referencia_mercado, que só
   * aparece como substituto quando o estado NÃO tem dado recente).
   */
  comparativo_regional?: BenchmarkRegional;
  erro?: "produto_ausente" | "uf_ausente";
  /** "Café" sem tipo: qual tipo a ferramenta considerou (o bot precisa dizer isso ao produtor). */
  tipo_cafe_assumido?: { considerado: string; outro_tipo: string; motivo: string };
};

export async function buscarPreco(
  supabase: SupabaseClient,
  args: { produto: string | null; uf: string | null; incluir_frete: boolean },
  ctx?: {
    lat: number | null;
    lon: number | null;
    pediuFrete?: boolean;
    culturaCadastrada?: string | null;
  },
): Promise<ResultadoBuscarPreco> {
  let { produto } = args;
  const { uf, incluir_frete } = args;

  // Defesa em profundidade: o prompt já instrui a perguntar em vez de
  // chutar quando não sabe produto/UF, mas o schema permite null — se o
  // modelo mesmo assim chamar sem um dos dois, não deixa a query rodar com
  // um valor inventado (visto na prática: sem esse corte, o modelo às vezes
  // preenchia UF sozinho em vez de perguntar).
  if (!produto) return { encontrado: false, erro: "produto_ausente" };
  if (!uf) return { encontrado: false, erro: "uf_ausente" };
  // "carne bovina", "gado" etc. são o boi gordo na base (ver config/culturas.ts).
  produto = normalizarCultura(produto);

  // "Café" sem tipo (arábica ou conillon): a base guarda cada um separado. Escolhe o tipo mais
  // provável, cai no outro se só ele tiver preço na UF, e devolve o que considerou.
  if (produto === "café") {
    const preferido = tipoDeCafePadrao(uf, ctx?.culturaCadastrada);
    const outro = preferido === "café arábica" ? "café conillon" : "café arábica";
    let considerado: string = preferido;
    let resultado = await buscarPreco(supabase, { ...args, produto: preferido }, ctx);
    if (!resultado.encontrado) {
      const alternativa = await buscarPreco(supabase, { ...args, produto: outro }, ctx);
      if (alternativa.encontrado) {
        resultado = alternativa;
        considerado = outro;
      }
    }
    return {
      ...resultado,
      tipo_cafe_assumido: {
        considerado,
        outro_tipo: considerado === "café arábica" ? "café conillon" : "café arábica",
        motivo: "o produtor não disse se é arábica ou conillon",
      },
    };
  }

  // Dois tipos de dado convivem: o número único do estado (regiao='', ex:
  // Conab) e o preço por praça/região (ex: BBM, diário). O do estado vence, a
  // não ser que esteja defasado — ver escolherFontePreco. Antes só olhava as
  // regiões quando o estado não tinha NADA, e servia preço de 4 semanas atrás
  // (soja MT: R$129,80 de 21/08 vs ~R$143 de hoje nas praças).
  const principal = produtoPrincipal(produto);
  const buscarLinhas = (soPrincipal: boolean, regional: boolean) => {
    let q = filtrarPorProduto(
      supabase.from("precos").select("produto, preco, unidade, regiao, data_referencia, fonte"),
      produto,
    ).eq("uf", uf);
    q = regional ? q.neq("regiao", "") : q.eq("regiao", "");
    if (soPrincipal && principal) q = q.eq("produto", principal);
    return q
      .order("data_referencia", { ascending: false })
      .limit(regional ? 60 : 20)
      .returns<PrecoRow[]>();
  };

  // "milho" também casa "MILHO DE PIPOCA" (achado real: R$103 pro milho de MT,
  // que vale ~R$51) — soja e milho usam só a variante principal; sem nenhuma
  // linha dela, cai pro comportamento antigo (qualquer variante).
  let [{ data: rowsEstado }, { data: rowsRegionais }] = await Promise.all([
    buscarLinhas(true, false),
    buscarLinhas(true, true),
  ]);
  if (principal && (rowsEstado ?? []).length === 0 && (rowsRegionais ?? []).length === 0) {
    [{ data: rowsEstado }, { data: rowsRegionais }] = await Promise.all([
      buscarLinhas(false, false),
      buscarLinhas(false, true),
    ]);
  }

  // Praça CIF (porto/indústria) é outro nível de preço: não entra no preço da região.
  rowsRegionais = (rowsRegionais ?? []).filter((r) => !ehPracaDePorto(r.regiao));

  const maisRecenteEstado = rowsEstado?.[0]?.data_referencia ?? null;
  const maisRecenteRegional = rowsRegionais?.[0]?.data_referencia ?? null;
  const origem = escolherFontePreco(maisRecenteEstado, maisRecenteRegional);

  let atuais: PrecoRow[] = [];
  if (origem === "estado") {
    atuais = (rowsEstado ?? []).filter((r) => r.data_referencia === maisRecenteEstado);
  } else if (origem === "regional") {
    atuais = (rowsRegionais ?? []).filter((r) => r.data_referencia === maisRecenteRegional);
  }

  if (atuais.length === 0) {
    const desde = new Date();
    desde.setDate(desde.getDate() - 90);
    const { data: outrasUfs } = await filtrarPorProduto(
      supabase.from("precos").select("uf"),
      produto,
    )
      .gte("data_referencia", desde.toISOString().slice(0, 10))
      .returns<{ uf: string }[]>();
    const referencia = await buscarReferenciaMercado(supabase, {
      cultura: produto,
      uf,
      ultimaDataUf: null,
    });
    return {
      encontrado: false,
      ufs_com_dado: [...new Set((outrasUfs ?? []).map((r) => r.uf))],
      ...(referencia ? { referencia_mercado: referencia } : {}),
    };
  }

  // Com várias praças, o preço de referência é a média delas (na unidade de
  // saca de 60kg quando houver) — antes pegava a primeira linha que o banco
  // devolvesse, ou seja, uma praça arbitrária.
  // Dado do estado antigo demais (ex: boi de SC, 50 dias): a resposta traz
  // também o que existe de recente em outros estados (e o futuro da B3 no boi).
  const dataMaisRecente = atuais
    .map((r) => r.data_referencia)
    .sort()
    .at(-1)!;
  const periodoUf = atuais.every((r) => ehFonteMensal(r.fonte))
    ? mesPorExtenso(dataMaisRecente)
    : null;
  const referencia = await buscarReferenciaMercado(supabase, {
    cultura: produto,
    uf,
    ultimaDataUf: dataMaisRecente,
    periodoUf,
  });
  const comReferencia = referencia ? { referencia_mercado: referencia } : {};

  const linhasSaca = atuais.filter((r) => (r.unidade ?? "").includes("60"));
  const paraMedia = linhasSaca.length > 0 ? linhasSaca : atuais;
  const precoMedioRegioes =
    origem === "regional" ? mediaDePracas(paraMedia.map((r) => r.preco)) : null;
  const dadosDeOrigem =
    origem === "regional"
      ? { origem_preco: "regional" as const, preco_medio_regioes: precoMedioRegioes }
      : { origem_preco: "estado" as const };

  const precoRepresentativo =
    origem === "regional" ? precoMedioRegioes : (atuais[0]?.preco ?? null);
  // A média mensal de um estado não se compara com o preço de outros estados em outras datas e unidades
  // (achado 2026-10-22: alface de SP, R$/kg de junho, "177% acima" de SC, que usa R$/unidade).
  const ehMensal = atuais.length > 0 && atuais.every((r) => ehFonteMensal(r.fonte));
  const benchmark = ehMensal
    ? null
    : await buscarBenchmarkRegional(supabase, {
        cultura: produto,
        uf,
        precoUf: precoRepresentativo,
      });
  const comComparativo = benchmark ? { comparativo_regional: benchmark } : {};

  if (!incluir_frete) {
    return {
      encontrado: true,
      precos: comPeriodo(atuais),
      ...dadosDeOrigem,
      ...comReferencia,
      ...comComparativo,
    };
  }

  // O preço da região é o que o produtor recebe (já descontado do frete até o
  // porto). O frete serve pra comparar com o porto (paridade, contra a média das
  // praças da BBM), nunca pra descontar de novo.
  const frete = await buscarFrete(supabase, {
    cultura: produto,
    uf,
    lat: ctx?.lat ?? null,
    lon: ctx?.lon ?? null,
  });
  if (!frete) {
    return ctx?.pediuFrete
      ? {
          encontrado: true,
          precos: comPeriodo(atuais),
          frete: null,
          ...dadosDeOrigem,
          ...comComparativo,
        }
      : {
          encontrado: true,
          precos: comPeriodo(atuais),
          ...dadosDeOrigem,
          ...comReferencia,
          ...comComparativo,
        };
  }
  // Frete de referência sem paridade (MT, GO, milho...) só entra se o produtor
  // perguntou de frete: sem porto pra comparar, é ruído que o modelo repetia
  // em toda resposta.
  if (frete.tipo === "frete_referencia" && !ctx?.pediuFrete) {
    return {
      encontrado: true,
      precos: comPeriodo(atuais),
      ...dadosDeOrigem,
      ...comReferencia,
      ...comComparativo,
    };
  }

  return {
    encontrado: true,
    precos: comPeriodo(atuais),
    frete: frete.rota,
    frete_e_paridade: frete,
    ...dadosDeOrigem,
    ...comReferencia,
    ...comComparativo,
  };
}
