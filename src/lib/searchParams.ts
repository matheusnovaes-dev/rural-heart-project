import { z } from "zod";

/**
 * Parâmetros de URL tolerantes. O parser de query do roteador transforma "1"
 * em número e rejeitava qualquer valor fora do esperado, o que derrubava a
 * página inteira na tela de erro: `/?semTrial=1`, `/?plano=ouro2` ou um token
 * só de dígitos em `/acesso?t=...` quebravam o site pra quem clicou (achado
 * 2026-10-13, ao testar o cadastro). Agora: número vira texto e valor inválido
 * é ignorado (a página abre normal, sem o parâmetro). Importa porque links
 * montados à mão (bio do Instagram, ManyChat, anúncios) vão ter erro de digitação.
 */
const comoTexto = (valor: unknown) => (typeof valor === "number" ? String(valor) : valor);

export const paramEnum = <const T extends readonly [string, ...string[]]>(valores: T) =>
  z.preprocess(
    comoTexto,
    z
      .enum(valores as unknown as [T[number], ...T[number][]])
      .optional()
      .catch(undefined),
  );

export const paramLiteral = <T extends string>(valor: T) =>
  z.preprocess(comoTexto, z.literal(valor).optional().catch(undefined));

export const paramUuid = z.preprocess(comoTexto, z.string().uuid().optional().catch(undefined));

export const paramTexto = z.preprocess(comoTexto, z.string().optional().catch(undefined));
