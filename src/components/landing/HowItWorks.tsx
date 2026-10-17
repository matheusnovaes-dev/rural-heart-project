import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { PassosHorizontais } from "@/components/landing/PassosHorizontais";
import { Conversa, Fontes, Resposta } from "@/components/landing/VisuaisDosPassos";
import { Reveal } from "@/components/landing/Reveal";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";
import { MIDIA } from "@/assets/midia";

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

const VISUAIS = [Conversa, Fontes, Resposta] as const;

/** Um passo no celular: ícone, título, texto e a ilustração, que anima uma vez quando o cartão entra na tela. */
function PassoEmpilhado({
  step,
  Visual,
}: {
  step: (typeof steps)[number];
  Visual: (typeof VISUAIS)[number];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ativo = useInView(ref, { once: true, margin: "0px 0px -18% 0px" });
  return (
    <div ref={ref} data-ativo={ativo} className="group text-center">
      <span className="mx-auto block w-fit">
        <step.icon className="size-12" />
      </span>
      <h3 className="mt-3 font-display text-xl font-semibold text-foreground">{step.title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{step.description}</p>
      <div className="mt-6 text-left">
        <Visual />
      </div>
    </div>
  );
}

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
  // No celular a moldura é 4:5 e mostra só o miolo do vídeo: lá vai a versão recortada nesse formato, em resolução
  // nativa (nítida e mais leve). Decidido só quando o vídeo entra na tela (o vídeo nunca existe no HTML do servidor).
  const [celular, setCelular] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setCelular(window.matchMedia("(max-width: 639px)").matches);
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
          src={MIDIA[celular ? "videoMobile" : "videoDesktop"]}
          poster={MIDIA.posterComoFunciona}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          className="size-full object-cover"
        />
      ) : (
        <img
          src={MIDIA.posterComoFunciona}
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

      {/* Celular e tablet: os três passos empilhados, cada um com a mesma ilustração do desktop num cartão leve. */}
      <div className="mx-auto mt-12 grid max-w-md gap-12 desk:hidden">
        {steps.map((step, index) => (
          <PassoEmpilhado key={step.title} step={step} Visual={VISUAIS[index]!} />
        ))}
      </div>
      <PassosHorizontais />
    </section>
  );
}
