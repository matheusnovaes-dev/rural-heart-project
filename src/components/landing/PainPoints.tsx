import { Calculator, FileWarning, Truck } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";

// Bento: o pain point do frete/porto é o gancho mais forte (liga direto com o
// Hero, que já fala "o porto paga mais que você recebe"), por isso ganha a
// célula grande; os outros dois ficam menores, na coluna ao lado.
const painDestaque = {
  icon: Truck,
  title: "Sem comparar com o porto",
  description:
    "O preço do porto não é o que você recebe: o frete pesa e muda a negociação. Sem comparar os dois, você não sabe se tá vendendo bem.",
};

const painsSecundarios = [
  {
    icon: Calculator,
    title: "Planilha manual",
    description:
      "Você perde tempo todo dia ligando pro corretor ou abrindo site só pra saber se o preço mudou.",
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

      <div className="mt-12 grid gap-6 sm:grid-cols-2 sm:grid-rows-2">
        <Reveal className="sm:row-span-2">
          <div className="flex h-full flex-col items-start gap-5 rounded-xl border border-primary/30 bg-primary/5 p-8 shadow-sm transition-shadow hover:shadow-md">
            <span className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <painDestaque.icon className="size-7" />
            </span>
            <h3 className="text-2xl font-semibold text-foreground">{painDestaque.title}</h3>
            <p className="text-base text-muted-foreground">{painDestaque.description}</p>
          </div>
        </Reveal>

        {painsSecundarios.map((pain, index) => (
          <Reveal key={pain.title} delay={(index + 1) * 0.1}>
            <div className="flex h-full flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
