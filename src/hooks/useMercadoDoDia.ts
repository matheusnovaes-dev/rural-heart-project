import { useQuery } from "@tanstack/react-query";

import { mercadoDoDiaLanding } from "@/lib/mercadoLanding.server";
import type { MercadoDoDia } from "@/lib/mercadoLanding";

/** Preços reais do dia (faixa e demo da landing). Null enquanto carrega ou se a busca falhar. */
export function useMercadoDoDia(): MercadoDoDia | null {
  const { data } = useQuery({
    queryKey: ["landing-mercado-do-dia"],
    queryFn: () => mercadoDoDiaLanding(),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  return data && data.itens.length > 0 ? data : null;
}
