import { Marquee } from "@/components/landing/Marquee";

// Mesmas culturas e fontes que a seção "Dado com origem clara" já cita no texto.
const CULTURAS = [
  "SOJA",
  "MILHO",
  "ALGODÃO",
  "CAFÉ",
  "BOI",
  "LEITE",
  "FEIJÃO",
  "TRIGO",
  "ARROZ",
  "E MAIS DE 70",
];
const FONTES = [
  "Conab",
  "Imea",
  "Deral/PR",
  "Epagri/SC",
  "Emater/RS",
  "BBM",
  "IEA-SP",
  "B3",
  "Conseleite",
];

/**
 * Faixa gigante entre "Como funciona" e o painel (a faixa de parceiros do Lando Norris, em escala maior):
 * as culturas em letra enorme, alternando cheia e contornada, e as fontes oficiais em serifa correndo no
 * sentido contrário. As duas aceleram com o scroll. O texto é todo real, vindo do que o produto cobre.
 */
export function FaixaGigante() {
  return (
    <section
      aria-label="Culturas cobertas: soja, milho, algodão, café, boi, leite, feijão, trigo, arroz e mais de 70 produtos. Fontes: Conab, Imea, Deral, Epagri, Emater, BBM, IEA-SP, B3 e Conseleite."
      className="overflow-hidden bg-primary py-10 text-primary-foreground sm:py-14"
    >
      <Marquee velocidade={70} repeticoes={2}>
        {CULTURAS.map((nome, i) => (
          <span
            key={nome}
            className="font-display flex items-center text-[clamp(3.6rem,13vw,9rem)] leading-none font-extrabold tracking-tight"
          >
            <span
              className={i % 2 ? "text-transparent" : ""}
              style={i % 2 ? { WebkitTextStroke: "2px oklch(0.97 0.01 90)" } : undefined}
            >
              {nome}
            </span>
            <span
              aria-hidden="true"
              className="mx-[0.35em] inline-block size-[0.16em] rounded-full bg-[color:var(--cta)]"
            />
          </span>
        ))}
      </Marquee>

      <Marquee velocidade={45} reverso repeticoes={3} className="mt-5 sm:mt-7">
        {FONTES.map((nome) => (
          <span
            key={nome}
            className="flex items-center text-[clamp(1.8rem,5.5vw,3.4rem)] leading-none text-primary-foreground/90"
            style={{ fontFamily: '"Instrument Serif", "Times New Roman", serif' }}
          >
            {nome.toUpperCase()}
            <span
              aria-hidden="true"
              className="mx-[0.7em] inline-block size-[0.2em] rounded-full bg-primary-foreground/40"
            />
          </span>
        ))}
      </Marquee>
    </section>
  );
}
