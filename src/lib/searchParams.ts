/**
 * Parâmetros de URL tolerantes. O parser de query do roteador transforma "1"
 * em número e rejeitava qualquer valor fora do esperado, o que derrubava a
 * página inteira na tela de erro: `/?semTrial=1`, `/?plano=ouro2` ou um token
 * só de dígitos em `/acesso?t=...` quebravam o site pra quem clicou (achado
 * 2026-10-13, ao testar o cadastro). Agora: número vira texto e valor inválido
 * é ignorado (a página abre normal, sem o parâmetro). Importa porque links
 * montados à mão (bio do Instagram, ManyChat, anúncios) vão ter erro de digitação.
 *
 * Funções simples em vez de zod: a landing não carrega mais a biblioteca só pra ler dois parâmetros (~13 KB a menos).
 */
const comoTexto = (valor: unknown) => (typeof valor === "number" ? String(valor) : valor);

export const lerEnum = <const T extends readonly string[]>(
  valor: unknown,
  valores: T,
): T[number] | undefined => {
  const texto = comoTexto(valor);
  return typeof texto === "string" && (valores as readonly string[]).includes(texto)
    ? (texto as T[number])
    : undefined;
};

export const lerLiteral = <T extends string>(valor: unknown, esperado: T): T | undefined =>
  comoTexto(valor) === esperado ? esperado : undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const lerUuid = (valor: unknown): string | undefined => {
  const texto = comoTexto(valor);
  return typeof texto === "string" && UUID.test(texto) ? texto : undefined;
};

export const lerTexto = (valor: unknown): string | undefined => {
  const texto = comoTexto(valor);
  return typeof texto === "string" ? texto : undefined;
};

/** Tira as chaves sem valor (o tipo do parâmetro fica opcional, como o roteador espera). */
export function parametros<T extends Record<string, unknown>>(
  objeto: T,
): { [K in keyof T]?: T[K] } {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(objeto))
    if (valor !== undefined) saida[chave] = valor;
  return saida as { [K in keyof T]?: T[K] };
}
