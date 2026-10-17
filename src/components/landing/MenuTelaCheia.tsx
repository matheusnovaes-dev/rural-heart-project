import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";

import { MIDIA } from "@/assets/midia";
import { Grao } from "@/components/landing/Grao";
import { NomeMarca } from "@/components/landing/NomeMarca";
import { buildWhatsAppLink, siteConfig } from "@/config/site";
import { trackLanding } from "@/lib/metaPixel";

const SERIFA = { fontFamily: '"Instrument Serif", "Times New Roman", serif' };
const INSTAGRAM = "https://www.instagram.com/safralume/";

const itens = [
  { href: "/#topo", rotulo: "Início" },
  { href: "/#como-funciona", rotulo: "Como funciona" },
  { href: "/#planos", rotulo: "Preços" },
  { href: "/#duvidas", rotulo: "Perguntas" },
];

/**
 * Menu em tela cheia (o do site do Lando Norris): botão "Menu" no topo, painel verde da marca com os destinos em letra
 * gigante que sobem de uma máscara uma a uma, e na lateral os contatos. Radix Dialog cuida de foco, Esc, leitor de tela e
 * trava de rolagem (o Lenis do desktop pausa com `body[data-scroll-locked]`). Nada disso existe no HTML até o menu abrir:
 * o custo antes do clique é só o botão.
 */
export function MenuTelaCheia() {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);

  return (
    <Dialog.Root
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) trackLanding("MenuAberto", {});
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-rolar
          aria-label="Abrir menu"
          className="inline-flex h-10 items-center gap-2.5 rounded-full border border-border bg-background/60 pr-4 pl-3.5 text-sm font-semibold text-foreground transition-colors hover:border-[color:var(--cta)] hover:text-[color:var(--cta)]"
        >
          <span aria-hidden="true" className="flex w-4 flex-col gap-[5px]">
            <span className="h-[2px] w-full rounded bg-current" />
            <span className="h-[2px] w-2/3 rounded bg-current" />
          </span>
          Menu
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="menu-tela fixed inset-0 z-[70] isolate flex flex-col overflow-y-auto bg-primary text-primary-foreground outline-none"
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Grao />

          <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <span className="flex items-center gap-2">
              <img src={MIDIA.logo} alt="" className="size-8 rounded-[0.6rem]" />
              <span className="text-lg font-bold tracking-tight">
                <NomeMarca />
              </span>
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar menu"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/25 pr-4 pl-3.5 text-sm font-semibold transition-colors hover:border-[color:var(--cta)] hover:text-[color:var(--cta)]"
              >
                <X className="size-4" aria-hidden="true" />
                Fechar
              </button>
            </Dialog.Close>
          </div>

          <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 content-center gap-10 px-4 pt-6 pb-10 sm:px-6 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-16">
            <nav aria-label="Menu principal">
              <ul className="flex flex-col">
                {itens.map((item, i) => (
                  <li key={item.href} className="overflow-hidden">
                    <a
                      href={item.href}
                      onClick={fechar}
                      style={{ ["--i" as string]: i }}
                      className="menu-item group flex items-baseline gap-4 py-1 font-display text-[clamp(2.6rem,10.5vw,6.2rem)] leading-[1.02] font-extrabold tracking-tight uppercase transition-colors hover:text-[color:var(--cta)] focus-visible:text-[color:var(--cta)]"
                    >
                      <span
                        className="w-10 shrink-0 text-[0.32em] leading-none text-primary-foreground/45 italic normal-case transition-colors group-hover:text-[color:var(--cta)] sm:w-14"
                        style={SERIFA}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="transition-transform duration-300 group-hover:translate-x-3">
                        {item.rotulo}
                      </span>
                    </a>
                  </li>
                ))}
                <li className="overflow-hidden">
                  <Link
                    to="/login"
                    onClick={fechar}
                    style={{ ["--i" as string]: itens.length }}
                    className="menu-item group flex items-baseline gap-4 py-1 font-display text-[clamp(2.6rem,10.5vw,6.2rem)] leading-[1.02] font-extrabold tracking-tight text-[color:var(--cta)] uppercase"
                  >
                    <span
                      className="w-10 shrink-0 text-[0.32em] leading-none italic normal-case sm:w-14"
                      style={SERIFA}
                    >
                      {String(itens.length + 1).padStart(2, "0")}
                    </span>
                    <span className="transition-transform duration-300 group-hover:translate-x-3">
                      Entrar
                    </span>
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="menu-lateral flex flex-col gap-7 lg:pb-3">
              <div className="flex flex-col gap-3">
                <a
                  href="/#comece"
                  onClick={fechar}
                  data-magnetico
                  className="inline-flex w-fit items-center gap-2 rounded-xl bg-cta px-6 py-4 text-sm font-bold tracking-wide text-cta-foreground uppercase transition-transform hover:-translate-y-0.5"
                >
                  Testar grátis por 7 dias
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
                <a
                  href={buildWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackLanding("WhatsappClique", { origem: "menu" })}
                  className="inline-flex w-fit items-center gap-2 text-sm font-semibold tracking-wide uppercase underline decoration-white/30 underline-offset-4 transition-colors hover:text-[color:var(--cta)]"
                >
                  Falar no WhatsApp
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-primary-foreground/70">
                <li>
                  <a
                    href={INSTAGRAM}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[color:var(--cta)]"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <Link
                    to="/privacidade"
                    onClick={fechar}
                    className="transition-colors hover:text-[color:var(--cta)]"
                  >
                    Privacidade
                  </Link>
                </li>
                <li>
                  <Link
                    to="/termos"
                    onClick={fechar}
                    className="transition-colors hover:text-[color:var(--cta)]"
                  >
                    Termos
                  </Link>
                </li>
              </ul>
              <p
                className="text-3xl leading-tight text-primary-foreground/90 sm:text-4xl"
                style={SERIFA}
              >
                SEMPRE NA <br />
                HORA CERTA.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
