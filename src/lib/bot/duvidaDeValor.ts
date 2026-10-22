import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizarCultura } from "@/config/culturas";
import { ehFonteMensal, mesPorExtenso } from "@/lib/precoFonte";
import { buscarPreco } from "@/lib/bot/tools/preco";

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

/** A última mensagem do bot foi a pergunta "quantas sacas você pretende vender?" e a pessoa respondeu com um número. */
export function respondeuAQuantidade(texto: string, ultimaDoBot: string | undefined): boolean {
  return !!ultimaDoBot && ultimaDoBot.includes(MARCA_DUVIDA_DE_VALOR) && /\d/.test(texto);
}

/** "800", "uns 800 sacas", "5 mil", "1,5 mil", "5.000": a quantidade escrita pela pessoa, ou null. */
export function lerQuantidade(texto: string): number | null {
  const m = texto.toLowerCase().match(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(mil\b|k\b)?/);
  if (!m) return null;
  let n = Number(m[1]!.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (m[2]) n *= 1000;
  return n > 0 && n <= 10_000_000 ? n : null;
}

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: n < 1000 && n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/**
 * Cumpre a promessa da resposta de valor ("com esse número eu te mostro quanto cada 1% de preço vale no seu bolso"):
 * quantidade x preço de hoje, o valor de 1% e de R$ 5 por unidade, TUDO calculado por código com o preço do banco (o
 * modelo não pode: o guarda de números inventados barra qualquer conta que a ferramenta não devolveu pronta, visto no
 * teste de 22/10). Só para saca de 60 kg e arroba; outra unidade devolve null e o fluxo normal conduz.
 */
export async function responderValorDaVenda(
  supabase: SupabaseClient,
  produtor: { uf: string | null; cultura_principal: string | null },
  texto: string,
): Promise<string | null> {
  const quantidade = lerQuantidade(texto);
  if (!quantidade || !produtor.uf || !produtor.cultura_principal) return null;
  const cultura = normalizarCultura(produtor.cultura_principal);
  const r = await buscarPreco(supabase, {
    produto: cultura,
    uf: produtor.uf,
    incluir_frete: false,
  }).catch(() => null);
  if (!r?.encontrado || !r.precos?.length) return null;
  const linha = r.precos[0]!;
  const unidadeTxt = (linha.unidade ?? "").toLowerCase();
  const porSaca = /60\s*kg|\bsc\b/.test(unidadeTxt);
  const porArroba = /15\s*kg|arroba|@/.test(unidadeTxt);
  if (!porSaca && !porArroba) return null;
  const preco =
    r.origem_preco === "regional" && r.preco_medio_regioes ? r.preco_medio_regioes : linha.preco;
  if (!(preco > 0)) return null;
  const un = porSaca ? "saca" : "arroba";
  const unPl = porSaca ? "sacas" : "arrobas";
  const total = quantidade * preco;
  const quando = ehFonteMensal(linha.fonte)
    ? `média de ${mesPorExtenso(linha.data_referencia)}`
    : dataBr(linha.data_referencia);
  const qtdTxt = quantidade.toLocaleString("pt-BR");
  return `Com ${qtdTxt} ${unPl} de ${cultura} a ${brl(preco)} por ${un} (${linha.fonte}, ${quando}), a sua venda vale cerca de ${brl(Math.round(total))}.\n\nOlha o que isso significa: cada 1% de preço são ${brl(Math.round(total * 0.01))} no seu bolso, e cada R$ 5 a mais por ${un} são ${brl(Math.round(quantidade * 5))}. Por isso vale não vender no escuro.\n\nQuer que eu te avise quando o preço passar de um valor que você escolher? Ou, se você já recebeu uma proposta de comprador, manda aqui (foto, PDF ou o valor) que eu comparo com o mercado.`;
}
