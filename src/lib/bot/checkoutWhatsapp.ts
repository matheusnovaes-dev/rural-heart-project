import type { SupabaseClient } from "@supabase/supabase-js";

import { pricingPlans } from "@/config/site";
import { buscarFaturaParaPagar } from "@/lib/bot/faturaPendente";
import { classificarPedidoDeAssinatura } from "@/lib/bot/guardas";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import { documentoValido, soDigitos } from "@/lib/documentos";
import {
  cifrarDocumento,
  decifrarDocumento,
  DocumentoIlegivelError,
} from "@/lib/documentoSeguro.server";

/**
 * Assinar pelo próprio WhatsApp (pedido do Matheus, 23/10: "quero pagantes"). Antes: "quero assinar" levava a login + CPF +
 * e-mail + página externa da Asaas (a tela de assinatura teve 7 visitas em 8 dias; só 4 de 108 contas criaram cobrança e 3
 * não pagaram a primeira fatura). Agora o bot conduz por código, uma pergunta por vez: plano, CPF/CNPJ (só se ainda não tiver
 * no cadastro), nome completo (só se o cadastro tiver nome genérico), cria cliente e assinatura na Asaas do mesmo jeito que o
 * site (externalReference = id da nossa assinatura, então o webhook ativa a conta sozinho) e devolve o link do Pix.
 * O passo é lido pelos marcadores nas próprias mensagens do bot (mesmo padrão do cadastro).
 */

/** Documento escrito pela pessoa: o primeiro trecho de 11 ou 14 dígitos que seja CPF/CNPJ válido. */
export function lerDocumento(texto: string): { numero: string; valido: boolean } | null {
  const candidatos = texto.match(/\d[\d.\-/\s]{8,20}\d/g) ?? [];
  let ultimo: string | null = null;
  for (const c of candidatos) {
    const d = soDigitos(c);
    if (d.length !== 11 && d.length !== 14) continue;
    ultimo = d;
    if (documentoValido(d)) return { numero: d, valido: true };
  }
  return ultimo ? { numero: ultimo, valido: false } : null;
}

// ---------- plano ----------

export type PlanoId = "bronze" | "prata" | "ouro";
const ORDEM: PlanoId[] = ["bronze", "prata", "ouro"];
const nomeDoPlano = (id: PlanoId) => pricingPlans.find((p) => p.id === id)!.name;
const precoDoPlano = (id: PlanoId) => pricingPlans.find((p) => p.id === id)!.price;
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function lerPlano(texto: string): PlanoId | null {
  const t = semAcento(texto).trim();
  const m = t.match(/^(?:opcao\s*)?([1-3])[\s.!)]*$/);
  if (m) return ORDEM[Number(m[1]) - 1]!;
  if (/\bbronze\b/.test(t)) return "bronze";
  if (/\bprata\b/.test(t)) return "prata";
  if (/\bouro\b/.test(t)) return "ouro";
  return null;
}

// ---------- mensagens (com os marcadores que identificam o passo) ----------

export const MARC_PLANO = "Qual plano você quer";
export const MARC_DOCUMENTO = "seu CPF ou CNPJ";

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

export function perguntaDePlano(): string {
  return `Que bom! ${MARC_PLANO}? Responda só com o número:\n1 Bronze, ${brl(precoDoPlano("bronze"))}/mês: preço, alertas, clima e caderno da fazenda\n2 Prata, ${brl(precoDoPlano("prata"))}/mês: o Bronze mais leilões, estoque e até 3 funcionários\n3 Ouro, ${brl(precoDoPlano("ouro"))}/mês: o Prata mais outras culturas e estados e suporte prioritário\n\nPaga no Pix, cartão ou boleto.`;
}

export function perguntaDeDocumento(plano: PlanoId): string {
  return `Perfeito, plano ${nomeDoPlano(plano)}! Pra emitir a cobrança (Pix, cartão ou boleto), o sistema de pagamento precisa do ${MARC_DOCUMENTO}. Pode me mandar só os números?`;
}

const REPERGUNTA_DOCUMENTO = (plano: PlanoId) =>
  `Não consegui validar esse número 😅 Confira e me mande o ${MARC_DOCUMENTO} de novo, só os números (plano ${nomeDoPlano(plano)}).`;

