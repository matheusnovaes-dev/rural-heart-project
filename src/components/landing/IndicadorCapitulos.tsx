import { useEffect, useState } from "react";

const CAPITULOS = [
  { id: "precos", rotulo: "Preços" },
  { id: "problema", rotulo: "O problema" },
  { id: "calculadora", rotulo: "Calculadora" },
  { id: "como-funciona", rotulo: "Como funciona" },
  { id: "painel", rotulo: "O painel" },
  { id: "planos", rotulo: "Planos" },
  { id: "duvidas", rotulo: "Perguntas" },
] as const;

/**
 * Trilho de capítulos na lateral (desktop, como no site do Lando Norris): uma coluna de pontos numerados que mostra
 * em que parte da história você está e leva a qualquer capítulo com um clique. Só aparece depois do hero e some no
 * rodapé. Um IntersectionObserver por seção, sem ouvir o scroll, e nada de layout: só opacidade e transform.
 */
export function IndicadorCapitulos() {
  const [ativo, setAtivo] = useState<string | null>(null);

  useEffect(() => {
    const alvos = CAPITULOS.map((c) => document.getElementById(c.id)).filter(
      (x): x is HTMLElement => !!x,
    );
    const cruzando = new Set<string>();
    // Linha de leitura no meio da tela: o capítulo que a cruza é o ativo (funciona para seções de qualquer altura,
    // inclusive a do painel, que fica fixa por vários "vh"). Sem nenhum (hero, rodapé, faixas) o trilho some.
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) cruzando.add(e.target.id);
          else cruzando.delete(e.target.id);
        }
        const ativo = CAPITULOS.find((c) => cruzando.has(c.id));
        setAtivo(ativo ? ativo.id : null);
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    alvos.forEach((a) => io.observe(a));
    return () => io.disconnect();
  }, []);

  return (
    <nav
      aria-label="Capítulos da página"
      className={`fixed top-1/2 right-5 z-40 hidden -translate-y-1/2 transition-opacity duration-500 desk:block ${ativo ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <ol className="flex flex-col items-end gap-3">
        {CAPITULOS.map((c, i) => {
          const on = ativo === c.id;
          return (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-label={c.rotulo}
                aria-current={on ? "true" : undefined}
                className="group flex items-center gap-3 py-0.5"
              >
                <span
                  className={`rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap text-background transition-all duration-300 ${on ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`}
                >
                  {c.rotulo}
                </span>
                <span
                  className={`font-mono text-[11px] tabular-nums transition-all duration-300 ${on ? "scale-125 font-bold text-[color:var(--cta)]" : "text-foreground/45 group-hover:text-foreground"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
