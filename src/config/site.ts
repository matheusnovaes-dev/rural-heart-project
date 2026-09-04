export const siteConfig = {
  name: "Safralume",
  tagline: "O preço líquido da sua saca, direto no WhatsApp",
  description:
    "Safralume traduz os relatórios da Conab e da Imea em respostas simples, para grãos e pecuária, com frete já descontado, direto no WhatsApp do produtor.",
  whatsapp: {
    number: "5531990040215",
    defaultMessage: "Olá! Quero testar o Safralume grátis por 7 dias.",
    supportMessage: "Oi! Tenho uma dúvida sobre o Safralume.",
  },
} as const;

export function buildWhatsAppLink(message: string = siteConfig.whatsapp.defaultMessage) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${siteConfig.whatsapp.number}?text=${encoded}`;
}

export type PricingPlan = {
  id: string;
  name: string;
  audience: string;
  price: number;
  features: string[];
  highlighted?: boolean;
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "bronze",
    name: "Bronze",
    audience: "Pequenos produtores",
    price: 39,
    features: [
      "Cotações (Conab e órgãos estaduais, semanal ou mais rápido conforme a fonte)",
      "Preço líquido com frete",
      "Boletim Semanal (Imea)",
      "Sinal de venda: cruza preço, futuros da B3 e clima pra apontar a hora certa",
      "Até 3 alertas de preço e clima ao mesmo tempo (dá pra editar e apagar)",
      "Lembretes automáticos, recorrentes ou avulsos",
      "Previsão do clima por estado ou cidade — acompanhe quantos quiser",
      "Relatórios em PDF",
      "Contexto de mercado: câmbio, diesel, safra (USDA), futuros da B3 e produção do IBGE",
      "Suporte por chamado, direto no painel",
    ],
  },
  {
    id: "prata",
    name: "Prata",
    audience: "Médios produtores",
    price: 129,
    features: [
      "Tudo do Bronze, mais:",
      "Alertas de preço e clima sem limite",
      "Até 3 funcionários com acesso, pra dividir o trabalho",
      "Compara o preço da Conab com o da Imea (MT)",
      "Cooperativas: risco climático agregado entre todos os produtores",
    ],
    highlighted: true,
  },
  {
    id: "ouro",
    name: "Ouro",
    audience: "Grandes produtores e consultores",
    price: 399,
    features: [
      "Tudo do Prata, mais:",
      "Acompanhe o preço de outras culturas e estados, não só o seu",
      "Funcionários sem limite — ideal pra consultor com vários clientes",
      "Suporte prioritário — seu chamado é respondido primeiro",
    ],
  },
];
