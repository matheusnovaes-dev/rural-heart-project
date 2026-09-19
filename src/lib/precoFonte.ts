/**
 * Qual fonte de preço usar quando o mesmo produto/UF tem dois tipos de dado:
 * o preço único do estado (regiao = '', ex: Conab) e os preços por praça/
 * região (ex: BBM, diária).
 *
 * Antes, o app usava SEMPRE o do estado e só olhava as regiões quando o
 * estado não tinha nada — então a soja de MT ficou parada em R$129,80 (Conab,
 * 21/08) por 4 semanas enquanto a BBM publicava todo dia ~R$143 no mesmo
 * estado. A Conab publica por estado de forma irregular (89 de 270 séries
 * paradas há mais de 20 dias), então o estado não pode ganhar por padrão.
 *
 * Regra: o estado vence, a não ser que esteja defasado — ou seja, os dados
 * regionais são pelo menos DIAS_ESTADO_DEFASADO dias mais novos. O limite de
 * uma semana existe porque as fontes do estado são semanais: um dia ou dois de
 * diferença é só o ritmo normal de publicação, e trocar de fonte nesse caso
 * mudaria a base do preço à toa (em PR, a mesma soja no mesmo dia sai R$139 no
 * estado e R$157 nas praças, por definições diferentes de preço).
 */
export const DIAS_ESTADO_DEFASADO = 7;

export type FonteDePreco = "estado" | "regional" | null;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function dataParaMs(data: string): number {
  return Date.parse(`${data.slice(0, 10)}T00:00:00Z`);
}

/** Dias inteiros entre duas datas YYYY-MM-DD (positivo quando `b` é mais nova que `a`). */
export function diasEntre(a: string, b: string): number {
  return Math.round((dataParaMs(b) - dataParaMs(a)) / MS_POR_DIA);
}

export function escolherFontePreco(
  ultimaDoEstado: string | null | undefined,
  ultimaRegional: string | null | undefined,
): FonteDePreco {
  if (!ultimaDoEstado && !ultimaRegional) return null;
  if (!ultimaRegional) return "estado";
  if (!ultimaDoEstado) return "regional";
  const diferenca = diasEntre(ultimaDoEstado, ultimaRegional);
  if (Number.isNaN(diferenca)) return "estado";
  return diferenca >= DIAS_ESTADO_DEFASADO ? "regional" : "estado";
}

/** Média dos preços das praças (2 casas), pra um número único de referência do estado. */
export function mediaDePracas(precos: number[]): number | null {
  if (precos.length === 0) return null;
  const soma = precos.reduce((acc, p) => acc + p, 0);
  return Math.round((soma / precos.length) * 100) / 100;
}
