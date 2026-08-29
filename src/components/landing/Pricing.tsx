import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Reveal } from "@/components/landing/Reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pricingPlans } from "@/config/site";

export function Pricing({ semTrial = false }: { semTrial?: boolean }) {
  return (
    <section id="planos" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Planos para cada tamanho de operação
        </h2>
        <p className="mt-3 text-muted-foreground">
          Comece pelo plano de entrada. Cobrança concentrada na safra, quando o bolso está cheio.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {pricingPlans.map((plan, index) => {
          const isOuro = plan.id === "ouro";
          return (
            <Reveal key={plan.id} delay={index * 0.1}>
              <div
                className={cn(
                  "flex h-full flex-col rounded-2xl border p-6",
                  plan.highlighted
                    ? "border-primary bg-card shadow-lg ring-1 ring-primary"
                    : isOuro
                      ? "border-gold bg-gold-soft/40 ring-1 ring-gold/50"
                      : "border-border bg-card",
                )}
              >
                {plan.highlighted && (
                  <span className="mb-3 w-fit rounded-full bg-cta px-3 py-1 text-xs font-semibold text-cta-foreground">
                    Mais popular
                  </span>
                )}
                {isOuro && (
                  <span className="mb-3 w-fit rounded-full bg-gold px-3 py-1 text-xs font-semibold text-gold-foreground">
                    Nível premium
                  </span>
                )}
                <h3 className="font-display text-lg font-semibold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.audience}</p>
                <p className="mt-4 font-mono text-2xl font-bold tabular-nums text-foreground">
                  R$ {plan.price.toLocaleString("pt-BR")}
                  <span className="text-base font-normal text-muted-foreground">/mês</span>
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          isOuro ? "text-gold-foreground" : "text-primary",
                        )}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className={cn(
                    "mt-6",
                    plan.highlighted && "bg-cta text-cta-foreground hover:bg-cta/90",
                    isOuro && "bg-gold text-gold-foreground hover:bg-gold/90",
                  )}
                  variant={plan.highlighted || isOuro ? "default" : "outline"}
                >
                  <Link
                    to="/login"
                    search={{
                      plano: plan.id as "bronze" | "prata" | "ouro",
                      ...(semTrial ? { semTrial: "1" as const } : {}),
                    }}
                  >
                    {semTrial ? "Assinar agora" : "Testar grátis"}
                  </Link>
                </Button>
                {semTrial && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Cobrança imediata, sem período de teste.
                  </p>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
