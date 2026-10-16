import { ContaAte } from "@/components/landing/ContaAte";
import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import { useState } from "react";
import { Check, ChevronDown, Leaf, Sprout, Wheat } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Reveal } from "@/components/landing/Reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pricingPlans, type PricingPlan } from "@/config/site";
import { trackLanding } from "@/lib/metaPixel";

// Mesma lógica do Sprout da marca (Header/Footer): cada plano é um estágio de
// crescimento da lavoura, não só um nome. Reforça a identidade em vez de
// repetir o card de preço genérico de qualquer SaaS.
const planIcons = { bronze: Sprout, prata: Leaf, ouro: Wheat } as const;

// O Bronze tinha 11 bullets contra 4 da Prata e 3 do Ouro (a Prata e o Ouro
// listam só o que ACRESCENTAM): o plano mais barato parecia o mais completo e
// o card ficava ~1.000px de altura no celular. Agora cada plano mostra só o
// essencial e o resto abre sob demanda.
const RECURSOS_VISIVEIS = 6;

const porDia = (preco: number) =>
  (preco / 30).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Pricing({ semTrial = false }: { semTrial?: boolean }) {
  return (
    <section id="planos" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-12 sm:py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <TituloDuasVozes
          antes="Planos para cada tamanho de"
          serifa="OPERAÇÃO"
          className="text-foreground"
        />
        <p className="mt-3 text-muted-foreground">
          {semTrial
            ? "Escolha o plano e comece agora. Cancele quando quiser."
            : "Todos começam com 7 dias grátis, sem cartão. Cancele quando quiser."}
        </p>
      </Reveal>

      <div className="mt-12 grid items-stretch gap-6 sm:grid-cols-3">
        {pricingPlans.map((plan, index) => (
          // No celular o plano em destaque (Prata) sobe pro topo: antes ele só
          // aparecia depois de rolar o card inteiro do Bronze.
          <Reveal
            key={plan.id}
            delay={index * 0.1}
            className={cn("h-full", plan.highlighted && "max-sm:order-first")}
          >
            {plan.highlighted ? (
              // Plano em destaque: um fio de luz laranja dá a volta no cartão (só transform, ver .anel-destaque)
              <div className="anel-destaque">
                <CartaoPlano plan={plan} semTrial={semTrial} />
              </div>
            ) : (
              <CartaoPlano plan={plan} semTrial={semTrial} />
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CartaoPlano({ plan, semTrial }: { plan: PricingPlan; semTrial: boolean }) {
  const [expandido, setExpandido] = useState(false);
  const isOuro = plan.id === "ouro";
  const PlanIcon = planIcons[plan.id as keyof typeof planIcons];
  const temMais = plan.features.length > RECURSOS_VISIVEIS;
  const recursos = expandido ? plan.features : plan.features.slice(0, RECURSOS_VISIVEIS);
  const idLista = `recursos-${plan.id}`;

  return (
    <div
      data-tilt
      data-spotlight
      className={cn(
        "flex h-full flex-col rounded-2xl border p-6",
        plan.highlighted
          ? "relative border-transparent bg-card shadow-lg"
          : isOuro
            ? "border-gold bg-gold-soft/40 ring-1 ring-gold/50"
            : "border-border bg-card",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-lg",
            isOuro ? "bg-gold text-gold-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          <PlanIcon className="size-5" aria-hidden="true" />
        </span>
        {plan.highlighted && (
          <span className="rounded-full bg-cta px-3 py-1 text-xs font-semibold text-cta-foreground">
            Mais popular
          </span>
        )}
        {isOuro && (
          <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-gold-foreground">
            Nível premium
          </span>
        )}
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">{plan.name}</h3>
      <p className="text-sm text-muted-foreground">{plan.audience}</p>
      <p className="mt-4 font-mono text-2xl font-bold tabular-nums text-foreground">
        R$ <ContaAte alvo={plan.price} />
        <span className="text-base font-normal text-muted-foreground">/mês</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Equivale a R$&nbsp;{porDia(plan.price)} por dia
      </p>

      <ul id={idLista} className="mt-6 flex-1 space-y-3">
        {recursos.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
            <Check
              className={cn(
                "mt-0.5 size-4 shrink-0",
                isOuro ? "text-gold-foreground" : "text-primary",
              )}
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>

      {temMais && (
        <button
          type="button"
          aria-expanded={expandido}
          aria-controls={idLista}
          onClick={() => {
            setExpandido((v) => !v);
            if (!expandido) trackLanding("PlanoVerTodos", { plano: plan.id });
          }}
          className="mt-4 inline-flex w-fit touch-manipulation items-center gap-1 pointer-coarse:min-h-11 text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          {expandido ? "Mostrar menos" : `Ver todos os ${plan.features.length} recursos`}
          <ChevronDown
            className={cn(
              "size-4 transition-transform motion-reduce:transition-none",
              expandido && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      )}

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
          data-rolar
          onClick={() => trackLanding("PlanoClique", { plano: plan.id })}
        >
          {semTrial ? "Assinar agora" : "Testar grátis"}
        </Link>
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {semTrial ? "Cobrança imediata, sem período de teste." : "7 dias grátis, sem cartão."}
      </p>
    </div>
  );
}
