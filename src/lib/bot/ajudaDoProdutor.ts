import { MARCA_DUVIDA_DE_VALOR } from "@/lib/bot/duvidaDeValor";

/**
 * Ajuda para quem está perdido (achado de 22/10: cafeicultor de PE escreveu "fociona", "emformaçãos", e o bot respondeu
 * com parágrafos genéricos; numa bateria de perguntas de quem está chegando, "não entendi nada" e "me explica de um jeito
 * mais simples" recebiam PREÇO de café e até de leite). Tudo por código, em português simples e curto: um menu numerado
 * (o produtor já aprendeu a responder com número no cadastro), a conta de quanto vale a venda dele, e a oferta de uma
 * pessoa da equipe quando a confusão se repete. Só afirma o que o produto realmente faz e a política já documentada.
 */
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const normalizar = (t: string) =>
  semAcento(t)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Se a frase fala de cultura, preço ou clima, a pessoa está perguntando outra coisa: segue o fluxo normal.
const ASSUNTO_DE_DADO =
  /\b(soja|milho|boi|gado|cafe|trigo|arroz|feijao|algodao|leite|cana|preco|cotacao|clima|chuva|previsao|dolar|diesel|alerta|plano|assin\w*|cancel\w*|pagamento|senha|cadastro|painel|link|caderno)\b/;

const PADROES_DE_CONFUSAO = [
  /\b(continuo|ainda|segue|sigo)\s+(sem\s+entender|nao\s+entend\w+|perdid[oa])\b/,
  /\bsem\s+entender\b/,
  /\bnao\s+(estou|to|ta|tou|esta)\s+entendendo\b/,
  /\bnao\s+consegui\s+(entender|compreender|usar)\b/,
  /\bnao\s+(entendi|entendo|compreendi|sei\s+(usar|como\s+usar|o\s+que\s+(fazer|perguntar|pedir)))\b/,
  /\b(me\s+)?(explica|explique|explicar)\b.{0,25}\b(simples|melhor|de\s+novo|outra\s+vez|facil)\b/,
  /\b(mais\s+simples|de\s+um\s+jeito\s+(mais\s+)?(simples|facil))\b/,
  /^\s*como\s+(eu\s+)?(que\s+)?(uso|usa|usar|faco|funciona)(\s+(isso|aqui|o\s+safralume|essa\s+coisa|isso\s+aqui))?\s*$/,
  /\b(to|estou)\s+perdid[oa]\b/,
  /^\s*(e\s+agora|o\s+que\s+(eu\s+)?faco(\s+agora)?|o\s+que\s+(eu\s+)?posso\s+(fazer|pedir))\s*$/,
];

export function ehConfusao(texto: string): boolean {
  const t = normalizar(texto);
  if (t.split(" ").length > 14) return false;
  if (ASSUNTO_DE_DADO.test(t)) return false;
  return PADROES_DE_CONFUSAO.some((p) => p.test(t));
}

// ---------- condições do teste e do cancelamento ----------

const PADROES_DE_CONDICOES = [
  /\be\s+se\s+(eu\s+)?(nao\s+gostar|nao\s+gosto|nao\s+servir|nao\s+me\s+adaptar|nao\s+quiser|nao\s+quiser\s+continuar|desistir)\b/,
  /\b(posso|da\s+pra|da\s+para|consigo)\s+cancelar\b/,
  /\bvai\s+me\s+cobrar\b|\bvoces\s+vao\s+(me\s+)?cobrar\b|\bja\s+vai\s+cobrar\b|\bcobra\s+(algo|alguma\s+coisa)\s+(agora|no\s+teste)\b/,
  /\bprecisa\s+(de\s+)?(cartao|pagar)\s+(agora|no\s+teste|pra\s+testar|para\s+testar)\b/,
  /\bpreciso\s+(pagar|colocar\s+cartao)\s+(agora|pra\s+testar|para\s+testar)\b/,
  /\bo\s+que\s+acontece\s+(depois|quando\s+acaba|no\s+fim)\b.{0,25}\b(teste|7\s+dias)\b/,
];

export function ehPerguntaDeCondicoes(texto: string): boolean {
  const t = normalizar(texto);
  if (t.split(" ").length > 20) return false;
  if (/\b(alerta|alertas|lembrete|resumo|aviso|avisos|pedido|lancamento)\b/.test(t)) return false;
  return PADROES_DE_CONDICOES.some((p) => p.test(t));
}

