import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { MenuTelaCheia } from "@/components/landing/MenuTelaCheia";
import { NomeMarca } from "@/components/landing/NomeMarca";
import { useCadastro } from "@/components/landing/CadastroProvider";
import { buildWhatsAppLink } from "@/config/site";
import { trackLanding } from "@/lib/metaPixel";
import { MIDIA } from "@/assets/midia";

/**
 * Cabeçalho que acompanha a rolagem sem pesar: um único listener passivo com rAF, que só troca atributos de dados e uma
 * variável CSS (nada de estado do React, nenhum re-render). No celular ele some ao rolar pra baixo e volta ao rolar pra cima
 * (mais tela pro conteúdo, como no site do Lando); no desktop mostra o CTA "Testar grátis" depois do hero e uma barra fina de
 * progresso da página.
 */
export function Header() {
  const ref = useRef<HTMLElement>(null);
  const { abrirCadastro } = useCadastro();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ultimo = window.scrollY;
    let acumulado = 0;
    let quadro = 0;
    const atualizar = () => {
      quadro = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - ultimo;
      ultimo = y;
      // Soma o movimento na mesma direção: um tremor de 1-2px do dedo não esconde nem mostra nada.
      acumulado = Math.sign(delta) === Math.sign(acumulado) ? acumulado + delta : delta;
      const oculto = el.getAttribute("data-oculto") === "1";
      if (y < 90 || acumulado < -10) {
        if (oculto) el.setAttribute("data-oculto", "0");
      } else if (acumulado > 10 && y > 140 && !oculto) {
        el.setAttribute("data-oculto", "1");
      }
      const passou = y > window.innerHeight * 0.85 ? "1" : "0";
      if (el.getAttribute("data-passou") !== passou) el.setAttribute("data-passou", passou);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      el.style.setProperty("--progresso", total > 0 ? String(Math.min(1, y / total)) : "0");
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(atualizar);
    };
    atualizar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);

  return (
    <header
      ref={ref}
      data-oculto="0"
      data-passou="0"
      className="cabecalho group sticky top-0 z-50 border-b border-border/60 bg-background"
    >
      <span
        aria-hidden="true"
        className="cabecalho-progresso pointer-events-none absolute inset-x-0 bottom-[-1px] hidden h-0.5 origin-left bg-cta md:block"
      />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 py-2">
          <img src={MIDIA.logo} alt="" className="size-8 rounded-[0.6rem]" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            <NomeMarca />
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Navegação secundária em pílula fina, com um traço entre os itens (microtipografia em mono, como no site do
              Active Theory); o botão laranja de testar continua sendo o destaque. Só a partir do desktop. */}
          <div className="hidden h-9 items-center rounded-full border border-border/80 bg-background/70 px-1.5 backdrop-blur-sm md:flex">
            <Link
              to="/login"
              data-rolar
              className="rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              Entrar
            </Link>
            <span aria-hidden="true" className="h-px w-6 bg-border" />
            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              data-rolar
              onClick={() => trackLanding("WhatsappClique", { origem: "header" })}
              className="rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.16em] text-foreground uppercase transition-colors hover:text-[color:var(--cta)]"
            >
              WhatsApp
            </a>
          </div>
          <Button
            type="button"
            size="sm"
            data-magnetico
            data-rolar
            tabIndex={-1}
            onClick={() => abrirCadastro({ origem: "header" })}
            className="pointer-events-none -ml-3 hidden max-w-0 overflow-hidden bg-cta !px-0 whitespace-nowrap text-cta-foreground opacity-0 transition-[opacity,max-width,margin,padding] duration-300 group-data-[passou=1]:pointer-events-auto group-data-[passou=1]:ml-0 group-data-[passou=1]:max-w-[16rem] group-data-[passou=1]:!px-3 group-data-[passou=1]:opacity-100 hover:bg-cta/90 md:inline-flex motion-reduce:transition-none"
          >
            Testar grátis por 7 dias
          </Button>
          <MenuTelaCheia />
        </div>
      </div>
    </header>
  );
}
