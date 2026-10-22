import { motion } from "framer-motion";
import { useId } from "react";

/** Pílulas de período sobre fundo escuro (30 dias / 90 dias), com o destaque deslizando de uma para a outra. */
export function SeletorDePeriodo({
  valor,
  onChange,
  opcoes,
}: {
  valor: number;
  onChange: (v: number) => void;
  opcoes: { valor: number; rotulo: string }[];
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <div
      role="radiogroup"
      aria-label="Período do gráfico"
      className="inline-flex rounded-full bg-primary-foreground/10 p-0.5 ring-1 ring-primary-foreground/10"
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.valor)}
            className="alvo-toque relative rounded-full px-3 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
          >
            {ativo && (
              <motion.span
                layoutId={`${uid}-periodo`}
                className="absolute inset-0 rounded-full bg-primary-foreground shadow"
                transition={{ type: "spring", stiffness: 480, damping: 36 }}
              />
            )}
            <span className={`relative ${ativo ? "text-primary" : "text-primary-foreground/80"}`}>
              {o.rotulo}
            </span>
          </button>
        );
      })}
    </div>
  );
}
