/**
 * Sugestões de "o que mais dá pra pedir", escolhidas por código conforme o assunto e a cultura do
 * produtor. Pedido do Matheus (2026-10-15): o bot só convidava para alerta (e, sorteado, sinal de venda
 * ou outra cultura); o produtor precisa ver a VARIEDADE do que o Safralume faz, no que fizer sentido
 * para ele naquele momento. Aqui o código escolhe 2 caminhos diferentes, sem repetir o que acabou de
 * ser oferecido, e o modelo só os escreve de forma natural.
 */
import {
  culturaMaisRecenteNoHistorico,
  culturaMencionada,
  normalizarCultura,
} from "@/config/culturas";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { ProdutorContexto } from "@/lib/bot/types";

type Categoria = "grao" | "boi" | "cafe" | "leite" | "outra";
type Assunto = "preco" | "clima" | "cambio" | "outro";

type Contexto = {
  cultura: string | null;
  categoria: Categoria;
  assunto: Assunto;
  uf: string | null;
  turnosDoProdutor: number;
  semLogin: boolean;
  falouDeMT: boolean;
};

export type Sugestao = {
  id: string;
  /** O que oferecer, já com um exemplo de pedido quando houver. */
  convite: string;
  /** Reconhece a oferta numa resposta do bot (para não repetir e para conferir que ela saiu). */
  reconhecer: RegExp;
  /** 1 = contextual (mais relevante agora), 3 = genérica. */
  nivel: 1 | 2 | 3;
  quando: (c: Contexto) => boolean;
};

const GRAOS = new Set(["soja", "milho", "trigo", "feijão", "arroz", "sorgo granífero", "aveia"]);

function categoriaDe(cultura: string | null): Categoria {
  if (!cultura) return "outra";
  const c = normalizarCultura(cultura);
  if (GRAOS.has(c) || c.startsWith("algod")) return "grao";
  if (["boi", "bezerro", "bezerra", "garrote", "novilha", "vaca gorda", "vaca magra"].includes(c)) {
    return "boi";
  }
  if (c.startsWith("café")) return "cafe";
  if (c.startsWith("leite")) return "leite";
  return "outra";
}

const ASSUNTO_CLIMA = /\b(clima|tempo|previs[ãa]o|geada|seca|chuv\w*|chov\w*|umidade)\b/i;
const ASSUNTO_CAMBIO = /\b(d[óo]lar|c[âa]mbio|ptax)\b/i;

const nome = (c: Contexto) => c.cultura ?? "sua cultura";

