import type { SupabaseClient } from "@supabase/supabase-js";

import { pricingPlans } from "@/config/site";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import { telefonesDoBot } from "@/lib/telefone";

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

export type UsoDoTeste = { consultas: number; alertas: number; lancamentos: number };

/** "trocou 9 mensagens com a gente, deixou 2 alertas ligados e anotou 3 lançamentos": só o que a pessoa realmente fez. */
export function frasesDeUso(uso: UsoDoTeste | null): string | null {
  if (!uso) return null;
  const partes: string[] = [];
  if (uso.consultas >= 3) partes.push(`trocou ${uso.consultas} mensagens com a gente`);
  if (uso.alertas >= 1)
    partes.push(`deixou ${uso.alertas} ${uso.alertas === 1 ? "alerta ligado" : "alertas ligados"}`);
  if (uso.lancamentos >= 1)
    partes.push(
      `anotou ${uso.lancamentos} ${uso.lancamentos === 1 ? "lançamento" : "lançamentos"} no caderno da fazenda`,
    );
  if (partes.length === 0) return null;
  return partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

export function textoAvisoFimDoTeste(quando: string, uso: UsoDoTeste | null = null): string {
  const resumo = frasesDeUso(uso);
  if (resumo) {
    return `⏳ Lembrete: seu teste grátis acaba ${quando}. Nesses dias você já ${resumo}. Pra não perder isso, o plano Bronze custa R$${pricingPlans[0]!.price} por mês: responda *quero assinar* que eu te mando o link (Pix, cartão ou boleto).`;
  }
  return `⏳ Lembrete: seu teste grátis acaba ${quando}. Pra continuar com preços, alertas e o caderno da fazenda sem interromper, o plano Bronze custa R$${pricingPlans[0]!.price} por mês: responda *quero assinar* que eu te mando o link (Pix, cartão ou boleto).`;
}

/** O que a pessoa fez durante o teste, direto do banco (conversas, alertas ligados, lançamentos do caderno). */
export async function usoDuranteOTeste(
  supabase: SupabaseClient,
  produtorId: string,
  telefone: string | null,
  desdeIso: string,
): Promise<UsoDoTeste | null> {
  try {
    const contar = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
    const [consultas, alertasPreco, alertasClima, lancamentos] = await Promise.all([
      telefone
        ? contar(
            supabase
              .from("bot_conversas")
              .select("id", { count: "exact", head: true })
              .in("telefone", telefonesDoBot(telefone))
              .eq("role", "user")
              .gte("created_at", desdeIso),
          )
        : Promise.resolve(0),
      contar(
        supabase
          .from("alertas_preco")
          .select("id", { count: "exact", head: true })
          .eq("produtor_id", produtorId)
          .eq("ativo", true),
      ),
      contar(
        supabase
          .from("alertas_clima")
          .select("id", { count: "exact", head: true })
          .eq("produtor_id", produtorId)
          .eq("ativo", true),
      ),
      contar(
        supabase
          .from("fazenda_registros")
          .select("id", { count: "exact", head: true })
          .eq("produtor_id", produtorId)
          .is("apagado_em", null),
      ),
    ]);
    return { consultas, alertas: alertasPreco + alertasClima, lancamentos };
  } catch {
    return null;
  }
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
  telefone?: string | null;
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
      .select("status, trial_expira_em, created_at")
      .eq("produtor_id", produtorId)
      .maybeSingle();
    if (!data || data.status !== "trial" || !data.trial_expira_em) return null;
    const quando = quandoAcabaOTeste(data.trial_expira_em, agora);
    if (!quando) return null;
    const uso = await usoDuranteOTeste(
      supabase,
      produtorId,
      params.telefone ?? null,
      (data as { created_at?: string }).created_at ??
        new Date(agora.getTime() - 8 * 86_400_000).toISOString(),
    );
    return textoAvisoFimDoTeste(quando, uso);
  } catch {
    return null;
  }
}

/**
 * Quem está com acesso cortado (teste vencido, cancelada, inadimplente) e continua escrevendo é lead quente:
 * achado de 22/10 (Anildo, 26 mensagens, 8 dias recebendo só "quero assinar"). Avisa o Matheus (o n8n manda o
 * "Notificar humano") quando a pessoa já conversou o bastante (3+ mensagens no histórico recente) e ainda não houve
 * aviso de bloqueio nas últimas horas, ou seja, no máximo 1 alerta por pessoa por dia.
 */
export function deveAvisarEquipeDeLeadBloqueado(
  historico: HistoricoLinha[],
  agora = new Date(),
): boolean {
  if (historico.filter((h) => h.role === "user").length < 3) return false;
  const bloqueouRecente = historico.some((h) => {
    if (h.role !== "assistant" || !/quero (assinar|pagar)/i.test(h.conteudo)) return false;
    const t = Date.parse(h.created_at);
    return Number.isNaN(t) || (agora.getTime() - t) / 3_600_000 < HORAS_ENTRE_AVISOS;
  });
  return !bloqueouRecente;
}
