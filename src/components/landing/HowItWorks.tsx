import { useCadastro } from "@/components/landing/CadastroProvider";
import { CampoWhatsappCta } from "@/components/landing/CampoWhatsappCta";
import { ChatScrollDemo } from "@/components/landing/ChatScrollDemo";
import { Reveal } from "@/components/landing/Reveal";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";

const steps = [
  {
    icon: IconesSafralume.whatsapp,
    title: "1. Mande uma mensagem",
    description: "Pergunte o preço da sua cultura e cidade, do jeito que você já usa o WhatsApp.",
  },
  {
    icon: IconesSafralume["dado-oficial"],
    title: "2. Cruzamos os dados oficiais",
    description:
      "Consultamos Conab e órgãos estaduais na hora e comparamos com o preço do porto e o frete.",
  },
  {
    icon: IconesSafralume.preco,
    title: "3. Você recebe o número certo",
    description:
      "Preço da sua região, do porto e o frete, com fonte e data, pronto para decidir sem depender de planilha.",
  },
];

export function HowItWorks() {
  const { abrirCadastro } = useCadastro();
  return (
    <section id="como-funciona" className="scroll-mt-16">
      {/* A conversa se escreve conforme a pessoa rola (no lugar do vídeo de 14 MB). */}
      <ChatScrollDemo />

      <div className="mx-auto max-w-md px-4 pb-4 sm:px-6">
        <Reveal>
          <p className="mb-3 text-center font-display text-lg font-semibold text-foreground">
            Faça a sua pergunta agora
          </p>
          <CampoWhatsappCta
            variante="claro"
            aoEnviar={(whatsapp) => abrirCadastro({ whatsapp, origem: "demo" })}
          />
          <p className="mt-3 text-center text-[13px] text-muted-foreground">
            7 dias grátis · Sem cartão · Cancele quando quiser
          </p>
        </Reveal>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="relative grid gap-8 sm:grid-cols-3">
          <div
            aria-hidden
            className="absolute top-7 left-[calc(16.66%+1.75rem)] right-[calc(16.66%+1.75rem)] hidden h-px bg-primary/40 sm:block"
          />
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.1} className="relative text-center">
              <span className="relative z-10 mx-auto block w-fit rounded-full ring-4 ring-background">
                <step.icon className="size-14" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
