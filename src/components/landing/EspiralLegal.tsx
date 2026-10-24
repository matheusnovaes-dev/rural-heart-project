import { useEffect, useRef } from "react";
import { useScroll } from "framer-motion";

import { FOLHAS, GALHOS, VIEWBOX_ARVORE } from "@/components/landing/arvoreLegal";
import type { SecaoLegal } from "@/components/landing/PaginaLegal";

/**
 * Leitura em espiral das páginas legais (referência: a página "work" do Active Theory, com a espinha 3D no centro). As seções
 * viram cartões numa hélice em volta de uma árvore desenhada à mão; rolar gira a espiral, e o cartão da frente fica nítido e
 * legível enquanto os de trás recuam e escurecem. A árvore se desenha (tronco, galhos, folhas) conforme a leitura avança e
 * chega à copa na última seção.
 *
 * Só desktop de verdade e carregado sob demanda por PaginaLegal (o celular nunca baixa este arquivo nem a árvore). O texto
 * completo continua no HTML do servidor (versão em texto corrido), para busca, leitores de tela, impressão e revisão da Meta;
 * o botão "Ler em texto corrido" volta para ela. CSS 3D e SVG, sem WebGL: as atualizações por quadro só mexem em transform,
 * opacity e stroke-dashoffset.
 */
