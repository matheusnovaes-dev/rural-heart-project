import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { enviarEmailBoasVindas, enviarEmailCobranca } from "@/lib/email";

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

        const body = (await request.json()) as AsaasWebhookBody;
        const payment = body.payment;
        if (!payment) {
          return new Response(null, { status: 200 });
        }

        // Preferimos o externalReference (id da nossa assinatura, definido
        // na criação) — cai pro asaas_subscription_id só se por algum
        // motivo ele não vier no payload.
        const assinaturaId = payment.externalReference;

        const supabase = createClient(supabaseUrl, serviceRoleKey);

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
            await supabase
              .from("assinaturas")
              .update({
                status: "ativa",
                asaas_customer_id: payment.customer,
                asaas_subscription_id: payment.subscription ?? null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", assinatura.id);

            if (assinatura.status !== "ativa") {
              await enviarEmailBoasVindasAsaas({
                apiKey: process.env["ASAAS_API_KEY"],
                customerId: payment.customer,
                plano: assinatura.plano,
              });
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
    if (customer.email) {
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
  const mensagem =
    tipo === "vencendo"
      ? `Olá, ${primeiroNome}! A cobrança do seu plano Safralume (${valor}) vence em ${vencimento}. Fatura: ${payment.invoiceUrl}`
      : `Olá, ${primeiroNome}. A cobrança do seu plano Safralume (${valor}, venceu em ${vencimento}) ainda não foi paga. Regularize pra não perder o acesso: ${payment.invoiceUrl}`;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-safralume-token": token },
    body: JSON.stringify({ telefone: `55${whatsapp}`, mensagem }),
  });
}
