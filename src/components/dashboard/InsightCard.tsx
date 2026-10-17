import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SafralumeIcon, type SafralumeIconeNome } from "@/components/icons/SafralumeIcon";

export type InsightTone = "up" | "down" | "neutral" | "warn";

const toneClasses: Record<InsightTone, string> = {
  up: "bg-primary/10 text-primary",
  down: "bg-destructive/10 text-red-800",
  neutral: "bg-secondary text-muted-foreground",
  warn: "bg-cta/10 text-cta-foreground",
};

export function InsightCard({
  icon: Icon,
  marca,
  tone,
  title,
  children,
}: {
  icon?: LucideIcon;
  /** Ícone da marca (círculo pronto, sem chip colorido): quando vem, vale no lugar do `icon`. */
  marca?: SafralumeIconeNome;
  tone: InsightTone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3 border-border/80 py-4 shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="gap-0 px-4 pt-0 pb-0">
        <div className="flex items-center gap-2">
          {marca ? (
            <SafralumeIcon nome={marca} className="size-8 shrink-0" />
          ) : Icon ? (
            <span
              className={`flex size-8 items-center justify-center rounded-lg ${toneClasses[tone]}`}
            >
              <Icon className="size-4" />
            </span>
          ) : null}
          <CardTitle className="font-display text-base font-semibold text-foreground">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-0 text-sm leading-relaxed text-foreground">
        {children}
      </CardContent>
    </Card>
  );
}
