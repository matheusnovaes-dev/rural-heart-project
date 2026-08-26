import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

import { enviarEmailBoasVindas } from "@/lib/email";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const stripeSecretKey = process.env["STRIPE_SECRET_KEY"];
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
        const supabaseUrl = process.env["SB_URL"];
        const serviceRoleKey = process.env["SB_SERVICE_ROLE_KEY"];

        if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
          return new Response("Missing server configuration", { status: 500 });
        }

        const stripe = new Stripe(stripeSecretKey, {
          httpClient: Stripe.createFetchHttpClient(),
        });

        const payload = await request.text();
        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return new Response("Missing stripe-signature header", { status: 400 });
        }

        let event: Stripe.Event;
        try {
          // constructEventAsync (não a versão sync) porque isso roda no
          // Cloudflare Workers, que só tem Web Crypto (SubtleCrypto), não o
          // crypto síncrono do Node que a verificação padrão do Stripe usa.
          event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
        } catch (err) {
          return new Response(`Webhook signature inválida: ${(err as Error).message}`, {
            status: 400,
          });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const assinaturaId = session.metadata?.["assinatura_id"];
            if (assinaturaId) {
              await supabase
                .from("assinaturas")
                .update({
                  stripe_customer_id:
                    typeof session.customer === "string" ? session.customer : session.customer?.id,
                  stripe_subscription_id:
                    typeof session.subscription === "string"
                      ? session.subscription
                      : session.subscription?.id,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", assinaturaId);

              const email = session.customer_details?.email;
              const plano = session.metadata?.["plano"];
              if (email && plano) {
                await enviarEmailBoasVindas({
                  to: email,
                  nome: session.customer_details?.name?.split(" ")[0] || "produtor",
                  plano,
                });
              }
            }
            break;
          }

          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            await supabase
              .from("assinaturas")
              .update({
                status: mapStripeStatus(subscription.status),
                updated_at: new Date().toISOString(),
              })
              .eq("stripe_subscription_id", subscription.id);
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            await supabase
              .from("assinaturas")
              .update({ status: "cancelada", updated_at: new Date().toISOString() })
              .eq("stripe_subscription_id", subscription.id);
            break;
          }

          default:
            break;
        }

        return new Response(null, { status: 200 });
      },
    },
  },
});

function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): "trial" | "ativa" | "inadimplente" | "cancelada" {
  switch (stripeStatus) {
    case "trialing":
      return "trial";
    case "active":
      return "ativa";
    case "past_due":
    case "unpaid":
      return "inadimplente";
    case "canceled":
    case "incomplete_expired":
      return "cancelada";
    default:
      return "inadimplente";
  }
}
