import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type AbaPremium = {
  id: string;
  rotulo: string;
  rotuloCurto?: string;
  icone?: LucideIcon;
  /** Bolinha com um número (ex: pendências). */
  contagem?: number;
  /** Esconde o ícone no celular quando as abas são muitas e o espaço é curto. */
  semIconeNoCelular?: boolean;
};

/**
 * Abas em pílula com indicador que desliza entre elas (layoutId) e conteúdo que troca com fade curto. Rola na horizontal
 * no celular, navega por setas do teclado e usa os papéis ARIA de tablist/tab/tabpanel.
 */
export function AbasPremium({
  abas,
  valor,
  onChange,
  rotulo,
  children,
}: {
  abas: AbaPremium[];
  valor: string;
  onChange: (id: string) => void;
  rotulo: string;
  children: (valor: string) => ReactNode;
}) {
  const uid = useId().replace(/:/g, "");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    refs.current[valor]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [valor]);

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const ir = (j: number) => {
      const alvo = abas[(j + abas.length) % abas.length]!;
      onChange(alvo.id);
      refs.current[alvo.id]?.focus();
    };
    if (e.key === "ArrowRight") {
      e.preventDefault();
      ir(i + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      ir(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      ir(0);
    } else if (e.key === "End") {
      e.preventDefault();
      ir(abas.length - 1);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div
        role="tablist"
        aria-label={rotulo}
        className="flex w-full max-w-full gap-1 self-start overflow-x-auto rounded-2xl sm:w-auto border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {abas.map((a, i) => {
          const ativo = a.id === valor;
          const Icone = a.icone;
          return (
            <button
              key={a.id}
              ref={(el) => {
                refs.current[a.id] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-aba-${a.id}`}
              aria-selected={ativo}
              aria-controls={`${uid}-painel-${a.id}`}
              tabIndex={ativo ? 0 : -1}
              onClick={() => onChange(a.id)}
              onKeyDown={(e) => aoTeclar(e, i)}
              className="relative flex h-10 min-w-fit flex-1 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 text-[0.82rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:flex-none sm:gap-2 sm:px-4 sm:text-sm"
            >
              {ativo && (
                <motion.span
                  layoutId={`${uid}-indicador`}
                  className="absolute inset-0 rounded-xl bg-primary shadow-md"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span
                className={`relative z-10 flex items-center gap-2 whitespace-nowrap ${
                  ativo ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {Icone && (
                  <Icone
                    className={`size-4 ${a.semIconeNoCelular ? "hidden sm:block" : ""}`}
                    aria-hidden="true"
                  />
                )}
                <span className="sm:hidden">{a.rotuloCurto ?? a.rotulo}</span>
                <span className="hidden sm:inline">{a.rotulo}</span>
                {a.contagem != null && a.contagem > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-px text-[0.68rem] font-bold tabular-nums ${
                      ativo
                        ? "bg-white/20 text-primary-foreground"
                        : "bg-cta/20 text-gold-foreground"
                    }`}
                  >
                    {a.contagem}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={valor}
          role="tabpanel"
          id={`${uid}-painel-${valor}`}
          aria-labelledby={`${uid}-aba-${valor}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-w-0 flex-col gap-5"
        >
          {children(valor)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
