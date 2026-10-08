import { motion, useMotionTemplate, useMotionValue, useScroll, useTransform } from "framer-motion";
import { useRef, type MouseEvent } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

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
        <motion.div className="absolute inset-x-0 inset-y-[-14%]" style={{ y: fotoY }}>
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
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.22_0.03_60/0.3)_0%,oklch(0.17_0.03_60/0.74)_32%,oklch(0.15_0.03_60/0.82)_68%,oklch(0.988_0.005_95.1)_100%)]" />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden mix-blend-soft-light sm:block"
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
          className="absolute inset-x-0 bottom-0 h-20 w-full sm:h-28"
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
          className="absolute inset-x-0 bottom-0 h-16 w-full sm:h-24"
          style={{ y: cristaFrenteY }}
        >
          <path d="M0,80 C360,40 1080,120 1440,70 L1440,120 L0,120 Z" className="fill-background" />
        </motion.svg>
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90"
        >
          <BadgeCheck className="size-3.5" />
          Dados oficiais Conab e órgãos estaduais
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-balance font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Você vende sem saber se o preço tá bom?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-5 max-w-2xl text-pretty text-lg text-white/85"
        >
          O porto paga mais do que você recebe, e o frete muda a conta. O Safralume cruza os dois e
          te avisa no WhatsApp, na hora de decidir.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8"
        >
          <Button
            asChild
            size="lg"
            className="bg-cta text-cta-foreground hover:bg-cta/90 h-12 px-8 text-base"
          >
            <a href="#comece">
              Testar grátis por 7 dias
              <ArrowRight className="size-4" />
            </a>
          </Button>
          {/* Mesmo padrão do Stripe/Linear: tira o atrito percebido bem no
              ponto da decisão, não só lá embaixo no FinalCta. */}
          <p className="mt-3 text-xs font-medium text-white/60">Sem cartão de crédito</p>
        </motion.div>
      </div>
    </section>
  );
}
