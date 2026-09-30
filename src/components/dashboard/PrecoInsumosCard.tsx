import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import type { Produtor } from "@/lib/auth";

type LinhaInsumo = {
  uf: string;
  ano: number;
  mes: number;
  preco: number;
  unidade_medida: string;
};

type GrupoInsumo = {
  subgrupo: string;
  rotulo: string;
  ano: number;
  mes: number;
  preco_minimo: number;
  preco_maximo: number;
  unidade_medida: string;
  quantidade_produtos: number;
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

const formatarPreco = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * Preço de defensivo/fertilizante por categoria, na UF do produtor —
 * mesma fonte e mesma lógica de faixa (mínimo-máximo entre produtos
 * comerciais diferentes) da tool buscar_preco_insumo do bot, achada
 * 2026-09-30. Cada linha da tabela é por produto/marca específica, então
 * o card não cita UM preço, sempre uma faixa — citar um número único aqui
 * seria inventar uma média que a fonte não dá.
 */
export function PrecoInsumosCard({ produtor }: { produtor: Produtor }) {
  const [grupos, setGrupos] = useState<GrupoInsumo[] | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase || !produtor.uf) return;
    let ativo = true;

    (async () => {
      const resultados = await Promise.all(
        SUBGRUPOS_CARD.map(async ({ subgrupo, rotulo }) => {
          const { data } = await supabase!
            .from("precos_insumos_conab")
            .select("uf, ano, mes, preco, unidade_medida")
            .eq("subgrupo", subgrupo)
            .order("ano", { ascending: false })
            .order("mes", { ascending: false })
            .limit(500)
            .returns<LinhaInsumo[]>();

          if (!data || data.length === 0) return null;

          const maisRecente = data[0]!;
          const doPeriodo = data.filter(
            (l) => l.ano === maisRecente.ano && l.mes === maisRecente.mes,
          );
          const daUf = doPeriodo.filter((l) => l.uf === produtor.uf);
          const linhas = daUf.length > 0 ? daUf : doPeriodo;

          // Não mistura faixa de preço em unidades diferentes (ex: R$/L com
          // R$/T) — fica com a unidade que tiver mais produtos cotados.
          const porUnidade = new Map<string, LinhaInsumo[]>();
          for (const l of linhas) {
            if (!porUnidade.has(l.unidade_medida)) porUnidade.set(l.unidade_medida, []);
            porUnidade.get(l.unidade_medida)!.push(l);
          }
          const [unidade_medida, itens] = [...porUnidade.entries()].sort(
            (a, b) => b[1].length - a[1].length,
          )[0]!;
          const precos = itens.map((i) => i.preco);

          const grupo: GrupoInsumo = {
            subgrupo,
            rotulo,
            ano: maisRecente.ano,
            mes: maisRecente.mes,
            preco_minimo: Math.min(...precos),
            preco_maximo: Math.max(...precos),
            unidade_medida,
            quantidade_produtos: itens.length,
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
  }, [produtor.uf]);

  if (!produtor.uf) return null;
  if (grupos === null) return null;

  return (
    <Card className="gap-3 border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="border-b border-border/70 px-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FlaskConical className="size-4" />
          </span>
          Preço de insumos
        </CardTitle>
        <CardDescription>Faixa de preço por marca, segundo a Conab.</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {grupos === undefined ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex flex-col gap-3">
            {grupos.map((g) => (
              <div key={g.subgrupo} className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{g.rotulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {MESES_ABREV[g.mes - 1]}/{g.ano} · {g.quantidade_produtos} produto
                    {g.quantidade_produtos === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="whitespace-nowrap text-right text-sm font-semibold text-primary">
                  R$ {formatarPreco(g.preco_minimo)} – {formatarPreco(g.preco_maximo)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    /{g.unidade_medida}
                  </span>
                </span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Fonte: Conab, Consulta de Preços de Insumos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
