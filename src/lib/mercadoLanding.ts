/** Preços reais do dia mostrados na landing (faixa do topo e demo do WhatsApp). Tipos e fallback; a busca está em mercadoLanding.server.ts. */

export type ItemDoMercado = {
  id: string;
  rotulo: string;
  valor: number;
  unidade: "saca" | "dolar";
  /** Variação contra ~7 dias antes, em %, ou null se não houver base. */
  varPct: number | null;
  /** "2026-10-15" */
  data: string;
};

export type SojaParaDemo = {
  uf: string;
  valor: number;
  data: string;
  /** Média por dia dos últimos ~45 dias (do mais antigo ao mais novo). */
  serie: number[];
  media90: number;
  vsMedia90Pct: number;
};

export type MercadoDoDia = {
  itens: ItemDoMercado[];
  soja: SojaParaDemo | null;
};

export const brl = (n: number, casas = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** "2026-10-15" -> "15/10" */
export const diaMesCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
