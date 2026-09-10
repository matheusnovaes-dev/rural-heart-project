import type { SupabaseClient } from "@supabase/supabase-js";

import { limiteAlertas, limiteFuncionarios, type Plano, type StatusAssinatura } from "@/lib/planos.shared";

/**
 * Achado real 2026-09-10: o produtor perguntou "qual o meu plano?" e o
 * modelo INVENTOU uma resposta plausível ("não está com plano ativo"),
 * porque nenhuma ferramenta expunha dado real de assinatura — mesmo tipo de
 * erro que buscar_preco/buscar_clima já proíbem (nunca chutar), só que sem
 * ferramenta nenhuma pra evitar. Sempre que o produtor perguntar sobre
 * plano/status/vencimento do trial, o modelo deve chamar isto em vez de
 * responder de cabeça.
 */
export async function consultarAssinatura(
  supabase: SupabaseClient,
  ctx: { produtor: { id: string } },
) {
  if (!ctx.produtor.id) {
    return { encontrado: false };
  }
  const { data } = await supabase
    .from("assinaturas")
    .select("plano, status, trial_expira_em")
    .eq("produtor_id", ctx.produtor.id)
    .maybeSingle();
  if (!data) {
    return { encontrado: false };
  }

  const plano = data.plano as Plano;
  const status = data.status as StatusAssinatura;
  const trialValido =
    status === "trial" && !!data.trial_expira_em && new Date(data.trial_expira_em) > new Date();

  return {
    encontrado: true,
    plano,
    status,
    trial_expira_em: data.trial_expira_em,
    ativo: status === "ativa" || trialValido,
    limite_alertas: limiteAlertas(plano) === Infinity ? "sem limite" : limiteAlertas(plano),
    limite_funcionarios: limiteFuncionarios(plano) === Infinity ? "sem limite" : limiteFuncionarios(plano),
  };
}
