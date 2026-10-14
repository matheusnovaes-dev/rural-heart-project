/**
 * Detecção por código de "o produtor está contando uma proposta de preço".
 * Decidida aqui e não no modelo: testando ao vivo, o gpt-4o-mini nem chamava a
 * ferramenta de estudo e respondia por conta própria, chegando a inventar
 * prazo e frete que ninguém disse (e a afirmar "a Cargill te ofereceu um preço
 * bom" sem ninguém ter dito valor nenhum).
 */

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const VERBO_DE_PROPOSTA =
  /\b(ofere(ceu|ceram|cem|ta|rta|rtou)|propost(a|as|o)|propuseram|propos|quer(em)?\s+pagar|quis\s+pagar|pagando|me\s+paga(m|ria)?|cotou|cotaram|fez\s+(uma\s+)?oferta)\b/;

const PALAVRA_DE_COMPARACAO =
  /\b(qual\s+(e\s+)?(a\s+)?(melhor|mais)|compensa|vale\s+mais|a\s+melhor)\b/;

/** Números que podem ser PREÇO: tira quantidades, prazos e percentuais ("4.000 sacas", "30 dias", "5%"). */
export function numerosDePreco(texto: string): number[] {
  const t = semAcento(texto.toLowerCase())
    .replace(
      /\d[\d.,]*\s*(sacas?|sc|toneladas?|ton|t|hectares?|ha|dias?|d|%|meses|mes|anos?|kg|km|h|horas?|reais\s+de\s+frete)\b/g,
      " ",
    )
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ");
  const achados = t.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g) ?? [];
  return achados
    .map((n) => Number(n.replace(/\./g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n >= 10 && n <= 20000);
}

/** Pergunta sobre o recurso ("você lê foto de proposta?", "como funciona o estudo?"), não proposta contada. */
const PERGUNTA_SOBRE_O_RECURSO =
  /\b(consegue|conseguem|sabe ler|sabem|le|leem|entende|analisa|aceita|aceitam|funciona|pode ler|posso mandar|da pra|como funciona|o que e|o que faz|pra que serve|para que serve|me explica|explica)\b/;
const ARQUIVO = /\b(foto|fotos|pdf|imagem|imagens|print|prints)\b/;

export function ehPropostaDePreco(texto: string): boolean {
  const t = semAcento(texto.toLowerCase());
  if (PERGUNTA_SOBRE_O_RECURSO.test(t) && (ARQUIVO.test(t) || /estudo|ranking/.test(t)))
    return false;
  const nums = numerosDePreco(texto);
  if (VERBO_DE_PROPOSTA.test(t)) return true;
  return PALAVRA_DE_COMPARACAO.test(t) && nums.length >= 2;
}

export function temPrecoDeProposta(texto: string): boolean {
  return numerosDePreco(texto).length > 0;
}

export const PERGUNTA_DO_VALOR_DA_PROPOSTA =
  "Pra eu fazer o estudo da proposta preciso do valor que o comprador ofereceu. Me diga o preço (e, se souber, a unidade, o prazo de pagamento e se ele retira na sua propriedade ou é entregue). Se preferir, é só mandar a foto ou o PDF da proposta que eu leio.";

/**
 * Trecho da fala que trata de um comprador: do nome dele até o próximo
 * comprador citado (ou o fim). Prazo, frete e quantidade só valem para quem os
 * citou NESSE trecho, para "a Bunge, pagando em 30 dias" não virar prazo da Cargill.
 */
export function trechoDoComprador(
  texto: string,
  comprador: string | null,
  todos: (string | null)[],
): { trecho: string; global: string } | null {
  if (!comprador) return null;
  const t = semAcento(texto.toLowerCase());
  const nome = semAcento(comprador.toLowerCase()).trim();
  const inicio = t.indexOf(nome);
  if (inicio < 0) return null;
  let fim = t.length;
  for (const outro of todos) {
    if (!outro) continue;
    const o = semAcento(outro.toLowerCase()).trim();
    if (!o || o === nome) continue;
    const pos = t.indexOf(o, inicio + nome.length);
    if (pos >= 0 && pos < fim) fim = pos;
  }
  // Trecho global: o que vem antes do primeiro comprador citado (vale para todos).
  let primeiro = t.length;
  for (const c of todos) {
    if (!c) continue;
    const pos = t.indexOf(semAcento(c.toLowerCase()).trim());
    if (pos >= 0 && pos < primeiro) primeiro = pos;
  }
  return { trecho: t.slice(inicio, fim), global: t.slice(0, primeiro) };
}
