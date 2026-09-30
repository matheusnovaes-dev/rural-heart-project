import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FlaskConical, Lock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradeButton } from "@/components/dashboard/UpgradeButton";
import { supabase } from "@/lib/supabase";
import { temAcessoPrata, useAssinatura } from "@/lib/planos";
import type { Produtor } from "@/lib/auth";

type LinhaInsumo = {
  uf: string;
  ano: number;
  mes: number;
  produto: string;
  preco: number;
  unidade_medida: string;
};

type GrupoInsumo = {
  subgrupo: string;
  rotulo: string;
  ano: number;
  mes: number;
  unidade_medida: string;
  usouOutraUf: boolean;
  produtos: { produto: string; preco: number }[];
};

// As 4 categorias mais perguntadas (mesmo critério da tool do bot) — a
// tabela inteira tem 9 subgrupos, mas o card fica ilegível com todos.
const SUBGRUPOS_CARD: { subgrupo: string; rotulo: string }[] = [
  { subgrupo: "HERBICIDA", rotulo: "Herbicida" },
  { subgrupo: "FUNGICIDA", rotulo: "Fungicida" },
  { subgrupo: "INSETICIDA", rotulo: "Inseticida" },
  { subgrupo: "QUÍMICO", rotulo: "Fertilizante" },
];

const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const PRODUTOS_VISIVEIS_SEM_EXPANDIR = 6;

