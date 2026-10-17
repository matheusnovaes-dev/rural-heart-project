import { carregarSupabase } from "@/lib/supabaseLazy";

/**
 * De onde veio o visitante (UTM, anúncio, Instagram, direto), guardado no
 * navegador e anexado ao lead/cadastro. Sem isso não dá pra saber se o
 * Instagram, o anúncio ou o orgânico está trazendo gente (achado 2026-10-13:
 * nenhuma tabela guardava origem). Tudo aqui é best-effort: nunca pode
 * atrapalhar o cadastro.
 */
export type Origem = {
  origem: string;
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
};

const CHAVE = "safralume_origem";

function limpar(valor: string | null): string | undefined {
  const v = valor?.trim().toLowerCase().slice(0, 80);
  return v ? v : undefined;
}

/** Decide a origem desta visita a partir da URL, do referrer e do navegador. */
export function detectarOrigem(
  url: string,
  referrer: string,
  userAgent: string,
  hostProprio: string,
): { origem: Origem; forte: boolean } {
  const params = new URL(url).searchParams;
  const utm_source = limpar(params.get("utm_source"));
  const utm_medium = limpar(params.get("utm_medium"));
  const utm_campaign = limpar(params.get("utm_campaign"));
  if (utm_source) {
    return { origem: { origem: utm_source, utm_source, utm_medium, utm_campaign }, forte: true };
  }
  if (params.get("fbclid")) return { origem: { origem: "meta_ads" }, forte: true };

  // Link da bio do Instagram abre no navegador do próprio app, que se identifica.
  if (/Instagram/i.test(userAgent)) return { origem: { origem: "instagram" }, forte: true };
  if (/FBAN|FBAV/i.test(userAgent)) return { origem: { origem: "facebook" }, forte: true };

  try {
    const host = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
    if (host && host !== hostProprio.replace(/^www\./, "")) {
      return { origem: { origem: limpar(host) ?? "referencia" }, forte: false };
    }
  } catch {
    // referrer inválido: cai em "direto"
  }
  return { origem: { origem: "direto" }, forte: false };
}

/** Guarda a origem da visita. Sinal forte (UTM, anúncio, Instagram) sobrescreve; o resto só preenche o vazio. */
export function capturarOrigem(): void {
  try {
    const { origem, forte } = detectarOrigem(
      window.location.href,
      document.referrer,
      navigator.userAgent,
      window.location.hostname,
    );
    const atual = window.localStorage.getItem(CHAVE);
    const atualEhFraco = !atual || /"origem":"(direto|[^"]*\.[^"]*)"/.test(atual);
    if (forte || atualEhFraco) window.localStorage.setItem(CHAVE, JSON.stringify(origem));
  } catch {
    // storage bloqueado: sem origem, o cadastro segue normal.
  }
}

export function lerOrigem(): Origem | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Origem) : null;
  } catch {
    return null;
  }
}

type TabelaComOrigem = "leads" | "cadastro_iniciados";

/**
 * Grava a linha com a origem. Se a coluna ainda não existir no banco (SQL
 * `supabase/origem-do-lead.sql` não rodado), regrava sem ela: o lead nunca se
 * perde por causa do rastreio.
 */
export async function inserirComOrigem(
  tabela: TabelaComOrigem,
  linha: Record<string, unknown>,
): Promise<void> {
  const supabase = await carregarSupabase();
  if (!supabase) return;
  const origem = lerOrigem();
  const { error } = await supabase.from(tabela).insert(origem ? { ...linha, ...origem } : linha);
  if (error && origem) await supabase.from(tabela).insert(linha);
}

/** Depois de criar o produtor: anota a origem nele (best-effort, ignora erro). */
export async function anotarOrigemDoProdutor(produtorId: string): Promise<void> {
  const origem = lerOrigem();
  if (!origem) return;
  const supabase = await carregarSupabase();
  if (!supabase) return;
  await supabase.from("produtores").update(origem).eq("id", produtorId);
}
