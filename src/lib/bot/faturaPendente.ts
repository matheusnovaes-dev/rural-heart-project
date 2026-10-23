import type { SupabaseClient } from "@supabase/supabase-js";

import { pricingPlans } from "@/config/site";

/**
 * Link da cobrança que a pessoa JÁ abriu e não pagou. Achado de 23/10 (Asaas): das 108 contas, só 4 chegaram a criar uma
 * cobrança e 3 delas ficaram com a 1ª fatura vencida e nunca paga (Pix/boleto/cartão não concluído na página externa);
 * em 30 dias só 2 pessoas escreveram "quero pagar" no bot. Quem já tem cobrança aberta recebe o link dela direto no WhatsApp,
 * um toque até o Pix, em vez de refazer login + CPF + e-mail na tela de assinatura.
 */
export type FaturaParaPagar = { url: string; valor: number; vencimento: string; vencida: boolean };

type Pagamento = { status: string; value: number; dueDate: string; invoiceUrl?: string };

/** Escolhe a fatura certa entre as abertas: a de valor igual ao plano atual (a mais antiga), senão a mais antiga. */
export function escolherFatura(
  pagamentos: Pagamento[],
  valorDoPlano: number | null,
): Pagamento | null {
  const abertas = pagamentos
    .filter((p) => (p.status === "OVERDUE" || p.status === "PENDING") && p.invoiceUrl)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (abertas.length === 0) return null;
  // Troca de plano deixou cobranças antigas com valor velho (ex: R$39 vencida de um plano que virou R$299): vale a do valor atual.
  return abertas.find((p) => valorDoPlano != null && p.value === valorDoPlano) ?? abertas[0]!;
}

export async function buscarFaturaParaPagar(
  supabase: SupabaseClient,
  produtorId: string,
): Promise<FaturaParaPagar | null> {
  const apiKey = process.env["ASAAS_API_KEY"];
  // DIAGNÓSTICO TEMPORÁRIO (23/10): registra o motivo quando não acha a fatura, para achar por que o link não sai em produção.
  const diag = async (motivo: string) => {
    try {
      await supabase.from("whatsapp_falhas").insert({
        telefone: "diag-fatura",
        wamid: `diag-fatura-${Date.now()}`,
        codigo_erro: 0,
        titulo_erro: "diag fatura",
        contexto: motivo.slice(0, 300),
      });
    } catch {
      // diagnóstico nunca atrapalha
    }
  };
  if (!apiKey) {
    await diag("sem ASAAS_API_KEY no ambiente");
    return null;
  }
  try {
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("plano, asaas_subscription_id, status")
      .eq("produtor_id", produtorId)
      .maybeSingle();
    if (!assinatura?.asaas_subscription_id || assinatura.status === "cancelada") return null;
    const res = await fetch(
      `https://api.asaas.com/v3/payments?subscription=${assinatura.asaas_subscription_id}&limit=20`,
      { headers: { access_token: apiKey, "User-Agent": "Safralume/1.0" } },
    );
    if (!res.ok) {
      await diag(`Asaas respondeu ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { data?: Pagamento[] };
    const valorDoPlano = pricingPlans.find((p) => p.id === assinatura.plano)?.price ?? null;
    const f = escolherFatura(json.data ?? [], valorDoPlano);
    if (!f?.invoiceUrl) return null;
    return {
      url: f.invoiceUrl,
      valor: f.value,
      vencimento: f.dueDate,
      vencida: f.status === "OVERDUE",
    };
  } catch (err) {
    await diag(`exceção: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

export function respostaComFatura(f: FaturaParaPagar): string {
  return `Aqui está o link da sua assinatura, de ${brl(f.valor)} por mês: ${f.url}\n\nÉ só abrir e escolher como pagar (Pix, cartão ou boleto). Assim que o pagamento for confirmado, o Safralume segue funcionando por aqui normalmente 🌱`;
}