export default function EspiralLegal({
  secoes,
  aoSair,
}: {
  secoes: SecaoLegal[];
  aoSair: () => void;
}) {
  const palco = useRef<HTMLDivElement>(null);
  const cartoes = useRef<(HTMLElement | null)[]>([]);
  const galhos = useRef<(SVGPathElement | null)[]>([]);
  const folhas = useRef<(SVGPathElement | null)[]>([]);
  const pontos = useRef<(HTMLButtonElement | null)[]>([]);
  const { scrollYProgress } = useScroll({ target: palco, offset: ["start start", "end end"] });
  const n = secoes.length;

  useEffect(() => {
    let raf = 0;
    let atual = scrollYProgress.get();
    const desenhar = () => {
      raf = 0;
      const p = atual;
      // a árvore já começa brotando na 1ª seção e chega à copa na última
      const pa = 0.1 + p * 0.9;
      const a = p * (n - 1); // índice (contínuo) do cartão da frente
      cartoes.current.forEach((el, i) => {
        if (!el) return;
        const d = i - a;
        const ad = Math.abs(d);
        const ang = d * 52; // graus em volta da árvore
        const y = d * 34; // a hélice desce: os próximos cartões vêm de baixo
        el.style.transform = `translate(-50%, -50%) perspective(1600px) rotateY(${ang.toFixed(2)}deg) translateZ(430px) translateY(${y.toFixed(1)}vh) rotateY(${(-ang * 0.35).toFixed(2)}deg)`;
        el.style.opacity = String(Math.max(0, 1 - ad * 0.62));
        // o cartão da frente passa diante da árvore; os outros, atrás dela
        el.style.zIndex = ad < 0.5 ? "30" : String(5 - Math.min(4, Math.round(ad)));
        el.style.pointerEvents = ad < 0.5 ? "auto" : "none";
        el.dataset["frente"] = ad < 0.5 ? "1" : "0";
      });
      // árvore: cada galho se desenha na sua janela da rolagem
      GALHOS.forEach((g, i) => {
        const el = galhos.current[i];
        if (!el) return;
        const k = Math.max(0, Math.min(1, (pa - g.s) / g.t));
        el.style.strokeDashoffset = String(1 - k);
      });
      FOLHAS.forEach((f, i) => {
        const el = folhas.current[i];
        if (!el) return;
        const k = Math.max(0, Math.min(1, (pa - f.s) / 0.05));
        el.style.opacity = String(k);
        el.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.a}deg) scale(${(f.k * (0.3 + 0.7 * k)).toFixed(3)})`;
      });
      const frente = Math.round(a);
      pontos.current.forEach((b, i) => {
        if (b) b.dataset["ativo"] = i === frente ? "1" : "0";
      });
    };
    const pedir = (v: number) => {
      atual = v;
      if (!raf) raf = requestAnimationFrame(desenhar);
    };
    pedir(scrollYProgress.get());
    const parar = scrollYProgress.on("change", pedir);
    return () => {
      parar();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollYProgress, n]);

  const irPara = (i: number) => {
    const el = palco.current;
    if (!el) return;
    const topo = el.getBoundingClientRect().top + window.scrollY;
    const curso = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: topo + (curso * i) / Math.max(1, n - 1), behavior: "smooth" });
  };

  return (
    <div
      ref={palco}
      className="relative bg-primary text-primary-foreground"
      style={{ height: `${n * 70 + 100}vh` }}
    >
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_55%,#1e4d37,transparent_72%)]"
        />
        <div className="absolute inset-0">
          {/* a árvore, no centro da hélice (plano z = 0: cartões da frente passam diante dela, os de trás, atrás) */}
          <svg
            aria-hidden="true"
            viewBox={VIEWBOX_ARVORE}
            className="pointer-events-none absolute top-1/2 left-[71%] z-10 h-[90%] -translate-x-1/2 -translate-y-1/2 overflow-visible"
          >
            <defs>
              <linearGradient id="arvore-g" x1="0" x2="0" y1="1" y2="0">
                <stop offset="0" stopColor="#D9771A" />
                <stop offset="0.6" stopColor="#EFA243" />
                <stop offset="1" stopColor="#FFC874" />
              </linearGradient>
            </defs>
            {GALHOS.map((g, i) => (
              <path
                key={i}
                ref={(el) => {
                  galhos.current[i] = el;
                }}
                d={g.d}
                pathLength={1}
                fill="none"
                stroke="url(#arvore-g)"
                strokeWidth={g.w}
                strokeLinecap="round"
                strokeDasharray="1 1"
                strokeDashoffset={1}
                opacity={0.9}
              />
            ))}
            {FOLHAS.map((f, i) => (
              <path
                key={i}
                ref={(el) => {
                  folhas.current[i] = el;
                }}
                d="M0 0 Q14 -10 32 0 Q14 10 0 0Z"
                fill="#9fbf6a"
                opacity={0}
              />
            ))}
          </svg>

          {secoes.map((s, i) => (
            <article
              key={s.id}
              ref={(el) => {
                cartoes.current[i] = el;
              }}
              aria-label={s.titulo}
              className="group absolute top-1/2 left-[37%] w-[min(34rem,38vw)] rounded-3xl border border-white/15 bg-[linear-gradient(150deg,rgba(38,92,66,0.94),rgba(18,58,40,0.9))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-saturate-150 will-change-transform data-[frente=1]:border-white/25"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-3xl bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.10)_48%,transparent_62%)]"
              />
              <p className="font-mono text-[11px] font-semibold tracking-[0.22em] text-primary-foreground/55 uppercase">
                {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")} -&gt; seção
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">{s.titulo}</h2>
              <div className="mt-4 text-[15px] leading-relaxed text-primary-foreground/80 [&_a]:underline [&_p+p]:mt-3">
                {s.corpo}
              </div>
            </article>
          ))}
        </div>

        {/* índice: pontos numerados à esquerda, e o botão para a leitura em texto corrido */}
        <nav aria-label="Seções" className="absolute top-1/2 left-8 z-40 -translate-y-1/2">
          <ul className="flex flex-col gap-1">
            {secoes.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  ref={(el) => {
                    pontos.current[i] = el;
                  }}
                  onClick={() => irPara(i)}
                  className="group/p flex items-center gap-3 py-1 font-mono text-[11px] tracking-[0.18em] text-primary-foreground/45 uppercase transition-colors hover:text-primary-foreground data-[ativo=1]:text-[color:var(--cta)]"
                >
                  <span className="w-5">{String(i + 1).padStart(2, "0")}</span>
                  <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover/p:max-w-[14rem] group-hover/p:opacity-100 group-data-[ativo=1]/p:max-w-[14rem] group-data-[ativo=1]/p:opacity-100">
                    {s.titulo}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          onClick={aoSair}
          className="absolute right-8 bottom-8 z-40 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-white/20"
        >
          Ler em texto corrido -&gt;
        </button>
        <p
          aria-hidden="true"
          className="absolute bottom-9 left-8 font-mono text-[10px] tracking-[0.22em] text-primary-foreground/40 uppercase"
        >
          Role para ler
        </p>
      </div>
    </div>
  );
}
