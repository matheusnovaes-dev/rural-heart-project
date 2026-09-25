import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarPrecosDaUf } from "@/lib/precos";
import { buscarFrete, type ResultadoFrete } from "@/lib/paridade";
import { buscarPrecosOutrasUfs, type PrecoOutraUf } from "@/lib/referenciaMercado";
import { mediaDePracas } from "@/lib/precoFonte";

/**
 * Cálculo de valor de produção e margem — usado pela Calculadora de Safra no
 * painel, pela ferramenta do bot no WhatsApp e pela versão pública da landing
 * (fonte única, pra não ter conta divergindo em cada lugar).
 *
 * Sacas e custo nunca são estimados aqui: são o que quem chama informar. Só
 * multiplicação em cima do preço real já validado no resto do produto (mesma
 * fonte do card "Seu preço hoje": série do estado quando em dia, média das
 * praças quando não; frete/paridade de porto só quando o preço é da UF real
 * do produtor, porque a rota de frete depende da UF de origem).
 */
export type ResultadoCalculadora = {
  disponivel: boolean;
  /** UF de onde saiu o preço usado — pode ser diferente da UF pedida (ver usandoOutraUf). */
  ufUsada: string | null;
  precoAtual: number | null;
  fonteFrase: string | null;
  /** true quando a UF pedida não tinha preço e o cálculo usou outro estado como referência. */
  usandoOutraUf: boolean;
  /** Outros estados com preço real e recente pra essa cultura — sempre preenchido quando a UF pedida não tem dado, pra quem chama oferecer escolha. */
  outrasUfsDisponiveis: PrecoOutraUf[];
  frete: ResultadoFrete | null;
  valorBruto: number | null;
  custoTotal: number | null;
  margemTotal: number | null;
  margemPorSaca: number | null;
  /**
   * Frase pronta em português, escrita por código (o bot cita como está, nunca
   * refaz a conta) — mesmo padrão de paridade.ts/referenciaMercado.ts.
   * null quando não há sacas suficientes pra montar uma frase (ex: sem preço).
   */
  frase: string | null;
};

const brl = (n: number) =>
  `R$${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function calcularValorProducao(
  supabase: SupabaseClient,
  params: {
    cultura: string;
    uf: string;
    sacas: number | null;
    custoSaca: number | null;
    lat?: number | null;
    lon?: number | null;
    /** UF explicitamente escolhida como referência, entre outrasUfsDisponiveis (chamada seguinte, depois que a UI já mostrou as opções). */
    ufReferencia?: string | null;
  },
): Promise<ResultadoCalculadora> {
  const { cultura, uf, sacas, custoSaca, lat, lon, ufReferencia } = params;

  const r = await buscarPrecosDaUf(supabase, cultura, uf);
  let precoAtual =
    r.serieEstado.at(-1)?.preco ??
    (r.regionais.length > 0 ? mediaDePracas(r.regionais.map((x) => x.preco)) : null);

  let ufUsada: string | null = precoAtual != null ? uf : null;
  let usandoOutraUf = false;
  let fonteFrase: string | null = null;
  let outrasUfsDisponiveis: PrecoOutraUf[] = [];
  let frete: ResultadoFrete | null = null;

  if (precoAtual != null) {
    // Preço é da UF real do produtor: só aí a rota de frete faz sentido.
    frete = await buscarFrete(supabase, {
      cultura,
      uf,
      lat: lat ?? null,
      lon: lon ?? null,
    }).catch(() => null);
  } else {
    // Sem preço na UF pedida: busca outros estados com dado real e recente
    // dessa cultura (mesma fonte do card de referência de mercado).
    outrasUfsDisponiveis = await buscarPrecosOutrasUfs(supabase, cultura, uf);
    const escolha = ufReferencia
      ? outrasUfsDisponiveis.find((o) => o.uf === ufReferencia)
      : outrasUfsDisponiveis[0];
    if (escolha) {
      precoAtual = escolha.preco;
      ufUsada = escolha.uf;
      usandoOutraUf = true;
      fonteFrase = `${escolha.fonte}, ${escolha.data_referencia.slice(0, 10).split("-").reverse().join("/")}`;
      // Frete não é calculado pra UF de referência: a rota até o porto é da
      // UF de origem real do produtor, não da UF emprestada pra ter preço.
    }
  }

  const valorBruto = precoAtual != null && sacas != null ? precoAtual * sacas : null;
  const custoTotal = custoSaca != null && sacas != null ? custoSaca * sacas : null;
  const margemTotal = valorBruto != null && custoTotal != null ? valorBruto - custoTotal : null;
  const margemPorSaca = precoAtual != null && custoSaca != null ? precoAtual - custoSaca : null;

  let frase: string | null = null;
  if (precoAtual != null && sacas != null && valorBruto != null) {
    const origem = usandoOutraUf ? ` (referência de ${ufUsada}, ${fonteFrase})` : "";
    const partes = [
      `${sacas.toLocaleString("pt-BR")} sacas a ${brl(precoAtual)}${origem}: ${brl(valorBruto)} de valor bruto.`,
    ];
    if (margemTotal != null && margemPorSaca != null) {
      partes.push(
        `Custo de ${brl(custoSaca!)} por saca: margem de ${brl(margemPorSaca)} por saca, ${brl(margemTotal)} no total.`,
      );
    }
    frase = partes.join(" ");
  }

  return {
    disponivel: precoAtual != null,
    ufUsada,
    precoAtual,
    fonteFrase,
    usandoOutraUf,
    outrasUfsDisponiveis,
    frete,
    valorBruto,
    custoTotal,
    margemTotal,
    margemPorSaca,
    frase,
  };
}
