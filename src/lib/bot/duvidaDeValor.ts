/**
 * "Não entendi como isso funciona / como vou obter lucro / pra que serve": a dúvida de valor de quem acabou de entrar
 * (achado de 22/10: um cafeicultor de Pernambuco escreveu "eu ainda não entendi direito como isso funciona e como eu vou
 * obter lucros" e recebeu uma lista numerada de funções, sem pergunta nenhuma). É o momento em que a venda se decide: aqui
 * o bot responde como um bom consultor, em 3 ganhos concretos que o produto realmente entrega, SEM prometer lucro, e faz
 * UMA pergunta que puxa a conversa para o caso da pessoa. Decidido por código (o modelo gera lista genérica). O aviso ao
 * Matheus sai junto (precisa_humano), porque quem pergunta isso está a um passo de ficar ou ir embora.
 */
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Pergunta específica de um recurso ("como funciona o alerta?") NÃO é dúvida de valor: o fluxo normal responde.
const RECURSO_ESPECIFICO =
  /\b(alerta|alertas|resumo|caderno|painel|plano|planos|cancel\w*|pagamento|pagar|assinar|assinatura|clima|chuva|preco|cotacao|cadastro|senha|link)\b/;

const PADROES = [
  /\bnao\s+entend\w+\b.{0,50}\b(funcion\w*|serve|ajud\w*|lucr\w*|ganh\w*|isso)\b/,
  /\bcomo\s+(eu\s+)?(vou|vai|posso|iria|que\s+eu\s+vou)\s+(ter|obter|ganhar|lucrar|ter\s+lucro|ganhar\s+dinheiro|usar\s+isso)\b/,
  /\bcomo\s+isso\s+(funciona|me\s+ajuda|ajuda|vai\s+me\s+ajudar)\b/,
  /\b(pra|para)\s+que\s+(isso\s+)?serve\b/,
  /\bo\s+que\s+(eu\s+)?(ganho|ganha|vou\s+ganhar)\b/,
  /\bpreciso\s+de\s+mais\s+[ei][nm]forma\w+\b/,
  /\bcomo\s+(eu\s+)?(vou\s+)?(obter|ter)\s+lucros?\b/,
];

export function ehDuvidaDeValor(texto: string): boolean {
  const t = semAcento(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ");
  if (t.split(" ").length > 40) return false; // texto longo: a pessoa está contando algo, não perguntando o valor
  if (RECURSO_ESPECIFICO.test(t)) return false;
  return PADROES.some((p) => p.test(t));
}

export const MARCA_DUVIDA_DE_VALOR = "O ganho vem de vender na hora certa";

/** Resposta consultiva. `cultura` já vem normalizada ("soja", "café arábica"); sem cultura, fala em "sua produção". */
export function respostaDuvidaDeValor(cultura: string | null): string {
  const de = cultura ? `de ${cultura}` : "da sua produção";
  const quanto = cultura ? `${cultura}` : "produção";
  return `Boa pergunta, vou ser direto: o Safralume não faz milagre. ${MARCA_DUVIDA_DE_VALOR} e de não aceitar preço abaixo do mercado. Na prática, são 3 coisas:\n\n1) Saber se o preço que te oferecem é justo: você me manda a proposta do comprador (foto, PDF ou o valor) e eu comparo com o mercado.\n2) Ser avisado na hora que o preço ${de} sobe ou cai, sem ficar ligando pra ninguém.\n3) Saber sua margem de verdade: você anota os gastos no caderno da fazenda e eu calculo seu custo por saca.\n\nPra eu te mostrar na prática: quantas sacas (ou arrobas) de ${quanto} você pretende vender nos próximos meses? Com esse número eu te mostro quanto cada 1% de preço vale no seu bolso.`;
}
