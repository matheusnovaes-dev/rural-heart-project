import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizarCultura } from "@/config/culturas";
import { calcularValorProducao, type ResultadoCalculadora } from "@/lib/calculadora";
import type { HistoricoLinha } from "@/lib/bot/prompt";

export type ResultadoCalcularMargem =
  (ResultadoCalculadora & { erro?: undefined }) | { erro: "uf_ausente" | "sacas_ausente" };

/** Culturas reconhecidas na mensagem atual do produtor (mesmas palavras-chave
 * usadas em todo o bot). Se nenhuma aparecer, a mensagem não está mudando de
 * cultura — é só a continuação de uma pergunta anterior. */
const REGEX_CULTURA_MENCIONADA =
  /\b(soja|milho|boi|gado|arroba|caf[eé]|algod[ãa]o|trigo|arroz|feij[ãa]o|cana)\w*/i;

/** Acha a cultura mencionada mais recente no histórico (varrendo do fim pro
 * começo, incluindo mensagens do próprio bot) — acompanha a pergunta de
 * verdade sendo discutida, não só o cadastro do produtor. Achado real
 * (2026-09-25): bot perguntou "quantas sacas de SOJA?", produtor confirmou só
 * a quantidade, e o modelo chamou a ferramenta com MILHO — a trava antiga
 * caía pro cultura_principal do cadastro, que só por coincidência bateria com
 * o que o bot tinha acabado de perguntar; se o produtor cadastrado for de
 * milho mas estiver perguntando de soja no meio da conversa, cair direto pro
 * cadastro reproduziria o mesmo bug por outro caminho. */
function culturaMaisRecenteNoHistorico(historico: HistoricoLinha[]): string | null {
  for (let i = historico.length - 1; i >= 0; i--) {
    const linha = historico[i];
    const match = linha?.conteudo?.match(REGEX_CULTURA_MENCIONADA);
    if (match) return match[0];
  }
  return null;
}

/**
 * Mesma conta da Calculadora de Safra do painel (src/lib/calculadora.ts) —
 * sacas × preço real, custo informado pelo produtor, margem. O bot nunca
 * calcula isso "de cabeça": sacas e custo vêm SEMPRE do que o produtor
 * escreveu na mensagem, nunca estimados.
 *
 * Achado ao vivo (2026-09-25): numa conversa de 2 turnos ("quero calcular
 * minha saca" -> bot pergunta "quantas sacas de SOJA?" -> produtor responde
 * só "50000, só o bruto"), o modelo chamou essa ferramenta com produto=MILHO
 * — perdeu a cultura da própria pergunta que ele mesmo tinha acabado de
 * fazer. Mesmo padrão de sempre desse modelo (não dá pra confiar em manter
 * contexto entre turnos só via prompt) — por isso a trava é aqui, em código:
 * se a mensagem ATUAL do produtor não menciona nenhuma cultura, ignora o que
 * o modelo mandou em "produto" e usa a cultura cadastrada dele, que é o
 * mesmo padrão já usado no resto do bot pra pergunta sem cultura explícita.
 */
export async function calcularMargemSafra(
  supabase: SupabaseClient,
  args: {
    produto: string;
    uf: string | null;
    sacas: number | null;
    custo_saca: number | null;
    uf_referencia: string | null;
  },
  ctx: {
    lat: number | null;
    lon: number | null;
    textoAtual: string;
    culturaPadrao: string | null;
    historico: HistoricoLinha[];
  },
): Promise<ResultadoCalcularMargem> {
  if (!args.uf) return { erro: "uf_ausente" };
  if (args.sacas == null || args.sacas <= 0) return { erro: "sacas_ausente" };

  const culturaMencionadaAgora = REGEX_CULTURA_MENCIONADA.test(ctx.textoAtual);
  const culturaDoHistorico = culturaMaisRecenteNoHistorico(ctx.historico);
  const produtoFinal = culturaMencionadaAgora
    ? args.produto
    : (culturaDoHistorico ?? ctx.culturaPadrao ?? args.produto);

  const cultura = normalizarCultura(produtoFinal);
  return calcularValorProducao(supabase, {
    cultura,
    uf: args.uf,
    sacas: args.sacas,
    custoSaca: args.custo_saca,
    lat: ctx.lat,
    lon: ctx.lon,
    ufReferencia: args.uf_referencia,
  });
}
