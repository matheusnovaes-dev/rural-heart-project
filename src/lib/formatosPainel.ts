import { formatarReais } from "@/lib/fazenda.shared";

/** R$ 1,1 mi, R$ 12 mil, R$ 950: curto o bastante para caber no indicador. */
export function reaisCompacto(n: number): string {
  if (n < 0) return `−${reaisCompacto(-n)}`;
  if (Math.abs(n) < 10_000) return formatarReais(n);
  return `R$\u00a0${n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 2 })}`;
}
