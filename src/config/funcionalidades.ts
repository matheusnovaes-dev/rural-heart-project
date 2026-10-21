/**
 * Catálogo do que o Safralume faz HOJE, fonte única para o bot (responder "o que
 * vocês têm?", "tem como...?", "o que há de novo?") e para o comunicado de
 * novidades. Cada item foi conferido contra as ferramentas do bot e o painel
 * reais; nada aqui é promessa. Ao lançar algo, acrescente aqui com a data em
 * `novidadeDesde` e o bot passa a saber e a destacar como novidade.
 */
export type Funcionalidade = {
  id: string;
  titulo: string;
  /** O que faz, em linguagem de produtor, sem jargão. */
  descricao: string;
  /** Frase de exemplo que o produtor pode mandar no WhatsApp. */
  comoPedir: string;
  onde: "WhatsApp" | "painel" | "WhatsApp e painel";
  /** Presente só quando NÃO é do plano básico. */
  plano?: "Prata" | "Ouro";
  /** AAAA-MM-DD: marca como novidade durante `DIAS_DE_NOVIDADE` dias. */
  novidadeDesde?: string;
  /** Ordem editorial entre as novidades (1 = a que mais vale mostrar primeiro). */
  destaque?: number;
  /** Frase de uso própria, quando "Pra usar, mande: <comoPedir>" não serve. */
  fraseDeUso?: string;
};

export const DIAS_DE_NOVIDADE = 30;

