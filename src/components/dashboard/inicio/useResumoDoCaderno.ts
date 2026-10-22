import { useEffect, useMemo, useState } from "react";

import { useCustosDaSafra } from "@/components/fazenda/useCustosDaSafra";
import {
  COLUNAS_REGISTRO,
  calcularEstoque,
  margemPctNoPreco,
  mesmaCultura,
  resumirPendencias,
  type RegistroFazenda,
  type ResumoPendencias,
} from "@/lib/fazenda.shared";
import { temAcessoPrata, type Plano } from "@/lib/planos.shared";
import { supabase } from "@/lib/supabase";

export type MargemDoPainel = {
  cultura: string;
  pct: number | null;
  custoPorSaca: number;
  precoHoje: number | null;
  metaPct: number | null;
};

export type EstoqueDoPainel = { cultura: string; sacas: number; precoHoje: number | null };

export type ResumoDoCaderno = {
  carregando: boolean;
  plano: Plano | null;
  prata: boolean;
  temArea: boolean;
  margem: MargemDoPainel | null;
  estoque: EstoqueDoPainel | null;
  pendencias: ResumoPendencias | null;
};

/**
 * O que o Caderno da fazenda tem a dizer na tela Início: margem estimada, estoque e o que vence. Reaproveita as mesmas contas
 * do painel da Fazenda (nenhum número novo, nenhuma regra duplicada) e busca à parte só o plano e as pendências.
 */
export function useResumoDoCaderno(
  produtor: {
    id: string;
    uf: string | null;
    cultura_principal: string | null;
  },
  /** Preço da cultura principal que a tela já tem (série do estado ou média das praças), para quando o estado não tem preço único. */
  precoReferencia: number | null = null,
): ResumoDoCaderno {
  const { areas, contas, registros, mercado, carregando } = useCustosDaSafra({
    id: produtor.id,
    uf: produtor.uf,
  });
  const [plano, setPlano] = useState<Plano | null>(null);
  const [pendentes, setPendentes] = useState<RegistroFazenda[] | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    supabase
      .from("assinaturas")
      .select("plano")
      .eq("produtor_id", produtor.id)
      .maybeSingle()
      .then(({ data }) => vivo && setPlano((data?.plano as Plano | undefined) ?? null));
    supabase
      .from("fazenda_registros")
      .select(COLUNAS_REGISTRO)
      .eq("produtor_id", produtor.id)
      .eq("situacao", "pendente")
      .is("apagado_em", null)
      .order("vence_em", { ascending: true })
      .limit(200)
      .then(({ data }) => vivo && setPendentes((data ?? []) as unknown as RegistroFazenda[]));
    return () => {
      vivo = false;
    };
  }, [produtor.id]);

  return useMemo(() => {
    const cultura = produtor.cultura_principal;
    const principal =
      contas.find((c) => cultura && mesmaCultura(c.area.cultura, cultura)) ?? contas[0] ?? null;
    const ehPrincipal = (c: string) => !!cultura && mesmaCultura(c, cultura);
    const margem: MargemDoPainel | null = (() => {
      if (!principal || principal.conta.custoPorSaca === null) return null;
      const preco =
        principal.mercado?.preco?.preco ??
        (ehPrincipal(principal.area.cultura) ? precoReferencia : null);
      return {
        cultura: principal.area.cultura,
        pct:
          principal.conta.margemPct ??
          (preco != null ? margemPctNoPreco(principal.conta.custoPorSaca, preco) : null),
        custoPorSaca: principal.conta.custoPorSaca,
        precoHoje: preco,
        metaPct: principal.area.margem_alvo_pct,
      };
    })();

    let estoque: EstoqueDoPainel | null = null;
    const candidatas = [
      ...(cultura ? [cultura] : []),
      ...areas.map((a) => a.cultura).filter((c) => !cultura || !mesmaCultura(c, cultura)),
    ];
    for (const c of candidatas) {
      const e = calcularEstoque(registros, c);
      if (e && e.sacas > 0) {
        estoque = {
          cultura: c,
          sacas: e.sacas,
          precoHoje:
            mercado[c.toLowerCase()]?.preco?.preco ?? (ehPrincipal(c) ? precoReferencia : null),
        };
        break;
      }
    }

    return {
      carregando: carregando || pendentes === null,
      plano,
      prata: temAcessoPrata(plano),
      temArea: areas.length > 0,
      margem,
      estoque,
      pendencias: pendentes ? resumirPendencias(pendentes) : null,
    };
  }, [
    areas,
    contas,
    registros,
    mercado,
    carregando,
    pendentes,
    plano,
    produtor.cultura_principal,
    precoReferencia,
  ]);
}
