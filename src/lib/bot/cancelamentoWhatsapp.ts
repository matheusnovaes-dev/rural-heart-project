import type { SupabaseClient } from "@supabase/supabase-js";

import { MOTIVOS_CANCELAMENTO, executarCancelamento, executarPausa } from "@/lib/asaas.server";
import { pricingPlans } from "@/config/site";
import type { HistoricoLinha } from "@/lib/bot/prompt";

/**
 * Cancelar e pausar a assinatura pelo próprio WhatsApp (23/10). Quem assina pelo WhatsApp não tem login no painel: para
 * cancelar teria de pedir o link de acesso e criar e-mail e senha. Aqui o bot conduz por código, com o MESMO efeito do painel
 * (executarCancelamento e executarPausa, em asaas.server.ts): pergunta o motivo (que também vira dado de produto), oferece a
 * pausa de 30/60 dias a quem "usa pouco", pede confirmação clara e só então cancela. O passo é lido pelos marcadores das
 * mensagens do bot (mesmo padrão do cadastro e do checkout); o motivo é recuperado da resposta da própria pessoa no histórico.
 */

type Motivo = (typeof MOTIVOS_CANCELAMENTO)[number];

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------- detectar o pedido ----------

const OUTRO_ASSUNTO =
  /\b(alerta|alertas|lembrete|lembretes|resumo|aviso|avisos|lancamento|registro|pedido|compra|venda|proposta|leilao|leiloes|reuniao)\b/;

export function ehPedidoDeCancelarAssinatura(texto: string): boolean {
  const t = semAcento(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > 90 || OUTRO_ASSUNTO.test(t)) return false;
  // "posso cancelar?" / "dá pra cancelar?" é pergunta de condições (outra resposta), não pedido.
  if (/^(posso|da pra|da para|consigo|tem como|e possivel)\b.*\bcancel/.test(t)) return false;
  return (
    /\bcancel\w*\b.{0,30}\b(assinatura|plano|cobranca|pagamento|conta|tudo|servico|safralume|mensalidade)\b/.test(
      t,
    ) ||
    /\b(quero|queria|gostaria de|preciso|vou|decidi|resolvi)\b.{0,15}\bcancel\w*/.test(t) ||
    /\bcomo\b.{0,12}\bcancel\w*/.test(t) ||
    /^cancel\w*$/.test(t) ||
    /\b(nao quero mais (pagar|assinar|o plano|a assinatura)|parar de pagar|sair do (plano|safralume)|encerrar (a |minha )?(conta|assinatura))\b/.test(
      t,
    )
  );
}

// ---------- mensagens e marcadores ----------

export const MARC_MOTIVO = "O que fez você querer cancelar";
export const MARC_PAUSA = "Que tal pausar a cobrança";
export const MARC_CONFIRMA = "Tem certeza que quer cancelar";

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function perguntaDeMotivo(): string {
  return `Poxa, que pena! ${MARC_MOTIVO}? Pode responder com o número, é só pra gente melhorar:\n1 Uso pouco\n2 Está caro\n3 Faltou alguma função ou dado\n4 Vou usar outro serviço\n5 Tive problema técnico\n6 Outro motivo\n\nSe mudar de ideia, é só dizer *deixa*.`;
}

export function ofertaDePausa(): string {
  return `${MARC_PAUSA} em vez de cancelar? Você continua com tudo funcionando (preço, alertas, caderno) e só volta a ser cobrado depois. Responda com o número:\n1 Pausar por 30 dias\n2 Pausar por 60 dias\n3 Cancelar mesmo assim`;
}

export function pedidoDeConfirmacao(valor: number | null): string {
  const cobranca = valor ? ` e a cobrança de ${brl(valor)} por mês` : "";
  return `${MARC_CONFIRMA}? O seu acesso${cobranca} terminam agora. Responda *SIM* para cancelar ou *NÃO* para manter a assinatura.`;
}

const SAIDA = "Combinado, não cancelei nada! A sua assinatura segue normal 🌱";

// ---------- leitura das respostas ----------

