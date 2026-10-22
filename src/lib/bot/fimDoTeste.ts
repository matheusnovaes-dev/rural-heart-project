import type { SupabaseClient } from "@supabase/supabase-js";

import type { HistoricoLinha } from "@/lib/bot/prompt";

/**
 * Aviso de fim de teste DENTRO da conversa (pedido do Matheus 2026-10-22: converter o máximo possível em
 * pagantes e chamar a pessoa, não esperar). Dentro da janela de 24h do WhatsApp a mensagem é livre (sem
 * template, sem o bloqueio 131049 da Meta que barrou 34 envios em 7 dias), e quem está conversando é quem mais
 * converte. Anexado por código, nunca pedido ao modelo, no máximo uma vez por dia e só depois de uma resposta
 * com conteúdo (não em "por nada"). O pedido "quero assinar" já gera o link de uso único (classificarPedidoDeAssinatura).
 */
const HORAS_ENTRE_AVISOS = 20;
const JANELA_DO_AVISO_HORAS = 60;
/** Trecho fixo: o histórico é conferido por ele para não repetir o aviso. */
export const MARCA_AVISO_FIM_DO_TESTE = "seu teste grátis";

const fusoSp = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** "hoje", "amanhã" ou "em 2 dias", pelo calendário de São Paulo. null se o teste acaba depois da janela ou já acabou. */
export function quandoAcabaOTeste(expiraEmIso: string, agora = new Date()): string | null {
  const expira = new Date(expiraEmIso);
  const horas = (expira.getTime() - agora.getTime()) / 3_600_000;
  if (horas <= 0 || horas > JANELA_DO_AVISO_HORAS) return null;
  const dias = Math.round((Date.parse(fusoSp(expira)) - Date.parse(fusoSp(agora))) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `em ${dias} dias`;
}

export function textoAvisoFimDoTeste(quando: string): string {
  return `⏳ Lembrete: seu teste grátis acaba ${quando}. Pra continuar com preços, alertas e o caderno da fazenda sem interromper, responda *quero assinar* que eu te mando o link (Pix, cartão ou boleto).`;
}

/** Já avisou nas últimas horas? Confere pelas mensagens do próprio bot no histórico. */
export function jaAvisouDoFimDoTeste(historico: HistoricoLinha[], agora = new Date()): boolean {
  return historico.some((h) => {
    if (h.role !== "assistant" || !h.conteudo.toLowerCase().includes(MARCA_AVISO_FIM_DO_TESTE)) {
      return false;
    }
    if (!h.conteudo.includes("⏳")) return false;
    const t = Date.parse(h.created_at);
    return Number.isNaN(t) || (agora.getTime() - t) / 3_600_000 < HORAS_ENTRE_AVISOS;
  });
}

/** A resposta tem conteúdo (preço, análise) e ainda não fala de assinatura? Só então vale anexar. */
export function respostaComporta(resposta: string): boolean {
  if (/assin|plano|pagar|pagamento|link/i.test(resposta)) return false;
  return /R\$/.test(resposta) || resposta.length >= 150;
}

export async function avisoDeFimDoTeste(params: {
  supabase: SupabaseClient;
  produtorId: string | null;
  historico: HistoricoLinha[];
  resposta: string;
  agora?: Date;
}): Promise<string | null> {
  const { supabase, produtorId, historico, resposta } = params;
  const agora = params.agora ?? new Date();
  if (!produtorId || !respostaComporta(resposta) || jaAvisouDoFimDoTeste(historico, agora)) {
    return null;
  }
  try {
    const { data } = await supabase
      .from("assinaturas")
      .select("status, trial_expira_em")
      .eq("produtor_id", produtorId)
      .maybeSingle();
    if (!data || data.status !== "trial" || !data.trial_expira_em) return null;
    const quando = quandoAcabaOTeste(data.trial_expira_em, agora);
    return quando ? textoAvisoFimDoTeste(quando) : null;
  } catch {
    return null;
  }
}