export const SUGESTOES: Sugestao[] = [
  {
    id: "sinal_venda",
    nivel: 1,
    convite:
      'saber se é hora de vender ou esperar (sinal de venda): "Vale vender {cultura} agora?"',
    reconhecer: /sinal de venda|hora de vender|bom momento (pra|para) vender|vale vender/i,
    quando: (c) => c.assunto !== "cambio" && c.categoria !== "outra" && !!c.cultura,
  },
  {
    id: "ferrugem",
    nivel: 1,
    convite: "ver se já tem foco de ferrugem asiática na sua região",
    reconhecer: /ferrugem/i,
    quando: (c) => c.cultura === "soja",
  },
  {
    id: "imea_mt",
    nivel: 1,
    convite:
      'ver o mercado de Mato Grosso do Imea (escala de abate, vaca gorda, prêmio no porto): "Como está a escala de abate em MT?"',
    reconhecer: /escala de abate|pr[êe]mio (no )?porto|indicadores do imea/i,
    quando: (c) =>
      (c.uf === "MT" || c.falouDeMT) &&
      ["boi", "grao"].includes(c.categoria) &&
      c.assunto === "preco",
  },
  {
    id: "leilao",
    nivel: 1,
    convite:
      'a agenda de leilões de gado da sua região (plano Prata): "Tem leilão de gado essa semana?"',
    reconhecer: /leil[ãa]o|leil[õo]es/i,
    quando: (c) => c.categoria === "boi",
  },
  {
    id: "reposicao",
    nivel: 2,
    convite: 'o preço de reposição (bezerro, garrote, vaca magra): "Quanto tá o bezerro em SP?"',
    reconhecer: /bezerr|garrote|vaca magra|reposi[cç][aã]o/i,
    quando: (c) => c.categoria === "boi",
  },
  {
    id: "leite_milho",
    nivel: 1,
    convite:
      'a relação entre o leite e o milho (quantos litros paga uma saca): "Como está a relação leite e milho?"',
    reconhecer: /rela[cç][aã]o (entre )?(o )?leite|leite (e|x) milho/i,
    quando: (c) => c.categoria === "leite",
  },
  {
    id: "alerta_clima",
    nivel: 1,
    convite: "um aviso automático de geada, chuva forte ou seca na sua região",
    reconhecer: /alerta de (clima|geada|chuva)|avis\w+[^.?!]{0,40}(geada|chuva forte|seca)/i,
    quando: (c) => c.assunto === "clima",
  },
  {
    id: "janela_plantio",
    nivel: 2,
    convite:
      'a janela oficial de plantio (se vale plantar agora): "Qual a janela de plantio de {cultura}?"',
    reconhecer: /janela de plantio|vale plantar|zarc/i,
    quando: (c) => c.categoria === "grao" && c.assunto !== "cambio",
  },
  {
    id: "andamento_safra",
    nivel: 2,
    convite: "como está o plantio e a colheita no seu estado, comparado com a média de 5 anos",
    reconhecer:
      /andamento (do plantio|da safra|da colheita)|plantio e (a )?colheita|m[ée]dia de 5 anos/i,
    quando: (c) => c.categoria === "grao" && c.assunto === "preco",
  },
  {
    id: "mercado",
    nivel: 2,
    convite: "o câmbio, os futuros da B3 e o diesel, que mexem no preço",
    reconhecer: /c[aâ]mbio|d[oó]lar|futuros?|diesel/i,
    quando: (c) => ["grao", "boi", "cafe"].includes(c.categoria) && c.assunto === "preco",
  },
  {
    id: "estudo_proposta",
    nivel: 2,
    convite:
      "comparar uma proposta de comprador com o mercado: manda a foto ou o PDF, ou escreve o que ofereceram",
    reconhecer: /proposta/i,
    quando: (c) => ["grao", "boi", "cafe", "leite"].includes(c.categoria) && c.assunto === "preco",
  },
  {
    id: "calculadora",
    nivel: 2,
    convite:
      'calcular quanto vale a sua safra e a margem: "Tenho 5.000 sacas de {cultura}, quanto vale?"',
    reconhecer: /quanto vale a sua safra|calcul\w+[^.?!]{0,30}(safra|margem)/i,
    quando: (c) => ["grao", "cafe"].includes(c.categoria) && c.assunto === "preco",
  },
  {
    id: "insumos",
    nivel: 2,
    convite: 'o preço de defensivos e fertilizantes (plano Prata): "Quanto tá a ureia?"',
    reconhecer: /ureia|defensivos?|fertilizantes?|insumos?/i,
    quando: (c) => ["grao", "cafe", "leite"].includes(c.categoria),
  },
  {
    id: "resumo_diario",
    nivel: 2,
    convite: 'um resumo de bom dia no horário que você escolher: "Quero o resumo diário às 7h"',
    reconhecer: /resumo di[aá]rio|bom dia resumido/i,
    quando: (c) => c.turnosDoProdutor >= 2,
  },
  {
    id: "alerta_cambio",
    nivel: 1,
    convite: "um aviso quando o dólar passar de um valor que você escolher",
    reconhecer: /alerta do d[oó]lar|avis\w+[^.?!]{0,30}d[oó]lar/i,
    quando: (c) => c.assunto === "cambio",
  },
  {
    id: "alerta_preco",
    nivel: 3,
    convite: "um aviso automático quando o preço de {cultura} chegar no valor que você quer",
    reconhecer: /alertas? autom[aá]tico|alerta de pre[cç]o|avis\w+[^.?!]{0,30}(quando|sozinho)/i,
    quando: (c) => c.assunto === "preco" && !!c.cultura,
  },
  {
    id: "outra_cultura",
    nivel: 3,
    convite: "acompanhar outra cultura ou outro estado (cobrimos mais de 70 produtos)",
    reconhecer:
      /\boutr[ao]s?\s+culturas?\b[^.?!]{0,40}\boutr[ao]s?\s+estados?\b|\boutr[ao]s?\s+estados?\b[^.?!]{0,40}\boutr[ao]s?\s+culturas?\b|mais de 70/i,
    quando: () => true,
  },
  {
    id: "painel",
    nivel: 3,
    convite: "o painel no site, com gráficos e histórico: é só pedir o link de acesso aqui",
    reconhecer: /painel|link de acesso/i,
    quando: (c) => c.semLogin && c.turnosDoProdutor >= 3,
  },
];

// Só conta como "oferta" a frase que convida (pergunta, "é só pedir", "quer", "posso"): o mesmo assunto
// aparece em resposta normal de dado ("futuros da B3", "painel") sem ser convite nenhum.
function frasesDeConvite(resposta: string): string[] {
  return resposta
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((f) => /\?|é só|\bmand[ae]\b|\bquer\b|\bposso\b|\bpode pedir\b/i.test(f));
}

export function ofereceu(resposta: string, s: Sugestao): boolean {
  return frasesDeConvite(resposta).some((f) => s.reconhecer.test(f));
}

/** A resposta fez algum convite do catálogo de sugestões? */
export function ofereceuAlgo(resposta: string): boolean {
  return SUGESTOES.some((s) => ofereceu(resposta, s));
}

