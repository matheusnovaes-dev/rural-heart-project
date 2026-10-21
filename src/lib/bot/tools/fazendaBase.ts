/**
 * Peças compartilhadas do Caderno da fazenda no bot: leitura de números, datas e unidades escritas à mão,
 * consulta ao banco e preço de mercado de hoje. Fica separado para os módulos do caderno (lançar, a pagar e
 * a receber, custo por saca, nota por foto) usarem sem importar uns aos outros.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COLUNAS_REGISTRO,
  hojeBrasilia,
  intervaloDoPeriodo,
  numerosDoTexto,
  somarDias,
  type PeriodoCaderno,
  type RegistroFazenda,
} from "@/lib/fazenda.shared";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { ProdutorContexto } from "@/lib/bot/types";
import { buscarPreco } from "@/lib/bot/tools/preco";

export const SEM_ACENTO = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const numeroOuNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

export const textoOuNull = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max) : null;
};

const UNIDADES: Record<string, string> = {
  saca: "sacas",
  sacas: "sacas",
  sc: "sacas",
  sacos: "sacas",
  arroba: "arrobas",
  arrobas: "arrobas",
  "@": "arrobas",
  ha: "ha",
  hectare: "ha",
  hectares: "ha",
  alqueire: "alqueires",
  alqueires: "alqueires",
  kg: "kg",
  quilo: "kg",
  quilos: "kg",
  tonelada: "t",
  toneladas: "t",
  t: "t",
  litro: "L",
  litros: "L",
  l: "L",
  cabeca: "cabeças",
  cabecas: "cabeças",
  cabeça: "cabeças",
  cabeças: "cabeças",
};

export function unidadePadrao(u: string | null): string | null {
  if (!u) return null;
  const k = u.trim().toLowerCase();
  return UNIDADES[k] ?? textoOuNull(k, 20);
}

/** Números que a pessoa escreveu nesta mensagem e nas últimas dela (o valor pode ter vindo antes). */
export function numerosDaConversa(texto: string, historico: HistoricoLinha[]): number[] {
  const recentes = [...historico]
    .filter((h) => h.role === "user")
    .sort((a, b) => b.ordem - a.ordem)
    .slice(0, 4)
    .map((h) => h.conteudo);
  return numerosDoTexto([texto, ...recentes].join(" \n "));
}

/** Última mensagem do bot nesta conversa (o histórico chega em qualquer ordem: ordena por `ordem`). */
export function ultimaDoBot(historico: HistoricoLinha[]): string | null {
  const u = [...historico]
    .filter((h) => h.role === "assistant")
    .sort((a, b) => b.ordem - a.ordem)[0];
  return u ? u.conteudo : null;
}

// ---------------------------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------------------------

/** Lançamentos do período (sem os apagados e sem os rascunhos), mais recentes primeiro. */
export async function lerRegistros(
  supabase: SupabaseClient,
  produtorId: string,
  periodo: PeriodoCaderno,
): Promise<{ registros: RegistroFazenda[]; rotulo: string; erro: boolean }> {
  const { desde, ate, rotulo } = intervaloDoPeriodo(periodo);
  const { data, error } = await supabase
    .from("fazenda_registros")
    .select(COLUNAS_REGISTRO)
    .eq("produtor_id", produtorId)
    .is("apagado_em", null)
    .neq("situacao", "rascunho")
    .gte("ocorrido_em", desde)
    .lte("ocorrido_em", ate)
    .order("ocorrido_em", { ascending: false })
    .limit(3000);
  if (error) console.error("Erro ao ler o caderno da fazenda:", error);
  return { registros: (data ?? []) as RegistroFazenda[], rotulo, erro: !!error };
}

/** Tudo que está a pagar ou a receber (de qualquer data). */
export async function lerPendentes(
  supabase: SupabaseClient,
  produtorId: string,
): Promise<RegistroFazenda[]> {
  const { data, error } = await supabase
    .from("fazenda_registros")
    .select(COLUNAS_REGISTRO)
    .eq("produtor_id", produtorId)
    .is("apagado_em", null)
    .eq("situacao", "pendente")
    .order("vence_em", { ascending: true })
    .limit(500);
  if (error) console.error("Erro ao ler pendências do caderno:", error);
  return (data ?? []) as RegistroFazenda[];
}

