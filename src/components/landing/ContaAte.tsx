import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

/** Conta de 0 até o número quando entra na tela. O HTML já nasce com o valor final (sem JS e para buscadores). */
export function ContaAte({ alvo, sufixo = "" }: { alvo: number; sufixo?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const emTela = useInView(ref, { once: true });
  const reduz = useReducedMotion();
  useEffect(() => {
    if (!emTela || reduz) return;
    const controle = animate(0, alvo, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = `${Math.round(v)}${sufixo}`;
      },
    });
    return () => controle.stop();
  }, [emTela, reduz, alvo, sufixo]);
  return (
    <span ref={ref}>
      {alvo}
      {sufixo}
    </span>
  );
}
