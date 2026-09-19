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
    // Achado forçando erro 2026-09-18: isso retornava liberado:true — tratando
    // "a consulta funcionou e não achou nenhuma assinatura" igual a "erro
    // transitório de banco" (motivo do fail-open no catch, mais abaixo). São
    // coisas diferentes: sem cooperativa e sem NENHUMA linha em assinaturas
    // significa que essa conta nunca teve (ou perdeu, por alguma falha
    // parcial no cadastro) um plano de verdade — precisa bloquear igual
    // trial vencido, não liberar pra sempre.
    if (!assinatura) return { liberado: false, comLogin: !!produtor?.user_id };

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

export function mensagemBloqueioAcesso(_comLogin: boolean): string {
  return "Seu teste grátis de 7 dias no Safralume acabou. Pra continuar recebendo preço, clima e alertas por aqui, assine um plano em https://safralume.com.br/assinar. Se não lembra como entrar no painel, me diga \"quero acessar meu painel\" que eu te mando um link de acesso.";
}
