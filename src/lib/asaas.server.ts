import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { pricingPlans } from "@/config/site";

const ASAAS_API_BASE = "https://api.asaas.com/v3";

function headers(apiKey: string) {
  return {
    "Content-Type": "application/json",
    access_token: apiKey,
  };
}

async function asaasFetch(apiKey: string, path: string, init?: RequestInit) {
  const res = await fetch(`${ASAAS_API_BASE}${path}`, {
    ...init,
    headers: { ...headers(apiKey), ...(init?.headers ?? {}) },
  });
  const json: unknown = await res.json();
  if (!res.ok) {
    const erros = (json as { errors?: { description?: string }[] })?.errors;
    throw new Error(erros?.[0]?.description ?? `Asaas retornou ${res.status}.`);
  }
  return json;
}

/** Uma semana a partir de hoje, no formato yyyy-mm-dd que a Asaas espera. */
function proximoVencimento(diasDeTrial: number) {
  const data = new Date();
  data.setDate(data.getDate() + diasDeTrial);
  return data.toISOString().slice(0, 10);
}

const criarAssinaturaSchema = z.object({
  plano: z.enum(["bronze", "prata", "ouro"]),
  assinaturaId: z.string().uuid(),
  nome: z.string().min(1),
  cpfCnpj: z.string().min(11),
  email: z.string().email().optional(),
  whatsapp: z.string().optional(),
});

/**
 * Cria (ou reaproveita) o cliente na Asaas e a assinatura recorrente,
 * com trial de 7 dias (primeira cobrança só vence depois disso).
 * billingType "UNDEFINED" deixa o produtor escolher Pix, cartão ou boleto
 * na página da fatura — se escolher cartão, os ciclos seguintes debitam
 * sozinhos; Pix/boleto geram uma cobrança nova a cada ciclo.
 */
export const criarAssinaturaAsaas = createServerFn({ method: "POST" })
  .validator(criarAssinaturaSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env["ASAAS_API_KEY"];
    if (!apiKey) {
      throw new Error("ASAAS_API_KEY não configurada.");
    }

    const plano = pricingPlans.find((p) => p.id === data.plano);
    if (!plano) {
      throw new Error(`Plano "${data.plano}" não encontrado.`);
    }

    const cpfCnpjLimpo = data.cpfCnpj.replace(/\D/g, "");

    const customer = (await asaasFetch(apiKey, "/customers", {
      method: "POST",
      body: JSON.stringify({
        name: data.nome,
        cpfCnpj: cpfCnpjLimpo,
        email: data.email,
        mobilePhone: data.whatsapp ? data.whatsapp.replace(/\D/g, "") : undefined,
        externalReference: data.assinaturaId,
      }),
    })) as { id: string };

    const appUrl = process.env["APP_URL"] ?? "https://www.safralume.com.br";

    const subscription = (await asaasFetch(apiKey, "/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: "UNDEFINED",
        value: plano.price,
        nextDueDate: proximoVencimento(7),
        cycle: "MONTHLY",
        description: `Safralume - Plano ${plano.name}`,
        externalReference: data.assinaturaId,
        callback: { successUrl: `${appUrl}/dashboard?checkout=success` },
      }),
    })) as { id: string };

    const payments = (await asaasFetch(
      apiKey,
      `/payments?subscription=${subscription.id}&limit=1`,
    )) as { data?: { invoiceUrl?: string }[] };

    const invoiceUrl = payments.data?.[0]?.invoiceUrl;
    if (!invoiceUrl) {
      throw new Error("Asaas não retornou um link de pagamento.");
    }

    return {
      url: invoiceUrl,
      asaasCustomerId: customer.id,
      asaasSubscriptionId: subscription.id,
    };
  });

const atualizarPlanoSchema = z.object({
  asaasSubscriptionId: z.string().min(1),
  novoPlano: z.enum(["bronze", "prata", "ouro"]),
});

/**
 * Muda o valor da assinatura existente na Asaas pro novo plano. Não pede
 * cartão de novo: se o pagamento é por cartão salvo, o próximo ciclo já
 * cobra o novo valor; se é Pix/boleto, a próxima cobrança gerada vem com
 * o valor novo.
 */
export const atualizarPlanoAsaas = createServerFn({ method: "POST" })
  .validator(atualizarPlanoSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env["ASAAS_API_KEY"];
    if (!apiKey) {
      throw new Error("ASAAS_API_KEY não configurada.");
    }

    const plano = pricingPlans.find((p) => p.id === data.novoPlano);
    if (!plano) {
      throw new Error(`Plano "${data.novoPlano}" não encontrado.`);
    }

    await asaasFetch(apiKey, `/subscriptions/${data.asaasSubscriptionId}`, {
      method: "PUT",
      body: JSON.stringify({ value: plano.price }),
    });

    return { ok: true as const };
  });
