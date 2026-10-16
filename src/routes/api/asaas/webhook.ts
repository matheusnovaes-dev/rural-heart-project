import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

import { enviarEmailBoasVindas, enviarEmailCobranca } from "@/lib/email";
import { primeiroNome } from "@/lib/nomes";
import { enviarEventoCapiDoServidor } from "@/lib/metaCapi.server";
import { supabaseServiceRole } from "@/lib/supabase.server";

type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string;
  externalReference?: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl: string;
};

type AsaasWebhookBody = {
  event: string;
  payment?: AsaasPayment;
};

type Assinatura = {
  id: string;
  status: string;
  plano: string;
  produtor_id: string | null;
  cooperativa_id: string | null;
};

const EVENTOS_ATIVACAO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const EVENTOS_INADIMPLENCIA = new Set(["PAYMENT_OVERDUE"]);
const EVENTOS_RENOVACAO = new Set(["PAYMENT_CREATED"]);
const EVENTOS_CANCELAMENTO = new Set([
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
]);

export const Route = createFileRoute("/api/asaas/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookToken = process.env["ASAAS_WEBHOOK_TOKEN"];
        const supabaseUrl = process.env["SB_URL"];
        const serviceRoleKey = process.env["SB_SERVICE_ROLE_KEY"];

        if (!webhookToken || !supabaseUrl || !serviceRoleKey) {
          return new Response("Missing server configuration", { status: 500 });
        }

        const tokenRecebido = request.headers.get("asaas-access-token");
        if (tokenRecebido !== webhookToken) {
          return new Response("Token inválido", { status: 401 });
        }

        let body: AsaasWebhookBody;
        try {
          body = (await request.json()) as AsaasWebhookBody;
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }
        const payment = body.payment;
        if (!payment) {
          return new Response(null, { status: 200 });
        }

        // Preferimos o externalReference (id da nossa assinatura, definido
        // na criação) — cai pro asaas_subscription_id só se por algum
        // motivo ele não vier no payload.
        const assinaturaId = payment.externalReference;

        const supabase = supabaseServiceRole();

        async function buscarAssinatura(): Promise<Assinatura | null> {
          const query = supabase
            .from("assinaturas")
            .select("id, status, plano, produtor_id, cooperativa_id");
          const { data } = await (
            assinaturaId
              ? query.eq("id", assinaturaId)
              : query.eq("asaas_subscription_id", payment!.subscription ?? "")
          ).maybeSingle();
          return data;
        }

        if (EVENTOS_ATIVACAO.has(body.event)) {
          const assinatura = await buscarAssinatura();
          if (assinatura) {
            // A Asaas manda PAYMENT_CONFIRMED e PAYMENT_RECEIVED quase juntos (Pix). A virada pra "ativa" é
            // reivindicada de forma atômica (só atualiza quem ainda não está ativa): quem ganha manda as
            // boas-vindas, o outro evento só atualiza os ids. Sem isso os dois liam "não ativa" ao mesmo
            // tempo e a pessoa recebia a boas-vindas em dobro.
            const dados = {
              asaas_customer_id: payment.customer,
              asaas_subscription_id: payment.subscription ?? null,
              updated_at: new Date().toISOString(),
            };
            const { data: virou } = await supabase
              .from("assinaturas")
              .update({ status: "ativa", ...dados })
              .eq("id", assinatura.id)
              .neq("status", "ativa")
              .select("id");

            if (virou && virou.length > 0) {
              await enviarEmailBoasVindasAsaas({
                apiKey: process.env["ASAAS_API_KEY"],
                customerId: payment.customer,
                plano: assinatura.plano,
              });
              await notificarPagamentoConfirmado(supabase, assinatura);
              await registrarCompraNoMeta(supabase, assinatura, payment);
            } else {
              await supabase.from("assinaturas").update(dados).eq("id", assinatura.id);
            }
          }
        } else if (EVENTOS_INADIMPLENCIA.has(body.event)) {
          const assinatura = await buscarAssinatura();
          if (assinatura) {
            await supabase
              .from("assinaturas")
              .update({ status: "inadimplente", updated_at: new Date().toISOString() })
              .eq("id", assinatura.id);
            await notificarCobranca(supabase, assinatura, payment, "vencida");
          }
        } else if (EVENTOS_RENOVACAO.has(body.event)) {
          // PAYMENT_CREATED dispara também pra primeira cobrança (a do
          // checkout inicial) — só avisa se já era uma assinatura ativa
          // antes, ou seja, é uma cobrança de ciclo seguinte (renovação),
          // não o convite inicial que a pessoa acabou de ver na hora.
          const assinatura = await buscarAssinatura();
          if (assinatura && assinatura.status === "ativa") {
            await notificarCobranca(supabase, assinatura, payment, "vencendo");
          }
        } else if (EVENTOS_CANCELAMENTO.has(body.event)) {
          // Apagar UMA cobrança (ex.: corrigir um valor errado) não encerra a
          // assinatura. Só cancela se a assinatura em si já não estiver ativa
          // na Asaas; sem conseguir confirmar, não cancela (cortar acesso de
          // quem paga é pior que manter uns dias a mais).
          if (body.event === "PAYMENT_DELETED" && payment.subscription) {
            const status = await statusDaAssinaturaNaAsaas(
              process.env["ASAAS_API_KEY"],
              payment.subscription,
            );
            if (status !== "INACTIVE" && status !== "EXPIRED") {
              return new Response(null, { status: 200 });
            }
          }
          const query = supabase.from("assinaturas").update({
            status: "cancelada",
            updated_at: new Date().toISOString(),
          });
          if (assinaturaId) {
            await query.eq("id", assinaturaId);
          } else if (payment.subscription) {
            await query.eq("asaas_subscription_id", payment.subscription);
          }
        }

        return new Response(null, { status: 200 });
      },
    },
  },
});

