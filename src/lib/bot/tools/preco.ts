import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarFrete, ehPracaDePorto, type ResultadoFrete } from "@/lib/paridade";
import { escolherFontePreco, mediaDePracas } from "@/lib/precoFonte";
import { produtoPrincipal } from "@/lib/precos";

type PrecoRow = {
  produto: string;
  preco: number;
  unidade: string | null;
  regiao: string;
  data_referencia: string;
  fonte: string;
};

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
  erro?: "produto_ausente" | "uf_ausente";
};

export async function buscarPreco(
  supabase: SupabaseClient,
  args: { produto: string | null; uf: string | null; incluir_frete: boolean },
  ctx?: { lat: number | null; lon: number | null; pediuFrete?: boolean },
): Promise<ResultadoBuscarPreco> {
  const { produto, uf, incluir_frete } = args;

  // Defesa em profundidade: o prompt já instrui a perguntar em vez de
  // chutar quando não sabe produto/UF, mas o schema permite null — se o
  // modelo mesmo assim chamar sem um dos dois, não deixa a query rodar com
  // um valor inventado (visto na prática: sem esse corte, o modelo às vezes
  // preenchia UF sozinho em vez de perguntar).
  if (!produto) return { encontrado: false, erro: "produto_ausente" };
  if (!uf) return { encontrado: false, erro: "uf_ausente" };

  // Dois tipos de dado convivem: o número único do estado (regiao='', ex:
  // Conab) e o preço por praça/região (ex: BBM, diário). O do estado vence, a
  // não ser que esteja defasado — ver escolherFontePreco. Antes só olhava as
  // regiões quando o estado não tinha NADA, e servia preço de 4 semanas atrás
  // (soja MT: R$129,80 de 21/08 vs ~R$143 de hoje nas praças).
  const principal = produtoPrincipal(produto);
  const buscarLinhas = (soPrincipal: boolean, regional: boolean) => {
    let q = supabase
      .from("precos")
      .select("produto, preco, unidade, regiao, data_referencia, fonte")
      .ilike("produto", `%${produto}%`)
      .eq("uf", uf);
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
    const { data: outrasUfs } = await supabase
      .from("precos")
      .select("uf")
      .ilike("produto", `%${produto}%`)
      .gte("data_referencia", desde.toISOString().slice(0, 10))
      .returns<{ uf: string }[]>();
    return {
      encontrado: false,
      ufs_com_dado: [...new Set((outrasUfs ?? []).map((r) => r.uf))],
    };
  }

  // Com várias praças, o preço de referência é a média delas (na unidade de
  // saca de 60kg quando houver) — antes pegava a primeira linha que o banco
  // devolvesse, ou seja, uma praça arbitrária.
  const linhasSaca = atuais.filter((r) => (r.unidade ?? "").includes("60"));
  const paraMedia = linhasSaca.length > 0 ? linhasSaca : atuais;
  const precoMedioRegioes =
    origem === "regional" ? mediaDePracas(paraMedia.map((r) => r.preco)) : null;
  const dadosDeOrigem =
    origem === "regional"
      ? { origem_preco: "regional" as const, preco_medio_regioes: precoMedioRegioes }
      : { origem_preco: "estado" as const };

  if (!incluir_frete) {
    return { encontrado: true, precos: atuais, ...dadosDeOrigem };
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
      ? { encontrado: true, precos: atuais, frete: null, ...dadosDeOrigem }
      : { encontrado: true, precos: atuais, ...dadosDeOrigem };
  }
  // Frete de referência sem paridade (MT, GO, milho...) só entra se o produtor
  // perguntou de frete: sem porto pra comparar, é ruído que o modelo repetia
  // em toda resposta.
  if (frete.tipo === "frete_referencia" && !ctx?.pediuFrete) {
    return { encontrado: true, precos: atuais, ...dadosDeOrigem };
  }

  return {
    encontrado: true,
    precos: atuais,
    frete: frete.rota,
    frete_e_paridade: frete,
    ...dadosDeOrigem,
  };
}
