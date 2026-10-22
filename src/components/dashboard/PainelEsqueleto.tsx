/**
 * Casca do painel (menu lateral, cabeçalho e blocos de conteúdo) mostrada enquanto o login e o acesso são
 * conferidos. O painel renderiza no navegador, então antes isso era uma tela com logo e "Carregando...": agora a
 * pessoa já vê a forma da tela e, quando o conteúdo chega, ele cai no lugar sem pulo. Só divs com pulso (CSS), sem
 * dados e sem lógica; o servidor e o navegador renderizam o mesmo HTML.
 */
export function PainelEsqueleto() {
  return (
    <div
      className="dashboard-shell flex min-h-screen bg-background"
      role="status"
      aria-busy="true"
      aria-label="Carregando o painel"
    >
      <aside className="bg-sidebar hidden w-64 shrink-0 flex-col border-r border-sidebar-border md:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          <div className="size-9 animate-pulse rounded-[0.65rem] bg-sidebar-foreground/15" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-sidebar-foreground/15" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-sidebar-foreground/10" />
          </div>
        </div>
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-sidebar-foreground/10" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border/80 px-4 sm:px-6">
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted md:w-8" />
          <div className="hidden h-3 w-40 animate-pulse rounded bg-muted sm:block" />
        </div>
        <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
          <div className="space-y-2 border-b border-border pb-5">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-36 animate-pulse rounded-xl bg-muted" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,.75fr)]">
            <div className="h-72 animate-pulse rounded-xl bg-primary/15" />
            <div className="h-72 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
