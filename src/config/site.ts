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
      "Alertas de preço",
      "Relatórios em PDF",
      "Contexto de mercado: câmbio, diesel e safra segundo a USDA",
    ],
  },
  {
    id: "prata",
    name: "Prata",
    audience: "Médios produtores",
    price: 129,
    features: [
      "Tudo do Bronze, mais:",
      "Tendências climáticas",
      "Compara o preço da Conab com o da Imea",
      "Produção da sua cultura por estado (IBGE)",
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
      "Lista de acompanhamento (outras culturas e estados)",
      "Mercado futuro da B3: a curva de preço pra decidir vender agora ou mais pra frente",
      "Suporte prioritário",
    ],
  },
];
