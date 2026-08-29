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

/**
 * As funções abaixo recebem `assinaturaId`/`asaasSubscriptionId` do próprio
 * cliente — sem confirmar de quem é o token, qualquer um poderia chamar o
 * server function direto (fora da UI) com o id de OUTRA pessoa e mudar o
 * plano dela ou ler o histórico de cobrança dela. `getUser` valida a
 * assinatura do JWT independente da key usada pra criar o client.
 */
async function usuarioAutenticado(accessToken: string) {
  const { data, error } = await supabaseServiceRole().auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Sessão inválida ou expirada. Atualize a página e tente de novo.");
  }
  return data.user.id;
}

/** Confirma que o usuário logado é dono (direto, ou via cooperativa) da assinatura em questão. */
async function confirmarDonoDaAssinatura(
  userId: string,
  filtro: { assinaturaId: string } | { asaasSubscriptionId: string },
) {
  const supabase = supabaseServiceRole();
  const query = supabase.from("assinaturas").select("id, produtor_id, cooperativa_id");
  const { data: assinatura } = await (
    "assinaturaId" in filtro
      ? query.eq("id", filtro.assinaturaId)
      : query.eq("asaas_subscription_id", filtro.asaasSubscriptionId)
  ).maybeSingle();
  if (!assinatura) throw new Error("Assinatura não encontrada.");

  if (assinatura.produtor_id) {
    const { data: produtor } = await supabase
      .from("produtores")
      .select("user_id")
      .eq("id", assinatura.produtor_id)
      .maybeSingle();
    if (produtor?.user_id === userId) return assinatura;
  }
  if (assinatura.cooperativa_id) {
    const { data: membro } = await supabase
      .from("cooperativa_membros")
      .select("user_id")
      .eq("cooperativa_id", assinatura.cooperativa_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (membro) return assinatura;
  }
  throw new Error("Você não tem permissão para acessar essa assinatura.");
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
  accessToken: z.string().min(1),
  plano: z.enum(["bronze", "prata", "ouro"]),
  assinaturaId: z.string().uuid(),
  nome: z.string().min(1),
  cpfCnpj: z.string().min(11),
  email: z.string().email().optional(),
  whatsapp: z.string().optional(),
  // true = quem veio do fluxo "prefere assinar direto" (sem passar pelo
  // formulário de lead) e topou pular o teste grátis — cobrança vence hoje
  // em vez de em 7 dias.
  semTrial: z.boolean().optional(),
});

/**
 * Cria (ou reaproveita) o cliente na Asaas e a assinatura recorrente,
 * com trial de 7 dias por padrão (primeira cobrança só vence depois disso) —
 * ou cobrança imediata se `semTrial` for true.
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

    const userId = await usuarioAutenticado(data.accessToken);
    await confirmarDonoDaAssinatura(userId, { assinaturaId: data.assinaturaId });

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
        nextDueDate: proximoVencimento(data.semTrial ? 0 : 7),
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
  accessToken: z.string().min(1),
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

    const userId = await usuarioAutenticado(data.accessToken);
    await confirmarDonoDaAssinatura(userId, { asaasSubscriptionId: data.asaasSubscriptionId });

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
  accessToken: z.string().min(1),
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

/** Histórico de cobranças da assinatura, pra tela "Minha assinatura". */
export const listarCobrancas = createServerFn({ method: "GET" })
  .validator(listarCobrancasSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env["ASAAS_API_KEY"];
    if (!apiKey) {
      throw new Error("ASAAS_API_KEY não configurada.");
    }

    const userId = await usuarioAutenticado(data.accessToken);
    await confirmarDonoDaAssinatura(userId, { asaasSubscriptionId: data.asaasSubscriptionId });

    const payments = (await asaasFetch(
      apiKey,
      `/payments?subscription=${data.asaasSubscriptionId}&limit=20&order=desc`,
    )) as { data?: Cobranca[] };

    return { cobrancas: payments.data ?? [] };
  });
