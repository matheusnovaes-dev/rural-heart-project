import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";

const criarSessaoCheckoutSchema = z.object({
  plano: z.enum(["bronze", "prata", "ouro"]),
  assinaturaId: z.string().uuid(),
});

export const criarSessaoCheckout = createServerFn({ method: "POST" })
  .validator(criarSessaoCheckoutSchema)
  .handler(async ({ data }) => {
    const stripeSecretKey = process.env["STRIPE_SECRET_KEY"];
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada.");
    }

    const priceIds: Record<typeof data.plano, string | undefined> = {
      bronze: process.env["STRIPE_PRICE_BRONZE"],
      prata: process.env["STRIPE_PRICE_PRATA"],
      ouro: process.env["STRIPE_PRICE_OURO"],
    };
    const priceId = priceIds[data.plano];
    if (!priceId) {
      throw new Error(`Price ID do plano "${data.plano}" não configurado.`);
    }

    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const appUrl = process.env["APP_URL"] ?? "https://www.safralume.com.br";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/dashboard?checkout=cancelado`,
      client_reference_id: data.assinaturaId,
      metadata: { assinatura_id: data.assinaturaId, plano: data.plano },
    });

    if (!session.url) {
      throw new Error("Stripe não retornou uma URL de checkout.");
    }

    return { url: session.url };
  });
