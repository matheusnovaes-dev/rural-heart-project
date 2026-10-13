/**
 * Pergunta que já vai escrita no WhatsApp do botão "peça seu primeiro preço".
 * Frase neutra de propósito: "preço DA soja" / "preço DO milho" dependem do
 * gênero de cada cultura e davam "preço da boi gordo (carne bovina)". Com "de"
 * serve pra qualquer cultura do catálogo, e o parêntese do rótulo sai.
 */
export function perguntaDePreco(cultura: string | null | undefined): string {
  const produto = cultura
    ?.replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return produto ? `Oi! Quero ver o preço de ${produto} hoje.` : "Oi! Quero ver o preço de hoje.";
}
