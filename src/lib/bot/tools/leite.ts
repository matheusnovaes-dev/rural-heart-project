import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buscarCotacaoLeite,
  buscarLinhasLeite,
  precoAtualMilho,
  relacaoLeiteMilho,
  resumirLeite,
  type CotacaoLeite,
  type RelacaoLeiteMilho,
  type ResumoLeite,
} from "@/lib/leite";

// Faixa em que um preço de leite pago ao produtor é plausível (R$/litro). Fora
// disso quase certamente é erro de digitação/transcrição ("28" em vez de "2,8").
const LITRO_MIN = 0.5;
const LITRO_MAX = 10;

export type ResultadoBuscarLeite = {
  encontrado: boolean;
  erro?: "uf_ausente" | "preco_litro_implausivel";
  uf?: string;
  /** Preço médio pago ao produtor no ano (IBGE), com produção e produtividade. Anual: não é cotação do dia. */
  media_ibge?: ResumoLeite & { fonte: string };
  /** Última cotação observada na UF, quando uma fonte cobre o estado (só se recente). */
  cotacao_recente?: CotacaoLeite;
  /** Leite x milho, com o preço de leite mais confiável disponível. */
  relacao_milho?: RelacaoLeiteMilho & {
    origem_preco_litro: "informado_pelo_produtor" | "cotacao_recente" | "media_ibge";
    milho: { data_referencia: string; origem: "estado" | "regional" };
    /** Texto pronto, escrito por código (o modelo erra a direção e as casas dessa conta): use como está. */
    frase_relacao: string;
  };
  nota?: string;
};

const brl = (n: number) => `R$${n.toFixed(2).replace(".", ",")}`;
const num1 = (n: number) => n.toFixed(1).replace(".", ",");
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/**
 * A relação leite/milho em português, escrita por código. Sem isso o modelo
 * inverte a leitura ("uma saca compra N litros") e faz conta própria em
 * outra unidade (0,038 kg), erros que passam pelo guarda de valores em R$.
 */
export function fraseRelacaoLeiteMilho(params: {
  relacao: RelacaoLeiteMilho;
  dataMilho: string;
  origem: "informado_pelo_produtor" | "cotacao_recente" | "media_ibge";
  cotacao: CotacaoLeite | null;
  anoMediaIbge: number | null;
}): string {
  const { relacao, dataMilho, origem, cotacao, anoMediaIbge } = params;
  const base = `Uma saca de milho (${brl(relacao.preco_saca_milho)}, ${dataBr(dataMilho)}) custa o mesmo que ${num1(relacao.litros_por_saca)} litros de leite, e cada litro de leite compra ${num1(relacao.kg_milho_por_litro)} kg de milho.`;
  if (origem === "informado_pelo_produtor") {
    return `${base} Conta feita com os ${brl(relacao.preco_litro)} por litro que você informou.`;
  }
  if (origem === "cotacao_recente" && cotacao) {
    return `${base} Conta feita com a cotação de ${brl(relacao.preco_litro)} por litro de ${dataBr(cotacao.data_referencia)} (${cotacao.fonte}).`;
  }
  return `${base} É uma estimativa: usa a média de leite de ${anoMediaIbge ?? "um ano anterior"} do IBGE (${brl(relacao.preco_litro)} por litro, dado anual) com o milho de agora. Me diga quanto você recebe por litro que eu recalculo com o seu número.`;
}

/**
 * Preço por litro que o produtor escreveu ("recebo 2,80 no litro", "R$ 3 por
 * litro"). Rede de segurança pro caso de o modelo não repassar o número (visto
 * ao vivo com "28 reais o litro", que ele descartou em silêncio).
 */
export function extrairPrecoLitroDoTexto(texto: string): number | null {
  const m = texto.match(
    /(?:r\$\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:reais\s*)?(?:o|no|por|pelo)\s+litro/i,
  );
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** O número aparece escrito no que o produtor disse (mensagem atual ou anteriores)? */
function produtorEscreveuONumero(valor: number, textoDoProdutor: string): boolean {
  return [...textoDoProdutor.matchAll(/\d+(?:[.,]\d+)?/g)].some(
    (m) => Math.abs(Number(m[0].replace(",", ".")) - valor) < 0.005,
  );
}

export async function buscarLeite(
  supabase: SupabaseClient,
  args: { uf: string | null; preco_litro_produtor?: number | null },
  falasDoProdutor: { atual: string; anteriores: string } = { atual: "", anteriores: "" },
): Promise<ResultadoBuscarLeite> {
  const uf = args.uf?.trim().toUpperCase();
  if (!uf) return { encontrado: false, erro: "uf_ausente" };

  // O preço dele é o que ele ESCREVEU. O modelo já "corrigiu" sozinho 28 pra
  // 2,80 (visto ao vivo) e calculou em cima de um número que ninguém disse:
  // o do texto atual manda, e o repassado pelo modelo só vale se estiver
  // escrito numa fala do produtor.
  const doTexto = extrairPrecoLitroDoTexto(falasDoProdutor.atual);
  const doModelo = args.preco_litro_produtor ?? null;
  const informado =
    doTexto ??
    (doModelo != null &&
    produtorEscreveuONumero(doModelo, `${falasDoProdutor.atual}\n${falasDoProdutor.anteriores}`)
      ? doModelo
      : null);
  if (informado != null && !(informado >= LITRO_MIN && informado <= LITRO_MAX)) {
    return { encontrado: false, erro: "preco_litro_implausivel" };
  }

  const [linhas, cotacao, milho] = await Promise.all([
    buscarLinhasLeite(supabase, uf),
    buscarCotacaoLeite(supabase, uf),
    precoAtualMilho(supabase, uf),
  ]);
  const resumo = resumirLeite(linhas);
  if (!resumo && !cotacao) return { encontrado: false, uf };

  const resultado: ResultadoBuscarLeite = { encontrado: true, uf };
  if (resumo) resultado.media_ibge = { ...resumo, fonte: "IBGE/PPM (anual)" };
  if (cotacao) resultado.cotacao_recente = cotacao;

  // Preço de leite da relação com o milho: o que o produtor disse (é o dele e
  // é de hoje) > última cotação observada > média anual do IBGE.
  const escolhido: {
    preco: number;
    origem: "informado_pelo_produtor" | "cotacao_recente" | "media_ibge";
  } | null =
    informado != null
      ? { preco: informado, origem: "informado_pelo_produtor" }
      : cotacao
        ? { preco: cotacao.preco, origem: "cotacao_recente" }
        : resumo
          ? { preco: resumo.preco_medio_litro, origem: "media_ibge" }
          : null;
  if (escolhido && milho) {
    const relacao = relacaoLeiteMilho(escolhido.preco, milho.preco);
    if (relacao) {
      resultado.relacao_milho = {
        ...relacao,
        origem_preco_litro: escolhido.origem,
        milho: { data_referencia: milho.data_referencia, origem: milho.origem },
        frase_relacao: fraseRelacaoLeiteMilho({
          relacao,
          dataMilho: milho.data_referencia,
          origem: escolhido.origem,
          cotacao,
          anoMediaIbge: resumo?.ano ?? null,
        }),
      };
    }
  }

  resultado.nota = cotacao
    ? "A média do IBGE é o preço médio pago ao produtor no ano indicado (anual, defasada) e NÃO é a cotação de hoje; a cotacao_recente é a última observada nesta UF."
    : "Não há cotação pública diária de leite pra esta UF. A média do IBGE é o preço médio pago ao produtor no ano indicado (anual, defasada) e NÃO é a cotação de hoje: cite sempre o ano e diga que é referência.";
  return resultado;
}
