/**
 * Estado vazio que explica e oferece próximo passo, em vez do beco sem saída. `icon` aceita Lucide ou um dos ícones da
 * marca (@/components/icons/SafralumeIcon); use `iconePersonalizado` para esse segundo caso (o ícone já vem com o próprio
 * círculo, sem precisar do chip). O ícone ganha anéis suaves ao redor para o vazio parecer intencional, não esquecido.
 */
export function EmptyState({
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
    <div className="flex flex-col items-center gap-4 px-4 py-9 text-center">
      <span className="relative flex size-[4.5rem] items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/12 to-transparent ring-1 ring-primary/10" />
        <span className="absolute -inset-2.5 rounded-full ring-1 ring-primary/[0.06]" />
        {iconePersonalizado ? (
          <Icon className="relative size-12 drop-shadow-sm" />
        ) : (
          <span className="relative flex size-12 items-center justify-center rounded-full bg-card text-primary shadow-md ring-1 ring-border">
            <Icon className="size-5" />
          </span>
        )}
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
