import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ehBoi, normalizarCultura } from "@/config/culturas";
import { supabase } from "@/lib/supabase";
import { buscarBenchmarkRegional, type BenchmarkRegional } from "@/lib/referenciaMercado";
import type { Produtor } from "@/lib/auth";

/**
 * "Como o meu estado tá vendendo em relação aos outros" — gatilho de
 * retenção (pedido do Matheus 2026-10-11: ninguém quer ser o que vende
 * pior que o vizinho). Diferente do ReferenciaMercadoCard (que só aparece
 * quando o estado não tem dado recente), este aparece sempre que o estado
 * TEM preço — é a comparação, não o substituto.
 */
export function BenchmarkRegionalCard({
  produtor,
  precoUf,
}: {
  produtor: Produtor;
  /** Preço mais recente do estado do produtor (null se não tiver; undefined enquanto carrega). */
  precoUf: number | null | undefined;
}) {
  const cultura = produtor.cultura_principal;
  const uf = produtor.uf;
  const [benchmark, setBenchmark] = useState<BenchmarkRegional | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase || !cultura || !uf || precoUf === undefined) return;
    let ativo = true;
    buscarBenchmarkRegional(supabase, { cultura, uf, precoUf })
      .then((r) => ativo && setBenchmark(r))
      .catch(() => ativo && setBenchmark(null));
    return () => {
      ativo = false;
    };
  }, [cultura, uf, precoUf]);

  if (!cultura || !uf || benchmark === null) return null;
  const nomeCultura = ehBoi(cultura) ? "boi gordo" : normalizarCultura(cultura);
  const nomeCulturaCapitalizado = nomeCultura[0]!.toUpperCase() + nomeCultura.slice(1);
  const Icone =
    benchmark && benchmark.percentualVsMedia > 0.5
      ? TrendingUp
      : benchmark && benchmark.percentualVsMedia < -0.5
        ? TrendingDown
        : Minus;

  return (
    <Card className="border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="border-b border-border/70 px-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icone className="size-4" />
          </span>
          {nomeCulturaCapitalizado}: você vs. outros estados
        </CardTitle>
        <CardDescription>Como o preço do seu estado se compara aos vizinhos.</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {benchmark === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <p className="text-sm text-foreground">{benchmark.frase}</p>
        )}
      </CardContent>
    </Card>
  );
}
