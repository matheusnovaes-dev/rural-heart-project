import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { LoadingScreen } from "./components/LoadingScreen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // O navegador tem sua própria restauração de scroll nativa, que roda ANTES
  // do React hidratar: ela pula pra posição antiga salva no histórico, e só
  // depois o scrollRestoration do router (abaixo) corrige pra posição certa
  // — daí o "desce e volta sozinho" ao entrar na página. Desligando a nativa,
  // só o router decide, sem a disputa entre os dois.
  if (typeof document !== "undefined") {
    window.history.scrollRestoration = "manual";

    // Depois de publicar, abas abertas pedem pedaços de código antigos que
    // não existem mais ("Failed to fetch dynamically imported module").
    // Recarrega uma vez pra pegar a versão nova, sem loop infinito.
    const CHAVE = "recarregou-por-chunk";
    const recarregar = () => {
      if (sessionStorage.getItem(CHAVE)) return false;
      sessionStorage.setItem(CHAVE, "1");
      window.location.reload();
      return true;
    };
    // Só engole o erro quando vai recarregar; senão o import "resolve" vazio
    // e o router quebra com "reading 'component'" (tela branca).
    window.addEventListener("vite:preloadError", (e) => {
      if (recarregar()) e.preventDefault();
    });
    window.addEventListener("unhandledrejection", (e) => {
      const msg = String((e.reason as Error | undefined)?.message ?? e.reason ?? "");
      if (/dynamically imported module|Importing a module script failed/i.test(msg)) {
        recarregar();
      }
    });
    window.setTimeout(() => sessionStorage.removeItem(CHAVE), 10000);
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: LoadingScreen,
    // Baixo de propósito: sem isso, trocar de rota "travava" sem feedback
    // nenhum até o pedaço de código daquela página terminar de baixar. 150ms
    // é rápido o suficiente pra não piscar em navegação já pré-carregada,
    // mas cobre a demora real que motivou esse ajuste.
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    // Transição suave (fade nativo do navegador) entre páginas públicas, por exemplo landing -> login. Fica de fora: a
    // primeira carga, mudança só de #âncora, qualquer tela do painel (/dashboard) e quem prefere menos movimento ou tem
    // aparelho simples (a captura da tela custa nessas máquinas). Sem suporte no navegador, navega normal.
    defaultViewTransition: {
      types: ({ fromLocation, toLocation, pathChanged }) => {
        if (!fromLocation || !pathChanged) return false;
        if (
          fromLocation.pathname.startsWith("/dashboard") ||
          toLocation.pathname.startsWith("/dashboard")
        )
          return false;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
        if ((navigator.hardwareConcurrency || 4) < 4) return false;
        return ["pagina"];
      },
    },
  });

  return router;
};
