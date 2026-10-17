import { useRef } from "react";
import { useInView } from "framer-motion";

import { Marquee } from "@/components/landing/Marquee";
import { Pincel } from "@/components/landing/Pincel";

import { useMercadoDoDia } from "@/hooks/useMercadoDoDia";
import { brl, diaMesCurto, type ItemDoMercado } from "@/lib/mercadoLanding";

/**
 * Carrossel de preços REAIS do dia (BBM e Banco Central), no estilo da faixa de parceiros do site do Lando
 * Norris: título gigante em duas vozes (grotesca pesada + serifa fina), uma palavra de pincel atrás (em tom suave, para não competir com os números) que anda
 * devagar com o scroll e a faixa de itens rolando sem parar. Só transform e opacidade; sem dado a faixa fica
 * invisível (altura reservada, sem deslocar a página) em vez de mostrar número inventado. Quem prefere menos
 * movimento recebe a faixa parada e rolável com o dedo.
 */

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
          <span
            className="inline-block motion-reduce:transition-none"
            style={{
              transform: visivel ? "translateY(0)" : "translateY(105%)",
              transition: `transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${(atraso + i * 0.045) * 1000}ms`,
            }}
          >
            {letra}
          </span>
        </span>
      ))}
    </span>
  );
}

export function PrecosCarrossel() {
  const mercado = useMercadoDoDia();
  const itens = mercado?.itens ?? [];
  const dataRef = itens.reduce((m, i) => (i.data > m ? i.data : m), "");

  // Observa o título inteiro (não cada letra: o overflow da máscara as marcaria como fora da tela).
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const tituloVisivel = useInView(tituloRef, { once: true, margin: "0px 0px -15% 0px" });

  return (
    <section
      id="precos"
      aria-labelledby="precos-do-dia"
      className="relative overflow-hidden bg-background py-14 sm:py-24"
    >
      <Pincel
        palavra="hoje"
        className="top-[-2%] left-[38%] text-[clamp(9rem,38vw,27rem)] text-[color:var(--cta)]/28 sm:top-[8%] sm:left-[34%]"
      />

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
        className={`relative mt-12 min-h-[7.5rem] [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)] transition-opacity duration-700 sm:mt-16 ${itens.length ? "opacity-100" : "opacity-0"}`}
      >
        <Marquee velocidade={55} repeticoes={3}>
          {itens.map((item) => (
            <Cartao key={item.id} item={item} />
          ))}
        </Marquee>
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
