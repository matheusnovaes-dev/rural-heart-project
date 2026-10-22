/**
 * Cabeçalho padrão das páginas do painel. `icon` aceita qualquer componente que receba `className` (ícone da lucide-react
 * OU um dos ícones da marca em @/components/icons/SafralumeIcon). `iconePersonalizado`: os ícones da marca já vêm com o
 * próprio círculo desenhado, então não entram no chip verde (senão duplicava o círculo).
 */
export function PageHeader({
  icon: Icon,
  iconePersonalizado = false,
  title,
  description,
  action,
}: {
  icon: (props: { className?: string }) => React.ReactNode;
  iconePersonalizado?: boolean;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-3 pb-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        {iconePersonalizado ? (
          <Icon className="size-11 shrink-0 drop-shadow-sm" />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.42_0.06_157)] to-[oklch(0.27_0.05_158)] text-primary-foreground shadow-[0_10px_22px_-10px_rgb(20_60_35/0.7)] ring-1 ring-white/10">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[1.6rem] leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-[1.85rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-[0.95rem] text-pretty text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
