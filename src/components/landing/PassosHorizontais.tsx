import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useScroll } from "framer-motion";

const PainelDosPassos = lazy(() => import("@/components/landing/PainelDosPassos"));
const carregarPainel = () => import("@/components/landing/PainelDosPassos");

/**
 * Casca da seção "Como funciona" em galeria horizontal (o painel fica FIXO enquanto a rolagem empurra os passos de lado, de
 * borda a borda; ver PainelDosPassos). A casca é só uma caixa alta (320vh) que existe no HTML do servidor, escondida abaixo
 * do desktop (variante `desk`: tela larga + mouse), então o layout não pula. O conteúdo (3 painéis com ilustrações) é um
 * pedaço de JS carregado SÓ no desktop, quando o navegador está ocioso: celular e tablet nunca baixam nem renderizam isso e
 * seguem com a lista vertical de passos.
 */
export function PassosHorizontais() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [montar, setMontar] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches)
      return;
    const iniciar = () => {
      void carregarPainel();
      setMontar(true);
    };
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => number })
      .requestIdleCallback;
    const id = ric ? ric(iniciar) : window.setTimeout(iniciar, 600);
    return () => {
      if (!ric) window.clearTimeout(id);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative mt-12 ml-[calc(50%-50vw)] hidden h-[320vh] w-screen desk:block"
    >
      {montar ? (
        <Suspense fallback={null}>
          <PainelDosPassos progresso={scrollYProgress} />
        </Suspense>
      ) : null}
    </div>
  );
}
