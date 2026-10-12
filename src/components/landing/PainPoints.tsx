import { Reveal } from "@/components/landing/Reveal";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";

// Bento: o gancho mais forte agora é "sem saber a hora certa" (liga direto
// com o Hero desde 2026-10-11 — pesquisa de mercado mostrou que paridade de
// porto sozinha não é mais diferencial, o AgroPocket já faz isso), por isso
// ganha a célula grande. Porto/frete continua real e vira secundário, não
// sumiu da página — só não é mais o gancho principal.
const painDestaque = {
  icon: IconesSafralume["sinal-venda"],
  title: "Vende no escuro, sem saber se é a hora certa",
  description:
    "Você decide olhando só o preço de hoje, sem saber se o mercado futuro da B3 aponta alta, se o clima vai pesar, ou se esperar valeria mais. Decisão no escuro custa caro.",
};

const painsSecundarios = [
  {
    icon: IconesSafralume.frete,
    title: "Sem comparar com o porto",
    description:
      "O preço do porto não é o que você recebe: o frete pesa e muda a negociação. Sem comparar os dois, você não sabe se tá vendendo bem.",
  },
  {
    icon: IconesSafralume["calculadora-safra"],
    title: "Planilha manual",
    description:
      "Você perde tempo todo dia ligando pro corretor ou abrindo site só pra saber se o preço mudou.",
  },
];

export function PainPoints() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          O problema não é falta de dado. É não saber a hora certa.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 sm:grid-rows-2">
        <Reveal className="sm:row-span-2">
          <div className="flex h-full flex-col items-start gap-5 rounded-xl border border-primary/30 bg-primary/5 p-8 shadow-sm transition-shadow hover:shadow-md">
            <painDestaque.icon className="size-14" />
            <h3 className="text-2xl font-semibold text-foreground">{painDestaque.title}</h3>
            <p className="text-base text-muted-foreground">{painDestaque.description}</p>
          </div>
        </Reveal>

        {painsSecundarios.map((pain, index) => (
          <Reveal key={pain.title} delay={(index + 1) * 0.1}>
            <div className="flex h-full flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <pain.icon className="size-11" />
              <h3 className="text-lg font-semibold text-foreground">{pain.title}</h3>
              <p className="text-sm text-muted-foreground">{pain.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