export const funcionalidades: Funcionalidade[] = [
  {
    id: "caderno_fazenda",
    titulo: "Caderno da fazenda",
    descricao:
      'Anote o que acontece na fazenda só escrevendo ou mandando áudio: gasto ("gastei 12 mil de adubo no talhão 3"), venda ("vendi 500 sacas a 135"), plantio e colheita. O resumo mostra gastos por categoria, vendas, resultado do mês, o que vem pela frente e compara sua venda com o preço de hoje. Tudo aparece também na tela Fazenda do painel, onde dá para lançar, editar e baixar em planilha. Dá para desfazer o último lançamento.',
    comoPedir: "Gastei 3 mil de diesel hoje, ou: resumo da fazenda",
    onde: "WhatsApp e painel",
    novidadeDesde: "2026-10-21",
    destaque: 0,
    fraseDeUso:
      'Para lançar, é só escrever, por exemplo: "gastei 12 mil de adubo no talhão 3" ou "vendi 500 sacas de soja a 135". Para ver tudo, mande: "resumo da fazenda".',
  },
  {
    id: "resumo_diario",
    titulo: "Resumo diário",
    descricao:
      "Um bom dia resumido, no horário que você escolher, com o preço da sua cultura, o andamento da safra, ferrugem, sinal de venda e previsão do tempo.",
    comoPedir: "Quero o resumo diário às 7h",
    onde: "WhatsApp",
    novidadeDesde: "2026-10-12",
    destaque: 1,
  },
  {
    id: "aviso_proativo",
    titulo: "Aviso automático só quando importa",
    descricao:
      "O Safralume avisa sozinho quando o preço da sua cultura mexe de verdade, quando vem clima severo (chuva forte ou geada) ou quando o dólar se move. No máximo 1 por dia e, na maioria dos dias, nenhum. Dá para desligar quando quiser.",
    comoPedir: "Não quero mais esses avisos",
    onde: "WhatsApp",
    novidadeDesde: "2026-10-11",
    destaque: 2,
    fraseDeUso:
      'Já vem ligado para quem conversa com a gente. Para desligar, mande: "Não quero mais esses avisos".',
  },
  {
    id: "comparar_proposta",
    titulo: "Estudo de proposta (foto, PDF ou texto)",
    descricao:
      "Mande a foto, o print da conversa ou o PDF de uma proposta ou tabela de preços (ou conte por escrito). O Safralume lê, compara com o preço de mercado, considera o prazo de pagamento, ranqueia os compradores e diz o que perguntar antes de fechar. Depois você pode questionar (por que está abaixo, de onde vem o preço) ou mudar um valor (e se o comprador topar 130, e se for à vista) que ele refaz a conta. Bronze: 3 estudos por dia; Prata e Ouro: 15 por dia.",
    comoPedir:
      "Manda a foto da proposta, ou escreva: Um comprador ofereceu 126 e outro 128 em 30 dias, qual é melhor?",
    onde: "WhatsApp",
    novidadeDesde: "2026-10-13",
    destaque: 0,
  },
  {
    id: "alerta_cambio",
    titulo: "Alerta do dólar",
    descricao: "Avisa no WhatsApp quando o dólar passar do valor que você definir.",
    comoPedir: "Me avisa se o dólar passar de 5,20",
    onde: "WhatsApp e painel",
    novidadeDesde: "2026-10-12",
    destaque: 4,
  },
  {
    id: "comparativo_regional",
    titulo: "Seu estado contra os outros",
    descricao:
      "Mostra como o seu estado está vendendo em relação aos outros estados que acompanhamos.",
    comoPedir: "Quanto tá a soja hoje?",
    onde: "WhatsApp e painel",
    novidadeDesde: "2026-10-11",
    destaque: 5,
    fraseDeUso: 'Ele já aparece junto do preço, é só perguntar: "Quanto tá a soja hoje?".',
  },
  {
    id: "memoria",
    titulo: "Lembra do que você conta",
    descricao:
      "O Safralume guarda o que você contar de importante (onde vende, preocupações, planos) para as próximas conversas. Se não quiser que ele lembre, é só pedir para esquecer.",
    comoPedir: "Esquece isso",
    onde: "WhatsApp",
    novidadeDesde: "2026-10-09",
    destaque: 6,
    fraseDeUso:
      'Ele guarda sozinho o que você contar de importante. Para apagar, mande: "Esquece isso".',
  },
  {
    id: "cidade",
    titulo: "Clima e frete da sua cidade",
    descricao:
      "Conte a sua cidade e o clima e o frete de referência passam a usar ela, em vez da capital do estado. Também dá para informar no cadastro.",
    comoPedir: "Minha cidade é Rio Verde, GO",
    onde: "WhatsApp",
    novidadeDesde: "2026-10-13",
    destaque: 7,
  },
  {
    id: "preco",
    titulo: "Preço da sua região",
    descricao:
      "O preço de hoje da sua cultura na sua região, comparado com o porto (paridade) e com o frete. Cobre soja, milho, café (arábica e conillon), boi, leite, feijão, trigo, arroz, algodão, cana, reposição de gado, ovos e mais de 70 produtos, onde há cotação oficial.",
    comoPedir: "Quanto tá a soja em Sorriso?",
    onde: "WhatsApp e painel",
  },
  {
    id: "sinal_venda",
    titulo: "Sinal de venda",
    descricao:
      "Cruza o preço de hoje com os últimos 90 dias, os futuros da B3 e o clima para dizer se é hora de vender ou esperar. É um cenário de mercado, não recomendação de investimento.",
    comoPedir: "Vale vender a soja agora?",
    onde: "WhatsApp e painel",
  },
  {
    id: "alertas",
    titulo: "Alertas de preço e de clima",
    descricao:
      "Avisa no WhatsApp quando o preço da sua cultura cruzar um valor, ou quando vier chuva forte, geada, seca prolongada ou vento forte. No plano Bronze são até 3 ao mesmo tempo; Prata e Ouro, sem limite.",
    comoPedir: "Me avisa quando a soja passar de R$ 140",
    onde: "WhatsApp e painel",
  },
  {
    id: "calculadora",
    titulo: "Calculadora de safra",
    descricao:
      "Quanto a sua produção vale hoje (sacas vezes o preço da sua região) e a sua margem, se você informar o custo por saca.",
    comoPedir: "Tenho 5.000 sacas de soja, quanto vale?",
    onde: "WhatsApp e painel",
  },
  {
    id: "plantio",
    titulo: "Janela de plantio",
    descricao:
      "Diz se vale plantar agora ou esperar, pelo zoneamento oficial (ZARC), para soja, milho, algodão, arroz e feijão.",
    comoPedir: "Posso plantar soja agora em Sorriso?",
    onde: "WhatsApp e painel",
  },
  {
    id: "clima",
    titulo: "Previsão do tempo",
    descricao: "Previsão por estado ou por cidade, quantas vezes você quiser.",
    comoPedir: "Vai chover amanhã aqui?",
    onde: "WhatsApp e painel",
  },
  {
    id: "ferrugem",
    titulo: "Ferrugem asiática da soja",
    descricao:
      "Consulta os focos de ferrugem confirmados por município. É consulta, não há alerta automático de ferrugem.",
    comoPedir: "Tem ferrugem na minha região?",
    onde: "WhatsApp e painel",
  },
  {
    id: "safra",
    titulo: "Andamento da safra",
    descricao:
      "Quanto já foi plantado ou colhido na semana, comparado com a média dos últimos 5 anos (Conab).",
    comoPedir: "Como está o plantio de soja?",
    onde: "WhatsApp e painel",
  },
  {
    id: "mercado",
    titulo: "Dólar, diesel, futuros e safra no mundo",
    descricao:
      "Câmbio, diesel, futuros da B3, safra mundial (USDA), produção do IBGE e o boletim semanal da Imea.",
    comoPedir: "Quanto tá o diesel? / Como estão os futuros da soja?",
    onde: "WhatsApp e painel",
  },
  {
    id: "leite",
    titulo: "Preço do leite",
    descricao: "Referência do preço do leite e a relação leite/milho.",
    comoPedir: "Quanto estão pagando o litro do leite?",
    onde: "WhatsApp e painel",
  },
  {
    id: "insumos",
    titulo: "Preço de insumos",
    descricao: "Defensivos e fertilizantes por marca, direto da Conab.",
    comoPedir: "Quanto tá a ureia?",
    onde: "WhatsApp e painel",
    plano: "Prata",
  },
  {
    id: "leiloes",
    titulo: "Leilões de gado",
    descricao:
      "Agenda de leilões do Brasil inteiro (presencial na sua região e virtual em destaque) e alerta de novos leilões.",
    comoPedir: "Tem leilão de gado essa semana?",
    onde: "WhatsApp e painel",
    plano: "Prata",
  },
  {
    id: "indicadores_imea",
    titulo: "Mercado do boi, da soja, do milho e do algodão em Mato Grosso",
    descricao:
      "Os indicadores do Imea de Mato Grosso: escala de abate dos frigoríficos, vaca gorda e boi gordo a prazo, diferença do boi de MT para SP, prêmio no porto de Santos, diferencial de base contra Chicago, caroço de algodão e os indicadores do Cepea que o Imea publica. São dados de MT, atualizados toda semana.",
    comoPedir: "Como está a escala de abate em MT?",
    onde: "WhatsApp",
    novidadeDesde: "2026-10-15",
    destaque: 2.5,
  },
  {
    id: "cafe_feijao_trigo_arroz",
    titulo: "Café, feijão, trigo e arroz por praça",
    descricao:
      "Preço de cada praça (BBM): café arábica de MG, SP e BA, café conillon do ES, feijão, trigo e arroz, com 1 ano de histórico, então o sinal de venda dessas culturas já usa os últimos 90 dias.",
    comoPedir: "Quanto tá o café em MG?",
    onde: "WhatsApp e painel",
    novidadeDesde: "2026-10-15",
    destaque: 0.5,
  },
  {
    id: "reposicao_ovos",
    titulo: "Reposição de gado e ovos",
    descricao:
      "Preço de bezerro, bezerra, garrote, novilha, vaca gorda, vaca magra e ovos, onde há cotação (hoje São Paulo e Santa Catarina). Bezerro, bezerra, garrote e vaca magra são preço por cabeça.",
    comoPedir: "Quanto tá o bezerro em SP?",
    onde: "WhatsApp e painel",
    novidadeDesde: "2026-10-15",
    destaque: 2.6,
  },
  {
    id: "cooperativas",
    titulo: "Cooperativas e corretoras",
    descricao:
      'Painel da equipe para cooperativa ou corretora: convida os produtores e mostra o risco climático agregado. O cadastro é pelo site, na opção "Represento uma cooperativa".',
    comoPedir: "Represento uma cooperativa",
    onde: "painel",
    plano: "Prata",
  },
  {
    id: "painel",
    titulo: "Painel no site",
    descricao:
      "Os mesmos dados em gráficos, mais lembretes, boletim semanal e suporte por chamado. Peça o link de acesso aqui no WhatsApp.",
    comoPedir: "Quero o link do painel",
    onde: "painel",
  },
];

