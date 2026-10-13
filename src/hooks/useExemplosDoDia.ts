import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { exemplosDoDiaLanding } from "@/lib/exemplosLanding.server";
import type { ExemplosDoDia } from "@/lib/exemplosLanding";

/**
 * Dado real do dia pros exemplos da landing. Null enquanto carrega (ou se a
 * busca falhar): quem usa renderiza o fallback relativo à data, então nunca
 * aparece exemplo vazio nem quebrado.
 */
export function useExemplosDoDia(): ExemplosDoDia | null {
  const { data } = useQuery({
    queryKey: ["landing-exemplos-do-dia"],
    queryFn: () => exemplosDoDiaLanding(),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  return data ?? null;
}

/**
 * "Hoje" só depois de montar no navegador. Renderizar new Date() direto
 * geraria texto diferente entre o HTML do servidor e a hidratação (virada de
 * dia, fuso), então o primeiro render usa um texto sem data.
 */
export function useHoje(): Date | null {
  const [hoje, setHoje] = useState<Date | null>(null);
  useEffect(() => setHoje(new Date()), []);
  return hoje;
}
