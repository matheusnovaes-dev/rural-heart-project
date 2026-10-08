import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizarCultura } from "@/config/culturas";
import { escolherFontePreco, type FonteDePreco } from "@/lib/precoFonte";
import { ehPracaDePorto } from "@/lib/paridade";

/**
 * Nome exato do produto "de verdade" quando a busca por substring casa mais
 * de uma variante. Achado real: "milho" também casa "MILHO DE PIPOCA (60
 * kg)" — a Conab publica só essa variante no nível do estado em MT, então o
 * painel e o bot mostravam R$103 pro milho de MT quando o milho em grão
 * custa ~R$51. Só soja e milho têm nome canônico certo; as outras culturas
 * seguem como antes.
 */
const PRODUTO_PRINCIPAL: Record<string, string> = {
  soja: "SOJA EM GRÃOS (60 kg)",
  milho: "MILHO EM GRÃOS (60 kg)",
  // Boi gordo em arroba (15 kg): "boi" também casa "BOI GORDO CHINA", "BOI
  // MAGRO" e o boi vivo em kg da EMATER, que são outras medidas.
  boi: "BOI GORDO (15 kg)",
};

export function produtoPrincipal(cultura: string): string | null {
  return PRODUTO_PRINCIPAL[normalizarCultura(cultura)] ?? null;
}

export type LinhaEstado = { preco: number; data_referencia: string; updated_at: string | null };
export type LinhaRegional = {
  regiao: string;
  preco: number;
  data_referencia: string;
  fonte: string;
};

const DIAS_DE_HISTORICO = 90;

/**
 * Preços de uma cultura numa UF já com a fonte escolhida (ver
 * escolherFontePreco): a série do estado (mais antiga primeiro) quando ela
 * está em dia, ou as praças do dia mais recente quando a do estado está
 * defasada ou não existe.
 */
export async function buscarPrecosDaUf(
  supabase: SupabaseClient,
  culturaCadastrada: string,
  uf: string,
): Promise<{
  fonte: FonteDePreco;
  serieEstado: LinhaEstado[];
  regionais: LinhaRegional[];
  /** Histórico completo (90 dias) de todas as praças, mesmo quando a fonte
   * escolhida é "estado" — diferente de `regionais`, que só traz a data mais
   * recente. Usado pelo gráfico da home quando o estado não tem preço único
   * (só praças): sem isso, o card de preço do produtor ficava sem nenhum
   * elemento gráfico, só uma lista de texto (achado real 2026-10-09, UF sem
   * série de estado, só praças regionais). */
  regionaisHistorico: LinhaRegional[];
  motivoRegional: "sem_estado" | "estado_defasado" | null;
}> {
  const cultura = normalizarCultura(culturaCadastrada);
  const desde = new Date();
  desde.setDate(desde.getDate() - DIAS_DE_HISTORICO);
  const desdeIso = desde.toISOString().slice(0, 10);
  const principal = produtoPrincipal(cultura);

  const consultaEstado = (soPrincipal: boolean) => {
    let q = supabase
      .from("precos")
      .select("preco, data_referencia, updated_at")
      .ilike("produto", `%${cultura}%`)
      .eq("uf", uf)
      .eq("regiao", "")
      .gte("data_referencia", desdeIso)
      .order("data_referencia", { ascending: true });
    if (soPrincipal && principal) q = q.eq("produto", principal);
    return q.returns<LinhaEstado[]>();
  };
  const consultaRegional = (soPrincipal: boolean) => {
    let q = supabase
      .from("precos")
      .select("regiao, preco, data_referencia, fonte")
      .ilike("produto", `%${cultura}%`)
      .eq("uf", uf)
      .neq("regiao", "")
      .order("data_referencia", { ascending: false })
      .limit(60);
    if (soPrincipal && principal) q = q.eq("produto", principal);
    return q.returns<LinhaRegional[]>();
  };

  let [{ data: estado }, { data: regionalRaw }] = await Promise.all([
    consultaEstado(true),
    consultaRegional(true),
  ]);
  // Sem nenhuma linha da variante principal, cai pro comportamento antigo
  // (qualquer variante) em vez de dizer que não há preço.
  if (principal && (estado ?? []).length === 0 && (regionalRaw ?? []).length === 0) {
    [{ data: estado }, { data: regionalRaw }] = await Promise.all([
      consultaEstado(false),
      consultaRegional(false),
    ]);
  }

  const serieEstado = estado ?? [];
  // Praça CIF (porto/indústria) é outro nível de preço: fora da média e da lista do interior.
  // regionaisTodas fica do jeito que a consulta devolveu (mais recente primeiro) porque
  // ultimaRegional depende disso; regionaisHistorico é a mesma lista em ordem
  // cronológica, pro gráfico (precisa ser crescente, igual serieEstado).
  const regionaisTodas = (regionalRaw ?? []).filter((r) => !ehPracaDePorto(r.regiao));
  const regionaisHistorico = [...regionaisTodas].sort((a, b) =>
    a.data_referencia.localeCompare(b.data_referencia),
  );
  const ultimaRegional = regionaisTodas[0]?.data_referencia ?? null;
  const fonte = escolherFontePreco(serieEstado.at(-1)?.data_referencia, ultimaRegional);

  if (fonte === "regional") {
    return {
      fonte,
      serieEstado: [],
      regionais: regionaisTodas.filter((r) => r.data_referencia === ultimaRegional),
      regionaisHistorico,
      motivoRegional: serieEstado.length > 0 ? "estado_defasado" : "sem_estado",
    };
  }
  return {
    fonte,
    serieEstado,
    regionais: [],
    regionaisHistorico,
    motivoRegional: null,
  };
}

/** Data da praça mais recente de uma cultura numa UF (ou null). Mesma variante principal de buscarPrecosDaUf. */
export async function ultimaDataRegional(
  supabase: SupabaseClient,
  culturaCadastrada: string,
  uf: string,
): Promise<string | null> {
  const cultura = normalizarCultura(culturaCadastrada);
  const principal = produtoPrincipal(cultura);
  const consulta = (soPrincipal: boolean) => {
    let q = supabase
      .from("precos")
      .select("data_referencia")
      .ilike("produto", `%${cultura}%`)
      .eq("uf", uf)
      .neq("regiao", "")
      .not("regiao", "ilike", "%cif%")
      .order("data_referencia", { ascending: false })
      .limit(1);
    if (soPrincipal && principal) q = q.eq("produto", principal);
    return q.returns<{ data_referencia: string }[]>();
  };
  let { data } = await consulta(true);
  if (principal && (data ?? []).length === 0) ({ data } = await consulta(false));
  return data?.[0]?.data_referencia ?? null;
}