async function statusDaAssinaturaNaAsaas(
  apiKey: string | undefined,
  subscriptionId: string,
): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.asaas.com/v3/subscriptions/${subscriptionId}`, {
      headers: { access_token: apiKey, "User-Agent": "Safralume/1.0" },
    });
    if (res.status === 404) return "INACTIVE";
    if (!res.ok) return null;
    const sub = (await res.json()) as { status?: string; deleted?: boolean };
    return sub.deleted ? "INACTIVE" : (sub.status ?? null);
  } catch {
    return null;
  }
}

async function enviarEmailBoasVindasAsaas({
  apiKey,
  customerId,
  plano,
}: {
  apiKey: string | undefined;
  customerId: string;
  plano: string;
}) {
  if (!apiKey) return;
  try {
    const res = await fetch(`https://api.asaas.com/v3/customers/${customerId}`, {
      headers: { access_token: apiKey, "User-Agent": "Safralume/1.0" },
    });
    const customer = (await res.json()) as { name?: string; email?: string };
    // Quem se cadastrou pela landing ou pelo WhatsApp tem e-mail técnico (lead-<fone>@safralume.app), que
    // não recebe nada: mandar pra lá só gera devolução e prejudica a reputação do remetente. Visto na
    // primeira venda (Bruno, 16/10/2026).
    if (customer.email && !customer.email.toLowerCase().endsWith("@safralume.app")) {
      await enviarEmailBoasVindas({
        to: customer.email,
        nome: customer.name ?? "produtor",
        plano,
      });
    }
  } catch (err) {
    // E-mail é um extra — não deve derrubar o processamento do webhook.
    console.error("Falha ao buscar cliente na Asaas pro e-mail de boas-vindas:", err);
  }
}

const ROTULO_PLANO: Record<string, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

/**
 * Boas-vindas pelo WhatsApp quando o pagamento cai (a assinatura passa a ativa). Vale pra todo produtor:
 * o e-mail de boas-vindas não chega a quem se cadastrou pela landing ou pelo WhatsApp (e-mail técnico),
 * e o WhatsApp é o canal que ele de fato usa. Template `pagamento_confirmado_safralume` (UTILITY, aprovado
 * pela Meta), enviado pelo mesmo webhook do n8n das cobranças. Falha aqui nunca derruba o webhook.
 */
/** Mesmo texto do template `pagamento_confirmado_safralume`, mandado como texto livre dentro da janela de 24h. */
function textoPagamentoConfirmado(nome: string, plano: string): string {
  return `Oi, ${nome}! 🎉 Seu pagamento do plano ${plano} foi confirmado e a gente está muito feliz de ter você no Safralume! 🌾\n\nObrigado pela confiança. Daqui pra frente, é só me chamar aqui quando quiser: pergunte o preço da sua cultura, peça o clima, mande a proposta de um comprador pra eu analisar. Estou aqui pra te ajudar a vender na hora certa.\n\nSeja muito bem-vindo! 💚`;
}

