import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { buscarVariacaoCambio } from "@/lib/bot/tools/mercado";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";

type VariacaoCambio = Awaited<ReturnType<typeof buscarVariacaoCambio>>;

/**
 * Cotação do dólar na home — pedido do Matheus 2026-10-12: "hoje não tem,
 * um lugar que mostra, pro cara não ter que ir no Google". O painel já
 * tinha câmbio dentro de ContextoMercado (só na página de Preços, junto de
 * WASDE/diesel/IBGE) — este é um card pequeno e dedicado pra home, sem
 * precisar entrar em outra página.
 */
export function DolarCard() {
  const [variacao, setVariacao] = useState<VariacaoCambio | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    let ativo = true;
    buscarVariacaoCambio(supabase)
      .then((v) => ativo && setVariacao(v))
      .catch(() => ativo && setVariacao(null));
    return () => {
      ativo = false;
    };
  }, []);

  const Icone =
    variacao && variacao.variacao > 0.1
      ? TrendingUp
      : variacao && variacao.variacao < -0.1
        ? TrendingDown
        : Minus;

  return (
    <Card className="gap-3 border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="border-b border-border/70 px-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <IconesSafralume.dolar className="size-8" />
          Dólar hoje
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {variacao === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : variacao === null ? (
          <p className="text-sm text-muted-foreground">Cotação indisponível no momento.</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                R$ {variacao.atual.toFixed(2).replace(".", ",")}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icone className="size-3.5" />
                {Math.abs(variacao.variacao) < 0.1
                  ? "estável desde o último pregão"
                  : `${variacao.variacao > 0 ? "+" : ""}${variacao.variacao.toFixed(1).replace(".", ",")}% desde o último pregão`}
              </p>
            </div>
            <Link
              to="/dashboard/alertas"
              search={{ abrir: "cambio" }}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Criar alerta
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
