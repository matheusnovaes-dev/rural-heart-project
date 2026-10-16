import { useEffect } from "react";

import { iniciarParticulas } from "@/components/landing/desktop/particulas";
import { iniciarFluxo } from "@/components/landing/desktop/fluxo";
import {
  iniciarCartoes,
  iniciarCursor,
  iniciarMagneticos,
  iniciarParallax,
  iniciarScrollSuave,
} from "@/components/landing/desktop/interacoes";

/**
 * Efeitos exclusivos da versão desktop (carregado sob demanda por DesktopFXLoader, só em tela larga com
 * mouse e máquina razoável): poeira dourada em WebGL no hero, brilho que escorre na faixa gigante, cursor
 * próprio, botões magnéticos, cartões que inclinam e brilham, parallax nas fotos e scroll com inércia.
 * O celular nunca baixa nem executa nada daqui. Tudo é desfeito se a tela encolher ou a aba sair.
 */
export default function DesktopFX() {
  useEffect(() => {
    const limpezas: Array<() => void> = [];
    const seguro = (fn: () => () => void) => {
      try {
        limpezas.push(fn());
      } catch {
        // um efeito que falha não pode derrubar a página nem os outros efeitos
      }
    };
    seguro(iniciarScrollSuave);
    seguro(iniciarCursor);
    seguro(iniciarMagneticos);
    seguro(iniciarCartoes);
    seguro(iniciarParallax);
    const hero = document.getElementById("topo");
    if (hero) seguro(() => iniciarParticulas(hero));
    const faixa = document.querySelector<HTMLElement>('section[aria-label^="Culturas cobertas"]');
    if (faixa) seguro(() => iniciarFluxo(faixa));
    return () => limpezas.reverse().forEach((f) => f());
  }, []);
  return null;
}
