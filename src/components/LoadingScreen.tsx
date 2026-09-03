import { Sprout } from "lucide-react";

/**
 * Tela de transição entre rotas — antes disso, trocar de página no
 * dashboard "travava" sem indicação nenhuma (o pedaço de código daquela
 * rota ainda estava baixando) e depois trocava de repente. Reaproveita a
 * mesma marca (círculo verde + folha) já usada no cabeçalho e no menu
 * lateral, com um anel pulsando atrás pra dar sensação de "carregando" sem
 * ser um spinner genérico.
 */
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="relative flex size-14 items-center justify-center">
        <span className="absolute inline-flex size-14 animate-ping rounded-full bg-primary/40" />
        <span className="relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sprout className="size-7" />
        </span>
      </div>
      <span className="font-display text-sm font-medium tracking-wide text-muted-foreground">
        Carregando...
      </span>
    </div>
  );
}
