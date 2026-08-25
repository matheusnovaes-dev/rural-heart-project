import type { LucideIcon } from "lucide-react";

/**
 * Cabeçalho padrão das páginas do painel. Antes, 7 das 10 páginas começavam
 * direto num <Card>, sem título nenhum — o usuário não sabia onde estava.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="size-4.5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
