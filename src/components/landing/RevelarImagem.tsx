import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

const SUAVE = [0.22, 1, 0.36, 1] as const;

/**
 * Foto que aparece "por máscara" em vez de fade (o recorte sobe revelando a imagem, enquanto ela assenta de uma escala
 * maior), como nas fotos do site do Lando Norris. Só clip-path e transform, uma vez por foto, disparado ao entrar na
 * tela. Quem prefere menos movimento recebe a foto já inteira (duração zero, mesmo HTML).
 *
 * Quem observa a entrada na tela é a caixa de fora, que nunca é recortada: o IntersectionObserver do Chrome calcula a
 * interseção já com o `clip-path` aplicado, então observar o elemento recortado em 100% nunca dispararia.
 */
export function RevelarImagem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduz = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={{ clipPath: "inset(100% 0% 0% 0% round 32px)" }}
        animate={visivel ? { clipPath: "inset(0% 0% 0% 0% round 16px)" } : false}
        transition={{ duration: reduz ? 0 : 1.15, ease: SUAVE }}
        className="overflow-hidden rounded-2xl"
      >
        <motion.div
          initial={{ scale: 1.22 }}
          animate={visivel ? { scale: 1 } : false}
          transition={{ duration: reduz ? 0 : 1.7, ease: SUAVE }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
