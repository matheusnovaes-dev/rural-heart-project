import { useEffect } from "react";

/**
 * Virada de cor entre capítulos: o fundo da página muda de tom (creme, areia, menta) conforme a seção que cruza o
 * meio da tela, num fade lento, como as viradas de cor do site do Lando Norris. Cada capítulo declara a sua cor aqui;
 * quem não está na lista (faixas escuras, rodapé) não muda nada. Um IntersectionObserver por seção (nada de ouvir o
 * scroll) escreve uma única variável CSS no <html>; o fade é uma transição de background-color em um só elemento
 * (a raiz da landing). Sem JavaScript, ou para quem prefere menos movimento, a página fica no creme de sempre.
 */
const CORES: Record<string, string> = {
  precos: "oklch(0.988 0.005 95.1)",
  problema: "oklch(0.988 0.005 95.1)",
  calculadora: "oklch(0.96 0.024 88)",
  "como-funciona": "oklch(0.96 0.017 150)",
  painel: "oklch(0.988 0.005 95.1)",
  planos: "oklch(0.96 0.024 88)",
  duvidas: "oklch(0.96 0.017 150)",
};

export function FundoDosCapitulos() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const raiz = document.documentElement;
    const alvos = Object.keys(CORES)
      .map((id) => document.getElementById(id))
      .filter((x): x is HTMLElement => !!x);
    const cruzando = new Set<string>();
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) cruzando.add(e.target.id);
          else cruzando.delete(e.target.id);
        }
        const id = Object.keys(CORES).find((k) => cruzando.has(k));
        if (id) raiz.style.setProperty("--fundo-capitulo", CORES[id]!);
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    alvos.forEach((a) => io.observe(a));
    return () => {
      io.disconnect();
      raiz.style.removeProperty("--fundo-capitulo");
    };
  }, []);
  return null;
}
