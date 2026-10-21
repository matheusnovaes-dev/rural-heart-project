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

    const [dolar, futuroSoja, serieSoja, comparativoSoja, plantio] = await Promise.all([
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

      // Soja em Sorriso/Lucas do Rio Verde (MT), BBM, até 90 dias de pregões: um número por dia, sem linhas cruas.
      (async (): Promise<ExemplosDoDia["serieSoja"]> => {
        const desde = new Date();
        desde.setDate(desde.getDate() - 90);
        const { data } = await supabase
          .from("precos")
          .select("data_referencia, preco")
          .eq("produto", "SOJA EM GRÃOS (60 kg)")
          .eq("uf", "MT")
          .eq("regiao", "Sorriso / Lucas do Rio Verde")
          .gte("data_referencia", desde.toISOString().slice(0, 10))
          .order("data_referencia", { ascending: true })
          .returns<{ data_referencia: string; preco: number }[]>();
        const pontos = (data ?? []).map((r) => ({
          data: r.data_referencia,
          preco: Number(r.preco),
        }));
        return pontos.length >= 10 ? { praca: "Sorriso e Lucas do Rio Verde (MT)", pontos } : null;
      })().catch(() => null),

      // Último preço e variação semanal de 3 praças de soja (BBM). Só valores agregados por praça.
      (async (): Promise<ExemplosDoDia["comparativoSoja"]> => {
        const PRACAS = [
          {
            uf: "MT",
            regiao: "Sorriso / Lucas do Rio Verde",
            rotulo: "Sorriso e Lucas do Rio Verde",
          },
          { uf: "GO", regiao: "Rio Verde", rotulo: "Rio Verde" },
          { uf: "PR", regiao: "Cascavel", rotulo: "Cascavel" },
        ];
        const desde = new Date();
        desde.setDate(desde.getDate() - 14);
        const { data } = await supabase
          .from("precos")
          .select("uf, regiao, data_referencia, preco")
          .eq("produto", "SOJA EM GRÃOS (60 kg)")
          .in(
            "regiao",
            PRACAS.map((p) => p.regiao),
          )
          .gte("data_referencia", desde.toISOString().slice(0, 10))
          .order("data_referencia", { ascending: true })
          .returns<{ uf: string; regiao: string; data_referencia: string; preco: number }[]>();
        const saida: NonNullable<ExemplosDoDia["comparativoSoja"]> = [];
        for (const p of PRACAS) {
          const linhas = (data ?? []).filter((l) => l.uf === p.uf && l.regiao === p.regiao);
          const ultima = linhas.at(-1);
          if (!ultima) return null;
          // contra o último dia com pelo menos 5 dias de distância, ou nada se a série for curta
          const corte = new Date(`${ultima.data_referencia}T12:00:00Z`).getTime() - 5 * 86_400_000;
          const base = [...linhas]
            .reverse()
            .find((l) => new Date(`${l.data_referencia}T12:00:00Z`).getTime() <= corte);
          saida.push({
            uf: p.uf,
            praca: p.rotulo,
            preco: Number(ultima.preco),
            data: ultima.data_referencia,
            variacaoSemana: base
              ? ((Number(ultima.preco) - Number(base.preco)) / Number(base.preco)) * 100
              : null,
          });
        }
        return saida;
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

    const dados: ExemplosDoDia = { dolar, futuroSoja, serieSoja, comparativoSoja, plantio };
    // Se as três fontes falharem juntas (ex: banco fora do ar), não congela o
    // vazio por 30 minutos: a próxima visita tenta de novo.
    if (dolar || futuroSoja || serieSoja || comparativoSoja || plantio)
      cache = { em: Date.now(), dados };
    return dados;
  },
);
