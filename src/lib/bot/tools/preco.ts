import type { SupabaseClient } from "@supabase/supabase-js";

import { precoLiquido, escolherFreteReferencia } from "@/lib/frete";
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
  preco_liquido?: number | null;
  frete?: FreteRow | null;
  ufs_com_dado?: string[];
  /** De onde veio o preço: o número único do estado ou os preços por praça (quando o do estado está defasado ou não existe). */
  origem_preco?: "estado" | "regional";
  /** Só quando origem_preco="regional": média das praças, base do preco_liquido. */
  preco_medio_regioes?: number | null;
  erro?: "produto_ausente" | "uf_ausente";
};

export async function buscarPreco(
  supabase: SupabaseClient,
  args: { produto: string | null; uf: string | null; incluir_frete: boolean },
  ctx?: { lat: number | null; lon: number | null },
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

  // Entre as rotas cadastradas nesse estado, escolhe a origem mais perto da
  // cidade cadastrada do produtor (quando ele tem uma) em vez de uma rota
  // qualquer do estado — ver escolherFreteReferencia em lib/frete.ts.
  const { data: fretes } = await supabase
    .from("fretes")
    .select(
      "municipio_origem, uf_origem, municipio_destino, uf_destino, frete_rt, lat_origem, lon_origem, updated_at",
    )
    .ilike("cultura", `%${produto}%`)
    .eq("uf_origem", uf)
    .order("updated_at", { ascending: false })
    .returns<
      (FreteRow & {
        lat_origem: number | null;
        lon_origem: number | null;
        updated_at: string;
      })[]
    >();

  const frete = escolherFreteReferencia(fretes ?? [], ctx?.lat ?? null, ctx?.lon ?? null);
  if (!frete) {
    return { encontrado: true, precos: atuais, frete: null, preco_liquido: null, ...dadosDeOrigem };
  }

  // Preferir a linha em saca de 60kg pro cálculo de líquido — mesma
  // preferência de unidade instruída no prompt pra resposta ao produtor. Com
  // várias praças, usa a média delas.
  const linhaParaCalculo = atuais.find((r) => (r.unidade ?? "").includes("60")) ?? atuais[0]!;
  const base = precoMedioRegioes ?? linhaParaCalculo.preco;
  const liquido = Math.round(precoLiquido(base, frete.frete_rt) * 100) / 100;

  return { encontrado: true, precos: atuais, frete, preco_liquido: liquido, ...dadosDeOrigem };
}
