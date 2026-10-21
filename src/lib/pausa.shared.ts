/**
 * Novo vencimento ao pausar: parte do vencimento atual (ou de hoje, se ele já passou) e soma os dias. Formato
 * yyyy-mm-dd da Asaas, em UTC para não depender do fuso do servidor. (toque de sincronização)
 */
export function novoVencimentoDaPausa(
  vencimentoAtual: string | null,
  dias: number,
  hoje = new Date(),
): string {
  const base = new Date(`${hoje.toISOString().slice(0, 10)}T12:00:00Z`);
  if (vencimentoAtual) {
    const atual = new Date(`${vencimentoAtual.slice(0, 10)}T12:00:00Z`);
    if (!Number.isNaN(atual.getTime()) && atual > base) base.setTime(atual.getTime());
  }
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}
