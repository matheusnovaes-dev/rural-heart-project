import { ContaAte } from "@/components/landing/ContaAte";
import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Leaf, Sprout, Wheat } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Grao } from "@/components/landing/Grao";
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
    // Capítulo escuro (verde da marca, como o rodapé): os cartões claros e o laranja dos botões saltam do fundo.
    <section id="planos" className="relative isolate scroll-mt-16 overflow-hidden bg-[#0e1d15]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 600px at 85% -10%, rgba(217,164,65,.22), transparent 65%), radial-gradient(800px 700px at -10% 110%, rgba(64,140,96,.34), transparent 62%), linear-gradient(180deg,#0e1d15,#12281c)",
        }}
      />
      <Grao />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <TituloDuasVozes
            antes="Planos para cada tamanho de"
            serifa="OPERAÇÃO"
            className="text-[#f6f3ec]"
            corSerifa="#e9b44c"
          />
          <p className="mt-3 text-[#f6f3ec]/75">
            {semTrial
              ? "Escolha o plano e comece agora. Cancele quando quiser."
              : "Todos começam com 7 dias grátis, sem cartão. Cancele quando quiser."}
          </p>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-md items-stretch gap-6 lg:max-w-none lg:grid-cols-3">
          {pricingPlans.map((plan, index) => (
            <Reveal
              key={plan.id}
              delay={index * 0.1}
              // No celular e no tablet (um cartão por linha) o plano em destaque (Prata) sobe pro topo: antes ele só aparecia depois de rolar o
              // card inteiro do Bronze.
              className={cn("h-full", plan.highlighted && "max-lg:order-first")}
            >
              {plan.highlighted ? (
                // Plano em destaque: um fio de luz laranja dá a volta no cartão (só transform, ver .anel-destaque)
                <div className="anel-destaque h-full lg:-translate-y-3 lg:scale-[1.02]">
                  <CartaoPlano plan={plan} semTrial={semTrial} />
                </div>
              ) : (
                <CartaoPlano plan={plan} semTrial={semTrial} />
              )}
            </Reveal>
          ))}
        </div>
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
  const nivel = isOuro ? 2 : plan.highlighted ? 1 : 0;

  return (
    <div
      data-tilt
      data-spotlight
      className={cn(
        "group/plano relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 sm:p-7",
        plan.highlighted
          ? "border-transparent bg-card shadow-xl"
          : isOuro
            ? "border-gold bg-card ring-1 ring-gold/50"
            : "border-border bg-card",
      )}
    >
      {/* No Ouro o tom dourado vem por cima de uma base clara opaca (o fundo da seção é escuro) */}
      {isOuro ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gold-soft/40" />
      ) : null}
      {/* brilho de fundo do plano (muda de cor com o nível) */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -top-24 -right-16 size-64 rounded-full opacity-70 blur-3xl transition-opacity duration-500 group-hover/plano:opacity-100",
          isOuro
            ? "bg-[oklch(0.82_0.14_85/0.45)]"
            : plan.highlighted
              ? "bg-[oklch(0.78_0.15_65/0.35)]"
              : "bg-[oklch(0.8_0.06_150/0.35)]",
        )}
      />
      {isOuro ? (
        <span aria-hidden="true" className="plano-brilho pointer-events-none absolute inset-0" />
      ) : null}

      <div className="relative mb-4 flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-xl shadow-sm",
            isOuro ? "bg-gold text-gold-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          <PlanIcon className="size-6" aria-hidden="true" />
        </span>
        {plan.highlighted && (
          <span className="rounded-full bg-cta px-3 py-1 text-xs font-semibold text-cta-foreground shadow-sm">
            Mais popular
          </span>
        )}
        {isOuro && (
          <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-gold-foreground shadow-sm">
            Nível premium
          </span>
        )}
      </div>

      <h3 className="relative font-display text-3xl leading-none font-extrabold tracking-tight text-foreground">
        {plan.name}
      </h3>
      <p className="relative mt-1.5 text-sm text-muted-foreground">{plan.audience}</p>

      {/* nível da operação: a metáfora de crescimento da lavoura (broto, folha, espiga) */}
      <div className="relative mt-4 flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= nivel ? (isOuro ? "bg-gold" : "bg-[color:var(--cta)]") : "bg-border",
            )}
          />
        ))}
      </div>

      <p className="relative mt-5 flex items-baseline gap-1.5 text-foreground">
        <span className="text-xl font-semibold text-muted-foreground">R$</span>
        <span className="font-display text-6xl leading-none font-extrabold tracking-tighter tabular-nums">
          <ContaAte alvo={plan.price} />
        </span>
        <span className="text-base font-medium text-muted-foreground">/mês</span>
      </p>
      <p className="relative mt-2.5 inline-flex w-fit items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
        Equivale a R$&nbsp;{porDia(plan.price)} por dia
      </p>

      <ul id={idLista} className="relative mt-6 flex-1 space-y-3">
        {recursos.map((feature, i) => (
          <motion.li
            key={feature}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <Check
              className={cn(
                "mt-0.5 size-4 shrink-0",
                isOuro ? "text-gold-foreground" : "text-primary",
              )}
              aria-hidden="true"
            />
            {feature}
          </motion.li>
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
          data-cursor="Começar"
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