function montarContexto(
  produtor: ProdutorContexto,
  historico: HistoricoLinha[],
  texto: string,
): Contexto {
  const cultura =
    culturaMencionada(texto) ??
    culturaMaisRecenteNoHistorico(historico) ??
    (produtor.cultura_principal ? normalizarCultura(produtor.cultura_principal) : null);
  const assunto: Assunto = ASSUNTO_CAMBIO.test(texto)
    ? "cambio"
    : ASSUNTO_CLIMA.test(texto)
      ? "clima"
      : culturaMencionada(texto)
        ? "preco"
        : "outro";
  return {
    cultura,
    categoria: categoriaDe(cultura),
    assunto,
    uf: produtor.uf?.toUpperCase() ?? null,
    turnosDoProdutor: historico.filter((h) => h.role === "user").length,
    semLogin: !produtor.user_id,
    falouDeMT: /\b(mt|mato grosso)\b/i.test(texto),
  };
}

const PESO_POR_NIVEL = { 1: 4, 2: 3, 3: 1 } as const;
// Janela de respostas do bot olhadas para não repetir o mesmo convite.
const RESPOSTAS_RECENTES = 6;

/** Até `max` convites diferentes, contextuais e que o bot não fez nas últimas respostas. */
export function escolherSugestoes(params: {
  produtor: ProdutorContexto;
  historico: HistoricoLinha[];
  texto: string;
  max?: number;
  sorteio?: () => number;
}): Sugestao[] {
  const { produtor, historico, texto, max = 2, sorteio = Math.random } = params;
  const ctx = montarContexto(produtor, historico, texto);
  const recentes = [...historico]
    .filter((h) => h.role === "assistant")
    .sort((a, b) => b.ordem - a.ordem)
    .slice(0, RESPOSTAS_RECENTES)
    .map((h) => h.conteudo);
  let candidatas = SUGESTOES.filter((s) => s.quando(ctx) && !recentes.some((r) => ofereceu(r, s)));
  const escolhidas: Sugestao[] = [];
  while (escolhidas.length < max && candidatas.length > 0) {
    const total = candidatas.reduce((soma, s) => soma + PESO_POR_NIVEL[s.nivel], 0);
    let alvo = sorteio() * total;
    let i = 0;
    for (; i < candidatas.length - 1; i++) {
      alvo -= PESO_POR_NIVEL[candidatas[i]!.nivel];
      if (alvo < 0) break;
    }
    const s = candidatas[i]!;
    escolhidas.push(s);
    candidatas = candidatas.filter((x) => x.id !== s.id);
  }
  return escolhidas.map((s) => ({ ...s, convite: s.convite.replaceAll("{cultura}", nome(ctx)) }));
}

/** A resposta já traz alguma das ofertas que a nota pediu? */
export function respostaTemConvite(resposta: string, escolhidas: Sugestao[]): boolean {
  return escolhidas.some((s) => ofereceu(resposta, s));
}

/** Quantas das sugestões escolhidas a resposta realmente ofereceu. */
export function quantasOferecidas(resposta: string, escolhidas: Sugestao[]): number {
  return escolhidas.filter((s) => ofereceu(resposta, s)).length;
}

export type ModoDaNota = "primeira_resposta" | "comeco" | "momento";

export function notaDeSugestoes(escolhidas: Sugestao[], modo: ModoDaNota): string {
  const lista = escolhidas.map((s, i) => `(${i + 1}) ${s.convite}`).join(" ");
  const quantos = escolhidas.length >= 3 ? "TRÊS" : "DOIS";
  const abertura =
    modo === "primeira_resposta"
      ? "Nota OBRIGATÓRIA pra esta resposta: esta é a PRIMEIRA mensagem de verdade desse produtor depois de criar a conta, o momento de maior atenção que ele vai dar ao Safralume. Ele precisa ver a variedade do que dá pra pedir, não só preço."
      : modo === "comeco"
        ? "Nota: esse produtor já tem cadastro e está no início da conversa com você: é um momento-chave pra ele ver o que mais o Safralume faz."
        : "Nota OBRIGATÓRIA pra esta resposta: esse produtor acabou de perguntar algo que abre caminho pra outras coisas úteis, um momento-chave real. Não copie o padrão das respostas anteriores desta conversa se elas não tinham convite.";
  return `${abertura} Depois de responder a pergunta dele normalmente (com o dado real, igual sempre), termine com UMA ou DUAS frases curtas e naturais que mostrem ${quantos} caminhos diferentes que ele pode pedir agora: ${lista} Use os exemplos entre aspas quando houver, não invente nada além disso, não diga "mais de 10 funcionalidades" nem "seu plano cobre muito mais" de forma genérica: nomeie as coisas. Não ofereça só alerta. O tamanho da resposta NÃO é motivo pra pular isso. Só pule se o pedido dele já foi exatamente sobre isso.`;
}