export function lerMotivo(texto: string): { motivo: Motivo; detalhe: string | null } | null {
  const t = semAcento(texto).trim();
  const num = t.match(/^(?:opcao\s*)?([1-6])[\s.!)]*$/);
  const porNumero: Motivo[] = [
    "nao_uso_o_suficiente",
    "muito_caro",
    "faltou_funcionalidade",
    "vou_usar_outro_servico",
    "problema_tecnico_ou_dados",
    "outro",
  ];
  if (num) return { motivo: porNumero[Number(num[1]) - 1]!, detalhe: null };
  if (t.length < 3) return null;
  const detalhe = texto.trim().slice(0, 300);
  if (/\b(erro|erros|problema|bug|nao funciona|travou|errado|errada)\b/.test(t))
    return { motivo: "problema_tecnico_ou_dados", detalhe };
  if (
    /\b(caro|cara|salgado|apertad\w*|sem dinheiro|nao tenho dinheiro|preco alto|valor alto)\b/.test(
      t,
    )
  )
    return { motivo: "muito_caro", detalhe };
  if (/\b(pouco|nao uso|nao preciso|nao uso o suficiente)\b/.test(t))
    return { motivo: "nao_uso_o_suficiente", detalhe };
  if (/\b(falta|faltou|nao tem|queria que)\b/.test(t))
    return { motivo: "faltou_funcionalidade", detalhe };
  if (/\b(outro servico|outra plataforma|concorrente|outro app)\b/.test(t))
    return { motivo: "vou_usar_outro_servico", detalhe };
  return { motivo: "outro", detalhe };
}

const SIM =
  /^\s*(sim|s|ss|isso|confirmo|pode cancelar|cancela|pode|quero cancelar|confirmado)[\s!.]*$/;
const NAO = /^\s*(nao|n|deixa|deixa pra la|desisti|mantem|manter|nao quero|voltei atras)[\s!.]*$/;

type Passo = "motivo" | "pausa" | "confirma" | null;

function passoAtual(botDesc: string[]): Passo {
  const ultima = botDesc[0] ?? "";
  if (ultima.includes(MARC_CONFIRMA)) return "confirma";
  if (ultima.includes(MARC_PAUSA)) return "pausa";
  if (ultima.includes(MARC_MOTIVO)) return "motivo";
  return null;
}

/** O motivo que a pessoa já deu: a resposta dela logo depois da pergunta de motivo. */
function motivoDoHistorico(
  historicoAsc: HistoricoLinha[],
): { motivo: Motivo; detalhe: string | null } | null {
  for (let i = historicoAsc.length - 1; i >= 0; i--) {
    const h = historicoAsc[i]!;
    if (h.role === "assistant" && h.conteudo.includes(MARC_MOTIVO)) {
      const resposta = historicoAsc.slice(i + 1).find((x) => x.role === "user");
      return resposta ? lerMotivo(resposta.conteudo) : null;
    }
  }
  return null;
}

// ---------- fluxo ----------

type Resposta = { resposta: string; precisa_humano: boolean };

/**
 * Devolve null quando a mensagem não é do fluxo (sem pedido de cancelar e sem passo aberto), para o resto do bot seguir.
 */
