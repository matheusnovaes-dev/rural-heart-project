import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useVelocity,
} from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Faixa infinita acoplada ao scroll (a faixa de parceiros do site do Lando Norris): anda sozinha, acelera
 * conforme a pessoa rola e inverte o sentido quando ela rola para cima. Um só elemento se move (transform),
 * sem recalcular layout. Passe conteúdo que, repetido, passe da largura da tela (o chamador repete se precisar).
 * Passar o dedo/mouse por cima desacelera. Quem prefere menos movimento recebe a faixa parada e rolável.
 */
export function Marquee({
  children,
  velocidade = 50,
  reverso = false,
  repeticoes = 1,
  className,
}: {
  children: ReactNode;
  /** px por segundo em repouso */
  velocidade?: number;
  reverso?: boolean;
  /** Quantas vezes repetir o conteúdo em cada metade, para passar da largura da tela. */
  repeticoes?: number;
  className?: string;
}) {
  const reduz = useReducedMotion();
  const x = useMotionValue(0);
  const metadeRef = useRef<HTMLDivElement>(null);
  const largura = useRef(0);
  const devagar = useRef(false);
  const pronto = useRef(false);
  // O HTML do servidor leva só uma cópia (a faixa é repetitiva e pesava ~45 KB de HTML); as repetições
  // que fecham o loop entram depois da hidratação, fora da tela.
  const [reps, setReps] = useState(1);
  const [montado, setMontado] = useState(false);
  const { scrollY } = useScroll();
  const vel = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });

  // Só começa a andar depois que a página terminou de carregar e hidratar (a faixa está abaixo da dobra):
  // a animação disputava a CPU do Android lento com a hidratação e atrasava o DCL.
  useEffect(() => {
    const liberar = () => {
      pronto.current = true;
    };
    setReps(repeticoes);
    setMontado(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(liberar, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(liberar, 1500);
    return () => clearTimeout(t);
  }, [repeticoes]);

  useLayoutEffect(() => {
    const el = metadeRef.current;
    if (!el) return;
    const medir = () => {
      largura.current = el.offsetWidth;
    };
    // Sem medir() direto: ler offsetWidth aqui forçaria um layout síncrono da página inteira na hidratação
    // (custava ~200 ms de DCL no Android lento). O ResizeObserver já avisa depois do primeiro layout.
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useAnimationFrame((_, delta) => {
    const w = largura.current;
    if (!w || reduz || !pronto.current) return;
    const v = vel.get();
    const base = reverso ? 1 : -1;
    const sentido = v < -80 ? -base : base;
    const impulso = 1 + Math.min(Math.abs(v) / 250, 6);
    const passo = sentido * velocidade * impulso * (devagar.current ? 0.25 : 1) * (delta / 1000);
    let nx = x.get() + passo;
    if (nx <= -w) nx += w;
    if (nx > 0) nx -= w;
    x.set(nx);
  });

  return (
    <div
      className={cn("overflow-hidden motion-reduce:overflow-x-auto", className)}
      onPointerEnter={() => (devagar.current = true)}
      onPointerLeave={() => (devagar.current = false)}
    >
      <motion.div style={{ x }} className="flex w-max items-center whitespace-nowrap">
        {[0, 1].map((copia) =>
          // A cópia que fecha o loop só entra depois da hidratação (menos HTML no servidor)
          copia === 1 && !montado ? null : (
            <div
              key={copia}
              ref={copia === 0 ? metadeRef : undefined}
              aria-hidden={copia === 1 ? true : undefined}
              className="flex shrink-0 items-center"
            >
              {Array.from({ length: copia === 0 ? reps : reps }, (_, r) => (
                <div key={r} className="flex shrink-0 items-center">
                  {children}
                </div>
              ))}
            </div>
          ),
        )}
      </motion.div>
    </div>
  );
}
