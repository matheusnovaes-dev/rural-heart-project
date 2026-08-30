import type { InsightTone } from "@/components/dashboard/InsightCard";

export type SinalPosicao = "alto" | "baixo" | "neutro";
export type SinalCurva = "alta" | "baixa" | "neutro";

const LIMITE_POSICAO_ALTO = 70;
const LIMITE_POSICAO_BAIXO = 30;
// Curva de futuros sempre tem algum ruído dia a dia — variação menor que
// isso entre o vencimento mais próximo e o mais distante não é sinal de
// nada, é só o mercado andando de lado.
const LIMITE_CURVA_PCT = 1.5;

/**
 * Onde o preço de hoje está dentro da faixa (mín-máx) dos últimos 90 dias,
 * já calculado em 0-100 pelo InsightsPanel — só traduz o número numa
 * categoria pro sinal de venda.
 */
export function sinalDaPosicao(posicao: number | null): SinalPosicao | null {
  if (posicao == null) return null;
  if (posicao >= LIMITE_POSICAO_ALTO) return "alto";
  if (posicao <= LIMITE_POSICAO_BAIXO) return "baixo";
  return "neutro";
}

/**
 * Contango (futuro mais caro que o próximo vencimento) sugere que o
 * mercado espera preço subir; backwardation (futuro mais barato) sugere
 * queda esperada. Não é o único fator (custo de carregamento/armazenagem
 * também empurra pra contango sem ter nada a ver com expectativa de
 * preço), por isso é só UM dos dois sinais, nunca a palavra final sozinha.
 */
export function sinalDaCurvaFuturos(
  futuros: { mesAnoVencimento: string; preco: number }[],
): SinalCurva | null {
  const ordenados = [...futuros].sort((a, b) =>
    a.mesAnoVencimento.localeCompare(b.mesAnoVencimento),
  );
  const distintos = ordenados.filter(
    (f, i) => i === 0 || f.mesAnoVencimento !== ordenados[i - 1]!.mesAnoVencimento,
  );
  if (distintos.length < 2) return null;

  const maisProximo = distintos[0]!;
  const maisDistante = distintos[distintos.length - 1]!;
  if (maisProximo.preco === 0) return null;

  const variacaoPct = ((maisDistante.preco - maisProximo.preco) / maisProximo.preco) * 100;
  if (Math.abs(variacaoPct) < LIMITE_CURVA_PCT) return "neutro";
  return variacaoPct > 0 ? "alta" : "baixa";
}

export type SinalVenda = { tone: InsightTone; texto: string };

/**
 * Cruza "o preço de hoje é bom comparado ao histórico" (posição) com "o
 * mercado espera alta ou queda" (curva de futuros) numa recomendação em
 * português simples. Isso é o diferencial: ninguém que a gente mapeou no
 * mercado cruza esses dois dados — só mostram um ou outro número solto.
 *
 * Não é recomendação de investimento (mesmo aviso que já vale pros
 * relatórios em PDF) — são dois sinais de mercado, não uma certeza.
 */
export function combinarSinalVenda(
  posicao: SinalPosicao | null,
  curva: SinalCurva | null,
): SinalVenda | null {
  if (posicao == null && curva == null) return null;

  if (posicao === "alto" && curva !== "alta") {
    return {
      tone: "up",
      texto:
        "Preço bem posicionado nos últimos 90 dias e o mercado futuro não aponta mais alta — pode ser um bom momento pra vender.",
    };
  }
  if (posicao === "alto" && curva === "alta") {
    return {
      tone: "neutral",
      texto:
        "Preço já está bem posicionado, mas o mercado futuro ainda aponta alta — dá pra vender agora e travar esse preço, ou esperar mais um pouco de melhora.",
    };
  }
  if (posicao === "baixo" && curva === "alta") {
    return {
      tone: "neutral",
      texto:
        "Preço abaixo da média dos últimos 90 dias, mas o mercado futuro aponta alta — se der pra esperar, pode valer.",
    };
  }
  if (posicao === "baixo" && curva !== "alta") {
    return {
      tone: "down",
      texto:
        "Preço abaixo da média dos últimos 90 dias e o mercado futuro também não aponta melhora no curto prazo.",
    };
  }
  // Só um dos dois sinais disponível (o outro null) ou posição neutra —
  // ainda mostra o que der, em vez de esconder o card inteiro.
  if (posicao === "neutro" && curva && curva !== "neutro") {
    return curva === "alta"
      ? {
          tone: "neutral",
          texto: "Preço na média dos últimos 90 dias, mas o mercado futuro aponta alta.",
        }
      : {
          tone: "neutral",
          texto: "Preço na média dos últimos 90 dias, e o mercado futuro aponta queda.",
        };
  }
  if (curva == null && posicao && posicao !== "neutro") {
    return posicao === "alto"
      ? { tone: "up", texto: "Preço bem posicionado nos últimos 90 dias." }
      : { tone: "down", texto: "Preço abaixo da média dos últimos 90 dias." };
  }

  return null;
}
