import { Calculator, FileWarning, Truck } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";

const pains = [
  {
    icon: Calculator,
    title: "Planilha manual",
    description: "Você perde tempo atualizando preço na mão, todo dia, para cada cliente.",
  },
  {
    icon: Truck,
    title: "Frete não calculado",
    description: "O preço da bolsa não é o que cai na sua conta — o frete muda tudo.",
  },
  {
    icon: FileWarning,
    title: "Relatório difícil de ler",
    description: "O boletim oficial é denso. Você quer o número, não dez páginas de tabela.",
  },
];

export function PainPoints() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          O problema não é falta de dado. É excesso de trabalho manual.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {pains.map((pain, index) => (
          <Reveal key={pain.title} delay={index * 0.1}>
            <div className="flex h-full flex-col items-start gap-4 rounded-xl border border-border bg-card p-6">
              <span className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary">
                <pain.icon className="size-5" />
              </span>
              <h3 className="text-lg font-semibold text-foreground">{pain.title}</h3>
              <p className="text-sm text-muted-foreground">{pain.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