/** Só fatos documentados: teste de 7 dias sem cartão, cancelamento self-service, pausa. Não cita multa nem fidelidade. */
export function respostaDeCondicoes(semCadastro = false): string {
  const fecho = semCadastro
    ? "Quer começar? Responda *quero testar* que eu crio seu teste agora, em 1 minuto 🌱"
    : "Enquanto isso, aproveite o teste: me manda o que você quer ver 🌱";
  return `Sem risco nenhum 🙂 O teste de 7 dias é grátis e não pede cartão: se você não gostar, é só não assinar, que nada é cobrado.\n\nSe um dia assinar e quiser sair, dá pra cancelar quando quiser, direto em https://safralume.com.br/dashboard/assinatura (se você ainda não tem login, é só me pedir o link de acesso que eu mando). E se achar que usa pouco, dá pra pausar a cobrança em vez de cancelar.\n\n${fecho}`;
}

// ---------- menu de ajuda ----------

export const MARCA_MENU_AJUDA = "Escolha o que quer ver agora";

export function respostaMenuDeAjuda(cultura: string | null): string {
  const doCultura = cultura ? `o preço do ${cultura} hoje` : "o preço da sua cultura hoje";
  return `Sem problema, vou explicar fácil 🙂 O Safralume é um ajudante do mercado no seu WhatsApp: mostra preço, avisa quando mexe e ajuda a vender melhor.\n\n${MARCA_MENU_AJUDA}, respondendo só com o número:\n1 Ver ${doCultura}\n2 Saber se a proposta de um comprador é boa\n3 Ver quanto vale a minha colheita\n4 Ser avisado quando o preço subir\n5 Falar com uma pessoa da equipe`;
}

/** Pergunta de quantidade: leva a marca da dúvida de valor, então a resposta numérica cai na conta por código. */
export function perguntaDeQuantidade(cultura: string | null): string {
  const de = cultura ? ` de ${cultura}` : "";
  return `Vamos ver quanto vale a sua colheita 🙂 ${MARCA_DUVIDA_DE_VALOR}, e pra saber a hora certa a gente começa pelo tamanho do que você tem: quantas sacas (ou arrobas)${de} você pretende vender? Pode escrever só o número.`;
}

export const RESPOSTA_PROPOSTA =
  'Me manda a foto ou o PDF da proposta que o comprador te fez, ou escreve o valor que ofereceram (por exemplo: "ofereceram R$ 1.600 a saca"). Eu comparo com o preço do mercado e te digo se está bom 🙂';

export type RespostaAoMenu =
  { tipo: "reescrever"; texto: string } | { tipo: "responder"; resposta: string };

/** O produtor respondeu o menu com 1 a 5? Devolve o que fazer, ou null se não era resposta ao menu. */
export function respostaAoMenu(
  texto: string,
  ultimaDoBot: string | undefined,
  cultura: string | null,
): RespostaAoMenu | null {
  if (!ultimaDoBot || !ultimaDoBot.includes(MARCA_MENU_AJUDA)) return null;
  const m = texto.trim().match(/^\s*(?:op[cç][aã]o\s*)?([1-5])[\s.!)]*$/i);
  if (!m) return null;
  const n = m[1]!;
  const dele = cultura ?? "minha cultura";
  if (n === "1") return { tipo: "reescrever", texto: `quanto está ${dele} hoje?` };
  if (n === "2") return { tipo: "responder", resposta: RESPOSTA_PROPOSTA };
  if (n === "3") return { tipo: "responder", resposta: perguntaDeQuantidade(cultura) };
  if (n === "4") return { tipo: "reescrever", texto: `quero criar um alerta de preço de ${dele}` };
  return { tipo: "reescrever", texto: "quero falar com uma pessoa" };
}

/** A pessoa já viu o menu (ou o pitch de valor) e continua perdida: em vez de repetir, chama uma pessoa. */
export function jaMostrouAjudaRecente(historicoDoBotDesc: string[]): boolean {
  return historicoDoBotDesc
    .slice(0, 6)
    .some((m) => m.includes(MARCA_MENU_AJUDA) || m.includes("não faz milagre"));
}

export const RESPOSTA_CHAMAR_PESSOA =
  "Vou chamar uma pessoa da nossa equipe pra falar com você por aqui, do jeito mais fácil. Pode me dizer qual o melhor horário pra você? 🌱";
