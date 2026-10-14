import type { SupabaseClient } from "@supabase/supabase-js";

import { padraoIlikePorPalavra, normalizarCultura } from "@/config/culturas";
import { buscarPreco } from "@/lib/bot/tools/preco";
import type { ReferenciaDeMercado } from "@/lib/bot/propostas/tipos";
import { ehPracaDePorto } from "@/lib/paridade";
import { produtoPrincipal } from "@/lib/precos";
import { serieUnica, type PontoPreco } from "@/lib/sinalVenda";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PALAVRAS_SEM_VALOR = new Set([
  "armazem",
  "fazenda",
  "cooperativa",
  "entrega",
  "retirada",
  "unidade",
  "filial",
  "porto",
  "terminal",
]);

/** Praça que casa com o local de entrega escrito na proposta ("armazém Bunge em Rondonópolis (MT)"). */
export function pracaDoLocal(local: string | null | undefined, pracas: string[]): string | null {
  if (!local) return null;
  const palavras = semAcento(local)
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 5 && !PALAVRAS_SEM_VALOR.has(w));
  for (const praca of pracas) {
    const p = semAcento(praca);
    if (palavras.some((w) => p.includes(w))) return praca;
  }
  return null;
}

function lerUnidade(unidade: string | null | undefined): {
  unidade: ReferenciaDeMercado["unidade"];
  kg: number | null;
} {
  const u = (unidade ?? "").toLowerCase();
  if (u.includes("@") || u.includes("arroba")) return { unidade: "arroba", kg: null };
  if (/\bl\b|litro/.test(u)) return { unidade: "litro", kg: null };
  // "kg" sozinho (suíno vivo, frutas) é preço por quilo, não por saca de 60 kg.
  if (/^\s*kg(\s+vivo)?\s*$/.test(u)) return { unidade: "kg", kg: 1 };
  const m = u.match(/(\d+)\s*kg/);
  // 15 kg é a arroba do boi (algumas fontes escrevem "15 kg" em vez de "@").
  if (m && Number(m[1]) === 15) return { unidade: "arroba", kg: null };
  return { unidade: "saca", kg: m ? Number(m[1]) : 60 };
}

async function faixaDos90Dias(
  supabase: SupabaseClient,
  args: {
    produto: string;
    uf: string;
    origem: ReferenciaDeMercado["origem"];
    praca: string | null;
  },
): Promise<ReferenciaDeMercado["faixa90d"]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - 90);
  const principal = produtoPrincipal(args.produto);
  let q = supabase
    .from("precos")
    .select("produto, preco, regiao, data_referencia, unidade")
    .ilike("produto", padraoIlikePorPalavra(args.produto))
    .eq("uf", args.uf)
    .gte("data_referencia", desde.toISOString().slice(0, 10));
  if (principal) q = q.eq("produto", principal);
  q = args.origem === "estado" ? q.eq("regiao", "") : q.neq("regiao", "");
  if (args.praca) q = q.eq("regiao", args.praca);
  const { data } = await q.order("data_referencia", { ascending: true }).limit(3000).returns<
    {
      produto: string;
      preco: number;
      regiao: string;
      data_referencia: string;
      unidade: string | null;
    }[]
  >();
  const linhas = (data ?? []).filter(
    (r) => args.origem === "estado" || args.praca || !ehPracaDePorto(r.regiao),
  );
  const pontos: PontoPreco[] = serieUnica(
    linhas.map((r) => ({ preco: r.preco, data_referencia: r.data_referencia, produto: r.produto })),
  );
  if (pontos.length < 8) return null;
  const precos = pontos.map((p) => p.preco).filter(Number.isFinite);
  return { min: Math.min(...precos), max: Math.max(...precos), pontos: precos.length };
}

export type ResultadoReferencia =
  { ok: true; ref: ReferenciaDeMercado } | { ok: false; motivo: "sem_referencia" };

/**
 * Preço de mercado do dia pra comparar a proposta, montado como o painel e o
 * bot já fazem: preço único do estado quando está em dia, senão a média das
 * praças (ou a praça da própria proposta, se o local de entrega casa com uma).
 */
