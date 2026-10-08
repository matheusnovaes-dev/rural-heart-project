import { ArrowRight, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Reveal } from "@/components/landing/Reveal";
import { LeadForm } from "@/components/landing/LeadForm";

const garantias = [
  "Direto no seu painel, sem esperar contato",
  "Sem cartão de crédito. Cancele quando quiser",
  "Preço real desde o primeiro acesso, não exemplo",
];

export function FinalCta() {
  return (
    <section id="comece" className="bg-secondary/50 py-20">
      <div className="mx-auto grid max-w-5xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Teste grátis por 7 dias
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Enquanto você lê isso, o preço de hoje já pode estar diferente do de ontem.
          </p>

          {/* Texto solto perdia pro card do LeadForm ao lado; a lista reaproveita
              as mesmas garantias já ditas no LeadForm, só torna escaneável. */}
          <ul className="mt-5 flex flex-col gap-2.5">
            {garantias.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>

          <Link
            to="/"
            search={{ semTrial: "1" }}
            hash="planos"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowRight className="size-4" />
            Prefere assinar direto? Veja os planos
          </Link>
        </Reveal>

        <Reveal delay={0.15}>
          <LeadForm className="rounded-2xl border border-border bg-card p-6 sm:p-8" />
        </Reveal>
      </div>
    </section>
  );
}
