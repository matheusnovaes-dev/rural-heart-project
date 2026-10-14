import type { SupabaseClient } from "@supabase/supabase-js";

import type { Plano } from "@/lib/planos.shared";

/**
 * Estudos de proposta por dia e por plano. A quantidade (e não o recurso) é o
 * que muda de plano: o Bronze vê o valor inteiro, quem usa muito tem motivo para subir.
 */
export const LIMITE_DE_ESTUDOS_POR_PLANO: Record<Plano, number> = {
  bronze: 3,
  prata: 15,
  ouro: 15,
};

/** Início de todo estudo entregue: é isso que a contagem do dia procura. */
export const INICIO_DO_ESTUDO = "📄 *Estudo";

export type SituacaoDoLimite = {
  permitido: boolean;
  usados: number;
  limite: number;
  plano: Plano;
};

export function limiteDoPlano(plano: Plano | null | undefined): number {
  return LIMITE_DE_ESTUDOS_POR_PLANO[plano ?? "bronze"] ?? LIMITE_DE_ESTUDOS_POR_PLANO.bronze;
}

/** Quantos estudos foram entregues a este número nas últimas 24h e se ainda cabe mais um. */
export async function verificarLimiteDeEstudos(
  supabase: SupabaseClient,
  args: { telefone: string; produtorId: string | null; agora?: Date },
): Promise<SituacaoDoLimite> {
  let plano: Plano = "bronze";
  if (args.produtorId) {
    const { data } = await supabase
      .from("assinaturas")
      .select("plano")
      .eq("produtor_id", args.produtorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ plano: Plano }>();
    if (data?.plano === "prata" || data?.plano === "ouro" || data?.plano === "bronze")
      plano = data.plano;
  }
  const limite = limiteDoPlano(plano);
  const desde = new Date((args.agora ?? new Date()).getTime() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("bot_conversas")
    .select("id", { count: "exact", head: true })
    .eq("telefone", args.telefone)
    .eq("role", "assistant")
    .like("conteudo", `${INICIO_DO_ESTUDO}%`)
    .gte("created_at", desde);
  const usados = count ?? 0;
  return { permitido: usados < limite, usados, limite, plano };
}

/** Mensagem de quem bateu no limite do dia: no Bronze convida para o Prata, nos outros só avisa. */
export function mensagemDeLimite(s: SituacaoDoLimite): string {
  if (s.plano === "bronze") {
    return `Você já fez os ${s.limite} estudos de proposta de hoje, que é o limite do plano Bronze. Amanhã libera de novo. No plano Prata são ${LIMITE_DE_ESTUDOS_POR_PLANO.prata} por dia: se quiser, responda *quero assinar* que eu te mando o link pra mudar de plano.`;
  }
  return `Hoje já fiz ${s.limite} estudos de proposta pra você, que é o limite por dia. Amanhã eu continuo.`;
}
