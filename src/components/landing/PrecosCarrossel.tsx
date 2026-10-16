import { useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

import { useMercadoDoDia } from "@/hooks/useMercadoDoDia";
import { brl, diaMesCurto, type ItemDoMercado } from "@/lib/mercadoLanding";

/**
 * Carrossel de preços REAIS do dia (BBM e Banco Central), no estilo da faixa de parceiros do site do Lando
 * Norris: título gigante em duas vozes (grotesca pesada + serifa fina), uma palavra de pincel atrás que anda
 * devagar com o scroll e a faixa de itens rolando sem parar. Só transform e opacidade; sem dado a faixa fica
 * invisível (altura reservada, sem deslocar a página) em vez de mostrar número inventado. Quem prefere menos
 * movimento recebe a faixa parada e rolável com o dedo.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Letras que sobem de dentro de uma máscara, uma a uma, quando o título entra na tela. */
function Letras({
  texto,
  className,
  visivel,
  atraso = 0,
  fonte,
}: {
  texto: string;
  className: string;
  visivel: boolean;
  atraso?: number;
  fonte?: string;
}) {
  return (
    <span
      className={className}
      style={fonte ? { fontFamily: fonte } : undefined}
      aria-hidden="true"
    >
      {Array.from(texto).map((letra, i) => (
        <span
          key={i}
          className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom"
        >
          <motion.span
            className="inline-block"
            initial={{ y: "105%" }}
            animate={{ y: visivel ? 0 : "105%" }}
            transition={{ duration: 0.7, ease: EASE, delay: atraso + i * 0.045 }}
          >
            {letra}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function PrecosCarrossel() {
  const mercado = useMercadoDoDia();
  const itens = mercado?.itens ?? [];
  const dataRef = itens.reduce((m, i) => (i.data > m ? i.data : m), "");

  const secaoRef = useRef<HTMLElement>(null);
  // Observa o título inteiro (não cada letra: o overflow da máscara as marcaria como fora da tela).
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const tituloVisivel = useInView(tituloRef, { once: true, margin: "0px 0px -15% 0px" });
  const { scrollYProgress } = useScroll({ target: secaoRef, offset: ["start end", "end start"] });
  const pincelX = useTransform(scrollYProgress, [0, 1], ["-8%", "10%"]);
  const pincelRot = useTransform(scrollYProgress, [0, 1], [-11, -5]);

  return (
    <section
      ref={secaoRef}
      aria-labelledby="precos-do-dia"
      className="relative overflow-hidden bg-background py-14 sm:py-24"
    >
      {/* Palavra de pincel atrás do título, na cor do CTA */}
      <motion.span
        aria-hidden="true"
        style={{ x: pincelX, rotate: pincelRot, fontFamily: '"Caveat Brush", cursive' }}
        className="pointer-events-none absolute top-[-2%] left-[38%] sm:top-[18%] text-[clamp(9rem,38vw,27rem)] leading-none text-[color:var(--cta)]/90 select-none sm:left-[30%]"
      >
        hoje
      </motion.span>

      <div className="relative mx-auto grid max-w-6xl items-start gap-6 px-4 sm:px-6 lg:grid-cols-[1.25fr_1fr]">
        <h2 ref={tituloRef} id="precos-do-dia" aria-label="Preços e mercado">
          <Letras
            texto="PREÇOS"
            visivel={tituloVisivel}
            className="font-display block text-[clamp(3.4rem,13vw,7.5rem)] leading-[0.86] font-extrabold tracking-tight text-foreground"
          />
          <Letras
            texto="&MERCADO"
            visivel={tituloVisivel}
            atraso={0.25}
            fonte={'"Instrument Serif", "Times New Roman", serif'}
            className="block text-[clamp(3rem,11.5vw,6.6rem)] leading-[0.9] text-foreground"
          />
        </h2>
        <p className="max-w-sm text-base leading-snug text-foreground/85 lg:justify-self-end lg:pt-3 lg:text-lg">
          Os números que o Safralume cruza todo dia, com fonte e data. Pergunte o da sua praça no
          WhatsApp e receba na hora.
        </p>
      </div>

      {/* Faixa rolando */}
      <div
        aria-label="Preços de referência do dia"
        className="relative mt-12 min-h-[7.5rem] overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)] sm:mt-16 motion-reduce:overflow-x-auto"
      >
        <div
          className={`flex w-max items-center whitespace-nowrap transition-opacity duration-700 hover:[animation-play-state:paused] ${itens.length ? "animate-marquee-lento opacity-100" : "opacity-0"}`}
        >
          {[0, 1].map((metade) => (
            <div
              key={metade}
              aria-hidden={metade === 1 ? true : undefined}
              className="flex shrink-0 items-center"
            >
              {[0, 1, 2].flatMap((rep) =>
                itens.map((item) => <Cartao key={`${metade}-${rep}-${item.id}`} item={item} />),
              )}
            </div>
          ))}
        </div>
      </div>

      {dataRef ? (
        <p className="relative mt-6 px-4 text-center text-xs text-muted-foreground sm:px-6">
          Referências de {diaMesCurto(dataRef)} · BBM (média das praças) e Banco Central · soja e
          milho de MT, café de MG, trigo do PR
        </p>
      ) : null}
    </section>
  );
}

function Cartao({ item }: { item: ItemDoMercado }) {
  const v = item.varPct;
  const sobe = v !== null && v > 0.05;
  const desce = v !== null && v < -0.05;
  const valor = item.unidade === "dolar" ? brl(item.valor, 4) : brl(item.valor);
  return (
    <div className="flex shrink-0 flex-col gap-1 px-8 sm:px-14">
      <span className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase sm:text-xs">
        {item.rotulo}
      </span>
      <span className="font-display text-4xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-6xl">
        <span className="mr-1 text-xl font-bold text-foreground/60 sm:text-3xl">R$</span>
        {valor}
      </span>
      {v !== null ? (
        <span
          className={`text-sm font-semibold tabular-nums ${sobe ? "text-[#1f8f55]" : desce ? "text-[#c2412d]" : "text-muted-foreground"}`}
        >
          {sobe ? "▲" : desce ? "▼" : "•"} {brl(Math.abs(v), 1)}% em 7 dias
        </span>
      ) : null}
    </div>
  );
}
