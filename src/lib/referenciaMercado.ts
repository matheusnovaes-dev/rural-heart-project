import type { SupabaseClient } from "@supabase/supabase-js";

import { ehBoi, normalizarCultura } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { ehPracaDePorto } from "@/lib/paridade";
import { diasEntre } from "@/lib/precoFonte";
import { produtoPrincipal } from "@/lib/precos";

/**
 * Quando o estado do produtor não tem preço recente (ou não tem nenhum) da
 * cultura dele, mostrar um painel vazio perde o cliente (visto em 2026-09-20: o
 * primeiro lead Ouro cadastrou "carne bovina" em SC, a base não tinha nada com
 * esse nome, e o dado de boi de SC tinha 50 dias). Em vez disso o app mostra o
 * que existe de verdade e recente: o preço da mesma cultura em outros estados
 * (com fonte e data) e, no boi, o mercado futuro da B3, que é referência
 * nacional diária.
 */

/** Dado do estado mais velho que isso é tratado como desatualizado. */
export const DIAS_DADO_DESATUALIZADO = 21;
/** Preço de outro estado só vale como referência se for recente. */
const DIAS_OUTRA_UF = 14;
const MAX_OUTRAS_UFS = 5;

export type PrecoOutraUf = {
  uf: string;
  preco: number;
  data_referencia: string;
  fonte: string;
  unidade: string | null;
};
export type ContratoFuturo = { vencimento: string; preco: number; data_pregao: string };
export type LinhaOutraUf = PrecoOutraUf & { regiao: string; produto: string };

export type ReferenciaMercado = {
  outras_ufs: PrecoOutraUf[];
  futuro_b3: ContratoFuturo[];
  /** Frase pronta em português, escrita por código (o bot cita como está). */
  frase: string;
  /** Todos os valores em R$ da frase (pra checagem de números). */
  valores: number[];
};

const brl = (n: number) => `R$${n.toFixed(2).replace(".", ",")}`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
const nomeDaUf = (uf: string) => ufs.find((u) => u.value === uf)?.label ?? uf;

/**
 * Preço mais recente por estado (média das praças do mesmo dia), só de linhas
 * do mesmo produto e sem praça CIF, dentro da janela. Função pura.
 */
export function escolherPrecosOutrasUfs(
  linhas: LinhaOutraUf[],
  ufExcluida: string,
  hojeIso: string,
): PrecoOutraUf[] {
  const validas = linhas.filter(
    (l) =>
      l.uf !== ufExcluida &&
      !ehPracaDePorto(l.regiao) &&
      Number.isFinite(l.preco) &&
      l.preco > 0 &&
      diasEntre(l.data_referencia, hojeIso) <= DIAS_OUTRA_UF,
  );
  // Um único produto (o mais frequente): estados com variantes diferentes
  // (boi em kg vivo, "china", etc.) não entram misturados.
  const contagem = new Map<string, number>();
  for (const l of validas) contagem.set(l.produto, (contagem.get(l.produto) ?? 0) + 1);
  const produto = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!produto) return [];

  const porUf = new Map<string, LinhaOutraUf[]>();
  for (const l of validas.filter((v) => v.produto === produto)) {
    porUf.set(l.uf, [...(porUf.get(l.uf) ?? []), l]);
  }
  const resultado: PrecoOutraUf[] = [];
  for (const [uf, rows] of porUf) {
    const maisRecente = rows
      .map((r) => r.data_referencia)
      .sort()
      .at(-1)!;
    const doDia = rows.filter((r) => r.data_referencia === maisRecente);
    const media = doDia.reduce((soma, r) => soma + r.preco, 0) / doDia.length;
    resultado.push({
      uf,
      preco: Math.round(media * 100) / 100,
      data_referencia: maisRecente,
      fonte: doDia[0]!.fonte,
      unidade: doDia[0]!.unidade,
    });
  }
  return resultado
    .sort((a, b) => b.data_referencia.localeCompare(a.data_referencia) || a.uf.localeCompare(b.uf))
    .slice(0, MAX_OUTRAS_UFS);
}

