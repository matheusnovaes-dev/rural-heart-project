import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Reveal } from "@/components/landing/Reveal";
import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";

export type SecaoLegal = { id: string; titulo: string; corpo: ReactNode };

// Leitura em espiral (só desktop): arquivo separado, baixado só quando alguém abre esta página num computador.
const EspiralLegal = lazy(() => import("@/components/landing/EspiralLegal"));
const CHAVE_TEXTO_CORRIDO = "safralume_legal_texto_corrido";

/**
 * Moldura das páginas legais (termos e privacidade) no padrão da landing: faixa verde com o título em duas vozes e o
 * sol da marca, índice lateral que acompanha a leitura (no celular vira uma fila de atalhos fixa no topo), seções
 * numeradas em serifa e o mesmo cabeçalho e rodapé do site. O texto jurídico vem pronto de cada rota; aqui só a forma.
 */
export function PaginaLegal({
  antes,
  serifa,
  resumo,
  atualizadoEm,
  secoes,
}: {
  antes: string;
  serifa: string;
  resumo: string;
  atualizadoEm: string;
  secoes: SecaoLegal[];
}) {
  const [ativa, setAtiva] = useState(secoes[0]?.id ?? "");
  // Começa sempre em texto corrido (é o que o servidor manda): a espiral só liga no desktop de verdade, depois de montar.
  const [espiral, setEspiral] = useState(false);
  useEffect(() => {
    let preferiuTexto = false;
    try {
      preferiuTexto = localStorage.getItem(CHAVE_TEXTO_CORRIDO) === "1";
    } catch {
      /* sem armazenamento: segue o padrão */
    }
    const desktop = window.matchMedia(
      "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
    ).matches;
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (desktop && !reduz && !preferiuTexto && !location.hash) setEspiral(true);
  }, []);
  const alternar = (ligar: boolean) => {
    try {
      localStorage.setItem(CHAVE_TEXTO_CORRIDO, ligar ? "0" : "1");
    } catch {
      /* sem armazenamento */
    }
    setEspiral(ligar);
    if (!ligar) window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const alvos = secoes
      .map((s) => document.getElementById(s.id))
      .filter((x): x is HTMLElement => !!x);
    const io = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtiva(visivel.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    alvos.forEach((a) => io.observe(a));
    return () => io.disconnect();
  }, [secoes]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 -right-24 -z-10 size-[34rem] rounded-full bg-[radial-gradient(circle,oklch(0.78_0.15_65/0.5),transparent_68%)] blur-2xl sm:size-[44rem]"
          />
          <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-24 sm:pb-24">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide">
              <span className="size-1.5 rounded-full bg-[color:var(--cta)]" />
              Atualizado em {atualizadoEm}
            </p>
            <TituloDuasVozes
              antes={antes}
              serifa={serifa}
              className="text-[clamp(2.6rem,9.6vw,6.2rem)] leading-[0.92] text-primary-foreground sm:text-[clamp(3rem,7vw,6.2rem)]"
            />
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-6 max-w-xl text-base text-primary-foreground/80 sm:mt-8 sm:text-lg"
            >
              {resumo}
            </motion.p>
            {espiral ? null : (
              <button
                type="button"
                onClick={() => alternar(true)}
                className="mt-8 hidden rounded-full border border-white/25 bg-white/10 px-5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-white/20 desk:inline-block print:hidden"
              >
                Ler em espiral -&gt;
              </button>
            )}
          </div>
        </section>

        {espiral ? (
          <div className="print:hidden">
            <Suspense fallback={<div className="h-screen bg-primary" />}>
              <EspiralLegal secoes={secoes} aoSair={() => alternar(false)} />
            </Suspense>
          </div>
        ) : null}

        {/* Texto corrido: sempre no HTML (busca, leitores de tela, impressão, revisão da Meta); com a espiral ligada fica
            escondido na tela, mas volta na impressão. */}
        <div className={espiral ? "hidden print:block" : undefined}>
          {/* Atalhos no celular */}
          <nav
            aria-label="Nesta página"
            className="sticky top-16 z-30 -mb-px overflow-x-auto border-b border-border/70 bg-background/95 lg:hidden"
          >
            <ul className="flex w-max gap-2 px-4 py-2.5 sm:px-6">
              {secoes.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={`alvo-toque inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                      ativa === s.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {i + 1}. {s.titulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[15rem_1fr] lg:gap-16">
            {/* Índice lateral (desktop) */}
            <nav aria-label="Nesta página" className="hidden lg:block">
              <div className="sticky top-28">
                <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                  Nesta página
                </p>
                <ul className="flex flex-col gap-1 border-l border-border">
                  {secoes.map((s, i) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className={`-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors ${
                          ativa === s.id
                            ? "border-[color:var(--cta)] font-semibold text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="mr-2 font-mono text-xs opacity-60">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {s.titulo}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>

            <div className="max-w-2xl">
              {secoes.map((s, i) => (
                <Reveal key={s.id}>
                  <section
                    id={s.id}
                    className="scroll-mt-36 border-t border-border py-9 first:border-t-0 first:pt-0 sm:py-12"
                  >
                    <p
                      aria-hidden="true"
                      className="text-[color:var(--cta)] text-5xl leading-none italic sm:text-6xl"
                      style={{ fontFamily: '"Instrument Serif", "Times New Roman", serif' }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      {s.titulo}
                    </h2>
                    <div className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-[17px]">
                      {s.corpo}
                    </div>
                  </section>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
