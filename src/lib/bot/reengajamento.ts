import type { SupabaseClient } from "@supabase/supabase-js";

import { ehBoi, normalizarCultura } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { buscarPreco } from "@/lib/bot/tools/preco";
import { buscarFerrugemAsiatica } from "@/lib/bot/tools/ferrugem";
import { buscarProgressoSafraConab, buscarVariacaoCambio } from "@/lib/bot/tools/mercado";
import { buscarSinalVenda } from "@/lib/bot/tools/sinalVenda";
import { buscarLeiloesProximos } from "@/lib/bot/tools/leiloes";
import { buscarPrevisao } from "@/lib/clima";
import { buscarPrecosDaUf } from "@/lib/precos";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
const nomeDaUf = (uf: string) => ufs.find((u) => u.value === uf)?.label ?? uf;
const brl = (n: number) => `R$${n.toFixed(2).replace(".", ",")}`;
const pct = (fracao: number) =>
  `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

// WhatsApp rejeita template com corpo (texto fixo + variáveis já substituídas)
// acima de 1024 caracteres — achado real 2026-10-07, enviando reativação de
// verdade: resumo de 881 caracteres (ferrugem + preço + progresso + sinal de
// venda + clima, tudo junto) estourou o limite em 3 dos 10 templates (corpo
// fixo mais longo). 600 dá margem segura pro maior corpo fixo entre
// boas-vindas/reengajamento/reativação (346) + nome + plano. Corta na última
// frase completa que couber, nunca no meio de uma frase.
const LIMITE_RESUMO = 600;
// O ponto de "jan.", "aprox." etc. não encerra frase: cortar ali deixava o
// resumo terminando em "...com vencimento em jan." (achado no teste do resumo
// diário, 2026-10-13).
const ABREVIACOES =
  /(?:^|[\s(])(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|ex|etc|aprox|obs|vs|sr|sra|dr|dra|r\$|nº)$/i;
export function limitarResumo(texto: string): string {
  if (texto.length <= LIMITE_RESUMO) return texto;
  const cortado = texto.slice(0, LIMITE_RESUMO);
  let corte = -1;
  for (const m of cortado.matchAll(/[.!?] /g)) {
    if (m[0].startsWith(".") && ABREVIACOES.test(cortado.slice(0, m.index))) continue;
    corte = m.index!;
  }
  if (corte > 0) return cortado.slice(0, corte + 1);
  return `${cortado.trimEnd()}...`;
}

/**
 * Resumo de retomada — pedido do Matheus 2026-09-30: produtor some depois
 * da primeira conversa (achado real analisando os 28 cadastros: 18 nunca
 * mandaram mensagem nenhuma, os outros quase todos sumiram na mesma sessão
 * do cadastro). Em vez de um "quer saber o preço de hoje?" genérico, monta
 * um resumo com dado REAL e específico do produtor (cultura+UF dele),
 * reaproveitando as MESMAS funções que o bot usa pra responder de verdade
 * — nunca um texto fixo, sempre o que existir de real pra ele agora.
 * Degrada graciosamente: cada pedaço só entra se tiver dado de verdade.
 */
export async function montarResumoReengajamento(
  supabase: SupabaseClient,
  produtor: { uf: string; cultura_principal: string },
): Promise<string | null> {
  const cultura = normalizarCultura(produtor.cultura_principal);
  const uf = produtor.uf;
  const partes: string[] = [];

  const [preco, progresso, ferrugem] = await Promise.all([
    buscarPreco(supabase, { produto: cultura, uf, incluir_frete: false }).catch(() => null),
    buscarProgressoSafraConab(supabase, { produto: cultura, uf }).catch(() => null),
    cultura === "soja"
      ? buscarFerrugemAsiatica(supabase, { uf }).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Ferrugem primeiro, de propósito: é o dado mais urgente quando existe
  // (risco real pra lavoura), tem que vir antes do preço.
  if (ferrugem?.encontrado && ferrugem.municipios_com_ocorrencia_confirmada.length > 0) {
    const municipios = ferrugem.municipios_com_ocorrencia_confirmada
      .slice(0, 3)
      .map((m) => m.municipio)
      .join(", ");
    partes.push(
      `Atenção: já tem foco confirmado de ferrugem asiática em ${municipios} esta safra.`,
    );
  }

  if (preco?.encontrado && preco.precos && preco.precos.length > 0) {
    const linha = preco.precos[0]!;
    // Estado sem preço único (só praças): cita a média das praças, a mesma
    // regra do bot e do sinal de venda. Antes pegava a primeira praça e o
    // resumo trazia um preço aqui e outro (da série) logo abaixo.
    const media =
      preco.origem_preco === "regional" && typeof preco.preco_medio_regioes === "number"
        ? preco.preco_medio_regioes
        : null;
    partes.push(
      `${cultura[0]!.toUpperCase()}${cultura.slice(1)} hoje em ${nomeDaUf(uf)}: ${
        media != null ? `média das praças ${brl(media)}` : brl(linha.preco)
      }${linha.unidade ? `/${linha.unidade}` : ""} (${linha.fonte}, ${dataBr(linha.data_referencia)}).`,
    );
  } else if (preco?.referencia_mercado) {
    partes.push(preco.referencia_mercado.frase);
  }

  if (progresso?.disponivel) {
    // Mesmo achado do card do painel: 0% é "ainda não começou", não dado
    // útil pra citar — cai pro nacional se o estado dele estiver zerado.
    const daUf = progresso.da_uf.find((l) => l.percentual > 0);
    const linha = daUf ?? progresso.nacional.find((l) => l.percentual > 0);
    if (linha) {
      const escopo = daUf ? "no seu estado" : "no Brasil (seu estado ainda não começou)";
      partes.push(
        `${pct(linha.percentual)} da safra já foi ${linha.tipo === "semeadura" ? "semeada" : "colhida"} ${escopo} (média de 5 anos: ${
          linha.media_5_anos != null ? pct(linha.media_5_anos) : "sem histórico"
        }), referência de ${mesAno(progresso.semana_referencia)}.`,
      );
    }
  }

  if (partes.length === 0) return null;
  return limitarResumo(partes.join(" "));
}

// Limiares próprios desta mensagem proativa (não reaproveitam os de nenhum
// outro alerta existente — são a régua de "vale a pena mandar sem ele
// pedir" especificamente aqui, escolhida pra ser rara e nunca virar
// recado vazio): 3% de variação de preço desde a última cotação, 70% de
// chance de chuva, mínima prevista <= 3°C (geada), ou 1,5% de variação do
// dólar entre os 2 últimos dias úteis (menor que o de preço de cultura de
// propósito — câmbio costuma mover menos no dia a dia, então o mesmo 3%
// quase nunca disparava).
const LIMIAR_VARIACAO_PRECO = 0.03;
const LIMIAR_CHUVA_FORTE_PCT = 70;
const LIMIAR_GEADA_TEMP_MIN = 3;
const LIMIAR_VARIACAO_CAMBIO = 1.5;

/**
 * Resumo da mensagem proativa diária (pedido do Matheus 2026-10-11): manda,
 * no máximo 1x por dia, só pra quem JÁ conversou com o bot alguma vez
 * (ver /api/cron/mensagem-proativa), e só quando tem algo que realmente
 * mudaria a decisão do produtor hoje — nunca um "bom dia" vazio. Prioridade:
 * (1) preço moveu de verdade desde a última cotação, (2) clima severo hoje
 * (chuva forte ou geada), (3) dólar moveu de verdade (pedido do Matheus
 * 2026-10-11, depois de revisar o anúncio v4 — câmbio influencia o preço de
 * exportação, então é sinal real, mesmo não sendo específico da cultura
 * dele). Sem nenhum dos três, retorna null e o cron não manda nada —
 * degradar pro silêncio é o comportamento certo aqui, não um texto de
 * preenchimento (risco de "quality score" do WhatsApp se mandar mensagem
 * sem valor real, ver memória do projeto).
 */
export async function montarResumoProativoDiario(
  supabase: SupabaseClient,
  produtor: { uf: string; cultura_principal: string },
): Promise<string | null> {
  const cultura = normalizarCultura(produtor.cultura_principal);
  const uf = produtor.uf;

  const [serie, previsao, cambio] = await Promise.all([
    buscarPrecosDaUf(supabase, cultura, uf).catch(() => null),
    buscarPrevisao(uf).catch(() => null),
    buscarVariacaoCambio(supabase).catch(() => null),
  ]);

  const atual = serie?.serieEstado.at(-1);
  const anterior = serie?.serieEstado.at(-2);
  if (atual && anterior && anterior.preco !== 0) {
    const fracao = (atual.preco - anterior.preco) / anterior.preco;
    if (Math.abs(fracao) >= LIMIAR_VARIACAO_PRECO) {
      const direcao = fracao > 0 ? "subiu" : "caiu";
      return limitarResumo(
        `O preço de ${cultura} em ${nomeDaUf(uf)} ${direcao} ${pct(Math.abs(fracao))} desde a última cotação: agora está ${brl(atual.preco)}, referência de ${dataBr(atual.data_referencia)}.`,
      );
    }
  }

  if (previsao && previsao.dias.length > 0) {
    const chuvaHoje = previsao.chuvaPct[0];
    const minHoje = previsao.tempMin[0];
    if (chuvaHoje != null && chuvaHoje >= LIMIAR_CHUVA_FORTE_PCT) {
      return limitarResumo(
        `Previsão de chuva forte hoje na capital do seu estado (referência): ${Math.round(chuvaHoje)}% de chance.`,
      );
    }
    if (minHoje != null && minHoje <= LIMIAR_GEADA_TEMP_MIN) {
      return limitarResumo(
        `Risco de geada hoje na capital do seu estado (referência): mínima prevista de ${Math.round(minHoje)}°C.`,
      );
    }
  }

  if (cambio && Math.abs(cambio.variacao) >= LIMIAR_VARIACAO_CAMBIO) {
    // cambio.variacao já vem em escala percentual (buscarVariacaoCambio
    // multiplica por 100), diferente da `fracao` do preço acima — pct()
    // espera fração e multiplicaria por 100 de novo, inflando 100x (achado
    // real testando esse cenário: variação real de 2% virava "200%" na
    // mensagem). Por isso aqui divide por 100 antes de passar pra pct().
    const direcao = cambio.variacao > 0 ? "subiu" : "caiu";
    return limitarResumo(
      `O dólar ${direcao} ${pct(Math.abs(cambio.variacao) / 100)} desde o último pregão: agora está ${brl(cambio.atual)}, referência de ${dataBr(cambio.dataAtual)}. Câmbio pesa no preço de exportação.`,
    );
  }

  return null;
}

const dataHoraBr = (iso: string) => {
  const hora = new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${dataBr(iso)} às ${hora}`;
};

