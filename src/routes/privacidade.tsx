import { createFileRoute } from "@tanstack/react-router";

import { PaginaLegal, type SecaoLegal } from "@/components/landing/PaginaLegal";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://www.safralume.com.br/privacidade" }],
    meta: [
      { property: "og:url", content: "https://www.safralume.com.br/privacidade" },
      { title: "Política de Privacidade | Safralume" },
      {
        name: "description",
        content:
          "Como o Safralume coleta, usa e protege seus dados pessoais e de WhatsApp, em conformidade com a LGPD.",
      },
    ],
  }),
  component: PrivacidadePage,
});

const secoes: SecaoLegal[] = [
  {
    id: "quem-somos",
    titulo: "Quem somos",
    corpo: (
      <p>
        Esta política explica quais dados o {siteConfig.name} coleta, para quê e quais direitos você
        tem sobre eles, em conformidade com a Lei Geral de Proteção de Dados (LGPD).
      </p>
    ),
  },
  {
    id: "dados-que-coletamos",
    titulo: "Dados que coletamos",
    corpo: (
      <p>
        Nome, número de WhatsApp, e-mail, CPF ou CNPJ, cultura principal e estado (UF) informados no
        cadastro ou no formulário de contato; histórico de mensagens trocadas com o bot no WhatsApp;
        dados de uso do painel; e dados de pagamento processados diretamente pela Asaas (nós não
        armazenamos número de cartão). Fotos e PDFs de propostas ou tabelas de preços que você
        enviar pelo WhatsApp são lidos na hora para montar o estudo e não ficam guardados por nós:
        guardamos só o texto da conversa e um resumo do estudo (comprador, preço e condições) para
        você poder questionar ou refazer a conta.
      </p>
    ),
  },
  {
    id: "para-que-usamos",
    titulo: "Para que usamos",
    corpo: (
      <p>
        Para enviar as cotações e alertas que você solicitar, operar sua assinatura e cobrança, dar
        suporte, e melhorar a qualidade das respostas do bot. Não vendemos seus dados a terceiros.
      </p>
    ),
  },
  {
    id: "com-quem-compartilhamos",
    titulo: "Com quem compartilhamos",
    corpo: (
      <p>
        Usamos a Meta (WhatsApp Business) para entregar mensagens, a Asaas para processar
        pagamentos, o Supabase para armazenar os dados com segurança e a OpenAI (inteligência
        artificial) para ler o texto, o áudio e os arquivos que você manda ao bot e montar as
        respostas. Cada um desses parceiros processa apenas o necessário para prestar seu serviço.
      </p>
    ),
  },
  {
    id: "cookies-e-publicidade",
    titulo: "Cookies e publicidade",
    corpo: (
      <p>
        Usamos o Meta Pixel (Facebook/Instagram) no site pra entender o desempenho dos nossos
        anúncios e medir quantas pessoas se cadastram a partir deles. Ele grava um identificador
        anônimo no seu navegador. Não vendemos nem compartilhamos esse dado além da Meta, que o usa
        segundo a própria política de privacidade dela.
      </p>
    ),
  },
  {
    id: "seus-direitos",
    titulo: "Seus direitos",
    corpo: (
      <p>
        Você pode pedir a qualquer momento para acessar, corrigir ou apagar seus dados, ou cancelar
        sua assinatura. É só chamar no WhatsApp de suporte informado no rodapé do site.
      </p>
    ),
  },
  {
    id: "contato",
    titulo: "Contato",
    corpo: (
      <p>
        Dúvidas sobre privacidade podem ser enviadas pelo WhatsApp de contato do {siteConfig.name}.
      </p>
    ),
  },
];

function PrivacidadePage() {
  return (
    <PaginaLegal
      antes="POLÍTICA DE"
      serifa="PRIVACIDADE"
      resumo="Quais dados coletamos, para quê usamos e como você controla tudo, em conformidade com a LGPD."
      atualizadoEm="13 de outubro de 2026"
      secoes={secoes}
    />
  );
}
