import { BadgeCheck, MessageCircle, SearchCheck } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";

const steps = [
  {
    icon: MessageCircle,
    title: "1. Mande uma mensagem",
    description: "Pergunte o preço da sua cultura e cidade, do jeito que você já usa o WhatsApp.",
  },
  {
    icon: SearchCheck,
    title: "2. Cruzamos os dados oficiais",
    description: "Consultamos Cepea e Conab na hora e aplicamos o frete líquido da sua região.",
  },
  {
    icon: BadgeCheck,
    title: "3. Você recebe o número certo",
    description: "Preço líquido, com fonte e data — pronto para decidir sem depender de planilha.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Como funciona
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-8 sm:grid-cols-3">
        {steps.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.1} className="text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <step.icon className="size-6" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
