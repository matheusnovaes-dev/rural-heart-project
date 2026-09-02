import type { SupabaseClient } from "@supabase/supabase-js";

import { precoLiquido } from "@/lib/frete";

type PrecoRow = {
  produto: string;
  preco: number;
  unidade: string | null;
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
  erro?: "produto_ausente" | "uf_ausente";
};

export async function buscarPreco(
  supabase: SupabaseClient,
  args: { produto: string | null; uf: string | null; incluir_frete: boolean },
): Promise<ResultadoBuscarPreco> {
  const { produto, uf, incluir_frete } = args;

  // Defesa em profundidade: o prompt já instrui a perguntar em vez de
  // chutar quando não sabe produto/UF, mas o schema permite null — se o
  // modelo mesmo assim chamar sem um dos dois, não deixa a query rodar com
  // um valor inventado (visto na prática: sem esse corte, o modelo às vezes
  // preenchia UF sozinho em vez de perguntar).
  if (!produto) return { encontrado: false, erro: "produto_ausente" };
  if (!uf) return { encontrado: false, erro: "uf_ausente" };

  const { data: rows } = await supabase
    .from("precos")
    .select("produto, preco, unidade, data_referencia, fonte")
    .ilike("produto", `%${produto}%`)
    .eq("uf", uf)
    .order("data_referencia", { ascending: false })
    .limit(20)
    .returns<PrecoRow[]>();

  const maisRecente = rows?.[0]?.data_referencia;
  const atuais = (rows ?? []).filter((r) => r.data_referencia === maisRecente);

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

  if (!incluir_frete) {
    return { encontrado: true, precos: atuais };
  }

  const { data: fretes } = await supabase
    .from("fretes")
    .select("municipio_origem, uf_origem, municipio_destino, uf_destino, frete_rt, updated_at")
    .ilike("cultura", `%${produto}%`)
    .eq("uf_origem", uf)
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<(FreteRow & { updated_at: string })[]>();

  const frete = fretes?.[0] ?? null;
  if (!frete) {
    return { encontrado: true, precos: atuais, frete: null, preco_liquido: null };
  }

  // Preferir a linha em saca de 60kg pro cálculo de líquido — mesma
  // preferência de unidade instruída no prompt pra resposta ao produtor.
  const linhaParaCalculo = atuais.find((r) => (r.unidade ?? "").includes("60")) ?? atuais[0]!;
  const liquido = precoLiquido(linhaParaCalculo.preco, frete.frete_rt);

  return { encontrado: true, precos: atuais, frete, preco_liquido: liquido };
}
