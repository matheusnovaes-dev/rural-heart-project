import { useCallback, useEffect, useMemo, useState } from "react";

import {
  COLUNAS_REGISTRO,
  calcularCustoEMargem,
  intervaloDoPeriodo,
  mesmaCultura,
  resumir,
  somarGastosDaCultura,
  type RegistroFazenda,
  type ResultadoCusto,
} from "@/lib/fazenda.shared";
import { dadosDeMercadoDaCultura, type DadosDeMercadoDaCultura } from "@/lib/fazenda.server";
import { supabase } from "@/lib/supabase";

export type Area = {
  id: string;
  cultura: string;
  area_ha: number;
  produtividade_sc_ha: number | null;
};

export type ContaDaCultura = {
  area: Area;
  soma: ReturnType<typeof somarGastosDaCultura>;
  conta: ResultadoCusto;
  mercado: DadosDeMercadoDaCultura | null;
};

/** Áreas, gastos da safra e preço de hoje, e a conta de custo por saca de cada cultura (painel e relatório). */
export function useCustosDaSafra(produtor: { id: string; uf: string | null }, versao = 0) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [registros, setRegistros] = useState<RegistroFazenda[]>([]);
  const [mercado, setMercado] = useState<Record<string, DadosDeMercadoDaCultura>>({});
  const [carregando, setCarregando] = useState(true);
  const { desde, ate, rotulo } = intervaloDoPeriodo("safra");

  const carregar = useCallback(async () => {
    if (!supabase) return;
    const [a, r] = await Promise.all([
      supabase
        .from("fazenda_areas")
        .select("id, cultura, area_ha, produtividade_sc_ha")
        .eq("produtor_id", produtor.id)
        .order("area_ha", { ascending: false }),
      supabase
        .from("fazenda_registros")
        .select(COLUNAS_REGISTRO)
        .eq("produtor_id", produtor.id)
        .is("apagado_em", null)
        .eq("situacao", "realizado")
        .in("tipo", ["gasto", "colheita"])
        .gte("ocorrido_em", desde)
        .lte("ocorrido_em", ate)
        .limit(3000),
    ]);
    setAreas(
      ((a.data ?? []) as Area[]).map((x) => ({
        ...x,
        area_ha: Number(x.area_ha),
        produtividade_sc_ha: x.produtividade_sc_ha === null ? null : Number(x.produtividade_sc_ha),
      })),
    );
    setRegistros((r.data ?? []) as unknown as RegistroFazenda[]);
    setCarregando(false);
  }, [produtor.id, desde, ate]);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  useEffect(() => {
    let cancelado = false;
    for (const a of areas) {
      const chave = a.cultura.toLowerCase();
      if (mercado[chave]) continue;
      dadosDeMercadoDaCultura({ data: { cultura: a.cultura, uf: produtor.uf } })
        .then((d) => {
          if (!cancelado) setMercado((m) => ({ ...m, [chave]: d }));
        })
        .catch(() => {
          if (!cancelado) setMercado((m) => ({ ...m, [chave]: { preco: null, conab: null } }));
        });
    }
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, produtor.uf]);

  const colhido = useMemo(() => resumir(registros).colhidoPorCultura, [registros]);

  const contas: ContaDaCultura[] = useMemo(
    () =>
      areas.map((a) => {
        const soma = somarGastosDaCultura(registros, a.cultura, areas.length);
        const col = colhido.find(
          (c) => mesmaCultura(c.cultura, a.cultura) && /saca/i.test(c.unidade ?? ""),
        );
        const m = mercado[a.cultura.toLowerCase()] ?? null;
        const conta = calcularCustoEMargem({
          gastos: soma.daCultura + soma.semCulturaIncluidos,
          area_ha: a.area_ha,
          produtividade_sc_ha: a.produtividade_sc_ha,
          produtividadeConab: m?.conab?.scHa ?? null,
          sacasColhidas: col?.quantidade ?? null,
          precoHoje: m?.preco?.preco ?? null,
        });
        return { area: a, soma, conta, mercado: m };
      }),
    [areas, registros, colhido, mercado],
  );

  return { areas, contas, carregando, recarregar: carregar, rotulo };
}
