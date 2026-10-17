import lavoura440 from "@/assets/fotos/lavoura-entardecer-440.webp?url";
import lavoura760 from "@/assets/fotos/lavoura-entardecer-760.webp?url";
import estrada440 from "@/assets/fotos/estrada-safra-440.webp?url";
import estrada760 from "@/assets/fotos/estrada-safra-760.webp?url";
import aerea440 from "@/assets/fotos/soja-aerea-440.webp?url";
import aerea760 from "@/assets/fotos/soja-aerea-760.webp?url";

import { Reveal } from "@/components/landing/Reveal";
import { RevelarImagem } from "@/components/landing/RevelarImagem";
import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";

/**
 * Faixa de fotos com legenda, no estilo das fotos de largura total do site do Lando Norris: três cenas da lavoura em
 * retrato, reveladas por máscara. No desktop ficam lado a lado e em alturas escalonadas; no celular viram uma fileira
 * que desliza pro lado (scroll-snap, sem JavaScript). Imagens leves (WebP de 440px no celular, 760px no desktop, via
 * srcset), com carregamento preguiçoso: só descem quando a faixa chega perto. Imagens geradas com IA, e o texto diz isso.
 */
const FOTOS = [
  {
    n: "01",
    legenda: "Soja ao entardecer",
    a: lavoura440,
    b: lavoura760,
    alt: "Fileiras de soja sob um céu de tempestade com o sol se pondo ao fundo",
  },
  {
    n: "02",
    legenda: "A estrada da safra",
    a: estrada440,
    b: estrada760,
    alt: "Estrada de terra entre lavouras ao pôr do sol, com caminhões ao longe",
  },
  {
    n: "03",
    legenda: "A lavoura vista de cima",
    a: aerea440,
    b: aerea760,
    alt: "Vista aérea de uma lavoura de soja em fileiras, ao amanhecer",
  },
] as const;

export function FaixaDeFotos() {
  return (
    <section aria-labelledby="faixa-fotos" className="relative overflow-hidden py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <TituloDuasVozes
            id="faixa-fotos"
            antes="Cada saca começa"
            serifa="NO CAMPO."
            className="text-foreground"
          />
          <p className="mt-3 max-w-md text-muted-foreground">
            É de lá que vem o número que você recebe: preço de praça, com fonte e data.
          </p>
        </Reveal>

        <ul className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:items-start md:gap-6 md:overflow-visible md:px-0 md:pb-0">
          {FOTOS.map((f, i) => (
            <li
              key={f.n}
              className={`w-[72vw] max-w-80 shrink-0 snap-center md:w-auto md:max-w-none ${i === 1 ? "md:mt-14" : i === 2 ? "md:mt-6" : ""}`}
            >
              <figure>
                <RevelarImagem>
                  <div className="aspect-[4/5] overflow-hidden">
                    <img
                      src={f.a}
                      srcSet={`${f.a} 440w, ${f.b} 760w`}
                      sizes="(min-width: 768px) 33vw, 72vw"
                      alt={f.alt}
                      width={440}
                      height={550}
                      data-parallax
                      data-cursor="Ver"
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  </div>
                </RevelarImagem>
                <figcaption className="mt-3 flex items-baseline gap-3 text-sm font-medium text-foreground">
                  <span
                    className="text-2xl leading-none text-[color:var(--cta)] italic"
                    style={{ fontFamily: '"Instrument Serif", "Times New Roman", serif' }}
                  >
                    {f.n}
                  </span>
                  {f.legenda}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted-foreground">Imagens ilustrativas, criadas com IA.</p>
      </div>
    </section>
  );
}
