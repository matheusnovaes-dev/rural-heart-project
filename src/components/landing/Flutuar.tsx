import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";

/**
 * Dá profundidade a um elemento (o celular da demo): ele flutua de leve com o scroll e, no desktop, inclina
 * seguindo o mouse com mola. Só transform. Toque e caneta não inclinam (só o mouse), então no celular fica
 * apenas o deslocamento suave do scroll.
 */
export function Flutuar({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, (v) => 28 - v * 56);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const inclinaX = useSpring(rx, { stiffness: 140, damping: 16 });
  const inclinaY = useSpring(ry, { stiffness: 140, damping: 16 });
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      <motion.div
        style={{ rotateX: inclinaX, rotateY: inclinaY, transformPerspective: 1000 }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
          rx.set(-((e.clientY - r.top) / r.height - 0.5) * 9);
        }}
        onPointerLeave={() => {
          rx.set(0);
          ry.set(0);
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
