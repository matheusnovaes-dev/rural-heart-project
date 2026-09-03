import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarPrevisao } from "@/lib/clima";
import { CULTURA_PARA_B3 } from "@/config/b3";
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

  const { data: rows } = await supabase
    .from("precos")
    .select("preco, data_referencia, produto")
    .ilike("produto", `%${produto}%`)
    .eq("uf", uf)
    .eq("regiao", "")
    .gte("data_referencia", desde.toISOString().slice(0, 10))
    .order("data_referencia", { ascending: true })
    .returns<PontoPreco[]>();

  const serie = serieUnica(rows ?? []);
  const posicao = calcularPosicao(serie);

  const codigo = CULTURA_PARA_B3[produto.toLowerCase()]?.[0];
  let futuros: { mesAnoVencimento: string; preco: number }[] | null = null;
  if (codigo) {
    const inicioMesAtual = new Date();
    inicioMesAtual.setDate(1);
    const { data: b3rows } = await supabase
      .from("b3_futuros")
      .select("mes_ano_vencimento, preco_ajuste_atual, data_pregao")
      .eq("produto", codigo)
      .gte("mes_ano_vencimento", inicioMesAtual.toISOString().slice(0, 10))
      .order("data_pregao", { ascending: false })
      .order("mes_ano_vencimento", { ascending: true })
      .limit(10)
      .returns<{ mes_ano_vencimento: string; preco_ajuste_atual: number; data_pregao: string }[]>();
    const rowsB3 = b3rows ?? [];
    const pregaoMaisRecente = rowsB3[0]?.data_pregao;
    const doDiaCerto = rowsB3.filter((r) => r.data_pregao === pregaoMaisRecente);
    futuros = doDiaCerto
      .slice(0, 3)
      .map((r) => ({ mesAnoVencimento: r.mes_ano_vencimento, preco: r.preco_ajuste_atual }));
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
  return { disponivel: true, tone: sinal.tone, texto: sinal.texto };
}
