import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { Reveal } from "@/components/landing/Reveal";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";

const steps = [
  {
    icon: IconesSafralume.whatsapp,
    title: "1. Mande uma mensagem",
    description: "Pergunte o preço da sua cultura e cidade, do jeito que você já usa o WhatsApp.",
  },
  {
    icon: IconesSafralume["dado-oficial"],
    title: "2. Cruzamos os dados oficiais",
    description:
      "Consultamos Conab e órgãos estaduais na hora e comparamos com o preço do porto e o frete.",
  },
  {
    icon: IconesSafralume.preco,
    title: "3. Você recebe o número certo",
    description:
      "Preço da sua região, do porto e o frete, com fonte e data, pronto para decidir sem depender de planilha.",
  },
];

/**
 * Vídeo 3D/cinematográfico (gerado por IA, pedido do Matheus 2026-10-12)
 * mostrando 5 perguntas reais do produto em loop: preço, câmbio, janela de
 * plantio, benchmark regional, sinal de venda — dados reais do dia em que
 * foi gerado, não é um preview ao vivo. 14MB mesmo já comprimido (de 37MB
 * original via AVFoundation, sem ffmpeg disponível na máquina), então só
 * carrega quando a seção chega perto da viewport (IntersectionObserver),
 * nunca no load inicial da página. Quem prefere menos movimento recebe só
 * o primeiro frame como imagem estática, sem autoplay.
 */
function VideoComoFunciona() {
  const prefereMenosMovimento = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisivel(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      data-cursor="Ver"
      className="mx-auto aspect-[4/5] w-full max-w-3xl overflow-hidden rounded-2xl bg-[#101c15] shadow-lg sm:aspect-video"
    >
      {visivel && !prefereMenosMovimento ? (
        <video
          src="/videos/como-funciona.mp4"
          poster="/videos/como-funciona-poster.png"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          className="size-full object-cover"
        />
      ) : (
        <img
          src="/videos/como-funciona-poster.png"
          alt="Conversa de exemplo no WhatsApp com o Safralume, mostrando preço, câmbio, janela de plantio, comparação regional e sinal de venda"
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}

/**
 * O vídeo "abre" conforme a seção sobe pela tela: começa recortado e arredondado e se revela até ocupar
 * o espaço todo (clip-path, sem mexer no layout). Chega inteiro quando o centro dele cruza o meio da tela.
 */
function RevelarAoRolar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const clipPath = useTransform(scrollYProgress, (v) => {
    const t = Math.min(1, Math.max(0, v));
    return `inset(${(1 - t) * 14}% ${(1 - t) * 10}% round ${28 - t * 12}px)`;
  });
  return (
    <motion.div ref={ref} style={{ clipPath }} className={className}>
      {children}
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="mx-auto max-w-6xl scroll-mt-16 px-4 py-12 sm:py-20 sm:px-6"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <TituloDuasVozes antes="Como" serifa="FUNCIONA" className="text-foreground" />
      </Reveal>

      <RevelarAoRolar className="mt-10">
        <VideoComoFunciona />
      </RevelarAoRolar>

      <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
        <div
          aria-hidden
          className="absolute top-7 left-[calc(16.66%+1.75rem)] right-[calc(16.66%+1.75rem)] hidden h-px bg-primary/15 sm:block"
        >
          {/* O traço se desenha da esquerda para a direita quando os passos entram na tela */}
          <motion.div
            className="h-full origin-left bg-primary/60"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
        </div>
        {steps.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.1} className="relative text-center">
            <span className="relative z-10 mx-auto block w-fit rounded-full ring-4 ring-background">
              <step.icon className="size-14" />
            </span>
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
