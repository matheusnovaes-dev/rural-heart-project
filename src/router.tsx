import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { LoadingScreen } from "./components/LoadingScreen";

export const getRouter = () => {
  const queryClient = new QueryClient();

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
  });

  return router;
};
