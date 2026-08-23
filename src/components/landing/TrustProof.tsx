import { ShieldCheck } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";

export function TrustProof() {
  return (
    <section className="bg-primary py-20 text-primary-foreground">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal className="overflow-hidden rounded-2xl">
          <img
            src="/images/soybean-field.jpg"
            alt="Lavoura de soja"
            className="h-72 w-full object-cover sm:h-96"
            loading="lazy"
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium">
            <ShieldCheck className="size-3.5" />
            Fonte oficial, sempre visível
          </div>

          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Dado com origem clara, não achismo de IA
          </h2>

          <p className="mt-4 max-w-lg text-primary-foreground/85">
            Todo preço mostrado no Safralume vem do Cepea ou da Conab, com data de referência
            visível na resposta. O Safralume apresenta cenários de mercado com base em dados
            públicos — não é recomendação de investimento nem consultoria financeira.
          </p>

          <p className="mt-6 text-sm font-medium text-primary-foreground/70">
            Feito para chegar até você pela sua cooperativa, corretor de grãos ou agrônomo de
            confiança.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
