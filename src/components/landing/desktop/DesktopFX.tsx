import { useEffect } from "react";

import IndiceLateral from "@/components/landing/desktop/IndiceLateral";
import { iniciarParticulas } from "@/components/landing/desktop/particulas";
import { iniciarFluxo } from "@/components/landing/desktop/fluxo";
import { iniciarVento } from "@/components/landing/desktop/vento";
import { iniciarLetrasRolando } from "@/components/landing/desktop/letrasRolando";
import {
  iniciarCartoes,
  iniciarCortinas,
  iniciarCursor,
  iniciarMagneticos,
  iniciarPalcos3D,
  iniciarParallax,
  iniciarProfundidade,
  iniciarScrollSuave,
} from "@/components/landing/desktop/interacoes";

/**
 * Efeitos exclusivos da versão desktop (carregado sob demanda por DesktopFXLoader, só em tela larga com
 * mouse e máquina razoável): vento nas lavouras da foto do hero (shader que ondula o trigo e reage ao mouse), poeira dourada, brilho que escorre na faixa gigante, cursor
 * próprio, botões magnéticos, cartões que inclinam e brilham, parallax nas fotos e scroll com inércia.
 * O celular nunca baixa nem executa nada daqui. Tudo é desfeito se a tela encolher ou a aba sair.
 */
export default function DesktopFX({ leve = false }: { leve?: boolean }) {
  useEffect(() => {
    const limpezas: Array<() => void> = [];
    const seguro = (fn: () => () => void) => {
      try {
        limpezas.push(fn());
      } catch {
        // um efeito que falha não pode derrubar a página nem os outros efeitos
      }
    };
    seguro(iniciarCursor);
    seguro(iniciarMagneticos);
    seguro(iniciarLetrasRolando);
    if (leve) return () => limpezas.reverse().forEach((f) => f());
    seguro(iniciarScrollSuave);
    seguro(iniciarCartoes);
    seguro(iniciarParallax);
    seguro(iniciarProfundidade);
    seguro(iniciarCortinas);
    seguro(iniciarPalcos3D);
    const hero = document.getElementById("topo");
    if (hero) seguro(() => iniciarParticulas(hero));
    if (hero) seguro(() => iniciarVento(hero));
    const faixa = document.querySelector<HTMLElement>('section[aria-label^="Culturas cobertas"]');
    if (faixa) seguro(() => iniciarFluxo(faixa));
    return () => limpezas.reverse().forEach((f) => f());
  }, []);
  return leve ? null : <IndiceLateral />;
}