export async function obterReferencia(
  supabase: SupabaseClient,
  args: { produto: string; uf: string; localEntrega?: string | null },
): Promise<ResultadoReferencia> {
  const produto = normalizarCultura(args.produto);
  const r = await buscarPreco(supabase, { produto, uf: args.uf, incluir_frete: false });
  if (!r.encontrado || !r.precos || r.precos.length === 0) {
    // Sem preço recente no estado: usa os outros estados (a mesma referência que o painel
    // mostra), marcada como aproximação. Com menos de 2 estados não há referência confiável.
    const outras = r.referencia_mercado?.outras_ufs ?? [];
    if (outras.length >= 2) {
      const { unidade: un, kg: kgOutras } = lerUnidade(outras[0]!.unidade);
      const mesmas = outras.filter((o) => lerUnidade(o.unidade).unidade === un);
      if (mesmas.length >= 2) {
        const valores = mesmas.map((o) => o.preco);
        const media = valores.reduce((a, b) => a + b, 0) / valores.length;
        return {
          ok: true,
          ref: {
            preco: Math.round(media * 100) / 100,
            kgPorSaca: kgOutras,
            unidade: un,
            data: mesmas
              .map((o) => o.data_referencia)
              .sort()
              .at(-1)!,
            fonte: [...new Set(mesmas.map((o) => o.fonte))].join(" e "),
            rotulo: `média de ${mesmas.map((o) => o.uf).join(", ")} (${args.uf} não tem preço recente)`,
            min: Math.min(...valores),
            max: Math.max(...valores),
            origem: "media_das_pracas",
            faixa90d: null,
            aproximada: true,
            pracas: mesmas.map((o) => ({ regiao: o.uf, preco: o.preco })),
          },
        };
      }
    }
    return { ok: false, motivo: "sem_referencia" };
  }

  const linhas = r.precos;
  const { unidade, kg } = lerUnidade(linhas[0]!.unidade);
  const mesmaUnidade = linhas.filter((l) => lerUnidade(l.unidade).unidade === unidade);
  const base = mesmaUnidade.length > 0 ? mesmaUnidade : linhas;
  const data = base
    .map((l) => l.data_referencia)
    .sort()
    .at(-1)!;
  const fonte = base[0]!.fonte;

  let preco: number;
  let rotulo: string;
  let origem: ReferenciaDeMercado["origem"];
  let min: number | null = null;
  let max: number | null = null;
  let praca: string | null = null;
  let pracasUsadas: { regiao: string; preco: number }[] | undefined;

  if (r.origem_preco === "regional" && base.length > 1) {
    praca = pracaDoLocal(
      args.localEntrega,
      base.map((l) => l.regiao),
    );
    const doLocal = praca ? base.find((l) => l.regiao === praca) : undefined;
    if (doLocal) {
      preco = doLocal.preco;
      rotulo = `praça de ${doLocal.regiao} (${args.uf})`;
      origem = "praca";
    } else {
      const valores = base.map((l) => l.preco);
      preco = r.preco_medio_regioes ?? valores.reduce((a, b) => a + b, 0) / valores.length;
      min = Math.min(...valores);
      max = Math.max(...valores);
      pracasUsadas = base.map((l) => ({ regiao: l.regiao, preco: l.preco }));
      rotulo = `média das praças de ${args.uf}`;
      origem = "media_das_pracas";
    }
  } else if (r.origem_preco === "regional") {
    preco = base[0]!.preco;
    rotulo = `praça de ${base[0]!.regiao} (${args.uf})`;
    origem = "praca";
    praca = base[0]!.regiao;
  } else {
    preco = base[0]!.preco;
    rotulo = `preço do estado de ${args.uf}`;
    origem = "estado";
  }

  const faixa90d = await faixaDos90Dias(supabase, {
    produto,
    uf: args.uf,
    origem: origem === "estado" ? "estado" : origem,
    praca: origem === "praca" ? praca : null,
  }).catch(() => null);

  return {
    ok: true,
    ref: {
      preco: Math.round(preco * 100) / 100,
      kgPorSaca: kg,
      unidade,
      data,
      fonte,
      rotulo,
      min,
      max,
      origem,
      faixa90d,
      ...(pracasUsadas ? { pracas: pracasUsadas } : {}),
    },
  };
}
