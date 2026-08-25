import { createFileRoute } from "@tanstack/react-router";

import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Termos de Uso
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="font-display text-lg font-semibold">1. O serviço</h2>
            <p className="mt-2 text-muted-foreground">
              O {siteConfig.name} é um assistente via WhatsApp que traduz relatórios públicos do
              Cepea e da Conab em respostas de preço com frete já descontado. O acesso é feito por
              assinatura mensal, com um período de teste gratuito de 7 dias no primeiro plano
              contratado.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">2. Assinatura e cobrança</h2>
            <p className="mt-2 text-muted-foreground">
              A cobrança é feita automaticamente pela Stripe, mensalmente, a partir do fim do
              período de teste, no valor do plano escolhido. Você pode cancelar a qualquer momento;
              o acesso permanece ativo até o fim do ciclo já pago.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">3. Uso permitido</h2>
            <p className="mt-2 text-muted-foreground">
              O serviço é de uso pessoal ou da sua operação (produtor, cooperativa ou corretora).
              Não é permitido revender o acesso, tentar contornar limites de plano, ou usar o bot
              para fins diferentes de consulta de preços agrícolas.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">4. Natureza da informação</h2>
            <p className="mt-2 text-muted-foreground">
              As respostas do {siteConfig.name} apresentam cenários de mercado com base em dados
              públicos do Cepea e da Conab. Isso tem caráter informativo e não constitui
              recomendação de investimento, consultoria financeira ou garantia de preço futuro. A
              decisão de compra e venda é sempre sua.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">5. Cancelamento e reembolso</h2>
            <p className="mt-2 text-muted-foreground">
              Você pode cancelar a assinatura a qualquer momento pelo WhatsApp de suporte. Como o
              teste gratuito de 7 dias já cobre a fase de avaliação, não fazemos reembolso de ciclos
              de cobrança já iniciados.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">6. Alterações</h2>
            <p className="mt-2 text-muted-foreground">
              Podemos atualizar estes termos para refletir mudanças no serviço. Mudanças relevantes
              serão avisadas com antecedência pelo WhatsApp cadastrado.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
