import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Plus } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";
import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import { buildWhatsAppLink } from "@/config/site";
import { perguntasFrequentes } from "@/config/faq";
import { trackLanding } from "@/lib/metaPixel";

const SERIFA = { fontFamily: '"Instrument Serif", "Times New Roman", serif' };

/**
 * Perguntas que seguram quem está quase decidindo ("é grátis mesmo?", "preciso instalar?", "como cancelo?"). Sem prova
 * social de propósito (pedido do Matheus 2026-10-13): só esclarece risco e funcionamento. Formato editorial: título e
 * convite a conversar fixos à esquerda no desktop, perguntas em tipografia grande e numeradas à direita, com o "+" que
 * gira e a resposta abrindo suave (Radix cuida do teclado e da acessibilidade; as respostas continuam no HTML).
 */
export function Faq() {
  return (
    <section id="duvidas" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14 sm:px-6 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p
            aria-hidden="true"
            className="text-[7rem] leading-[0.7] text-[color:var(--cta)] italic select-none sm:text-[10rem]"
            style={SERIFA}
          >
            ?
          </p>
          <TituloDuasVozes antes="Perguntas" serifa="FREQUENTES" className="mt-3 text-foreground" />
          <p className="mt-5 max-w-sm text-muted-foreground">
            Ainda com dúvida? Fale com a gente pelo WhatsApp, a resposta vem de uma pessoa. Ou leia
            a{" "}
            <Link
              to="/privacidade"
              className="font-medium text-primary underline underline-offset-2"
            >
              Política de Privacidade
            </Link>
            .
          </p>
          <a
            href={buildWhatsAppLink("Oi! Tenho uma dúvida sobre o Safralume.")}
            target="_blank"
            rel="noopener noreferrer"
            data-magnetico
            data-rolar
            onClick={() => trackLanding("WhatsappClique", { origem: "faq" })}
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold tracking-wide text-primary-foreground uppercase transition-transform hover:-translate-y-0.5"
          >
            Tirar dúvida no WhatsApp
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </Reveal>

        <Reveal delay={0.08}>
          <AccordionPrimitive.Root
            type="single"
            collapsible
            className="border-t border-border"
            onValueChange={(valor) => {
              if (valor) trackLanding("FaqAberta", { pergunta: Number(valor) + 1 });
            }}
          >
            {perguntasFrequentes.map((item, i) => (
              <AccordionPrimitive.Item
                key={item.pergunta}
                value={String(i)}
                className="group relative border-b border-border after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-0 after:bg-[color:var(--cta)] after:transition-[width] after:duration-500 after:ease-out data-[state=open]:after:w-full desk:hover:after:w-full"
              >
                <AccordionPrimitive.Header>
                  <AccordionPrimitive.Trigger
                    data-cursor="Abrir"
                    className="flex w-full cursor-pointer items-start gap-4 py-5 text-left sm:gap-6 sm:py-7"
                  >
                    <span
                      className="w-9 shrink-0 origin-left pt-1 text-2xl leading-none text-muted-foreground italic transition-[color,transform] duration-300 group-hover:text-[color:var(--cta)] group-data-[state=open]:text-[color:var(--cta)] desk:group-hover:scale-125 desk:group-data-[state=open]:scale-110 sm:w-12 sm:text-3xl"
                      style={SERIFA}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 font-display text-lg leading-snug font-bold tracking-tight text-foreground transition-[transform,color] duration-300 group-hover:translate-x-1 group-hover:text-primary group-data-[state=open]:text-primary sm:text-2xl">
                      {item.pergunta}
                    </span>
                    <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-all duration-300 group-hover:border-[color:var(--cta)] group-data-[state=open]:rotate-45 group-data-[state=open]:border-[color:var(--cta)] group-data-[state=open]:bg-[color:var(--cta)] group-data-[state=open]:text-cta-foreground sm:size-11">
                      <Plus className="size-4 sm:size-5" aria-hidden="true" />
                    </span>
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <p className="pr-2 pb-6 pl-[3.25rem] text-base leading-relaxed text-muted-foreground sm:pr-14 sm:pb-8 sm:pl-[4.5rem] sm:text-lg">
                    {item.resposta}
                  </p>
                </AccordionPrimitive.Content>
              </AccordionPrimitive.Item>
            ))}
          </AccordionPrimitive.Root>
        </Reveal>
      </div>
    </section>
  );
}
