import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { MIDIA } from "@/assets/midia";
import { buildWhatsAppLink, siteConfig } from "@/config/site";

const SERIFA = { fontFamily: '"Instrument Serif", "Times New Roman", serif' };
const BOTAO =
  "inline-flex h-12 items-center justify-center rounded-xl px-6 text-base font-bold transition-[transform,background-color] active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-cta/40 focus-visible:outline-none";

/**
 * Tela de aviso da marca (404 e erro inesperado): fundo verde escuro com brilho quente, número gigante em degradê,
 * título em duas vozes (grotesca + serifa) e saídas claras (início, preços, WhatsApp). HTML e CSS puros, sem framer-motion
 * nem imagens além do logo, pra aparecer na hora mesmo quando algo deu errado.
 */
export function PaginaDeAviso({
  codigo,
  antes,
  serifa,
  texto,
  acaoPrincipal,
  mostrarPrecos = true,
}: {
  codigo: string;
  antes: string;
  serifa: string;
  texto: string;
  acaoPrincipal: ReactNode;
  mostrarPrecos?: boolean;
}) {
  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#0e1d15] text-[#f6f3ec]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 600px at 85% -10%, rgba(217,164,65,.28), transparent 65%), radial-gradient(800px 700px at -10% 110%, rgba(64,140,96,.38), transparent 62%), linear-gradient(180deg,#0e1d15,#12281c)",
        }}
      />
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-5 sm:px-6">
        <a href="/" className="flex items-center gap-2">
          <img src={MIDIA.logo} alt="" className="size-8 rounded-[0.6rem]" />
          <span className="text-lg font-bold tracking-tight">{siteConfig.name}</span>
        </a>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16 text-center sm:px-6">
        <p
          aria-hidden="true"
          className="font-display bg-gradient-to-b from-[#f4cf7a] to-[#e8912a] bg-clip-text text-[clamp(6rem,26vw,15rem)] leading-[0.85] font-extrabold tracking-tighter text-transparent"
        >
          {codigo}
        </p>
        <h1 className="font-display mt-4 text-[clamp(2rem,7vw,3.6rem)] leading-[1] font-extrabold tracking-tight">
          {antes}{" "}
          <span
            className="text-[1.2em] leading-[0.8] font-normal tracking-normal whitespace-nowrap text-[#e9b44c]"
            style={SERIFA}
          >
            {serifa}
          </span>
        </h1>
        <p className="mt-5 max-w-md text-base leading-snug text-[#f6f3ec]/75 sm:text-lg">{texto}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {acaoPrincipal}
          {mostrarPrecos ? (
            <Link
              to="/"
              hash="precos"
              className={`${BOTAO} border border-[#f6f3ec]/25 text-[#f6f3ec] hover:bg-[#f6f3ec]/10`}
            >
              Ver os preços de hoje
            </Link>
          ) : null}
          <a
            href={buildWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BOTAO} border border-[#f6f3ec]/25 text-[#f6f3ec] hover:bg-[#f6f3ec]/10`}
          >
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}

export const BOTAO_PRINCIPAL = `${BOTAO} bg-[#ee942b] text-[#1b1206] shadow-lg shadow-[#ee942b]/25 hover:bg-[#f2a444]`;