const SAIDA_EDUCADA = "Tudo bem! Quando quiser assinar, é só me dizer *quero assinar* 🌱";

const DESISTENCIA =
  /^\s*(nao|n|deixa|deixa pra la|depois|agora nao|cancela\w*|desisti\w*|esquece|nao quero)\b/;

type Passo = "plano" | "documento" | null;

export function passoDoCheckout(botDesc: string[]): {
  passo: Passo;
  plano: PlanoId | null;
  falhas: number;
  repergunta: boolean;
} {
  const ultima = botDesc[0] ?? "";
  const planoMsg = ultima.match(/plano (Bronze|Prata|Ouro)/i)?.[1]?.toLowerCase() as
    PlanoId | undefined;
  let falhas = 0;
  for (const m of botDesc.slice(0, 6)) {
    if (m.includes("Não consegui validar esse número")) falhas++;
    else break;
  }
  const repergunta = ultima.includes("Pra eu seguir");
  if (ultima.includes(MARC_PLANO)) return { passo: "plano", plano: null, falhas, repergunta };
  if (ultima.includes(MARC_DOCUMENTO))
    return { passo: "documento", plano: planoMsg ?? null, falhas, repergunta };
  return { passo: null, plano: null, falhas, repergunta };
}

/** Nome para a cobrança: o do cadastro; se for genérico ("Produtor"), um nome neutro (a cobrança é identificada pelo documento). */
const nomeParaCobranca = (nome: string | null | undefined) =>
  !nome || /^(produtor|produtora|ocupado|triste|usuario)$/i.test(nome.trim())
    ? "Produtor Safralume"
    : nome.trim();

// ---------- Asaas ----------

const ASAAS = "https://api.asaas.com/v3";

async function asaas(apiKey: string, path: string, init?: RequestInit) {
  const res = await fetch(`${ASAAS}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      "User-Agent": "Safralume/1.0",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    const erro = (json as { errors?: { description?: string }[] })?.errors?.[0]?.description;
    throw new Error(erro ?? `Asaas retornou ${res.status}.`);
  }
  return json;
}

const diaDeSaoPaulo = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Vencimento da 1ª cobrança: no fim do teste (se ainda estiver valendo), senão hoje. */
export function primeiroVencimento(trialExpiraEm: string | null, agora = new Date()): string {
  if (trialExpiraEm && new Date(trialExpiraEm).getTime() > agora.getTime()) {
    const dia = diaDeSaoPaulo(new Date(trialExpiraEm));
    return dia >= diaDeSaoPaulo(agora) ? dia : diaDeSaoPaulo(agora);
  }
  return diaDeSaoPaulo(agora);
}

type Resultado =
  { tipo: "responder"; resposta: string; precisa_humano: boolean } | { tipo: "erro_documento" };

async function criarAssinatura(
  supabase: SupabaseClient,
  p: {
    assinaturaId: string;
    produtorId: string;
    plano: PlanoId;
    nome: string;
    documento: string;
    whatsapp: string;
    customerIdExistente: string | null;
    trialExpiraEm: string | null;
  },
): Promise<Resultado> {
  const apiKey = process.env["ASAAS_API_KEY"];
  if (!apiKey) throw new Error("ASAAS_API_KEY ausente");
  try {
    const customerId =
      p.customerIdExistente ??
      (
        (await asaas(apiKey, "/customers", {
          method: "POST",
          body: JSON.stringify({
            name: p.nome,
            cpfCnpj: p.documento,
            mobilePhone: /^[1-9][1-9]\d{8,9}$/.test(p.whatsapp) ? p.whatsapp : undefined,
            externalReference: p.assinaturaId,
          }),
        })) as { id: string }
      ).id;
    const vencimento = primeiroVencimento(p.trialExpiraEm);
    const appUrl = process.env["APP_URL"] ?? "https://www.safralume.com.br";
    const sub = (await asaas(apiKey, "/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value: precoDoPlano(p.plano),
        nextDueDate: vencimento,
        cycle: "MONTHLY",
        description: `Safralume - Plano ${nomeDoPlano(p.plano)}`,
        externalReference: p.assinaturaId,
        callback: { successUrl: `${appUrl}/dashboard?checkout=success` },
      }),
    })) as { id: string };
    const pg = (await asaas(apiKey, `/payments?subscription=${sub.id}&limit=1`)) as {
      data?: { invoiceUrl?: string }[];
    };
    const url = pg.data?.[0]?.invoiceUrl;
    if (!url) throw new Error("Asaas não retornou o link de pagamento.");
    await supabase
      .from("assinaturas")
      .update({ asaas_customer_id: customerId, asaas_subscription_id: sub.id, plano: p.plano })
      .eq("id", p.assinaturaId);
    // O documento fica cifrado no banco (ver lib/documentoSeguro.server.ts); sem chave configurada continua em texto.
    await supabase
      .from("produtores")
      .update({ cpf_cnpj: await cifrarDocumento(p.documento) })
      .eq("id", p.produtorId);
    const noTeste = vencimento !== diaDeSaoPaulo(new Date());
    const quando = `${vencimento.slice(8, 10)}/${vencimento.slice(5, 7)}`;
    const aviso = noTeste
      ? `Seu teste grátis continua valendo e a primeira cobrança só vence em ${quando}. Se quiser já garantir, é só pagar agora:`
      : "Aqui está o link pra pagar:";
    return {
      tipo: "responder",
      precisa_humano: false,
      resposta: `Pronto! Criei a sua assinatura do plano ${nomeDoPlano(p.plano)}, ${brl(precoDoPlano(p.plano))} por mês. 🌱\n\n${aviso}\n${url}\n\nÉ só abrir e escolher Pix, cartão ou boleto. Na página de pagamento vai aparecer o nome *Matheus Novaes de Moura*, o responsável pelo Safralume (www.safralume.com.br): é normal, pode pagar tranquilo 🔒\n\nAssim que o pagamento for confirmado, eu te aviso por aqui.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/cpf|cnpj/i.test(msg)) return { tipo: "erro_documento" };
    throw err;
  }
}

