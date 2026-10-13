import { Link } from "@tanstack/react-router";

import { Reveal } from "@/components/landing/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { perguntasFrequentes } from "@/config/faq";
import { trackLanding } from "@/lib/metaPixel";

/**
 * Perguntas que seguram quem está quase decidindo ("é grátis mesmo?", "preciso
 * instalar?", "como cancelo?"). Antes a landing não respondia nenhuma delas,
 * então a dúvida virava saída. Sem prova social de propósito (pedido do
 * Matheus 2026-10-13): só esclarece risco e funcionamento.
 */
export function Faq() {
  return (
    <section id="duvidas" className="mx-auto max-w-3xl scroll-mt-16 px-4 py-12 sm:py-20 sm:px-6">
      <Reveal className="text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Perguntas frequentes
        </h2>
      </Reveal>

      <Reveal delay={0.1} className="mt-10">
        <Accordion
          type="single"
          collapsible
          className="rounded-2xl border border-border bg-card px-5 sm:px-6"
          onValueChange={(valor) => {
            if (valor) trackLanding("FaqAberta", { pergunta: Number(valor) + 1 });
          }}
        >
          {perguntasFrequentes.map((item, i) => (
            <AccordionItem key={item.pergunta} value={String(i)} className="last:border-b-0">
              <AccordionTrigger className="py-5 text-base font-semibold text-foreground">
                {item.pergunta}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {item.resposta}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ainda com dúvida? Fale com a gente pelo botão do WhatsApp ou veja a{" "}
          <Link to="/privacidade" className="font-medium text-primary underline underline-offset-2">
            Política de Privacidade
          </Link>
          .
        </p>
      </Reveal>
    </section>
  );
}
