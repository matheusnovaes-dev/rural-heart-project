import { Grao } from "@/components/landing/Grao";
import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useInView } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { AssinaturaSvg } from "@/components/landing/AssinaturaSvg";
import { MarcasFontes } from "@/components/landing/MarcasFontes";
import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import { siteConfig, buildWhatsAppLink } from "@/config/site";

const INSTAGRAM = "https://www.instagram.com/safralume/";

const paginas = [
  { href: "/#topo", label: "Início" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#planos", label: "Preços" },
  { href: "/#duvidas", label: "Perguntas" },
];

const itemClasse =
  "block w-fit font-display text-[clamp(1.45rem,5.6vw,2.1rem)] leading-[1.04] font-extrabold tracking-tight uppercase transition-colors hover:text-[color:var(--cta)] focus-visible:text-[color:var(--cta)]";

/**
 * Rodapé no estilo do site do Lando Norris: moldura laranja da marca, painel verde com as fontes oficiais, colunas de
 * navegação em letra grande, o título em duas vozes com a assinatura "Safralume" que se escreve sozinha por cima
 * (laranja, vetorial) e a faixa legal embaixo. Mantém os avisos legais e o CNPJ.
 */
export function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const assinar = useInView(ref, { once: true, margin: "0px 0px -18% 0px" });
  return (
    <footer className="bg-[color:var(--cta)] px-2.5 pt-2.5 pb-5 text-[#0e3b2a] sm:px-4 sm:pt-4">
      <div className="relative mx-auto max-w-[96rem] overflow-hidden rounded-[1.6rem] bg-primary text-primary-foreground sm:rounded-[2.2rem]">
        <Grao />
        <MarcasFontes />

        <div className="grid gap-10 px-5 py-9 sm:gap-12 sm:px-10 sm:py-14 lg:grid-cols-[1fr_1fr] lg:gap-14">
          {/* Colunas de navegação */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-9">
            <nav aria-label="Páginas">
              <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary-foreground/55 uppercase">
                Páginas
              </p>
              <ul className="flex flex-col gap-1.5">
                {paginas.map((p) => (
                  <li key={p.href}>
                    <a href={p.href} data-rolar className={itemClasse}>
                      {p.label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link to="/login" data-rolar className={`${itemClasse} text-[color:var(--cta)]`}>
                    Entrar
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Redes e contato">
              <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary-foreground/55 uppercase">
                Siga e fale
              </p>
              <ul className="flex flex-col gap-1.5">
                <li>
                  <a
                    href={INSTAGRAM}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-rolar
                    className={itemClasse}
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href={buildWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-rolar
                    className={itemClasse}
                  >
                    WhatsApp
                  </a>
                </li>
              </ul>
              <p className="mt-9 mb-3 text-xs font-semibold tracking-[0.2em] text-primary-foreground/55 uppercase">
                Legal
              </p>
              <ul className="flex flex-col gap-1.5">
                <li>
                  <Link to="/privacidade" data-rolar className={itemClasse}>
                    Privacidade
                  </Link>
                </li>
                <li>
                  <Link to="/termos" data-rolar className={itemClasse}>
                    Termos
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          {/* Título em duas vozes com a assinatura por cima */}
          <div ref={ref} className="relative flex flex-col justify-end">
            <AssinaturaSvg
              ativo={assinar}
              className="pointer-events-none mb-1 w-[88%] max-w-[34rem] -rotate-[4deg] sm:mb-3"
            />
            <TituloDuasVozes
              antes="SEMPRE NA"
              serifa="HORA CERTA."
              corSerifa="oklch(0.9 0.05 90 / 0.55)"
              className="text-[clamp(2.4rem,9.4vw,5.4rem)] leading-[0.9] text-primary-foreground sm:text-[clamp(2.6rem,6vw,5.4rem)] lg:text-[clamp(2.6rem,4.6vw,5.4rem)]"
            />
            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              data-magnetico
              data-rolar
              className="mt-8 inline-flex w-fit items-center gap-2 rounded-xl bg-cta px-6 py-4 text-sm font-bold tracking-wide text-cta-foreground uppercase transition-transform hover:-translate-y-0.5 sm:mt-10 sm:text-base"
            >
              Falar no WhatsApp
              <ArrowUpRight className="size-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {/* Faixa legal sobre a moldura laranja */}
      <div className="mx-auto mt-5 flex max-w-[96rem] flex-col gap-3 px-2 text-xs font-medium sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-bold tracking-wide uppercase">
          <span className="flex items-center gap-3">
            <Link to="/privacidade" className="alvo-toque hover:underline">
              Privacidade
            </Link>
            <Link to="/termos" className="alvo-toque hover:underline">
              Termos
            </Link>
          </span>
          <span className="normal-case">
            © {new Date().getFullYear()} {siteConfig.name}. Todos os direitos reservados.
          </span>
        </div>
        <p className="max-w-3xl leading-relaxed opacity-80">
          {siteConfig.name} apresenta cenários de mercado agrícola com base em dados públicos
          oficiais (Conab, Imea e órgãos estaduais de agricultura). As informações têm caráter
          informativo e não constituem recomendação de investimento, consultoria financeira ou
          garantia de preço futuro.
        </p>
        <p className="text-[10px] opacity-75">
          CNPJ 68.802.997/0001-37 (68.802.997 MATHEUS NOVAES DE MOURA)
        </p>
      </div>
    </footer>
  );
}