/** O que o Safralume NÃO faz hoje (para o bot dizer não com honestidade, sem inventar). */
export const naoFazHoje: string[] = [
  "só lê foto e PDF de proposta de compra ou tabela de preços; não lê outras imagens nem vídeo",
  "não faz diagnóstico de praga ou doença por imagem, nem alerta automático de praga",
  "não intermedeia compra ou venda e não fecha negócio por você",
  "não dá recomendação de investimento: mostra cenários de mercado com dado público",
  "não tem aplicativo para instalar: funciona no WhatsApp e no painel pelo navegador",
  "o caderno da fazenda guarda só o que você lança (gasto, venda, plantio, colheita); não emite nota fiscal, não faz contabilidade nem controla estoque",
];

const DIA = 86_400_000;

export function ehNovidade(f: Funcionalidade, hoje: Date = new Date()): boolean {
  if (!f.novidadeDesde) return false;
  const desde = new Date(`${f.novidadeDesde}T12:00:00-03:00`).getTime();
  return hoje.getTime() - desde <= DIAS_DE_NOVIDADE * DIA && hoje.getTime() >= desde;
}

export function novidadesRecentes(hoje: Date = new Date()): Funcionalidade[] {
  return funcionalidades
    .filter((f) => ehNovidade(f, hoje))
    .sort((a, b) => (a.destaque ?? 99) - (b.destaque ?? 99));
}

export function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}
