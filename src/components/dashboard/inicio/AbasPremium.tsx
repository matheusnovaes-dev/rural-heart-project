import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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
  const caixa = useRef<HTMLDivElement | null>(null);
  // Painéis já visitados ficam montados (só escondidos): trocar de aba é instantâneo, não recarrega os dados e a página
  // não encolhe no meio da troca (era o "pisca" no celular: o painel antigo sumia e a página inteira encolhia).
  const [visitadas, setVisitadas] = useState<string[]>([valor]);
  useEffect(() => {
    setVisitadas((v) => (v.includes(valor) ? v : [...v, valor]));
  }, [valor]);

  function trocar(id: string) {
    if (id === valor) return;
    // segura a altura atual até o painel novo terminar de carregar (sem esqueletos), no máximo 6 s: se ele ainda está
    // carregando, a página não despenca e não "pisca" no meio da troca
    const el = caixa.current;
    if (el) {
      el.style.transition = "none";
      el.style.minHeight = `${el.offsetHeight}px`;
      const inicio = Date.now();
      const soltar = () => {
        const painel = el.querySelector<HTMLElement>(`[data-ativo="true"]`);
        const carregando = !!painel?.querySelector(".animate-pulse");
        if (carregando && Date.now() - inicio < 6000) {
          window.setTimeout(soltar, 150);
          return;
        }
        el.style.transition = "min-height 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.minHeight = "0px";
      };
      window.setTimeout(soltar, 450);
    }
    onChange(id);
  }

  useEffect(() => {
    refs.current[valor]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [valor]);

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const ir = (j: number) => {
      const alvo = abas[(j + abas.length) % abas.length]!;
      trocar(alvo.id);
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
              onClick={() => trocar(a.id)}
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
      <div ref={caixa} className="min-w-0">
        {(visitadas.includes(valor) ? visitadas : [...visitadas, valor]).map((id) => (
          <div
            key={id}
            role="tabpanel"
            id={`${uid}-painel-${id}`}
            aria-labelledby={`${uid}-aba-${id}`}
            hidden={id !== valor}
            data-ativo={id === valor}
            className="painel-aba flex min-w-0 flex-col gap-5"
          >
            {children(id)}
          </div>
        ))}
      </div>
    </div>
  );
}
