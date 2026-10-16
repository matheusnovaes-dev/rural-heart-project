import { ContaAte } from "@/components/landing/ContaAte";
import {
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, type MouseEvent } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";

import { CampoWhatsappCta } from "@/components/landing/CampoWhatsappCta";
import { useCadastro } from "@/components/landing/CadastroProvider";

// Título em movimento: cada palavra entra sozinha (só transform e opacidade, nada que force recalcular
// layout). O trecho em destaque ganha a cor do CTA e um traço que se desenha por baixo.
const PALAVRAS_TITULO = [
  "Preço",
  "você",
  "já",
  "sabe.",
  "Mas",
  "sabe",
  "se",
  "é",
  "hora",
  "de",
  "vender?",
];
const A_PARTIR_DO_DESTAQUE = 8;

export function Hero() {
  const { abrirCadastro } = useCadastro();
  const sectionRef = useRef<HTMLElement>(null);
  // Parallax de scroll e luz-no-cursor são exatamente os dois efeitos que os
  // guias de acessibilidade mais citam como gatilho de enjoo em
  // prefers-reduced-motion — e nenhum dos dois é "positional key" do
  // framer-motion (y via useTransform de scroll, background via
  // useMotionTemplate), então o <MotionConfig reducedMotion="user"> do root
  // não os cobre sozinho. Checagem manual aqui (achado da auditoria
  // 2026-10-09).
  const prefereMenosMovimento = useReducedMotion();

  // Parallax orgânico ligado ao scroll (não ao mouse, por isso funciona em
  // touch também): a foto e as duas "cristas" de lavoura na base se movem em
  // velocidades diferentes enquanto a Hero passa pela tela, dando a sensação
  // de profundidade real — técnica de camadas usada em sites premiados de
  // agro no Awwwards (Farm Minerals, CleverFarm), adaptada ao clima calmo da
  // marca em vez do visual vibrante deles.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const fotoY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const cristaFundoY = useTransform(scrollYProgress, [0, 1], ["0px", "30px"]);
  const cristaFrenteY = useTransform(scrollYProgress, [0, 1], ["0px", "55px"]);

  // Luz dourada que segue o cursor sobre a foto — inspirado no site do Lando
  // Norris (blob reativo ao mouse no hero, premiado em design 2026), mas
  // adaptado ao clima calmo da marca: em vez de neon de F1, é "sol se
  // movendo pela lavoura" (mesma cor do CTA, --cta). Motion values em vez
  // de state: framer-motion escreve direto no DOM a cada movimento do
  // mouse, sem re-renderizar o componente React centenas de vezes por
  // segundo. Só desktop (sm:block) — toque no celular não tem "mouse
  // passando por cima", e economiza o listener onde mais importa performance.
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(35);
  const luz = useMotionTemplate`radial-gradient(500px circle at ${mouseX}% ${mouseY}%, color-mix(in oklab, var(--cta) 55%, transparent), transparent 70%)`;

  function seguirCursor(e: MouseEvent<HTMLElement>) {
    if (prefereMenosMovimento) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(((e.clientX - rect.left) / rect.width) * 100);
    mouseY.set(((e.clientY - rect.top) / rect.height) * 100);
  }

  return (
    <section
      ref={sectionRef}
      id="topo"
      className="relative overflow-hidden"
      onMouseMove={seguirCursor}
    >
      <div className="absolute inset-0">
        {/* inset-y-[-14%] dá uma "sobra" de foto pra cima e pra baixo: o
            translateY do parallax (±10%) nunca chega a expor uma borda vazia. */}
        <motion.div
          className="absolute inset-x-0 inset-y-[-14%] motion-reduce:transform-none!"
          style={{ y: fotoY }}
        >
          <picture>
            {/* A foto fica sob um gradiente escuro que cobre quase toda ela: as versões
                pequenas (640px/1000px, 14-29 KB) são idênticas a olho nu e tiram ~140 KB
                do caminho crítico de quem chega do anúncio pelo celular. */}
            <source
              media="(max-width: 640px)"
              srcSet="/images/hero-field-640.webp"
              type="image/webp"
            />
            <source srcSet="/images/hero-field-1000.webp" type="image/webp" />
            <img
              src="/images/hero-field-1000.jpg"
              alt="Lavoura ao entardecer"
              className="size-full object-cover"
              fetchPriority="high"
            />
          </picture>
        </motion.div>
        {/* A foto é um pôr do sol de verdade (céu dramático, trigo dourado) —
            o overlay antigo (preto-esverdeado, hue 158, até 88% opaco já no
            topo) enterrava exatamente essa cor. 4 paradas em vez de 2: o
            topo (onde só tem céu) fica bem mais claro pra mostrar as nuvens,
            escurece com força só a partir de onde o texto começa, e o tom é
            quente (hue 60, like --cta) em vez de frio, pra combinar com a
            própria foto em vez de brigar com ela. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.22_0.03_60/0.3)_0%,oklch(0.17_0.03_60/0.74)_32%,oklch(0.15_0.03_60/0.84)_78%,oklch(0.988_0.005_95.1)_100%)]" />
        {/* Sempre renderizada (escondida por CSS em motion-reduce): renderizar
            condicional por useReducedMotion gera HTML diferente entre servidor
            (sem preferência) e cliente (com preferência), e o React derruba e
            refaz a árvore inteira (erro #418 em produção pra quem reduz movimento). */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden mix-blend-soft-light sm:block motion-reduce:hidden"
          style={{ background: luz }}
        />

        {/* Crista de lavoura em duas camadas: a de trás (mais clara, tom
            verde suave) se move menos que a da frente (cor exata do fundo da
            página), criando profundidade na transição pra seção seguinte em
            vez do corte reto de antes. */}
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-20 w-full sm:h-28 motion-reduce:transform-none!"
          style={{ y: cristaFundoY }}
        >
          <path
            d="M0,60 C240,20 480,100 720,60 C960,20 1200,100 1440,60 L1440,120 L0,120 Z"
            className="fill-accent"
          />
        </motion.svg>
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-16 w-full sm:h-24 motion-reduce:transform-none!"
          style={{ y: cristaFrenteY }}
        >
          <path d="M0,80 C360,40 1080,120 1440,70 L1440,120 L0,120 Z" className="fill-background" />
        </motion.svg>
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pt-14 pb-24 text-center sm:px-6 sm:pt-24 sm:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90"
        >
          <BadgeCheck className="size-3.5" />
          Fontes públicas: Conab, órgãos estaduais e bolsas
        </motion.div>

        <h1
          data-profundidade="14"
          className="text-balance font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          {PALAVRAS_TITULO.map((palavra, i) => {
            const destaque = i >= A_PARTIR_DO_DESTAQUE;
            const ultima = i === PALAVRAS_TITULO.length - 1;
            return (
              <span key={palavra + i}>
                <motion.span
                  initial={{ opacity: 0, y: "0.55em" }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 + i * 0.055, ease: [0.22, 1, 0.36, 1] }}
                  className={`relative inline-block ${destaque ? "text-[color:var(--cta)]" : ""}`}
                >
                  {palavra}
                  {ultima ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 100 8"
                      preserveAspectRatio="none"
                      className="pointer-events-none absolute -bottom-1 left-0 h-2 w-full"
                    >
                      <motion.path
                        d="M1 5 Q 25 0 50 4 T 99 3"
                        fill="none"
                        stroke="var(--cta)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                          duration: 0.7,
                          delay: 0.1 + i * 0.055 + 0.45,
                          ease: "easeOut",
                        }}
                      />
                    </svg>
                  ) : null}
                </motion.span>
                {ultima ? "" : " "}
              </span>
            );
          })}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          data-profundidade="7"
          className="mt-4 max-w-2xl text-balance text-base text-white/85 sm:mt-5 sm:text-lg"
        >
          Preço de hoje, pra onde o mercado aponta e 90 dias de histórico, avisados no seu WhatsApp
          na hora certa de vender.
        </motion.p>

        <motion.div
          id="hero-cadastro"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-7 w-full max-w-xl sm:mt-8"
        >
          {/* O CTA virou o próprio campo de WhatsApp: antes era um botão que
              rolava ~10 mil px até o formulário do rodapé (achado da
              auditoria de UX 2026-10-13, 94% do tráfego é celular). Agora o
              cadastro começa aqui, no momento da decisão. */}
          <CampoWhatsappCta
            variante="escuro"
            aoEnviar={(whatsapp) => abrirCadastro({ whatsapp, origem: "hero" })}
          />
          <p className="mt-3 text-center text-[13px] font-medium text-balance text-white/85 sm:text-sm">
            <ShieldCheck className="mr-1.5 -mt-0.5 inline size-4 align-middle" aria-hidden="true" />
            7 dias grátis · Sem cartão · Cancele quando quiser
          </p>
          <ul className="mt-4 flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1 text-[13px] text-white/80 sm:text-sm">
            <li>
              <b className="font-display text-base text-white tabular-nums sm:text-lg">
                <ContaAte alvo={70} sufixo="+" />
              </b>{" "}
              produtos
            </li>
            <li>
              <b className="font-display text-base text-white tabular-nums sm:text-lg">
                <ContaAte alvo={90} />
              </b>{" "}
              dias de histórico
            </li>
            <li>fonte e data em toda resposta</li>
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