async function notificarPagamentoConfirmado(supabase: SupabaseClient, assinatura: Assinatura) {
  try {
    if (!assinatura.produtor_id) return;
    const webhookUrl = process.env["N8N_COBRANCA_WEBHOOK_URL"];
    const token = process.env["N8N_COBRANCA_TOKEN"];
    if (!webhookUrl || !token) return;
    const { data: produtor } = await supabase
      .from("produtores")
      .select("nome, whatsapp")
      .eq("id", assinatura.produtor_id)
      .maybeSingle();
    if (!produtor?.whatsapp) return;
    const primeiro = primeiroNome(produtor.nome) ?? "produtor";
    const plano = ROTULO_PLANO[assinatura.plano] ?? assinatura.plano;
    // Dentro de 24h da última mensagem dele, texto livre: não gasta template e não cai na trava de
    // marketing da Meta (131049). Quem paga costuma ter falado com o bot minutos antes (ex.: "quero pagar").
    const desde = new Date(Date.now() - 23 * 3_600_000).toISOString();
    const { count } = await supabase
      .from("bot_conversas")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .like("telefone", `%${produtor.whatsapp.slice(-8)}`)
      .gte("created_at", desde);
    const dentroDaJanela = (count ?? 0) > 0;
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-safralume-token": token },
      body: JSON.stringify({
        telefone: `55${produtor.whatsapp}`,
        template: "pagamento_confirmado_safralume",
        modo: dentroDaJanela ? "texto" : "template",
        mensagem: dentroDaJanela ? textoPagamentoConfirmado(primeiro, plano) : undefined,
        nome: primeiro,
        plano,
      }),
    });
    if (!res.ok) console.error("n8n recusou a boas-vindas de pagamento:", res.status);
  } catch (err) {
    console.error("Falha ao mandar boas-vindas de pagamento por WhatsApp:", err);
  }
}

/**
 * Avisa sobre cobrança vencendo/vencida: WhatsApp pro produtor (via n8n,
 * reaproveitando o envio já testado dos lembretes/alertas), e-mail pra
 * cooperativa (hoje não coleta telefone no cadastro).
 */
async function notificarCobranca(
  supabase: SupabaseClient,
  assinatura: Assinatura,
  payment: AsaasPayment,
  tipo: "vencendo" | "vencida",
) {
  try {
    if (assinatura.produtor_id) {
      const { data: produtor } = await supabase
        .from("produtores")
        .select("nome, whatsapp")
        .eq("id", assinatura.produtor_id)
        .maybeSingle();
      if (produtor?.whatsapp) {
        await notificarWhatsApp(produtor.whatsapp, produtor.nome, payment, tipo);
      }
    } else if (assinatura.cooperativa_id) {
      const { data: admin } = await supabase
        .from("cooperativa_membros")
        .select("nome, email")
        .eq("cooperativa_id", assinatura.cooperativa_id)
        .eq("papel", "admin")
        .maybeSingle();
      if (admin?.email) {
        await enviarEmailCobranca({
          to: admin.email,
          nome: admin.nome ?? "produtor",
          plano: assinatura.plano,
          tipo,
          invoiceUrl: payment.invoiceUrl,
        });
      }
    }
  } catch (err) {
    // Notificação é um extra — não deve derrubar o processamento do webhook.
    console.error("Falha ao notificar cobrança:", err);
  }
}

async function notificarWhatsApp(
  whatsapp: string,
  nome: string,
  payment: AsaasPayment,
  tipo: "vencendo" | "vencida",
) {
  const webhookUrl = process.env["N8N_COBRANCA_WEBHOOK_URL"];
  const token = process.env["N8N_COBRANCA_TOKEN"];
  if (!webhookUrl || !token) return;

  const valor = payment.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const vencimento = new Date(`${payment.dueDate}T00:00:00`).toLocaleDateString("pt-BR");
  const primeiroNome = nome.split(" ")[0] || nome;
  // Mensagem de negócio pra quem não mandou mensagem recentemente exige
  // template aprovado pela Meta — texto livre não entrega fora da janela
  // de 24h de uma conversa iniciada pelo cliente.
  const template = tipo === "vencendo" ? "cobranca_vencendo_safralu" : "cobranca_vencida_safralu";

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-safralume-token": token },
    body: JSON.stringify({
      telefone: `55${whatsapp}`,
      template,
      nome: primeiroNome,
      valor,
      vencimento,
    }),
  });
}

/**
 * Avisa a Meta (API de Conversões) que alguém pagou pela primeira vez: o evento Purchase com o valor real da cobrança.
 * Sem ele os anúncios só otimizam por cadastro e nunca aprendem quem vira cliente. Deduplicado por pagamento
 * (event_id) e nunca derruba o webhook: se a Meta falhar, a assinatura já está ativa e o cliente já foi avisado.
 */
async function registrarCompraNoMeta(
  supabase: ReturnType<typeof supabaseServiceRole>,
  assinatura: Assinatura,
  payment: { id?: string; value?: number },
) {
  try {
    if (!assinatura.produtor_id) return; // cooperativa: sem telefone para casar com o anúncio
    const { data: produtor } = await supabase
      .from("produtores")
      .select("whatsapp")
      .eq("id", assinatura.produtor_id)
      .maybeSingle<{ whatsapp: string | null }>();
    await enviarEventoCapiDoServidor({
      eventId: `purchase_${payment.id ?? assinatura.id}`,
      evento: "Purchase",
      plano: assinatura.plano,
      valor: typeof payment.value === "number" ? payment.value : undefined,
      whatsapp: produtor?.whatsapp ?? undefined,
    });
  } catch (err) {
    console.error("Falha ao registrar a compra no Meta:", err);
  }
}
