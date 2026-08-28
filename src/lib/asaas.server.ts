import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import { pricingPlans } from "@/config/site";

function supabaseServiceRole() {
  const supabaseUrl = process.env["SB_URL"];
  const serviceRoleKey = process.env["SB_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SB_URL/SB_SERVICE_ROLE_KEY não configuradas.");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

const ASAAS_API_BASE = "https://api.asaas.com/v3";

function headers(apiKey: string) {
  return {
    "Content-Type": "application/json",
    access_token: apiKey,
    // A Asaas rejeita requisições sem User-Agent — o fetch do Cloudflare
    // Workers não manda um por padrão como um navegador manda.
    "User-Agent": "Safralume/1.0",
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

    // Grava os IDs direto aqui (com a service role) porque o cliente não
    // tem permissão de UPDATE em `assinaturas` via RLS — só o webhook (que
    // também roda com service role) deveria poder mexer nesses campos.
    await supabaseServiceRole()
      .from("assinaturas")
      .update({ asaas_customer_id: customer.id, asaas_subscription_id: subscription.id })
      .eq("id", data.assinaturaId);

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

    // Atualiza o plano local na hora — não dá pra esperar o próximo evento
    // de pagamento do webhook pra liberar o recurso que o produtor acabou
    // de pagar pra desbloquear (Pix/boleto só gera cobrança nova no
    // próximo ciclo, que pode ser semanas depois).
    await supabaseServiceRole()
      .from("assinaturas")
      .update({ plano: data.novoPlano })
      .eq("asaas_subscription_id", data.asaasSubscriptionId);

    return { ok: true as const };
  });

const listarCobrancasSchema = z.object({
  asaasSubscriptionId: z.string().min(1),
});

export type Cobranca = {
  id: string;
  value: number;
  status: string;
  dueDate: string;
  paymentDate: string | null;
  billingType: string;
  invoiceUrl: string;
};

/**
 * Histórico de cobranças da assinatura, pra tela "Minha assinatura".
 * O asaasSubscriptionId precisa vir de uma leitura que já passou pelo RLS
 * (a própria página busca a assinatura do usuário logado antes de chamar
 * isso) — essa function em si não reconfirma dono, só repassa pra Asaas.
 */
export const listarCobrancas = createServerFn({ method: "GET" })
  .validator(listarCobrancasSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env["ASAAS_API_KEY"];
    if (!apiKey) {
      throw new Error("ASAAS_API_KEY não configurada.");
    }

    const payments = (await asaasFetch(
      apiKey,
      `/payments?subscription=${data.asaasSubscriptionId}&limit=20&order=desc`,
    )) as { data?: Cobranca[] };

    return { cobrancas: payments.data ?? [] };
  });
