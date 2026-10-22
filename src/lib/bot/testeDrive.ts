/**
 * "Test drive" logo depois do cadastro: o produtor vê de cara o que o Safralume faz, com dado REAL de
 * hoje da cultura e do estado dele (preço, porto, sinal de venda, clima), em vez de só "cadastro criado".
 * Pedido do Matheus 2026-10-15: no cadastro pelo WhatsApp a mensagem de confirmação não mostrava nada e
 * no cadastro pelo site o botão "Quero ver meu preço agora" caía em "tipo de mensagem não suportado".
 *
 * Tudo é montado por código a partir das mesmas ferramentas que o bot usa para responder: cada bloco
 * só entra se existir dado de verdade (nunca texto de preenchimento).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizarCultura } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { buscarPrevisao, diaParaResumo } from "@/lib/clima";
import { primeiroNome } from "@/lib/nomes";
import { semTravessao, montarResumoReengajamento } from "@/lib/bot/reengajamento";
import { buscarPreco } from "@/lib/bot/tools/preco";
import { buscarSinalVenda } from "@/lib/bot/tools/sinalVenda";

const nomeDaUf = (uf: string) => ufs.find((u) => u.value === uf)?.label ?? uf;

/** Texto do botão do modelo de boas-vindas do site ("Quero ver meu preço agora"). */
export function ehPedidoDeTesteDrive(texto: string): boolean {
  return /^\s*quero\s+ver\s+meu\s+pre[cç]o(\s+agora)?[\s!.?]*$/i.test(texto);
}

// "nov.", "aprox." etc. terminam com ponto mas não encerram a frase.
const ABREVIACOES =
  /(?:^|[\s(])(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|ex|etc|aprox|obs|vs|sr|sra|dr|dra|r\$|nº)$/i;

/** Frases completas que cabem em `max` caracteres (nunca corta no meio de uma frase nem depois de "nov."). */
function resumirFrases(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  let fim = -1;
  for (const m of corte.matchAll(/[.!?](?=\s|$)/g)) {
    if (m[0] === "." && ABREVIACOES.test(corte.slice(0, m.index))) continue;
    fim = m.index!;
  }
  return fim > 0
    ? corte.slice(0, fim + 1).trim()
    : texto.slice(0, texto.indexOf(". ") + 1 || max).trim();
}

const CONVITE_FINAL = [
  "Quer receber isso sozinho, sem precisar perguntar? É só me pedir um alerta: me diz a cultura e o preço a partir do qual você quer ser avisado.",
  "",
  "E se quiser também um painel no site, é só me pedir aqui que eu te mando um link de acesso.",
].join("\n");

/**
 * Os blocos do test drive (sem saudação). Devolve null quando não há nenhum dado real pra essa
 * cultura/UF, para quem chama cair no texto simples.
 */
export async function montarBlocosDoTesteDrive(
  supabase: SupabaseClient,
  produtor: { uf: string; cultura_principal: string },
): Promise<string | null> {
  const cultura = normalizarCultura(produtor.cultura_principal);
  const uf = produtor.uf;

  const [base, preco, previsao] = await Promise.all([
    montarResumoReengajamento(supabase, produtor).catch(() => null),
    buscarPreco(supabase, { produto: cultura, uf, incluir_frete: true }).catch(() => null),
    buscarPrevisao(uf).catch(() => null),
  ]);
  const jaTemPreco = !!preco?.encontrado;
  const sinal = await buscarSinalVenda(supabase, {
    produto: cultura,
    uf,
    // O resumo base já traz o preço; o sinal não repete número de preço nem a curva da B3 se ela já saiu.
    citarFuturoB3: !(preco?.referencia_mercado?.futuro_b3?.length ?? 0),
    citarPrecoAtual: !base,
  }).catch(() => null);

  const linhas: string[] = [];
  if (base) linhas.push(`🌾 *Preço e safra:* ${base}`);
  const paridade = jaTemPreco ? preco?.frete_e_paridade : null;
  if (paridade && paridade.tipo === "paridade" && paridade.frase) {
    linhas.push(`🚢 *Porto e frete:* ${paridade.frase}`);
  }
  // Sinal de venda só quando há preço de verdade do estado (sem preço, vira conselho solto).
  if (jaTemPreco && sinal?.disponivel && sinal.texto) {
    linhas.push(`📈 *Sinal de venda:* ${resumirFrases(sinal.texto, 280)}`);
  }
  const diaResumo = previsao ? diaParaResumo(previsao, "amanha") : null;
  if (previsao && diaResumo) {
    const idx = diaResumo.idx;
    const quando = diaResumo.quando.charAt(0).toUpperCase() + diaResumo.quando.slice(1);
    const condicao = previsao.condicaoTexto?.[idx];
    const max = previsao.tempMax[idx];
    const chuva = previsao.chuvaPct[idx];
    if (max != null && chuva != null) {
      linhas.push(
        `⛅ *Clima:* ${quando}, na capital do seu estado (referência): ${
          condicao ? `${condicao}, ` : ""
        }máxima de ${Math.round(max)}°C e ${Math.round(chuva)}% de chance de chuva.`,
      );
    }
  }
  if (linhas.length === 0) return null;
  return semTravessao(linhas.join("\n\n"));
}

/** Mensagem completa do botão "Quero ver meu preço agora" (cadastro feito pelo site). */
export async function montarTesteDriveDoBotao(
  supabase: SupabaseClient,
  produtor: { nome: string; uf: string | null; cultura_principal: string | null },
): Promise<string> {
  const nome = primeiroNome(produtor.nome);
  const abertura = nome
    ? `Aqui está, ${nome}! Um gostinho do que você tem no Safralume, com os dados de hoje 🌾`
    : "Aqui está! Um gostinho do que você tem no Safralume, com os dados de hoje 🌾";
  if (!produtor.uf || !produtor.cultura_principal) {
    return `${abertura}\n\nMe diz o que você produz e em que estado, tipo "soja em MT", que eu te mostro o preço de hoje, o clima e o sinal de venda.\n\n${CONVITE_FINAL}`;
  }
  const blocos = await montarBlocosDoTesteDrive(supabase, {
    uf: produtor.uf,
    cultura_principal: produtor.cultura_principal,
  });
  if (!blocos) {
    return `${abertura}\n\nAinda não temos preço recente de ${produtor.cultura_principal.toLowerCase()} em ${nomeDaUf(produtor.uf)}, mas já dá pra pedir o clima da sua região, alertas e o preço de outras culturas. É só me dizer o que quer ver.\n\n${CONVITE_FINAL}`;
  }
  return `${abertura}\n\n${blocos}\n\n${CONVITE_FINAL}`;
}

/** Confirmação do cadastro feito pelo WhatsApp, já com o test drive embaixo. */
export async function montarCadastroComTesteDrive(
  supabase: SupabaseClient,
  params: { nome: string; uf: string; cultura: string },
): Promise<string | null> {
  const nome = primeiroNome(params.nome);
  const saudacao = nome ? `Pronto, ${nome}!` : "Pronto!";
  const cultura = params.cultura.toLowerCase();
  const abertura = `${saudacao} Seu cadastro grátis de 7 dias como produtor de ${cultura} em ${nomeDaUf(params.uf)} está criado. Olha um gostinho do que você tem aqui, com os dados de hoje 🌾`;
  const blocos = await montarBlocosDoTesteDrive(supabase, {
    uf: params.uf,
    cultura_principal: params.cultura,
  }).catch(() => null);
  if (!blocos) return null;
  return `${abertura}\n\n${blocos}\n\n${CONVITE_FINAL}`;
}
