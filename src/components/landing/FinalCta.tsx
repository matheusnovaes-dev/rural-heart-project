import { Pincel } from "@/components/landing/Pincel";
import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Reveal } from "@/components/landing/Reveal";
import { LeadFormAoChegar } from "@/components/landing/LeadFormCarregavel";

const garantias = [
  "Direto no seu painel, sem esperar contato",
  "Sem cartão de crédito. Cancele quando quiser",
  "Preço real desde o primeiro acesso, não exemplo",
];

export function FinalCta() {
  return (
    <section id="comece" className="relative overflow-hidden bg-secondary/50 py-12 sm:py-20">
      <Pincel
        palavra="grátis"
        className="top-[2%] left-[-4%] text-[clamp(8rem,30vw,20rem)] text-[color:var(--cta)]/25"
      />
      <div className="mx-auto grid max-w-5xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <TituloDuasVozes
            antes="Teste grátis por"
            serifa="7 DIAS"
            className="text-foreground sm:text-4xl lg:text-5xl"
          />
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
            className="mt-6 inline-flex items-center gap-2 pointer-coarse:min-h-11 text-sm font-medium text-primary hover:underline"
          >
            <ArrowRight className="size-4" />
            Prefere assinar direto? Veja os planos
          </Link>
        </Reveal>

        <Reveal delay={0.15}>
          {/* autoFocar={false}: este formulário fica no fim da página. Com foco
              automático, o navegador rolava a página até aqui assim que ela
              carregava (scrollY de 0 até ~10 mil px e de volta), o que
              causava o "pulo" visível e boa parte do CLS. */}
          <LeadFormAoChegar
            autoFocar={false}
            className="rounded-2xl border border-border bg-card p-6 sm:p-8"
          />
        </Reveal>
      </div>
    </section>
  );
}