// ---------- fluxo ----------

const FALHA_GERAL =
  "Não consegui criar a cobrança agora. Já avisei a nossa equipe, que vai te mandar o link por aqui, ou você pode assinar em https://safralume.com.br/assinar 🌱";

/**
 * Conduz a assinatura pelo WhatsApp. Devolve null quando a mensagem não é do fluxo (sem pedido de assinar e sem passo aberto),
 * e quando a conta não cabe nele (já ativa com plano pago ou cancelada: segue o caminho antigo).
 */
export async function responderCheckoutWhatsapp(
  supabase: SupabaseClient,
  params: { produtorId: string; texto: string; historico: HistoricoLinha[] },
): Promise<{ resposta: string; precisa_humano: boolean } | null> {
  const { produtorId, texto, historico } = params;
  const botDesc = [...historico]
    .filter((h) => h.role === "assistant")
    .sort((a, b) => b.ordem - a.ordem)
    .map((h) => h.conteudo);
  const { passo, plano: planoDoPasso, falhas, repergunta } = passoDoCheckout(botDesc);
  const querAssinar = classificarPedidoDeAssinatura(texto);
  if (!passo && !querAssinar) return null;
  // "quero assinar" no meio de um passo aberto de outro assunto não é daqui; mas dentro de um passo, a resposta é.
  if (passo && DESISTENCIA.test(semAcento(texto)) && !querAssinar) {
    return { resposta: SAIDA_EDUCADA, precisa_humano: false };
  }

  const [{ data: assinatura }, { data: produtor }] = await Promise.all([
    supabase
      .from("assinaturas")
      .select("id, status, plano, asaas_customer_id, asaas_subscription_id, trial_expira_em")
      .eq("produtor_id", produtorId)
      .maybeSingle(),
    supabase
      .from("produtores")
      .select("nome, whatsapp, cpf_cnpj")
      .eq("id", produtorId)
      .maybeSingle(),
  ]);
  if (!assinatura || !produtor) return null;
  // Já existe cobrança (o link dela é entregue por outro caminho) ou o caso não é deste fluxo.
  if (assinatura.asaas_subscription_id && assinatura.status !== "cancelada") return null;
  // Cancelou antes e quer voltar: cria uma assinatura nova. Se a antiga ainda tiver fatura em aberto, o link dela é entregue
  // pelo outro caminho (evita cobrança duplicada).
  if (assinatura.status === "cancelada" && assinatura.asaas_subscription_id) {
    if (await buscarFaturaParaPagar(supabase, produtorId)) return null;
  }
  if (assinatura.status === "ativa") {
    return {
      resposta: "Você já tem um plano ativo, tudo certo por aqui! 🌱",
      precisa_humano: false,
    };
  }

  // Início: pediu para assinar sem passo aberto.
  if (!passo) {
    const plano = lerPlano(texto);
    if (!plano) return { resposta: perguntaDePlano(), precisa_humano: false };
    return avancar(supabase, {
      assinatura,
      produtor,
      produtorId,
      plano,
      texto: "",
      passo: "plano",
      falhas: 0,
    });
  }

  if (passo === "plano") {
    const plano = lerPlano(texto);
    if (!plano && repergunta) return { resposta: SAIDA_EDUCADA, precisa_humano: false };
    if (!plano) {
      return {
        resposta: `Pra eu seguir, me responda só com o número do plano: 1 Bronze (${brl(precoDoPlano("bronze"))}), 2 Prata (${brl(precoDoPlano("prata"))}) ou 3 Ouro (${brl(precoDoPlano("ouro"))}). ${MARC_PLANO}?`,
        precisa_humano: false,
      };
    }
    return avancar(supabase, {
      assinatura,
      produtor,
      produtorId,
      plano,
      texto: "",
      passo: "plano",
      falhas: 0,
    });
  }

  const plano = planoDoPasso ?? lerPlano(texto) ?? "bronze";
  return avancar(supabase, { assinatura, produtor, produtorId, plano, texto, passo, falhas });
}

