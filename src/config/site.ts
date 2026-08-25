export const siteConfig = {
  name: "Safralume",
  tagline: "O preço líquido da sua saca, direto no WhatsApp",
  description:
    "Safralume traduz os relatórios do Cepea e da Conab em respostas simples, com frete já descontado, direto no WhatsApp do produtor.",
  whatsapp: {
    number: "5531990040215",
    defaultMessage: "Olá! Quero testar o Safralume grátis por 7 dias.",
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
    features: ["Bot de WhatsApp", "Cotações diárias", "Resumo semanal", "50 consultas por mês"],
  },
  {
    id: "prata",
    name: "Prata",
    audience: "Médios produtores",
    price: 129,
    features: [
      "Consultas ilimitadas",
      "Leitura de relatórios em PDF",
      "Preço líquido com frete",
      "Tendências climáticas",
    ],
    highlighted: true,
  },
  {
    id: "ouro",
    name: "Ouro",
    audience: "Grandes produtores e consultores",
    price: 399,
    features: [
      "Múltiplos usuários",
      "Relatórios com marca própria",
      "Leitura de notas via foto",
      "Suporte prioritário",
    ],
  },
];
