import { motion, useReducedMotion } from "framer-motion";
import { Children, Fragment, isValidElement, type ReactNode } from "react";

/**
 * Cada bloco entra com um fade e um leve deslize quando chega à tela (uma vez só). Em painéis escondidos nada dispara
 * até a aba ficar visível. Respeita "reduzir movimento" pelo próprio framer-motion (useReducedMotion não é necessário:
 * o deslize é de 14 px e a opacidade conduz o efeito).
 */
export function Revelar({ children, atraso = 0 }: { children: ReactNode; atraso?: number }) {
  // Quem pediu menos movimento recebe o conteúdo direto, sem fade nem deslize
  if (useReducedMotion()) return <div>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.5, delay: atraso, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Embrulha cada filho direto (inclusive os de um fragmento) em <Revelar>, com um pequeno atraso escalonado. */
export function RevelarCada({ children }: { children: ReactNode }) {
  const lista: ReactNode[] = [];
  const achatar = (n: ReactNode) => {
    Children.forEach(n, (c) => {
      if (isValidElement(c) && c.type === Fragment)
        achatar((c.props as { children?: ReactNode }).children);
      else if (c !== null && c !== false && c !== undefined) lista.push(c);
    });
  };
  achatar(children);
  return (
    <>
      {lista.map((c, i) => (
        <Revelar
          key={isValidElement(c) && c.key != null ? String(c.key) : i}
          atraso={Math.min(i, 4) * 0.05}
        >
          {c}
        </Revelar>
      ))}
    </>
  );
}
