/**
 * Cabeçalho padrão das páginas do painel. Antes, 7 das 10 páginas começavam
 * direto num <Card>, sem título nenhum — o usuário não sabia onde estava.
 *
 * `icon` aceita qualquer componente que receba `className` (ícone da
 * lucide-react OU um dos ícones personalizados da marca em
 * @/components/icons/SafralumeIcon) — não é mais só LucideIcon, pra dar pra
 * trocar aos poucos sem quebrar as páginas que ainda não foram trocadas.
 * `iconePersonalizado`: os ícones da marca já vêm com o próprio círculo
 * desenhado na imagem — colocar dentro do chip verde do cabeçalho duplicava
 * o círculo (um de fundo, outro da imagem). Os ícones da lucide-react
 * continuam usando o chip, normalmente.
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        {iconePersonalizado ? (
          <Icon className="size-9 shrink-0" />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon className="size-4.5" />
          </span>
        )}
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-balance text-foreground">
            {title}
          </h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
