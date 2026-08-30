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
      "Cotações diárias (Conab)",
      "Preço líquido com frete",
      "Boletim Semanal (Imea)",
      "Sinal de venda: cruza preço, futuros da B3 e clima pra apontar a hora certa",
      "Alertas de preço e de clima, com edição e exclusão",
      "Lembretes automáticos, recorrentes ou avulsos",
      "Previsão do clima por estado ou cidade — acompanhe quantos quiser",
      "Relatórios em PDF",
      "Contexto de mercado: câmbio, diesel, safra (USDA), futuros da B3 e produção do IBGE",
    ],
  },
  {
    id: "prata",
    name: "Prata",
    audience: "Médios produtores",
    price: 129,
    features: [
      "Tudo do Bronze, mais:",
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
      "Lista de acompanhamento: siga outras culturas e estados além do seu",
      "Suporte prioritário",
    ],
  },
];