/** Preço de mercado de hoje da cultura (média das praças ou o do estado), por saca. */
export async function precoDeHoje(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  cultura: string | null,
): Promise<{ preco: number; uf: string } | null> {
  if (!cultura || !produtor.uf) return null;
  try {
    const r = await buscarPreco(
      supabase,
      { produto: cultura.toUpperCase(), uf: produtor.uf, incluir_frete: false },
      { lat: produtor.lat, lon: produtor.lon, culturaCadastrada: produtor.cultura_principal },
    );
    if (!r.encontrado || !r.precos?.length) return null;
    const saca = r.precos.filter((p) => /sc|saca/i.test(p.unidade ?? ""));
    const base = r.preco_medio_regioes ?? saca[0]?.preco ?? null;
    return typeof base === "number" && base > 0 ? { preco: base, uf: produtor.uf } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Ler o que a pessoa escreveu: unidade, data, vencimento, plano futuro e "isto é um lançamento"
// ---------------------------------------------------------------------------------------------

export const VERBOS_DE_LANCAMENTO =
  /\b(gastei|gastamos|paguei|pagamos|comprei|compramos|vendi|vendemos|plantei|plantamos|semeei|semeamos|colhi|colhemos|apliquei|aplicamos|pulverizei|abasteci|contratei|investi|desembolsei)\b/;
export const MARCA_DE_PLANO_OU_DUVIDA =
  /\b(vou|vamos|pretendo|pretendemos|quero|queria|queremos|preciso|precisamos|devo|devia|planejo|planejamos|pensando em|se eu|e se|ser[aá] que|talvez|ia )\b/;

/** Unidade escrita junto de um número ("500 sacas", "50 hectares", "30 arrobas"). */
export function unidadeDoTexto(texto: string): string | null {
  const t = SEM_ACENTO(texto);
  const m = t.match(
    /\d[\d.,]*\s*(?:mil\s*)?(sacas?|sacos?|sc|arrobas?|@|toneladas?|kg|quilos?|litros?|cabecas?|hectares?|ha|alqueires?)\b/,
  );
  return m ? unidadePadrao(m[1]!) : null;
}

const MESES_ABREV: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function montaData(a: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  // 31 de fevereiro e afins: a data não existe
  return new Date(`${iso}T12:00:00Z`).getUTCDate() === d ? iso : null;
}

const NOMES_DE_MES =
  "janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

/** Data dita com todas as letras ("ontem", "dia 15", "15/10", "dia 3 de setembro"), em AAAA-MM-DD, no passado. */
export function dataDoTexto(texto: string, hoje: string): string | null {
  const t = SEM_ACENTO(texto);
  if (/\banteontem\b/.test(t)) return somarDias(hoje, -2);
  if (/\bontem\b/.test(t)) return somarDias(hoje, -1);
  if (/\bhoje\b/.test(t)) return hoje;
  const [ano, mes, dia] = hoje.split("-").map(Number) as [number, number, number];
  const barra = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (barra) {
    const a = barra[3] ? (barra[3].length === 2 ? 2000 + Number(barra[3]) : Number(barra[3])) : ano;
    let iso = montaData(a, Number(barra[2]), Number(barra[1]));
    if (iso && !barra[3] && iso > hoje)
      iso = montaData(ano - 1, Number(barra[2]), Number(barra[1]));
    return iso;
  }
  const porExtenso = t.match(new RegExp(`\\bdia (\\d{1,2}) de (${NOMES_DE_MES})\\b`));
  if (porExtenso) {
    const m = MESES_ABREV[porExtenso[2]!]!;
    let iso = montaData(ano, m, Number(porExtenso[1]));
    if (iso && iso > hoje) iso = montaData(ano - 1, m, Number(porExtenso[1]));
    return iso;
  }
  const soDia = t.match(/\bdia (\d{1,2})\b/);
  if (soDia) {
    const d = Number(soDia[1]);
    if (d <= dia) return montaData(ano, mes, d);
    // dia que ainda não chegou neste mês: é do mês passado
    return mes === 1 ? montaData(ano - 1, 12, d) : montaData(ano, mes - 1, d);
  }
  return null;
}

/** Data de vencimento escrita ("dia 30", "30/11", "em 30 dias", "amanhã", "dia 10 do mês que vem"), no futuro. */
export function vencimentoDoTexto(texto: string, hoje: string): string | null {
  const t = SEM_ACENTO(texto);
  const [ano, mes, dia] = hoje.split("-").map(Number) as [number, number, number];
  const proxMes = (d: number) =>
    mes === 12 ? montaData(ano + 1, 1, d) : montaData(ano, mes + 1, d);
  if (/\bamanha\b/.test(t)) return somarDias(hoje, 1);
  const em = t.match(
    /\b(?:em|daqui a|dentro de|prazo de|a prazo de|parcela em)\s*(\d{1,3})\s*dias?\b/,
  );
  if (em && Number(em[1]) > 0) return somarDias(hoje, Number(em[1]));
  const barra = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (barra) {
    const a = barra[3] ? (barra[3].length === 2 ? 2000 + Number(barra[3]) : Number(barra[3])) : ano;
    let iso = montaData(a, Number(barra[2]), Number(barra[1]));
    if (iso && !barra[3] && iso < hoje)
      iso = montaData(ano + 1, Number(barra[2]), Number(barra[1]));
    return iso;
  }
  const porExtenso = t.match(new RegExp(`\\bdia (\\d{1,2}) de (${NOMES_DE_MES})\\b`));
  if (porExtenso) {
    const m = MESES_ABREV[porExtenso[2]!]!;
    let iso = montaData(ano, m, Number(porExtenso[1]));
    if (iso && iso < hoje) iso = montaData(ano + 1, m, Number(porExtenso[1]));
    return iso;
  }
  const soDia = t.match(/\bdia (\d{1,2})\b/);
  if (soDia) {
    const d = Number(soDia[1]);
    if (/\bmes que vem\b|\bproximo mes\b/.test(t)) return proxMes(d);
    if (d >= dia) return montaData(ano, mes, d);
    return proxMes(d);
  }
  return null;
}

/**
 * A mensagem fala de algo a pagar ou a receber mais tarde ("vendi e recebo dia 30", "tenho que pagar o
 * arrendamento dia 10", "boleto", "a prazo"). "Paguei" e "recebi" (no passado) NÃO contam: já aconteceu.
 */
export function indicaPendencia(texto: string): boolean {
  const t = SEM_ACENTO(texto);
  return /\b(a pagar|a receber|a prazo|boleto|prazo|vence\w*|parcel\w*|(vou|vai|vao|irei|irao) (receber|pagar)|receberei|pagarei|tenho (que |de |a )?(pagar|receber)|(recebo|recebe|recebem|pago|paga|pagam) (no |em |daqui |dia |amanha)|(recebo|pago) (dia|em|daqui|amanha)|(recebo|recebe|recebemos|pago|paga|pagamos) (depois|mais tarde|futuramente|a combinar)|ainda nao (recebi|paguei|recebemos|pagamos)|nao (recebi|paguei) ainda)\b/.test(
    t,
  );
}

export { hojeBrasilia };
