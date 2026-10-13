import { createServerFn } from "@tanstack/react-start";

import { supabaseServiceRole } from "@/lib/supabase.server";
import { consultarJanelaPlantio } from "@/lib/plantio";
import type { ExemplosDoDia } from "@/lib/exemplosLanding";

// Cache por isolate: a landing recebe visitas contínuas e o dado muda 1x/dia.
// Sem isso, cada visitante dispararia 3 consultas ao banco só pra montar um
// exemplo ilustrativo.
const TTL_MS = 30 * 60 * 1000;
let cache: { em: number; dados: ExemplosDoDia } | null = null;

/**
 * Dado REAL do dia pros exemplos da landing (dólar, futuros de soja na B3 e
 * janela de plantio em Sorriso/MT). Cada pedaço falha de forma isolada: se uma
 * fonte estiver fora, só aquele exemplo cai pro fallback relativo à data.
 * Roda com service role porque as tabelas só são legíveis por usuário
 * autenticado, e devolve apenas valores já agregados, nunca linhas cruas.
 */
export const exemplosDoDiaLanding = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExemplosDoDia> => {
    if (cache && Date.now() - cache.em < TTL_MS) return cache.dados;

    const supabase = supabaseServiceRole();

    const [dolar, futuroSoja, plantio] = await Promise.all([
      (async (): Promise<ExemplosDoDia["dolar"]> => {
        const { data } = await supabase
          .from("cambio")
          .select("data, cotacao_venda")
          .order("data", { ascending: false })
          .limit(1)
          .maybeSingle<{ data: string; cotacao_venda: number }>();
        return data ? { valor: data.cotacao_venda, data: data.data } : null;
      })().catch(() => null),

      (async (): Promise<ExemplosDoDia["futuroSoja"]> => {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        const { data } = await supabase
          .from("b3_futuros")
          .select("mes_ano_vencimento, preco_ajuste_atual, unidade, data_pregao")
          .eq("produto", "SJC")
          .gte("mes_ano_vencimento", inicioMes.toISOString().slice(0, 10))
          .order("data_pregao", { ascending: false })
          .order("mes_ano_vencimento", { ascending: true })
          .limit(20)
          .returns<
            {
              mes_ano_vencimento: string;
              preco_ajuste_atual: number;
              unidade: string;
              data_pregao: string;
            }[]
          >();
        const rows = data ?? [];
        const ultimoPregao = rows[0]?.data_pregao;
        const doDia = rows.filter((r) => r.data_pregao === ultimoPregao).slice(0, 3);
        if (doDia.length === 0) return null;
        return {
          unidade: doDia[0]!.unidade,
          contratos: doDia.map((r) => ({
            vencimento: r.mes_ano_vencimento,
            valor: r.preco_ajuste_atual,
          })),
        };
      })().catch(() => null),

      (async (): Promise<ExemplosDoDia["plantio"]> => {
        const r = await consultarJanelaPlantio(supabase, {
          produto: "soja",
          uf: "MT",
          municipio: "Sorriso",
        });
        if (!r.disponivel) return null;
        return {
          periodoAtual: r.periodo_atual,
          riscoHoje: r.risco_climatico_hoje_pct,
          proximas: r.proximas_janelas.slice(0, 5).map((j) => ({
            periodo: j.periodo,
            risco: j.risco_climatico_pct,
          })),
        };
      })().catch(() => null),
    ]);

    const dados: ExemplosDoDia = { dolar, futuroSoja, plantio };
    // Se as três fontes falharem juntas (ex: banco fora do ar), não congela o
    // vazio por 30 minutos: a próxima visita tenta de novo.
    if (dolar || futuroSoja || plantio) cache = { em: Date.now(), dados };
    return dados;
  },
);
