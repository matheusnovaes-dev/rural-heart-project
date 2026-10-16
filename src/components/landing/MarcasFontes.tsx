import type { CSSProperties, ReactNode } from "react";

import { Marquee } from "@/components/landing/Marquee";

/**
 * Faixa de "marcas" das fontes oficiais (a faixa de patrocinadores do rodapé do site do Lando Norris), mas com o que é
 * nosso de verdade: cada fonte de dados aparece em sua própria composição tipográfica, na cor do CTA, com um pequeno
 * sinal gráfico entre elas. São grafias do NOME de cada órgão (não os logotipos oficiais, que têm direitos próprios).
 * Roda como o Marquee da landing: anda sozinha e acelera com o scroll; no celular é a mesma faixa, só menor.
 */
const SANS = "var(--font-sans)";
const DISPLAY = "var(--font-display)";
const MONO = "var(--font-mono)";
const SERIFA = '"Instrument Serif", "Times New Roman", serif';

type Marca = { nome: string; node: ReactNode };

const base: CSSProperties = { lineHeight: 1, whiteSpace: "nowrap" };

const marcas: Marca[] = [
  {
    nome: "Conab",
    node: (
      <span style={{ ...base, fontFamily: DISPLAY, fontWeight: 800, letterSpacing: "-0.04em" }}>
        conab<span style={{ color: "#fff" }}>.</span>
      </span>
    ),
  },
  {
    nome: "Imea",
    node: (
      <span
        style={{
          ...base,
          fontFamily: SANS,
          fontWeight: 700,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
        }}
      >
        imea
      </span>
    ),
  },
  {
    nome: "Deral PR",
    node: (
      <span style={{ ...base, fontFamily: SERIFA, fontStyle: "italic", fontSize: "1.18em" }}>
        Deral
        <span
          style={{
            fontFamily: DISPLAY,
            fontStyle: "normal",
            fontWeight: 800,
            fontSize: "0.55em",
            marginLeft: "0.3em",
            letterSpacing: "0.1em",
          }}
        >
          PR
        </span>
      </span>
    ),
  },
  {
    nome: "Epagri Cepa SC",
    node: (
      <span style={{ ...base, fontFamily: DISPLAY, fontWeight: 700, letterSpacing: "-0.02em" }}>
        epagri
        <span
          style={{
            fontFamily: SERIFA,
            fontStyle: "italic",
            fontWeight: 400,
            marginLeft: "0.2em",
            fontSize: "1.1em",
          }}
        >
          cepa
        </span>
      </span>
    ),
  },
  {
    nome: "Emater RS Ascar",
    node: (
      <span
        style={{
          ...base,
          fontFamily: SANS,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Emater<span style={{ fontWeight: 500, opacity: 0.8 }}>/RS</span>
      </span>
    ),
  },
  {
    nome: "BBM",
    node: (
      <span
        style={{
          ...base,
          fontFamily: DISPLAY,
          fontWeight: 800,
          letterSpacing: "-0.06em",
          fontSize: "1.2em",
        }}
      >
        BBM
      </span>
    ),
  },
  {
    nome: "IEA SP",
    node: (
      <span style={{ ...base, fontFamily: MONO, fontWeight: 600, letterSpacing: "0.08em" }}>
        [iea<span style={{ color: "#fff" }}>·</span>sp]
      </span>
    ),
  },
  {
    nome: "B3",
    node: (
      <span
        style={{
          ...base,
          fontFamily: DISPLAY,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          fontSize: "1.25em",
        }}
      >
        B<span style={{ fontFamily: SERIFA, fontStyle: "italic", fontWeight: 400 }}>³</span>
      </span>
    ),
  },
  {
    nome: "Conseleite",
    node: (
      <span style={{ ...base, fontFamily: SERIFA, fontSize: "1.2em", letterSpacing: "0.01em" }}>
        Conseleite
      </span>
    ),
  },
];

function Sinal() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mx-8 size-4 shrink-0 text-primary-foreground/35 sm:mx-14 sm:size-5"
    >
      <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="currentColor" />
    </svg>
  );
}

export function MarcasFontes() {
  return (
    <div
      role="img"
      aria-label="Fontes dos dados: Conab, Imea, Deral/PR, Epagri/SC, Emater/RS, BBM, IEA-SP, B3 e Conseleite"
      className="relative border-b border-white/10 py-7 text-[color:var(--cta)] sm:py-11 [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]"
    >
      <p className="mb-4 px-5 text-center text-[11px] font-semibold tracking-[0.24em] text-primary-foreground/55 uppercase sm:mb-6 sm:text-xs">
        Fontes oficiais dos nossos dados
      </p>
      <Marquee velocidade={42} repeticoes={2}>
        {marcas.map((m) => (
          <span key={m.nome} className="flex items-center text-[1.9rem] sm:text-[3.1rem]">
            {m.node}
            <Sinal />
          </span>
        ))}
      </Marquee>
    </div>
  );
}
