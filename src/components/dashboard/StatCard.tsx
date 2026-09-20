import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/dashboard/Sparkline";

/**
 * Métrica com número grande, delta opcional e sparkline — padrão de painel
 * tipo Stripe. Substitui os contadores secos que a home da cooperativa tinha.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  variacao,
  sparkline,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  variacao?: number | null;
  sparkline?: number[];
  to?: string;
}) {
  const conteudo = (
    <Card className="group h-full gap-3 border-border/80 py-4 shadow-none hover:-translate-y-0.5 hover:shadow-sm">
      <CardHeader className="gap-0 px-4 pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4 shrink-0" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4 pb-0">
        <div className="flex items-end justify-between gap-2">
          <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          {variacao != null && (
            <span
              className={`mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                variacao > 0
                  ? "bg-primary/10 text-primary"
                  : variacao < 0
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {variacao > 0 ? (
                <ArrowUp className="size-3" />
              ) : variacao < 0 ? (
                <ArrowDown className="size-3" />
              ) : (
                <Minus className="size-3" />
              )}
              <span className="font-mono tabular-nums">{Math.abs(variacao).toFixed(1)}%</span>
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {sparkline && sparkline.length >= 2 && (
          <Sparkline data={sparkline} className="h-8 w-full" />
        )}
      </CardContent>
    </Card>
  );

  if (!to) return conteudo;
  return (
    <Link to={to} className="block h-full">
      {conteudo}
    </Link>
  );
}
