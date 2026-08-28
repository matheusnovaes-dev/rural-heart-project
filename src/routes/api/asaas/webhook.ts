import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { enviarEmailBoasVindas } from "@/lib/email";

type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string;
  externalReference?: string;
  status: string;
};

type AsaasWebhookBody = {
  event: string;
  payment?: AsaasPayment;
};

const EVENTOS_ATIVACAO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const EVENTOS_INADIMPLENCIA = new Set(["PAYMENT_OVERDUE"]);
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

        if (EVENTOS_ATIVACAO.has(body.event)) {
          const query = supabase.from("assinaturas").select("id, status, plano");
          const { data: assinatura } = await (
            assinaturaId
              ? query.eq("id", assinaturaId)
              : query.eq("asaas_subscription_id", payment.subscription ?? "")
          ).maybeSingle();

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
          const query = supabase.from("assinaturas").update({
            status: "inadimplente",
            updated_at: new Date().toISOString(),
          });
          if (assinaturaId) {
            await query.eq("id", assinaturaId);
          } else if (payment.subscription) {
            await query.eq("asaas_subscription_id", payment.subscription);
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