/** Frase da referência. Função pura. */
export function montarReferenciaMercado(params: {
  cultura: string;
  uf: string;
  ultimaDataUf: string | null;
  hojeIso: string;
  outras: PrecoOutraUf[];
  futuros: ContratoFuturo[];
}): ReferenciaMercado | null {
  const { cultura, uf, ultimaDataUf, hojeIso, outras, futuros } = params;
  if (outras.length === 0 && futuros.length === 0) return null;

  const partes: string[] = [];
  const dias = ultimaDataUf ? diasEntre(ultimaDataUf, hojeIso) : null;
  if (ultimaDataUf && dias != null && dias <= DIAS_DADO_DESATUALIZADO) {
    // Estado com dado em dia: só as referências (painel do boi mostra sempre).
  } else if (ultimaDataUf) {
    partes.push(
      `O último dado de ${cultura} em ${nomeDaUf(uf)} é de ${dataBr(ultimaDataUf)}, há ${dias} dias.`,
    );
  } else {
    partes.push(`Ainda não temos preço de ${cultura} em ${nomeDaUf(uf)}.`);
  }
  if (outras.length > 0) {
    const unidade = outras[0]!.unidade;
    const un = unidade ? ` por ${unidade === "15 kg" ? "arroba (15 kg)" : unidade}` : "";
    partes.push(
      `Referências recentes em outros estados${un}: ` +
        outras
          .map(
            (o) => `${nomeDaUf(o.uf)} ${brl(o.preco)} (${o.fonte}, ${dataBr(o.data_referencia)})`,
          )
          .join("; ") +
        ".",
    );
  }
  if (futuros.length > 0) {
    partes.push(
      `Mercado futuro na B3 (boi gordo, R$ por arroba, ajuste de ${dataBr(futuros[0]!.data_pregao)}): ` +
        futuros.map((f) => `${mesAno(f.vencimento)} ${brl(f.preco)}`).join("; ") +
        ".",
    );
  }
  return {
    outras_ufs: outras,
    futuro_b3: futuros,
    frase: partes.join(" "),
    valores: [...outras.map((o) => o.preco), ...futuros.map((f) => f.preco)],
  };
}

export async function buscarPrecosOutrasUfs(
  supabase: SupabaseClient,
  culturaCadastrada: string,
  uf: string,
  hoje: Date = new Date(),
): Promise<PrecoOutraUf[]> {
  const cultura = normalizarCultura(culturaCadastrada);
  const principal = produtoPrincipal(cultura);
  const desde = new Date(hoje);
  desde.setDate(desde.getDate() - DIAS_OUTRA_UF);
  let q = supabase
    .from("precos")
    .select("uf, preco, data_referencia, fonte, unidade, regiao, produto")
    .gte("data_referencia", desde.toISOString().slice(0, 10))
    .neq("uf", uf)
    .order("data_referencia", { ascending: false })
    .limit(600);
  q = principal ? q.eq("produto", principal) : q.ilike("produto", `%${cultura}%`);
  const { data } = await q.returns<LinhaOutraUf[]>();
  return escolherPrecosOutrasUfs(data ?? [], uf, hoje.toISOString().slice(0, 10));
}

/** Os 3 contratos mais próximos do boi gordo na B3 (ajuste do último pregão). */
export async function buscarFuturoBoi(
  supabase: SupabaseClient,
  hoje: Date = new Date(),
): Promise<ContratoFuturo[]> {
  const inicioDoMes = `${hoje.toISOString().slice(0, 7)}-01`;
  const { data: ultimo } = await supabase
    .from("b3_futuros")
    .select("data_pregao")
    .eq("produto", "BGI")
    .order("data_pregao", { ascending: false })
    .limit(1)
    .returns<{ data_pregao: string }[]>();
  const pregao = ultimo?.[0]?.data_pregao;
  if (!pregao) return [];
  const { data } = await supabase
    .from("b3_futuros")
    .select("mes_ano_vencimento, preco_ajuste_atual, data_pregao")
    .eq("produto", "BGI")
    .eq("data_pregao", pregao)
    .gte("mes_ano_vencimento", inicioDoMes)
    .order("mes_ano_vencimento", { ascending: true })
    .limit(3)
    .returns<{ mes_ano_vencimento: string; preco_ajuste_atual: number; data_pregao: string }[]>();
  return (data ?? []).map((r) => ({
    vencimento: r.mes_ano_vencimento,
    preco: Number(r.preco_ajuste_atual),
    data_pregao: r.data_pregao,
  }));
}

/**
 * Referência de mercado pra um estado sem dado recente: preço em outros
 * estados e, no boi, o futuro da B3. `ultimaDataUf` é a data mais recente que o
 * estado tem (null se não tem nada). Retorna null quando o dado do estado está
 * em dia (a menos que `sempre`, usado no painel do boi) ou não há referência.
 */
export async function buscarReferenciaMercado(
  supabase: SupabaseClient,
  params: {
    cultura: string;
    uf: string;
    ultimaDataUf: string | null;
    sempre?: boolean;
    hoje?: Date;
  },
): Promise<ReferenciaMercado | null> {
  const hoje = params.hoje ?? new Date();
  const hojeIso = hoje.toISOString().slice(0, 10);
  const desatualizado =
    params.ultimaDataUf == null ||
    diasEntre(params.ultimaDataUf, hojeIso) > DIAS_DADO_DESATUALIZADO;
  if (!desatualizado && !params.sempre) return null;
  const [outras, futuros] = await Promise.all([
    buscarPrecosOutrasUfs(supabase, params.cultura, params.uf, hoje),
    ehBoi(params.cultura) ? buscarFuturoBoi(supabase, hoje) : Promise.resolve([]),
  ]);
  return montarReferenciaMercado({
    cultura: ehBoi(params.cultura) ? "boi gordo" : normalizarCultura(params.cultura),
    uf: params.uf,
    ultimaDataUf: params.ultimaDataUf,
    hojeIso,
    outras,
    futuros,
  });
}
