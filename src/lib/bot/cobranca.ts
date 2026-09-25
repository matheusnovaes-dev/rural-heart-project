import type { SupabaseClient } from "@supabase/supabase-js";

/** Quanto tempo o bot continua respondendo normal depois que a assinatura
 * fica inadimplente, antes de travar de vez. */
export const HORAS_DE_GRACA = 24;

export type StatusCobranca =
  { bloqueado: false; aviso: string | null } | { bloqueado: true; mensagem: string };

const AVISO_GRACA =
  "⚠️ Seu pagamento do Safralume venceu e ainda não foi identificado. Você tem até amanhã pra regularizar (safralume.com.br/dashboard/assinatura); depois disso esse WhatsApp para de responder até o pagamento ser confirmado.";

/** Também usada por tools/acesso.ts (mensagemBloqueioAcesso) — mesma trava,
 * mesma mensagem, pra não divergir. */
export const MENSAGEM_CORTE_COBRANCA =
  "Seu acesso ao Safralume foi pausado porque o pagamento não foi regularizado a tempo. Assim que você pagar aqui (safralume.com.br/dashboard/assinatura), eu volto a responder normalmente em poucos minutos.";

/**
 * Trava do bot por inadimplência — deliberadamente separada da trava do
 * painel (useAcessoDashboard em lib/planos.ts, que corta na hora que o
 * webhook marca "inadimplente"). Aqui o bot continua respondendo normal por
 * HORAS_DE_GRACA a partir do momento em que ficou inadimplente (mesmo
 * `updated_at` que o webhook grava), com um aviso deterministico anexado —
 * nunca escrito pelo modelo, pra não arriscar ele esquecer de avisar. Depois
 * da graça, corta de vez com uma mensagem fixa, sem passar pelo LLM.
 * Funciona igual pra Pix, cartão ou boleto: o que importa é status na
 * assinatura, não a forma de pagamento.
 */
export async function verificarCobranca(
  supabase: SupabaseClient,
  produtorId: string | null,
): Promise<StatusCobranca> {
  if (!produtorId) return { bloqueado: false, aviso: null };

  const { data } = await supabase
    .from("assinaturas")
    .select("status, updated_at")
    .eq("produtor_id", produtorId)
    .maybeSingle();

  if (!data || data.status !== "inadimplente") return { bloqueado: false, aviso: null };

  const desdeMs = new Date(data.updated_at).getTime();
  const horasInadimplente = (Date.now() - desdeMs) / 3_600_000;

  if (horasInadimplente >= HORAS_DE_GRACA) {
    return { bloqueado: true, mensagem: MENSAGEM_CORTE_COBRANCA };
  }
  return { bloqueado: false, aviso: AVISO_GRACA };
}
