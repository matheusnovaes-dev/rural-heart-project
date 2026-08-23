export const siteConfig = {
  name: "Terralume",
  tagline: "O preço líquido da sua saca, direto no WhatsApp",
  description:
    "Terralume traduz os relatórios do Cepea e da Conab em respostas simples, com frete já descontado, direto no WhatsApp do produtor.",
  whatsapp: {
    // TODO: confirm this number is correct and active before going live.
    number: "5537998333290",
    defaultMessage: "Olá! Quero testar o Terralume grátis por 7 dias.",
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
  priceRange: string;
  features: string[];
  highlighted?: boolean;
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "bronze",
    name: "Bronze",
    audience: "Pequenos produtores",
    priceRange: "R$ 29–49/mês",
    features: ["Bot de WhatsApp", "Cotações diárias", "Resumo semanal", "50 consultas por mês"],
  },
  {
    id: "prata",
    name: "Prata",
    audience: "Médios produtores",
    priceRange: "R$ 99–149/mês",
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
    priceRange: "R$ 299–499/mês",
    features: [
      "Múltiplos usuários",
      "Relatórios com marca própria",
      "Leitura de notas via foto",
      "Suporte prioritário",
    ],
  },
];