const formatarPreco = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * Preço de defensivo/fertilizante por categoria, na UF do produtor — cada
 * produto comercial (marca) com o preço dele, não mais uma faixa
 * mínimo-máximo (pedido do Matheus 2026-09-30: "mostra as marcas
 * disponíveis e seus preços").
 *
 * Achado ao gravar esse pedido: a publicação NÃO sai na mesma data pra
 * todo UF — bug real conferido com SQL, ex. fungicida em GO tinha mar/2026
 * como período mais recente enquanto outros estados já estavam em ago/2026
 * pro mesmo subgrupo. A lógica antiga pegava o período mais recente ENTRE
 * TODOS os UFs primeiro e só depois filtrava pela UF do produtor — se a UF
 * dele estivesse atrasada nessa categoria, ele via preço de produto de
 * OUTRO estado sem saber. Corrigido: acha o período mais recente DENTRO da
 * própria UF primeiro; só cai pra "mais recente entre todos" quando a UF
 * dele não tem nenhum dado pra essa categoria.
 */
export function PrecoInsumosCard({ produtor }: { produtor: Produtor }) {
  const { plano, assinaturaId, asaasSubscriptionId, loading: loadingPlano } = useAssinatura();
  const [grupos, setGrupos] = useState<GrupoInsumo[] | null | undefined>(undefined);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase || !produtor.uf || !temAcessoPrata(plano)) return;
    let ativo = true;

    (async () => {
      const resultados = await Promise.all(
        SUBGRUPOS_CARD.map(async ({ subgrupo, rotulo }) => {
          const { data } = await supabase!
            .from("precos_insumos_conab")
            .select("uf, ano, mes, produto, preco, unidade_medida")
            .eq("subgrupo", subgrupo)
            .order("ano", { ascending: false })
            .order("mes", { ascending: false })
            .limit(500)
            .returns<LinhaInsumo[]>();

          if (!data || data.length === 0) return null;

          const daUf = data.filter((l) => l.uf === produtor.uf);
          const usouOutraUf = daUf.length === 0;
          // data já vem ordenado (ano desc, mes desc) — filtrar preserva a
          // ordem, então o primeiro item de cada lista já é o mais recente
          // DAQUELA lista (da Uf do produtor quando ela tem dado; senão de
          // qualquer UF).
          const base = usouOutraUf ? data : daUf;
          const maisRecente = base[0]!;
          const doPeriodo = base.filter(
            (l) => l.ano === maisRecente.ano && l.mes === maisRecente.mes,
          );

          // Não mistura preço em unidades diferentes (ex: R$/L com R$/T) —
          // fica com a unidade que tiver mais produtos cotados.
          const porUnidade = new Map<string, LinhaInsumo[]>();
          for (const l of doPeriodo) {
            if (!porUnidade.has(l.unidade_medida)) porUnidade.set(l.unidade_medida, []);
            porUnidade.get(l.unidade_medida)!.push(l);
          }
          const [unidade_medida, itens] = [...porUnidade.entries()].sort(
            (a, b) => b[1].length - a[1].length,
          )[0]!;

          const grupo: GrupoInsumo = {
            subgrupo,
            rotulo,
            ano: maisRecente.ano,
            mes: maisRecente.mes,
            unidade_medida,
            usouOutraUf,
            produtos: itens
              .map((i) => ({ produto: i.produto, preco: i.preco }))
              .sort((a, b) => a.preco - b.preco),
          };
          return grupo;
        }),
      );

      if (!ativo) return;
      const encontrados = resultados.filter((g): g is GrupoInsumo => g !== null);
      setGrupos(encontrados.length > 0 ? encontrados : null);
    })();

    return () => {
      ativo = false;
    };
  }, [produtor.uf, plano]);

  if (loadingPlano) return <Skeleton className="h-16 w-full" />;

  if (!temAcessoPrata(plano)) {
    return (
      <Card className="border-border/80 shadow-sm transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="size-5" />
          </span>
          <div className="space-y-1">
            <CardTitle className="font-display text-base">Preço de insumos</CardTitle>
            <CardDescription className="mx-auto max-w-sm">
              Exclusivo do plano Prata. Veja o preço de cada marca de defensivo e fertilizante,
              direto da Conab, pra negociar com número na mão.
            </CardDescription>
          </div>
          <UpgradeButton
            planoAlvo="prata"
            assinaturaId={assinaturaId}
            asaasSubscriptionId={asaasSubscriptionId}
            className="bg-cta text-cta-foreground hover:bg-cta/90"
          />
        </CardContent>
      </Card>
    );
  }

  if (!produtor.uf) return null;
  if (grupos === null) return null;

  function alternarExpandido(subgrupo: string) {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(subgrupo)) {
        novo.delete(subgrupo);
      } else {
        novo.add(subgrupo);
      }
      return novo;
    });
  }

  return (
    <Card className="gap-3 border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="border-b border-border/70 px-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FlaskConical className="size-4" />
          </span>
          Preço de insumos
        </CardTitle>
        <CardDescription>Preço por marca, segundo a Conab.</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {grupos === undefined ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            {grupos.map((g) => {
              const expandido = expandidos.has(g.subgrupo);
              const visiveis = expandido
                ? g.produtos
                : g.produtos.slice(0, PRODUTOS_VISIVEIS_SEM_EXPANDIR);
              const ocultos = g.produtos.length - visiveis.length;
              return (
                <div key={g.subgrupo} className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {g.rotulo}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {MESES_ABREV[g.mes - 1]}/{g.ano}
                      {g.usouOutraUf && ` · sem dado em ${produtor.uf}, outras UFs`}
                    </span>
                  </p>
                  <div className="flex flex-col divide-y divide-border/70 rounded-lg border border-border/70">
                    {visiveis.map((p) => (
                      <div
                        key={p.produto}
                        className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm"
                      >
                        <span className="text-foreground">{p.produto}</span>
                        <span className="whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-primary">
                          R$ {formatarPreco(p.preco)}
                          <span className="ml-0.5 font-sans font-normal text-muted-foreground">
                            /{g.unidade_medida}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {g.produtos.length > PRODUTOS_VISIVEIS_SEM_EXPANDIR && (
                    <button
                      type="button"
                      onClick={() => alternarExpandido(g.subgrupo)}
                      className="flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
                    >
                      {expandido ? (
                        <>
                          Mostrar menos <ChevronUp className="size-3" />
                        </>
                      ) : (
                        <>
                          Mais {ocultos} marca{ocultos === 1 ? "" : "s"}{" "}
                          <ChevronDown className="size-3" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Fonte: Conab, Consulta de Preços de Insumos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
