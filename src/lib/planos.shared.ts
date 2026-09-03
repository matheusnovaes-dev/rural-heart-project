export type Plano = "bronze" | "prata" | "ouro";
export type StatusAssinatura = "trial" | "ativa" | "inadimplente" | "cancelada";

export function temAcessoPrata(plano: Plano | null | undefined) {
  return plano === "prata" || plano === "ouro";
}

export function temAcessoOuro(plano: Plano | null | undefined) {
  return plano === "ouro";
}

/** Quantos funcionários a conta pode cadastrar. Bronze não tem direito a
 * nenhum (é o "plano de entrada" pra quem toca a operação sozinho); Prata
 * cobre uma equipe pequena; Ouro é pra quem já tem gente demais pra contar
 * (consultor com vários clientes, operação grande). */
export function limiteFuncionarios(plano: Plano | null | undefined): number {
  if (plano === "ouro") return Infinity;
  if (plano === "prata") return 3;
  return 0;
}

/** Quantos alertas (de preço + de clima, somados) a conta pode ter ativos
 * ao mesmo tempo. Bronze já tem alerta liberado, só com teto — Prata e Ouro
 * ficam sem limite. */
export function limiteAlertas(plano: Plano | null | undefined): number {
  if (plano === "prata" || plano === "ouro") return Infinity;
  return 3;
}
