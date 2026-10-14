/**
 * A safra de soja "AAAA/AAAA" vai do plantio (setembro do primeiro ano) até o fim da colheita
 * (junho do segundo). Dado de uma safra já encerrada não pode ser apresentado como "esta safra"
 * (visto em produção: aviso de foco de ferrugem de 2025/2026 enviado em outubro de 2026).
 */
export function safraEncerrada(safra: string | null | undefined, hoje: Date = new Date()): boolean {
  const m = (safra ?? "").match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (!m) return false;
  const fim = Date.UTC(Number(m[2]), 5, 30, 23, 59, 59);
  return hoje.getTime() > fim;
}
