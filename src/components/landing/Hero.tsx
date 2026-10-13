import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef, type MouseEvent } from "react";
import { BadgeCheck, ShieldCheck, Sprout } from "lucide-react";

import { CampoWhatsappCta } from "@/components/landing/CampoWhatsappCta";
import { useCadastro } from "@/components/landing/CadastroProvider";
import { useExemplosDoDia } from "@/hooks/useExemplosDoDia";
import { fraseDeSinal } from "@/lib/exemplosLanding";

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

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pt-14 pb-24 text-center sm:px-6 sm:pt-24 sm:pb-32 lg:max-w-6xl lg:flex-row lg:items-center lg:justify-between lg:gap-14 lg:pt-20 lg:pb-36 lg:text-left">
        <div className="flex w-full flex-col items-center lg:max-w-2xl lg:items-start">
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
            className="text-balance font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-5xl xl:text-[3.25rem]"
          >
            Preço você já sabe. Mas sabe se é hora de vender?
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 max-w-2xl text-balance text-base text-white/85 sm:mt-5 sm:text-lg"
          >
            Preço de hoje, pra onde o mercado aponta e 90 dias de histórico, avisados no seu
            WhatsApp na hora certa de vender.
          </motion.p>

          <motion.div
            id="hero-cadastro"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-7 w-full max-w-xl sm:mt-8 lg:max-w-lg"
          >
            {/* O CTA virou o próprio campo de WhatsApp: antes era um botão que
              rolava ~10 mil px até o formulário do rodapé (achado da
              auditoria de UX 2026-10-13, 94% do tráfego é celular). Agora o
              cadastro começa aqui, no momento da decisão. */}
            <CampoWhatsappCta
              variante="escuro"
              aoEnviar={(whatsapp) => abrirCadastro({ whatsapp, origem: "hero" })}
            />
            <p className="mt-3 text-center text-[13px] font-medium text-balance text-white/85 sm:text-sm lg:text-left">
              <ShieldCheck
                className="mr-1.5 -mt-0.5 inline size-4 align-middle"
                aria-hidden="true"
              />
              7 dias grátis · Sem cartão · Cancele quando quiser
            </p>
          </motion.div>
        </div>
        <HeroConversa />
      </div>
    </section>
  );
}

/**
 * O produto à vista já na primeira tela (só no desktop): a pergunta e a resposta
 * que o produtor recebe no WhatsApp. Os preços do exemplo são ilustrativos e a
 * legenda diz isso; o sinal de venda usa o futuro real do dia quando há dado.
 */
function HeroConversa() {
  const exemplos = useExemplosDoDia();
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.45 }}
      className="hidden w-full max-w-sm shrink-0 lg:block"
      aria-hidden="true"
    >
      <div className="rounded-[2rem] border-[7px] border-[oklch(0.244_0.026_155.8)] bg-[oklch(0.244_0.026_155.8)] shadow-2xl">
        <div className="overflow-hidden rounded-[1.5rem] bg-[#e5ded4]">
          <div className="flex items-center gap-3 bg-[oklch(0.331_0.049_156.2)] px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white">
              <Sprout className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Safralume</p>
              <p className="text-xs text-white/70">online</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 px-3 py-4 text-sm text-[#111b21]">
            <p className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2">
              Quanto está a soja em Rio Verde? Vale vender agora?
            </p>
            <div className="mr-auto max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
              <p>
                Soja em Cascavel/PR hoje: <strong>R$ 151,00/saca</strong>.
              </p>
              <p className="mt-1">
                No porto de Paranaguá a saca vale R$ 162,50. Tirando o frete (R$ 12,30), sobram R$
                150,20.
              </p>
              <p className="mt-1 text-xs text-[#667781]">Fonte: BBM · atualizado às 08:12</p>
            </div>
            <div className="mr-auto max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
              <p>🎯 {fraseDeSinal(exemplos?.futuroSoja ?? null)}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-white/75">Exemplo ilustrativo de conversa</p>
    </motion.div>
  );
}
