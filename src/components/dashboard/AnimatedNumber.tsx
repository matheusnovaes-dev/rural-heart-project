import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

/**
 * Número que sobe animado até o valor real, em vez de aparecer seco. Na
 * primeira montagem sobe de 0; em atualizações seguintes (preço mudou),
 * anima do valor anterior pro novo — nunca reinicia do zero depois da
 * primeira vez, senão pareceria estar "recarregando" a cada atualização.
 */
export function AnimatedNumber({
  value,
  decimals = 2,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const montado = useRef(false);

  useEffect(() => {
    const de = montado.current ? display : 0;
    montado.current = true;
    const controls = animate(de, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplay,
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={className}>
      {display.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}
