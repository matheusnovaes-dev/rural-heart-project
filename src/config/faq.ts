/**
 * Perguntas frequentes da landing. Cada resposta segue o que já está nos
 * Termos de Uso e na Política de Privacidade (cobrança, cancelamento, dados) e
 * no que o produto de fato faz, pra a página nunca prometer algo diferente do
 * contrato. Texto simples (sem JSX) de propósito: o mesmo conteúdo vai pro
 * FAQPage em JSON-LD (rich result do Google).
 */
export type PerguntaFrequente = { pergunta: string; resposta: string };

export const perguntasFrequentes: PerguntaFrequente[] = [
  {
    pergunta: "O teste de 7 dias é grátis mesmo? Preciso de cartão?",
    resposta:
      "É grátis e não pede cartão de crédito. Você usa o plano escolhido por 7 dias. Se não quiser continuar, é só cancelar antes do fim do teste e nada é cobrado.",
  },
  {
    pergunta: "O que acontece depois dos 7 dias?",
    resposta:
      "No fim do teste, a cobrança do plano escolhido é gerada pela Asaas e você paga por Pix, boleto ou cartão. Não quer seguir? Cancele antes pelo WhatsApp de suporte.",
  },
  {
    pergunta: "Como eu cancelo?",
    resposta:
      "A qualquer momento, pelo WhatsApp de suporte. Se você já pagou o mês, o acesso continua até o fim do ciclo pago.",
  },
  {
    pergunta: "Preciso instalar algum aplicativo?",
    resposta:
      "Não. O Safralume responde no WhatsApp que você já usa. Se preferir, também tem o painel no navegador, no celular ou no computador.",
  },
  {
    pergunta: "De onde vêm os preços?",
    resposta:
      "De fontes públicas oficiais: Conab para o Brasil todo e, onde elas dão um número mais completo, órgãos e boletins estaduais como Imea, Deral/PR, Epagri/SC, Emater/RS, BBM e IEA-SP. Mercado futuro vem da B3 e câmbio do Banco Central. Toda resposta mostra a fonte e a data.",
  },
  {
    pergunta: "Funciona com internet fraca?",
    resposta:
      "Sim. No WhatsApp você manda texto e recebe texto, então funciona mesmo com sinal fraco no campo.",
  },
  {
    pergunta: "E se a minha cultura ou o meu estado não tiver preço recente?",
    resposta:
      "O Safralume avisa que não há preço recente e mostra a referência mais recente de outros estados, sempre dizendo qual é. Nunca inventa um número. Cobrimos mais de 70 culturas, de grãos e café a boi e leite.",
  },
  {
    pergunta: "Isso é recomendação de investimento?",
    resposta:
      "Não. O Safralume mostra cenários de mercado com base em dados públicos. A decisão de comprar ou vender é sempre sua.",
  },
  {
    pergunta: "O que vocês fazem com o meu WhatsApp e os meus dados?",
    resposta:
      "Usamos só pra mandar o que você pediu, como preços e alertas, e pra operar sua assinatura. Não vendemos seus dados. Se não quiser mais receber mensagens, é só pedir pelo WhatsApp. Os detalhes estão na Política de Privacidade.",
  },
];