export async function responderCancelamentoWhatsapp(
  supabase: SupabaseClient,
  params: { produtorId: string; texto: string; historico: HistoricoLinha[] },
): Promise<Resposta | null> {
  const { produtorId, texto, historico } = params;
  const asc = [...historico].sort((a, b) => a.ordem - b.ordem);
  const botDesc = asc
    .filter((h) => h.role === "assistant")
    .reverse()
    .map((h) => h.conteudo);
  const passo = passoAtual(botDesc);
  const pediu = ehPedidoDeCancelarAssinatura(texto);
  if (!passo && !pediu) return null;

  const { data: a } = await supabase
    .from("assinaturas")
    .select("id, plano, status, asaas_subscription_id, pausa_usada_em")
    .eq("produtor_id", produtorId)
    .maybeSingle();
  if (!a) return null;

  // Início: pediu para cancelar, sem passo aberto.
  if (!passo) {
    if (a.status === "cancelada") {
      return {
        resposta:
          "A sua assinatura já está cancelada. Se quiser voltar, é só dizer *quero assinar* 🌱",
        precisa_humano: false,
      };
    }
    // Teste grátis sem cobrança: não há o que cancelar (e cancelar cortaria o acesso à toa).
    if (a.status === "trial" && !a.asaas_subscription_id) {
      return {
        resposta:
          "Você está no teste grátis e não tem nenhuma cobrança, então não precisa cancelar nada: se não quiser continuar, é só não assinar. Se quiser parar de receber os avisos, me diga *parar avisos* 🌱",
        precisa_humano: false,
      };
    }
    return { resposta: perguntaDeMotivo(), precisa_humano: false };
  }

  // Saída em qualquer passo.
  if (NAO.test(semAcento(texto)) && passo !== "pausa")
    return { resposta: SAIDA, precisa_humano: false };

  if (passo === "motivo") {
    const m = lerMotivo(texto);
    if (!m) return { resposta: perguntaDeMotivo(), precisa_humano: false };
    const podePausar =
      m.motivo === "nao_uso_o_suficiente" &&
      !a.pausa_usada_em &&
      (a.status === "ativa" || a.status === "trial");
    if (podePausar) return { resposta: ofertaDePausa(), precisa_humano: false };
    return {
      resposta: pedidoDeConfirmacao(pricingPlans.find((p) => p.id === a.plano)?.price ?? null),
      precisa_humano: false,
    };
  }

  if (passo === "pausa") {
    const t = semAcento(texto).trim();
    const dias = /^(?:opcao\s*)?1[\s.!)]*$|\b30\b/.test(t)
      ? 30
      : /^(?:opcao\s*)?2[\s.!)]*$|\b60\b/.test(t)
        ? 60
        : null;
    if (dias) {
      try {
        const r = await executarPausa(a.id, dias);
        return {
          resposta: `Pronto! Pausei a cobrança por ${dias} dias: a próxima só vence em ${dataBr(r.ate)}. Você continua com tudo funcionando por aqui, e os avisos de preço e clima seguem normalmente 🌱`,
          precisa_humano: false,
        };
      } catch (err) {
        console.error("Erro ao pausar pelo WhatsApp:", err);
        return {
          resposta:
            "Não consegui pausar agora. Já avisei a nossa equipe, que resolve com você por aqui 🌱",
          precisa_humano: true,
        };
      }
    }
    if (/^(?:opcao\s*)?3[\s.!)]*$/.test(t) || SIM.test(t) || /cancel/.test(t)) {
      return {
        resposta: pedidoDeConfirmacao(pricingPlans.find((p) => p.id === a.plano)?.price ?? null),
        precisa_humano: false,
      };
    }
    if (NAO.test(t)) return { resposta: SAIDA, precisa_humano: false };
    return { resposta: ofertaDePausa(), precisa_humano: false };
  }

  // passo === "confirma"
  if (!SIM.test(semAcento(texto))) {
    // Não é sim nem não: pergunta uma vez; na segunda, não cancela nada.
    if (botDesc.slice(0, 2).filter((m) => m.includes(MARC_CONFIRMA)).length >= 2) {
      return { resposta: SAIDA, precisa_humano: false };
    }
    return {
      resposta: `Só pra eu ter certeza: ${pedidoDeConfirmacao(null)}`,
      precisa_humano: false,
    };
  }
  const m = motivoDoHistorico(asc) ?? { motivo: "outro" as Motivo, detalhe: null };
  try {
    await executarCancelamento({
      assinaturaId: a.id,
      asaasSubscriptionId: a.asaas_subscription_id,
      motivo: m.motivo,
      motivoDetalhe: m.detalhe,
    });
  } catch (err) {
    console.error("Erro ao cancelar pelo WhatsApp:", err);
    return {
      resposta:
        "Não consegui concluir o cancelamento agora. Já avisei a nossa equipe, que cancela pra você por aqui, e você não será cobrado enquanto isso 🌱",
      precisa_humano: true,
    };
  }
  return {
    resposta:
      "Pronto, a sua assinatura foi cancelada e você não será mais cobrado. Obrigado por ter usado o Safralume! Se um dia quiser voltar, é só dizer *quero assinar* 🌱",
    precisa_humano: true,
  };
}
