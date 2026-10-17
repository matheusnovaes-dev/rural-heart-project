import { createFileRoute } from "@tanstack/react-router";

import { PaginaLegal, type SecaoLegal } from "@/components/landing/PaginaLegal";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/termos")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://www.safralume.com.br/termos" }],
    meta: [
      { property: "og:url", content: "https://www.safralume.com.br/termos" },
      { title: "Termos de Uso | Safralume" },
      {
        name: "description",
        content:
          "Regras de uso, assinatura, cobrança e cancelamento do Safralume, o assistente de preços agrícolas via WhatsApp.",
      },
    ],
  }),
  component: TermosPage,
});

const secoes: SecaoLegal[] = [
  {
    id: "o-servico",
    titulo: "O serviço",
    corpo: (
      <p>
        O {siteConfig.name} é um assistente via WhatsApp que traduz relatórios públicos da Conab e
        de órgãos estaduais de agricultura em respostas de preço com frete já descontado. O acesso é
        feito por assinatura mensal, com um período de teste gratuito de 7 dias no primeiro plano
        contratado.
      </p>
    ),
  },
  {
    id: "assinatura-e-cobranca",
    titulo: "Assinatura e cobrança",
    corpo: (
      <p>
        A cobrança é feita automaticamente pela Asaas (Pix, boleto ou cartão), mensalmente, a partir
        do fim do período de teste, no valor do plano escolhido. Você pode cancelar a qualquer
        momento; o acesso permanece ativo até o fim do ciclo já pago.
      </p>
    ),
  },
  {
    id: "uso-permitido",
    titulo: "Uso permitido",
    corpo: (
      <p>
        O serviço é de uso pessoal ou da sua operação (produtor, cooperativa ou corretora). Não é
        permitido revender o acesso, tentar contornar limites de plano, ou usar o bot para fins
        diferentes de consulta de preços agrícolas.
      </p>
    ),
  },
  {
    id: "natureza-da-informacao",
    titulo: "Natureza da informação",
    corpo: (
      <p>
        As respostas do {siteConfig.name} apresentam cenários de mercado com base em dados públicos
        oficiais (Conab e órgãos estaduais de agricultura). Isso tem caráter informativo e não
        constitui recomendação de investimento, consultoria financeira ou garantia de preço futuro.
        A decisão de compra e venda é sempre sua.
      </p>
    ),
  },
  {
    id: "cancelamento-e-reembolso",
    titulo: "Cancelamento e reembolso",
    corpo: (
      <p>
        Você pode cancelar a assinatura a qualquer momento pelo WhatsApp de suporte. Como o teste
        gratuito de 7 dias já cobre a fase de avaliação, não fazemos reembolso de ciclos de cobrança
        já iniciados.
      </p>
    ),
  },
  {
    id: "alteracoes",
    titulo: "Alterações",
    corpo: (
      <p>
        Podemos atualizar estes termos para refletir mudanças no serviço. Mudanças relevantes serão
        avisadas com antecedência pelo WhatsApp cadastrado.
      </p>
    ),
  },
  {
    id: "titularidade",
    titulo: "Titularidade",
    corpo: (
      <p>
        O {siteConfig.name} é operado sob o CNPJ 68.802.997/0001-37 (razão social 68.802.997 MATHEUS
        NOVAES DE MOURA).
      </p>
    ),
  },
];

function TermosPage() {
  return (
    <PaginaLegal
      antes="TERMOS"
      serifa="DE USO"
      resumo="As regras do serviço, da assinatura e do cancelamento, escritas de forma direta."
      atualizadoEm="12 de outubro de 2026"
      secoes={secoes}
    />
  );
}
