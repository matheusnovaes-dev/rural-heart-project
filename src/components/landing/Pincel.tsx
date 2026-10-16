import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * Palavra em traço de pincel atrás de um título (o "Collabs" do site do Lando Norris). Anda de lado e gira
 * um pouco conforme a seção atravessa a tela. Só transform; fica atrás do texto e não recebe toque.
 * A família "Caveat Brush" carrega só com as letras usadas (ver FONTES_DESTAQUE_URL em __root.tsx).
 */
export function Pincel({ palavra, className }: { palavra: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, (v) => `${-8 + v * 18}%`);
  const rotate = useTransform(scrollYProgress, (v) => -11 + v * 6);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <motion.span
        style={{ x, rotate, fontFamily: '"Caveat Brush", cursive' }}
        className={`absolute leading-none select-none ${className}`}
      >
        {palavra}
      </motion.span>
    </div>
  );
}
