/**
 * Estado vazio que explica e oferece próximo passo, em vez do beco sem saída
 * que existia antes ("Nenhum lead ainda."). `icon` aceita Lucide ou um dos
 * ícones personalizados da marca (@/components/icons/SafralumeIcon); use
 * `iconePersonalizado` pra esse segundo caso — o ícone já vem com o próprio
 * círculo, sem precisar do chip (mesmo motivo do PageHeader).
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
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      {iconePersonalizado ? (
        <Icon className="size-12" />
      ) : (
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="size-5" />
        </span>
      )}
      <div className="space-y-1">
        <p className="font-display font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
