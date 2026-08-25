import { MessageCircle } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";
import { LeadForm } from "@/components/landing/LeadForm";
import { buildWhatsAppLink } from "@/config/site";

export function FinalCta() {
  return (
    <section id="comece" className="bg-secondary/50 py-20">
      <div className="mx-auto grid max-w-5xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Teste grátis por 7 dias
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Preencha seus dados e a gente já te chama no WhatsApp para começar. Sem cartão de
            crédito, sem burocracia.
          </p>

          <a
            href={buildWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <MessageCircle className="size-4" />
            Prefere ir direto? Fale com a gente no WhatsApp
          </a>
        </Reveal>

        <Reveal delay={0.15}>
          <LeadForm className="rounded-2xl border border-border bg-card p-6 sm:p-8" />
        </Reveal>
      </div>
    </section>
  );
}