type Contexto = {
  assinatura: {
    id: string;
    plano: string | null;
    asaas_customer_id: string | null;
    trial_expira_em: string | null;
  };
  produtor: { nome: string | null; whatsapp: string | null; cpf_cnpj: string | null };
  produtorId: string;
  plano: PlanoId;
  texto: string;
  passo: Passo;
  falhas: number;
};

async function avancar(
  supabase: SupabaseClient,
  c: Contexto,
): Promise<{ resposta: string; precisa_humano: boolean }> {
  // Documento já salvo (cifrado ou, nos cadastros antigos, em texto). Se não der para ler, pede de novo à pessoa em vez de travar.
  let guardado: string | null = null;
  try {
    guardado = await decifrarDocumento(c.produtor.cpf_cnpj);
  } catch (e) {
    if (!(e instanceof DocumentoIlegivelError)) throw e;
  }
  let documento = guardado && documentoValido(guardado) ? soDigitos(guardado) : null;

  if (c.passo === "documento") {
    const lido = lerDocumento(c.texto);
    if (!lido && c.falhas >= 1) return { resposta: SAIDA_EDUCADA, precisa_humano: false };
    if (!lido?.valido) {
      if (c.falhas >= 1) {
        return {
          resposta:
            "Não consegui validar o documento por aqui. Já avisei a nossa equipe e alguém te ajuda a assinar, ou você pode assinar em https://safralume.com.br/assinar 🌱",
          precisa_humano: true,
        };
      }
      return { resposta: REPERGUNTA_DOCUMENTO(c.plano), precisa_humano: false };
    }
    documento = lido.numero;
  }

  if (!documento) return { resposta: perguntaDeDocumento(c.plano), precisa_humano: false };
  const nome = nomeParaCobranca(c.produtor.nome);

  try {
    const r = await criarAssinatura(supabase, {
      assinaturaId: c.assinatura.id,
      produtorId: c.produtorId,
      plano: c.plano,
      nome,
      documento,
      whatsapp: soDigitos(c.produtor.whatsapp ?? "").replace(/^55/, ""),
      customerIdExistente: c.assinatura.asaas_customer_id,
      trialExpiraEm: c.assinatura.trial_expira_em,
    });
    if (r.tipo === "erro_documento")
      return { resposta: REPERGUNTA_DOCUMENTO(c.plano), precisa_humano: false };
    return r;
  } catch (err) {
    console.error("Erro ao criar assinatura pelo WhatsApp:", err);
    return { resposta: FALHA_GERAL, precisa_humano: true };
  }
}
