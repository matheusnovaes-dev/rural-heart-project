import { useEffect } from "react";

import { trackLanding } from "@/lib/metaPixel";

const MARCOS = [25, 50, 75, 100];

/**
 * Profundidade de scroll da landing (25/50/75/100%), uma vez por marco por
 * visita. É o dado que faltava pra saber onde a maioria dos visitantes (84% de
 * rejeição, 37s de sessão média) para de ler, sem precisar de outra
 * ferramenta de analytics. Listener passivo e só lê scrollY/innerHeight uma vez
 * por frame (rAF), então não pesa no scroll.
 */
export function RastreioScroll() {
  useEffect(() => {
    const disparados = new Set<number>();
    let agendado = false;

    const medir = () => {
      agendado = false;
      const total = document.documentElement.scrollHeight;
      if (total <= 0) return;
      const pct = ((window.scrollY + window.innerHeight) / total) * 100;
      for (const marco of MARCOS) {
        if (pct >= marco - 0.5 && !disparados.has(marco)) {
          disparados.add(marco);
          trackLanding("ScrollProfundidade", { pct: marco });
        }
      }
      if (disparados.size === MARCOS.length) window.removeEventListener("scroll", aoRolar);
    };
    const aoRolar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(medir);
    };

    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return null;
}
