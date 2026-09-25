import type { SupabaseClient } from "@supabase/supabase-js";

import type { StatusAssinatura } from "@/lib/planos.shared";
import { MENSAGEM_CORTE_COBRANCA, verificarCobranca } from "@/lib/bot/cobranca";

export type AcessoWhatsapp =
  | { liberado: true }
  | { liberado: false; comLogin: boolean; motivo: "sem_plano" | "inadimplente_vencido" };

/**
 * Mesma regra de gating do painel web (useAcessoDashboard em src/lib/planos.ts):
 * assinatura ativa, trial ainda dentro do prazo, ou coberto pela cooperativa.
 * Faltava por completo no lado WhatsApp — um produtor com trial vencido e sem
 * plano pago continuava recebendo preço/clima/alerta pelo bot pra sempre,
 * achado real 2026-09-10 (o próprio fundador testou com o trial dele já
 * vencido e o bot respondeu normal).
 *
 * Inadimplente é um caso à parte, ADICIONADO 2026-09-25: diferente de trial
 * vencido/sem plano (bloqueia na hora), quem já é assinante e só atrasou o
 * pagamento continua com o bot funcionando por HORAS_DE_GRACA (ver
 * lib/bot/cobranca.ts, mesma lógica que responder.ts usa pra decidir se
 * ainda vale a pena chamar o agente) — só depois disso bloqueia de verdade,
 * com uma mensagem diferente da de "teste grátis acabou" (que seria
 * enganosa pra quem já pagou antes).
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
    if (!assinatura) {
      return { liberado: false, comLogin: !!produtor?.user_id, motivo: "sem_plano" };
    }

    const status = assinatura.status as StatusAssinatura;
    const trialValido =
      status === "trial" &&
      !!assinatura.trial_expira_em &&
      new Date(assinatura.trial_expira_em) > new Date();
    if (status === "ativa" || trialValido) return { liberado: true };

    if (status === "inadimplente") {
      const cobranca = await verificarCobranca(supabase, produtorId);
      if (cobranca.bloqueado) {
        return { liberado: false, comLogin: !!produtor?.user_id, motivo: "inadimplente_vencido" };
      }
      // Dentro da graça: libera aqui. O aviso pro produtor é anexado por
      // responder.ts (mesma verificarCobranca, já roda antes de chegar aqui)
      // — não duplicado nesta resposta.
      return { liberado: true };
    }

    return { liberado: false, comLogin: !!produtor?.user_id, motivo: "sem_plano" };
  } catch (err) {
    // Falha na checagem não pode derrubar o bot pra todo mundo por causa de
    // uma instabilidade pontual do banco — nesse caso libera (fail open) e
    // loga, em vez de bloquear quem talvez esteja pagando em dia.
    console.error("Erro ao verificar acesso WhatsApp:", err);
    return { liberado: true };
  }
}

export function mensagemBloqueioAcesso(
  _comLogin: boolean,
  motivo: "sem_plano" | "inadimplente_vencido" = "sem_plano",
): string {
  if (motivo === "inadimplente_vencido") {
    return MENSAGEM_CORTE_COBRANCA;
  }
  return 'Seu teste grátis de 7 dias no Safralume acabou. Pra continuar recebendo preço, clima e alertas por aqui, assine um plano em https://safralume.com.br/assinar. Se não lembra como entrar no painel, me diga "quero acessar meu painel" que eu te mando um link de acesso.';
}
