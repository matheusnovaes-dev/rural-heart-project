import type { SupabaseClient } from "@supabase/supabase-js";

import type { StatusAssinatura } from "@/lib/planos.shared";

export type AcessoWhatsapp =
  | { liberado: true }
  | { liberado: false; comLogin: boolean };

/**
 * Mesma regra de gating do painel web (useAcessoDashboard em src/lib/planos.ts):
 * assinatura ativa, trial ainda dentro do prazo, ou coberto pela cooperativa.
 * Faltava por completo no lado WhatsApp — um produtor com trial vencido e sem
 * plano pago continuava recebendo preço/clima/alerta pelo bot pra sempre,
 * achado real 2026-09-10 (o próprio fundador testou com o trial dele já
 * vencido e o bot respondeu normal).
 */
export async function verificarAcessoWhatsapp(
  supabase: SupabaseClient,
  produtorId: string,
): Promise<AcessoWhatsapp> {
  try {
    const { data: produtor } = await supabase
      .from("produtores")
      .select("cooperativa_id, user_id")
      .eq("id", produtorId)
      .maybeSingle();
    if (produtor?.cooperativa_id) return { liberado: true };

    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("status, trial_expira_em")
      .eq("produtor_id", produtorId)
      .maybeSingle();
    if (!assinatura) return { liberado: true };

    const status = assinatura.status as StatusAssinatura;
    const trialValido =
      status === "trial" &&
      !!assinatura.trial_expira_em &&
      new Date(assinatura.trial_expira_em) > new Date();
    if (status === "ativa" || trialValido) return { liberado: true };

    return { liberado: false, comLogin: !!produtor?.user_id };
  } catch (err) {
    // Falha na checagem não pode derrubar o bot pra todo mundo por causa de
    // uma instabilidade pontual do banco — nesse caso libera (fail open) e
    // loga, em vez de bloquear quem talvez esteja pagando em dia.
    console.error("Erro ao verificar acesso WhatsApp:", err);
    return { liberado: true };
  }
}

export function mensagemBloqueioAcesso(comLogin: boolean): string {
  if (comLogin) {
    return "Seu teste grátis de 7 dias no Safralume acabou. Pra continuar recebendo preço, clima e alertas por aqui, assine um plano em https://safralume.com.br/assinar — leva 1 minuto.";
  }
  return "Seu teste grátis de 7 dias no Safralume acabou. Pra continuar recebendo preço, clima e alertas por aqui, complete seu cadastro e escolha um plano em https://safralume.com.br.";
}
