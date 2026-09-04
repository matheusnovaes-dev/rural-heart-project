import { createFileRoute } from "@tanstack/react-router";

import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="font-display text-lg font-semibold">1. Quem somos</h2>
            <p className="mt-2 text-muted-foreground">
              Esta política explica quais dados o {siteConfig.name} coleta, para quê e quais
              direitos você tem sobre eles, em conformidade com a Lei Geral de Proteção de Dados
              (LGPD).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">2. Dados que coletamos</h2>
            <p className="mt-2 text-muted-foreground">
              Nome, número de WhatsApp, e-mail, CPF ou CNPJ, cultura principal e estado (UF)
              informados no cadastro ou no formulário de contato; histórico de mensagens trocadas
              com o bot no WhatsApp; dados de uso do painel; e dados de pagamento processados
              diretamente pela Asaas (nós não armazenamos número de cartão).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">3. Para que usamos</h2>
            <p className="mt-2 text-muted-foreground">
              Para enviar as cotações e alertas que você solicitar, operar sua assinatura e
              cobrança, dar suporte, e melhorar a qualidade das respostas do bot. Não vendemos seus
              dados a terceiros.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">4. Com quem compartilhamos</h2>
            <p className="mt-2 text-muted-foreground">
              Usamos a Meta (WhatsApp Business) para entregar mensagens, a Asaas para processar
              pagamentos e o Supabase para armazenar os dados com segurança. Cada um desses
              parceiros processa apenas o necessário para prestar seu serviço.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">5. Seus direitos</h2>
            <p className="mt-2 text-muted-foreground">
              Você pode pedir a qualquer momento para acessar, corrigir ou apagar seus dados, ou
              cancelar sua assinatura. É só chamar no WhatsApp de suporte informado no rodapé do
              site.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">6. Contato</h2>
            <p className="mt-2 text-muted-foreground">
              Dúvidas sobre privacidade podem ser enviadas pelo WhatsApp de contato do{" "}
              {siteConfig.name}.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
