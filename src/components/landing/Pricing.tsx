import { Check } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pricingPlans } from "@/config/site";

export function Pricing() {
  return (
    <section id="planos" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Planos para cada tamanho de operação
        </h2>
        <p className="mt-3 text-muted-foreground">
          Comece pelo plano de entrada. Cobrança concentrada na safra, quando o bolso está cheio.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {pricingPlans.map((plan, index) => (
          <Reveal key={plan.id} delay={index * 0.1}>
            <div
              className={cn(
                "flex h-full flex-col rounded-2xl border p-6",
                plan.highlighted
                  ? "border-primary bg-card shadow-lg ring-1 ring-primary"
                  : "border-border bg-card",
              )}
            >
              {plan.highlighted && (
                <span className="mb-3 w-fit rounded-full bg-cta px-3 py-1 text-xs font-semibold text-cta-foreground">
                  Mais popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground">{plan.audience}</p>
              <p className="mt-4 text-2xl font-bold text-foreground">{plan.priceRange}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={cn(
                  "mt-6",
                  plan.highlighted && "bg-cta text-cta-foreground hover:bg-cta/90",
                )}
                variant={plan.highlighted ? "default" : "outline"}
              >
                <a href="#comece">Testar grátis</a>
              </Button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
