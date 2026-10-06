import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarPrevisao } from "@/lib/clima";
import { CULTURA_PARA_B3 } from "@/config/b3";
import { normalizarCultura } from "@/config/culturas";
import { rotuloFonte } from "@/lib/bot/tools/mercado";
import {
  calcularPosicao,
  combinarComClima,
  combinarSinalVenda,
  serieUnica,
  sinalDaCurvaFuturos,
  sinalDaPosicao,
  type PontoPreco,
} from "@/lib/sinalVenda";

export type ResultadoSinalVenda = {
  disponivel: boolean;
  tone?: string;
  texto?: string;
};

export async function buscarSinalVenda(
  supabase: SupabaseClient,
  args: { produto: string; uf: string },
): Promise<ResultadoSinalVenda> {
  const { produto, uf } = args;
  const desde = new Date();
  desde.setDate(desde.getDate() - 90);

  // Sem filtro de `regiao` aqui de propósito: em estados onde a fonte só
  // publica preço por praça (ex: MG, sem número único pro estado inteiro —
  // ver comentário em prompt.ts), um filtro `regiao = ''` zerava a série
  // inteira e o sinal de venda ficava sempre "indisponível" mesmo com preço
  // real no banco — bug real, achado 2026-09-10. `serieUnica` já lida bem
  // com múltiplas praças no mesmo dia (mesmo produto, linhas extras na série).
  const { data: rows } = await supabase
    .from("precos")
    .select("preco, data_referencia, produto")
    .ilike("produto", `%${produto}%`)
    .eq("uf", uf)
    .gte("data_referencia", desde.toISOString().slice(0, 10))
    .order("data_referencia", { ascending: true })
    .returns<PontoPreco[]>();

  const serie = serieUnica(rows ?? []);
  const posicao = calcularPosicao(serie);

  const codigo = CULTURA_PARA_B3[normalizarCultura(produto)]?.[0];
  let futuros: { mesAnoVencimento: string; preco: number }[] | null = null;
  // Contrato de vencimento mais próximo do pregão mais recente, guardado
  // separado de `futuros` (que só serve pra classificar alta/baixa/neutro)
  // pra citar o número real na resposta — achado 2026-10-06: o texto de
  // combinarSinalVenda é só frase fixa de categoria, nunca o preço de
  // verdade, e é exatamente isso que fica vago pro produtor.
  let contratoMaisProximo: {
    nomeProduto: string;
    mesAnoVencimento: string;
    preco: number;
    moeda: string;
    unidade: string;
  } | null = null;
  if (codigo) {
    const inicioMesAtual = new Date();
    inicioMesAtual.setDate(1);
    const { data: b3rows } = await supabase
      .from("b3_futuros")
      .select("nome_produto, mes_ano_vencimento, preco_ajuste_atual, moeda, unidade, data_pregao")
      .eq("produto", codigo)
      .gte("mes_ano_vencimento", inicioMesAtual.toISOString().slice(0, 10))
      .order("data_pregao", { ascending: false })
      .order("mes_ano_vencimento", { ascending: true })
      .limit(10)
      .returns<
        {
          nome_produto: string;
          mes_ano_vencimento: string;
          preco_ajuste_atual: number;
          moeda: string;
          unidade: string;
          data_pregao: string;
        }[]
      >();
    const rowsB3 = b3rows ?? [];
    const pregaoMaisRecente = rowsB3[0]?.data_pregao;
    const doDiaCerto = rowsB3.filter((r) => r.data_pregao === pregaoMaisRecente);
    futuros = doDiaCerto
      .slice(0, 3)
      .map((r) => ({ mesAnoVencimento: r.mes_ano_vencimento, preco: r.preco_ajuste_atual }));
    const primeiro = doDiaCerto[0];
    if (primeiro) {
      contratoMaisProximo = {
        nomeProduto: primeiro.nome_produto,
        mesAnoVencimento: primeiro.mes_ano_vencimento,
        preco: primeiro.preco_ajuste_atual,
        moeda: primeiro.moeda,
        unidade: primeiro.unidade,
      };
    }
  }

  let diasDeChuva: number | null = null;
  const previsao = await buscarPrevisao(uf);
  if (previsao) {
    diasDeChuva = previsao.chuvaPct.filter((p) => p >= 60).length;
  }

  const sinal = combinarComClima(
    combinarSinalVenda(sinalDaPosicao(posicao), futuros ? sinalDaCurvaFuturos(futuros) : null),
    diasDeChuva,
  );

  if (!sinal) return { disponivel: false };

  let texto = sinal.texto;
  if (contratoMaisProximo) {
    const casas = contratoMaisProximo.moeda === "USD" && contratoMaisProximo.preco < 100 ? 4 : 2;
    const precoFormatado = contratoMaisProximo.preco.toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
    const mesAno = new Date(`${contratoMaisProximo.mesAnoVencimento}T00:00:00`).toLocaleDateString(
      "pt-BR",
      { month: "short", year: "2-digit" },
    );
    texto = `${texto} No mercado futuro, o contrato de ${contratoMaisProximo.nomeProduto} com vencimento em ${mesAno} está cotado a ${precoFormatado} ${contratoMaisProximo.unidade} (${rotuloFonte(codigo!)}).`;
  }

  return { disponivel: true, tone: sinal.tone, texto };
}