/**
 * Versão rica do resumo, só pra reativação (pedido do Matheus 2026-10-06:
 * essa mensagem é rara e de alto risco — se a pessoa não voltar agora,
 * pode não ter mais nenhuma chance — então vale somar mais sinal real em
 * vez do resumo enxuto do reengajamento normal, que manda toda semana e
 * não pode virar textão).
 *
 * Soma, além do resumo base (preço/progresso/ferrugem):
 * - sinal de venda (posição 90d + curva de futuros B3 + risco de clima,
 *   já rico em número real desde o fix de 2026-10-06 em sinalVenda.ts);
 * - previsão do tempo da capital do estado (fato diferente do risco de
 *   clima do sinal de venda acima — aqui é "como vai estar o tempo", lá é
 *   "isso muda a hora de vender" — pedido do Matheus pra não falar só de
 *   preço/produto);
 * - agenda de leilão de gado, só quando a cultura é boi (pedido explícito
 *   do Matheus: diversificar por cultura, não é só sobre grão) — respeita
 *   o paywall Prata+ igual o bot faz (teaser sem número pra quem é Bronze,
 *   nunca inventa dado).
 */
export async function montarResumoReativacao(
  supabase: SupabaseClient,
  produtor: { uf: string; cultura_principal: string },
  produtorId: string | null,
): Promise<string | null> {
  const cultura = normalizarCultura(produtor.cultura_principal);
  const uf = produtor.uf;

  // Busca o preço de novo (já buscado dentro de montarResumoReengajamento
  // também) só pra saber se o resumo base já citou a curva de futuros da
  // B3 via referencia_mercado (caso boi sem preço direto na UF) — sem isso
  // o sinal de venda duplicava a mesma curva. Custo de uma chamada extra,
  // aceitável num cron que roda poucas vezes por dia.
  const [base, precoParaChecarDuplicata, previsao, leiloes] = await Promise.all([
    montarResumoReengajamento(supabase, produtor),
    buscarPreco(supabase, { produto: cultura, uf, incluir_frete: false }).catch(() => null),
    buscarPrevisao(uf).catch(() => null),
    ehBoi(cultura)
      ? buscarLeiloesProximos(supabase, { uf }, produtorId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const baseJaCitouFuturoB3 =
    (precoParaChecarDuplicata?.referencia_mercado?.futuro_b3?.length ?? 0) > 0;
  const sinal = await buscarSinalVenda(supabase, {
    produto: cultura,
    uf,
    citarFuturoB3: !baseJaCitouFuturoB3,
  }).catch(() => null);

  const partes: string[] = [];
  if (base) partes.push(base);
  if (sinal?.disponivel && sinal.texto) partes.push(sinal.texto);

  if (previsao && previsao.dias.length > 0) {
    const idx = previsao.dias.length > 1 ? 1 : 0;
    const quando = idx === 1 ? "Amanhã" : "Hoje";
    const condicao = previsao.condicaoTexto?.[idx];
    const max = previsao.tempMax[idx];
    const chuva = previsao.chuvaPct[idx];
    if (max != null && chuva != null) {
      partes.push(
        `${quando}, na capital do seu estado (referência): ${
          condicao ? `${condicao}, ` : ""
        }máxima de ${Math.round(max)}°C e ${Math.round(chuva)}% de chance de chuva.`,
      );
    }
  }

  if (leiloes && "encontrado" in leiloes && leiloes.encontrado) {
    const proximo = leiloes.presenciais_na_regiao[0] ?? leiloes.virtuais_em_destaque[0];
    if (proximo?.data_hora) {
      partes.push(
        `Tem leilão de gado "${proximo.titulo}" dia ${dataHoraBr(proximo.data_hora)}${
          proximo.leiloeira ? ` (${proximo.leiloeira})` : ""
        }.`,
      );
    }
  } else if (leiloes && "disponivel_no_plano" in leiloes && leiloes.disponivel_no_plano === false) {
    partes.push(
      "O Safralume também acompanha a agenda de leilão de gado no Brasil inteiro (presencial e virtual) — isso é do plano Prata.",
    );
  }

  if (partes.length === 0) return null;
  return limitarResumo(partes.join(" "));
}
