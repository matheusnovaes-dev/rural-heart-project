import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type InsightTone = "up" | "down" | "neutral" | "warn";

const toneClasses: Record<InsightTone, string> = {
  up: "bg-primary/10 text-primary",
  down: "bg-destructive/10 text-destructive",
  neutral: "bg-secondary text-muted-foreground",
  warn: "bg-cta/10 text-cta-foreground",
};

export function InsightCard({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: InsightTone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="gap-0 pb-0">
        <div className="flex items-center gap-2">
          <span
            className={`flex size-7 items-center justify-center rounded-full ${toneClasses[tone]}`}
          >
            <Icon className="size-3.5" />
          </span>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-0 text-sm text-foreground">{children}</CardContent>
    </Card>
  );
}
