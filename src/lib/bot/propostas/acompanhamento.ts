import {
  avaliarPropostas,
  converterPreco,
  ehComparavel,
  ranquear,
} from "@/lib/bot/propostas/avaliar";
import { numerosDePreco } from "@/lib/bot/propostas/gatilho";
import { nomeBonito } from "@/lib/bot/propostas/texto";
import type {
  EstudoSalvo,
  FreteLido,
  PropostaAvaliada,
  PropostaLida,
  ReferenciaDeMercado,
} from "@/lib/bot/propostas/tipos";

/**
 * Perguntas e contestações depois de um estudo ("por que está abaixo?", "e se
 * for à vista?", "a Cargill topou 130", "o preço de mercado aqui é 140").
 * Tudo é respondido por código a partir do estudo guardado: o modelo nunca refaz
 * conta nem escreve número, só encaminha para as ferramentas.
 */

const brlInteiro = (n: number) =>
  `R$ ${Math.round(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${Math.abs(n).toFixed(1).replace(".", ",")}%`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O estudo com a referência que vale (a de mercado ou a que o produtor informou). */
export function referenciaDoEstudo(e: EstudoSalvo): ReferenciaDeMercado {
  if (e.referenciaManual == null) return e.ref;
  return {
    ...e.ref,
    preco: e.referenciaManual,
    rotulo: "preço que você informou",
    fonte: "informado por você",
    min: null,
    max: null,
    origem: "estado",
    faixa90d: null,
    aproximada: false,
    pracas: [],
  };
}

function avaliar(e: EstudoSalvo): PropostaAvaliada[] {
  return avaliarPropostas(e.propostas, referenciaDoEstudo(e), {
    taxaMensal: e.taxaMensal,
    quantidadePadrao: e.quantidadeInformada,
  });
}

const nomeDe = (a: PropostaAvaliada) =>
  a.comprador && a.comprador.trim() ? nomeBonito(a.comprador) : `Proposta ${a.indice + 1}`;

// ---------------------------------------------------------------------------
// Reconhecer o que o produtor está fazendo depois do estudo
// ---------------------------------------------------------------------------

const PEDIDO_DE_EXPLICACAO =
  /\b(como (voce )?(calculou|chegou|fez|calcula|se calcula)|de onde (vem|veio|tirou|saiu|e|eh)|por ?que|porque|qual (e )?(a )?fonte|explica\w*|nao entendi|o que (significa|e isso|quer dizer)|quer dizer|como assim|em que (se )?baseia|baseou|baseado|mostra (a )?conta|detalha\w*|inclui|conta (no|o|a)|considera\w*|levou em conta|tem certeza|certeza|confio|confiar|esta certo|ta certo|certo\?|errad\w*|qual (eu )?(escolho|fecho|aceito|devo)|devo (aceitar|fechar|vender)|vale (a pena )?fechar|fecho\?|aceito\?|recomend\w*|(ta|esta|e|fica) (bom|ruim|justo|baixo|alto|caro|barato|vantajos\w*)|compensa|garant\w*|errou|errad\w*|incorret\w*|nao bate|quanto (eu )?(perco|ganho|deixo|fico|sobra|da|dá)|na frente|ficou (em )?(primeiro|segundo|terceiro|atras)|por que (a|o) \w+ (ficou|esta|ta)|frustr\w*|nada disso faz sentido|confus\w*|complicad\w*|nao faz sentido|nao entendi nada)\b/;

const PALAVRA_DO_ESTUDO =
  /\b(estudo|proposta|propostas|analise|resultado|numeros?|abaixo|acima|ranking|melhor|pior|prazo|referencia|veredito|frete|cif|fob|entregue|retirad\w*|vista|juros|taxa|preco|valor|conta|calcul\w*|media|praca|pracas|fonte|mercado|90 dias|faixa|bbm|conab|escolho|fecho|aceito|isso|esse|essa|esses|essas)\b/;

const MUDANCA_NO_ESTUDO =
  /\b(e se|se (eu|ele|ela|eles|elas|for|fosse|pagar|pagarem|pagasse|pedir|conseguir|subir|baixar|topar)|topou|topar|aceitou|subiu|aumentou|baixou|diminuiu|mudou|mudar|trocar|troca|agora (e|foi|ficou|vai ser|sao|paga)|passou (pra|para)|na verdade|corrij\w*|errei|nao (e|era|foi) \d|, ?nao [r$ ]*\d|nao [r$ ]*\d+ ?(,|\.|$)|(me )?(disse|falou|passou|mandou) (que )?(e|eh|foi|era|sao|ficou|vai ser)? ?\d|desatualizad\w*|(hoje|agora|aqui|la) (paga|pagam|pagando|vale|valendo|esta|ta|e|ta pagando|esta pagando) ?\w* ?\d|paga(ndo)? \d|mercado (esta|ta|e) \d|a vista|avista|em \d+ dias?|(meu|o) dinheiro rende|custo do dinheiro|juros de|taxa de|aqui (e|esta|ta|paga|vale)|referencia (e|eh|aqui)|tambem (ofereceu|propos)|(chegou|apareceu|recebi|tenho|surgiu) (mais )?(uma|outra) (proposta|oferta)|outra (proposta|oferta)|oferecer\w* mais|melhorou|pediu mais)\b/;

const TEM_VALOR = /\d/;

/** Só a pergunta, sem assunto ("por quê?", "como assim?"): na conversa do estudo, é sobre ele. */
const SO_A_PERGUNTA =
  /^(por ?que|porque|como assim|explica\w*|me explica\w*|nao entendi|como|quer dizer|tem certeza|certeza|ta certo|esta certo|e agora)\W*$/;

/** Perguntas sobre outras coisas do produto não são sobre o estudo, mesmo com "por que". */
const OUTRO_ASSUNTO =
  /(dolar|cambio|clima|chuva|geada|plantio|alerta|resumo|plano|assinatura|futuro|b3|ferrugem|insumo|leilao|funcionario|cadastro|senha|painel|link|cancel)/;

const PALAVRA_FORTE_DO_ESTUDO =
  /\b(estudo|proposta|propostas|ranking|referencia|prazo|frete|abaixo|acima|veredito|cif|fob|vista|juros|taxa|calculo|calculou)\b/;

const nomesDosCompradores = (e: EstudoSalvo | undefined): string[] =>
  (e?.propostas ?? []).map((p) => semAcento(p.comprador ?? "").trim()).filter((n) => n.length >= 3);

export function ehPedidoDeExplicacao(texto: string, estudo?: EstudoSalvo): boolean {
  const t = semAcento(texto.trim());
  if (t.length === 0 || OUTRO_ASSUNTO.test(t)) return false;
  // "E se a Bunge pagar à vista?" é mudança (mesmo sem número), não pedido de explicação.
  if (MUDANCA_NO_ESTUDO.test(t) && /\d|vista/.test(t)) return false;
  if (SO_A_PERGUNTA.test(t) || FRUSTRACAO.test(t)) return true;
  const citaComprador = nomesDosCompradores(estudo).some((n) => t.includes(n));
  if (PEDIDO_DE_EXPLICACAO.test(t) && (PALAVRA_DO_ESTUDO.test(t) || citaComprador)) return true;
  // Pergunta sobre uma parte do estudo ou sobre um dos compradores: "e o frete?", "e a Bunge?"
  if (t.includes("?") && !TEM_VALOR.test(t) && (PALAVRA_FORTE_DO_ESTUDO.test(t) || citaComprador)) {
    return true;
  }
  return false;
}

export function ehMudancaNoEstudo(texto: string): boolean {
  const t = semAcento(texto.trim());
  return MUDANCA_NO_ESTUDO.test(t) && /\d|vista/.test(t);
}

/** "E se eu vender só metade?", "e se o preço subir?": cenário sem número, não dá para refazer. */
export function ehCenarioSemNumero(texto: string): boolean {
  const t = semAcento(texto.trim());
  return /^(e se|se)\b/.test(t) && !TEM_VALOR.test(t) && !/vista/.test(t) && !OUTRO_ASSUNTO.test(t);
}

/**
 * "O mercado aí tá desatualizado, aqui paga 142": o número é o preço de REFERÊNCIA da região
 * dele, não uma mudança no preço de um comprador. Decidido por código porque o modelo
 * confundia as duas coisas e mexia na proposta errada.
 */
export function referenciaInformadaPeloProdutor(texto: string, estudo: EstudoSalvo): number | null {
  const t = semAcento(texto);
  const numeros = numerosDePreco(texto);
  if (numeros.length !== 1) return null;
  if (nomesDosCompradores(estudo).some((n) => t.includes(n))) return null;
  const forte = /(mercado|referencia|regiao|praca|cotacao|bbm|desatualizad|minha cidade)/.test(t);
  const fraca = /\baqui\b|por aqui/.test(t) && !/(ofere|propo|topou|pedi|pediu|propost)/.test(t);
  return forte || fraca ? numeros[0]! : null;
}

export const PEDIR_UM_NUMERO =
  'Pra eu refazer a conta preciso de um número concreto. Me diga, por exemplo, quantas sacas você quer considerar ("tenho 2.000 sacas"), um preço novo ("a Cargill topou 130"), um prazo ("à vista" ou "em 60 dias") ou o preço da sua região ("aqui paga 140").';

// ---------------------------------------------------------------------------
// Explicar a conta
// ---------------------------------------------------------------------------

type Topico =
  "referencia" | "prazo" | "frete" | "ranking" | "veredito" | "faixa" | "confianca" | "decisao";

const FRUSTRACAO =
  /(robo ruim|bot ruim|pessim\w*|lixo|horrivel|nada disso faz sentido|nao faz sentido|nao entendi nada|confus\w*|complicad\w*|nao serve|inutil|bobagem)/;
const CONTESTACAO = /(errou|errad\w*|incorret\w*|nao bate|nao confere|conta errada|nao esta certo)/;
const GARANTIA = /garant\w*|certeza|confiavel|pode confiar/;
const RECOMENDACAO = /recomend\w*/;
const QUER_TOTAL = /quanto (eu )?(perco|ganho|deixo|fico|sobra|da|dá)|total|no bolso|em reais/;

const TOPICO_RE: Record<Topico, RegExp> = {
  referencia:
    /referenc|fonte|de onde|mercado|praca|pracas|media|bbm|conab|cotacao|preco de hoje|preco do dia/,
  prazo: /prazo|juros|taxa|vista|dias|1 ?%|custo do dinheiro|dinheiro|equivalente/,
  frete: /frete|cif|fob|entregue|retirad|porteira/,
  ranking:
    /ranking|ordem|classific|primeiro|segundo|melhor|pior|posicao|na frente|atras|ficou|vence|ganh|perde/,
  veredito:
    /abaixo|acima|veredito|justo|em linha|negociar|diferenca|por ?cento|%|bom|ruim|vantaj|compensa|caro|barato|perco|ganho|total/,
  faixa: /90 dias|faixa|trimestre|minima|maxima|historico/,
  confianca: /certeza|confi|correto|certo|errad|erro|li |leu|leitura|documento|foto|pdf/,
  decisao: /escolho|fecho|aceito|devo|vale (a pena )?fechar|decid/,
};

export function topicosDaPergunta(texto: string): Topico[] {
  const t = semAcento(texto);
  const achados = (Object.keys(TOPICO_RE) as Topico[]).filter((k) => TOPICO_RE[k].test(t));
  return achados;
}

function secaoReferencia(e: EstudoSalvo): string {
  const ref = referenciaDoEstudo(e);
  const un = ref.unidade === "saca" ? `saca de ${ref.kgPorSaca ?? 60} kg` : ref.unidade;
  const linhas = [`*De onde vem a referência*`, `${brl(ref.preco)} por ${un}: ${ref.rotulo}.`];
  if (e.referenciaManual != null) {
    linhas.push(
      `Usei o valor que você me passou no lugar do preço de mercado (que era ${brl(e.ref.preco)}, ${e.ref.rotulo}).`,
    );
    return linhas.join("\n");
  }
  linhas.push(`Fonte: ${ref.fonte}, ${dataBr(ref.data)}.`);
  if (ref.pracas && ref.pracas.length > 1) {
    linhas.push(
      `Entraram na média: ${ref.pracas.map((p) => `${p.regiao} ${brl(p.preco)}`).join("; ")}.`,
    );
  }
  if (ref.aproximada) {
    linhas.push(
      "Como o seu estado não tem preço recente, usei a média de outros estados: é uma aproximação.",
    );
  }
  linhas.push(
    "É o preço de mercado do dia por região, não o preço da sua venda: distância, qualidade e prazo podem deixar o seu preço diferente. Se você sabe o preço da sua região, me diga que eu refaço a conta com ele.",
  );
  return linhas.join("\n");
}

function secaoPrazo(e: EstudoSalvo, av: PropostaAvaliada[]): string {
  const taxa = (e.taxaMensal * 100).toFixed(1).replace(".0", "").replace(".", ",");
  const linhas = ["*Como entrou o prazo de pagamento*"];
  const comPrazo = av.filter((a) => a.prazoDias != null && a.prazoDias > 0 && a.preco != null);
  for (const a of comPrazo) {
    linhas.push(
      `• *${nomeDe(a)}*: ${brl(a.preco!)} em ${a.prazoDias} dias. À vista isso vale ${brl(a.precoEfetivo!)}: ${brl(a.preco!)} dividido por (1 + ${taxa}% × ${a.prazoDias}/30). O prazo custa ${brl(a.custoDoPrazo!)} por unidade.`,
    );
  }
  for (const a of av.filter((x) => x.prazoDias === 0))
    linhas.push(`• *${nomeDe(a)}*: à vista, então não ajustei o preço.`);
  for (const a of av.filter((x) => x.prazoDias == null)) {
    linhas.push(`• *${nomeDe(a)}*: o prazo não está informado, então não ajustei o preço.`);
  }
  linhas.push(
    `O ${taxa}% ao mês é uma hipótese de quanto custa ter o dinheiro parado. Se o seu custo for outro, me diga (por exemplo: "meu dinheiro rende 1,5% ao mês") que eu refaço.`,
  );
  return linhas.join("\n");
}

const FRETE_TEXTO: Record<FreteLido, string> = {
  fob_retirado: "retirado na propriedade: dá para comparar direto com a referência",
  cif_entregue: "entregue (frete por sua conta): falta descontar o frete antes de comparar",
  nao_informado: "não diz quem paga o frete",
};

function secaoFrete(av: PropostaAvaliada[]): string {
  const linhas = [
    "*Sobre o frete*",
    "Retirado na propriedade (FOB): o comprador busca e o frete é dele. Entregue (CIF): você leva até o destino e o frete sai do seu bolso, então esse preço só compara com o mercado depois de descontar o frete.",
  ];
  for (const a of av) linhas.push(`• *${nomeDe(a)}*: ${FRETE_TEXTO[a.frete]}.`);
  return linhas.join("\n");
}

function secaoVeredito(
  e: EstudoSalvo,
  avTodas: PropostaAvaliada[],
  pediuTotal = false,
  foco: PropostaAvaliada | null = null,
): string {
  const ref = referenciaDoEstudo(e);
  const av = foco ? [foco] : avTodas;
  const linhas = ["*Como chego no veredito*"];
  for (const a of av) {
    if (a.preco == null) {
      linhas.push(`• *${nomeDe(a)}*: não consegui comparar, falta entender o preço ou a unidade.`);
    } else if (a.suspeita) {
      linhas.push(
        `• *${nomeDe(a)}*: ${brl(a.precoLido ?? a.preco)} está a mais de 30% do mercado. Prefiro não opinar: pode ser erro de leitura ou de unidade.`,
      );
    } else {
      const base = a.custoDoPrazo ? `${brl(a.precoEfetivo!)} à vista` : brl(a.preco);
      const dir = (a.diferenca ?? 0) >= 0 ? "acima" : "abaixo";
      const total =
        a.diferencaTotal != null && a.quantidade != null
          ? ` Em ${a.quantidade.toLocaleString("pt-BR")} ${ref.unidade === "saca" ? "sacas" : ref.unidade + "s"}, são ${brlInteiro(Math.abs(a.diferencaTotal))} a ${a.diferencaTotal >= 0 ? "mais" : "menos"}.`
          : "";
      linhas.push(
        `• *${nomeDe(a)}*: ${base} contra ${brl(ref.preco)} de referência: ${brl(Math.abs(a.diferenca ?? 0))} ${dir} (${pct(a.diferencaPct ?? 0)})${a.frete === "cif_entregue" ? ", antes de descontar o frete" : ""}.${total}`,
      );
    }
  }
  if (foco) {
    const ordem = ranquear(avTodas);
    const melhor = ordem[0];
    if (melhor && melhor !== foco && foco.precoEfetivo != null && ordem.length > 1) {
      const d = melhor.precoEfetivo! - foco.precoEfetivo;
      const qtd = foco.quantidade ?? melhor.quantidade;
      linhas.push(
        d > 0
          ? `Contra a melhor proposta do estudo (${nomeDe(melhor)}, ${brl(melhor.precoEfetivo!)}${melhor.custoDoPrazo ? " à vista" : ""}), aceitar a da ${nomeDe(foco)} deixa ${brl(d)} por unidade na mesa${qtd ? `, ${brlInteiro(d * qtd)} em ${qtd.toLocaleString("pt-BR")}` : ""}.`
          : `A da ${nomeDe(foco)} é melhor que a ${nomeDe(melhor)} em ${brl(-d)} por unidade.`,
      );
    }
  }
  if (pediuTotal && !av.some((a) => a.diferencaTotal != null)) {
    linhas.push(
      'Pra somar o total em R$ eu preciso da quantidade: me diga quantas sacas você tem (por exemplo, "tenho 4.000 sacas") que eu refaço com o total.',
    );
  }
  linhas.push(
    "Minha régua: mais de 1% acima do mercado é acima; de 1% abaixo a 1% acima é em linha; até 5% abaixo é um pouco abaixo; mais de 5% abaixo é abaixo do mercado. Acima de 30% de diferença eu não opino.",
  );
  return linhas.join("\n");
}

function secaoRanking(av: PropostaAvaliada[]): string {
  const ordem = ranquear(av);
  if (ordem.length < 2) {
    return "*Sobre o ranking*\nSó ranqueio quando há duas ou mais propostas comparáveis: com preço lido, sem frete por descontar e sem valor suspeito.";
  }
  const linhas = [
    "*Como ranqueei*",
    "Pelo preço efetivo, que é o preço à vista depois de contar o prazo:",
  ];
  for (const a of ordem) {
    linhas.push(
      `• *${nomeDe(a)}*: ${brl(a.precoEfetivo!)}${a.custoDoPrazo ? ` (${brl(a.preco!)} em ${a.prazoDias} dias)` : ""}`,
    );
  }
  const fora = av.filter((a) => !ordem.includes(a));
  if (fora.length > 0) {
    linhas.push(
      `Ficaram fora: ${fora.map(nomeDe).join(", ")}, porque falta descontar o frete ou confirmar o valor.`,
    );
  }
  return linhas.join("\n");
}

function secaoFaixa(e: EstudoSalvo): string | null {
  const f = e.ref.faixa90d;
  if (!f || e.referenciaManual != null) return null;
  return `*Nos últimos 90 dias*\nO preço de referência andou entre ${brl(f.min)} e ${brl(f.max)} (${f.pontos} dias com preço).`;
}

function secaoConfianca(e: EstudoSalvo): string {
  const linhas = ["*O que é leitura e o que é cálculo*"];
  linhas.push(
    e.origem === "midia"
      ? "Os preços e as condições vieram do que está escrito no documento que você mandou; o cálculo (conversão de unidade, prazo, comparação com o mercado) eu faço por regra fixa, sem improviso."
      : "Os preços e as condições são só os que você escreveu; o cálculo (prazo, comparação com o mercado) eu faço por regra fixa, sem improviso.",
  );
  if (e.confianca === "baixa")
    linhas.push(
      "Nesse caso a imagem estava difícil de ler, então confira os valores com o documento.",
    );
  linhas.push(
    "Se algum valor estiver diferente do que você tem em mãos, me diga que eu refaço a conta na hora.",
  );
  return linhas.join("\n");
}

function secaoDecisao(e: EstudoSalvo, av: PropostaAvaliada[]): string {
  const ordem = ranquear(av);
  const linhas = ["*Sobre qual escolher*"];
  if (ordem.length >= 1) {
    const m = ordem[0]!;
    linhas.push(
      `Pelo preço efetivo, a melhor é a de *${nomeDe(m)}* (${brl(m.precoEfetivo!)}${m.custoDoPrazo ? " à vista" : ""}).` +
        (ordem.length > 1
          ? ` A diferença para a última é de ${brl(m.precoEfetivo! - ordem.at(-1)!.precoEfetivo!)} por unidade.`
          : ""),
    );
  } else {
    linhas.push(
      "Ainda não dá para dizer qual é a melhor: falta comparar com o frete ou confirmar valores.",
    );
  }
  linhas.push(
    "Quem decide é você: preço não é tudo. Confira prazo e garantia de pagamento, quem paga o frete, o desconto de umidade e impureza e a validade da proposta antes de fechar.",
  );
  void e;
  return linhas.join("\n");
}

const RODAPE = "_Comparação com preço de referência público, não é recomendação de investimento._";

function resumoEmUmaFrase(e: EstudoSalvo, av: PropostaAvaliada[]): string {
  const ref = referenciaDoEstudo(e);
  const ordem = ranquear(av);
  if (ordem.length === 0) {
    return "ainda não dá para comparar com segurança: falta confirmar valores ou descontar o frete.";
  }
  const m = ordem[0]!;
  const dif = Math.abs(m.diferenca ?? 0);
  const dir = (m.diferenca ?? 0) >= 0 ? "acima" : "abaixo";
  const quem = ordem.length > 1 ? `a melhor é a da ${nomeDe(m)}` : `a proposta da ${nomeDe(m)}`;
  return `${quem}, com ${brl(m.precoEfetivo!)}${m.custoDoPrazo ? " à vista" : ""}, que fica ${brl(dif)} ${dir} da referência de hoje (${brl(ref.preco)}).`;
}

const SECAO_RECOMENDACAO =
  "*É recomendação?*\nNão. O estudo compara a proposta com o preço de mercado público e mostra o que conferir antes de fechar. Vender, quando e para quem é decisão sua.";

function secaoGarantia(e: EstudoSalvo): string {
  const ref = referenciaDoEstudo(e);
  return `*Sobre garantia*\nGarantia de preço ninguém dá: o mercado muda todo dia. O que eu garanto é que a conta segue regra fixa e usa a fonte e a data que informei (${ref.fonte}, ${dataBr(ref.data)}). Se o seu preço de referência for outro, me diga que eu refaço.`;
}

export function explicarEstudo(e: EstudoSalvo, pergunta: string): string {
  const av = avaliar(e);
  const t = semAcento(pergunta);

  // Frustração: acolhe, resume numa frase e oferece o passo a passo (nada de improviso).
  if (FRUSTRACAO.test(t) && !CONTESTACAO.test(t)) {
    return `Desculpa se ficou confuso. Resumindo em uma frase: ${resumoEmUmaFrase(e, av)}\n\nSe quiser, eu explico a conta passo a passo: é só perguntar "como você calculou?". E se algum valor estiver diferente do que você tem em mãos, me diga que eu refaço.`;
  }

  const blocos: string[] = ["🔎 *Como calculei*"];
  const pedidos = topicosDaPergunta(pergunta);
  const usar = new Set<Topico>(pedidos);

  if (CONTESTACAO.test(t)) {
    blocos.push(
      "Vamos conferir juntos. Aqui está a conta passo a passo; me diga qual número está diferente do que você tem em mãos que eu corrijo na hora.",
    );
    for (const x of ["veredito", "prazo", "referencia", "confianca"] as Topico[]) usar.add(x);
  }
  if (RECOMENDACAO.test(t)) blocos.push(SECAO_RECOMENDACAO);
  if (GARANTIA.test(t)) {
    blocos.push(secaoGarantia(e));
    usar.add("confianca");
  }
  const quisTotal = QUER_TOTAL.test(t);
  if (quisTotal) usar.add("veredito");
  const citados = av.filter((x) => x.comprador && t.includes(semAcento(x.comprador).trim()));
  const foco = citados.length === 1 ? citados[0]! : null;

  const semTopicoNenhum = usar.size === 0 && !RECOMENDACAO.test(t) && !GARANTIA.test(t);
  if (semTopicoNenhum)
    for (const x of ["veredito", "referencia", "prazo", "frete", "ranking", "faixa"] as Topico[])
      usar.add(x);

  const ordem: Topico[] = [
    "decisao",
    "confianca",
    "veredito",
    "referencia",
    "prazo",
    "frete",
    "ranking",
    "faixa",
  ];
  for (const topico of ordem) {
    if (!usar.has(topico)) continue;
    const b =
      topico === "referencia"
        ? secaoReferencia(e)
        : topico === "prazo"
          ? secaoPrazo(e, av)
          : topico === "frete"
            ? secaoFrete(av)
            : topico === "ranking"
              ? secaoRanking(av)
              : topico === "veredito"
                ? secaoVeredito(e, av, quisTotal, foco)
                : topico === "faixa"
                  ? secaoFaixa(e)
                  : topico === "confianca"
                    ? secaoConfianca(e)
                    : secaoDecisao(e, av);
    if (b) blocos.push(b);
  }
  blocos.push(RODAPE);
  return blocos.join("\n\n");
}

// ---------------------------------------------------------------------------
// Refazer com outro valor
// ---------------------------------------------------------------------------

export type AlteracaoPedida = {
  comprador: string | null;
  preco: number | null;
  prazo_dias: number | null;
  a_vista: boolean | null;
  frete: "retirado" | "entregue" | null;
  quantidade_sacas: number | null;
  taxa_mensal_pct: number | null;
  referencia_manual: number | null;
  nova_proposta: boolean | null;
};

export type ResultadoDaAlteracao =
  { ok: true; estudo: EstudoSalvo; mudancas: string[] } | { ok: false; mensagem: string };

const numeroNoTexto = (n: number, texto: string): boolean => {
  const t = texto.replace(/\s/g, " ");
  const variantes = new Set<string>([
    String(n),
    String(n).replace(".", ","),
    n.toLocaleString("pt-BR"),
    n.toFixed(2).replace(".", ","),
  ]);
  if (Number.isInteger(n)) variantes.add(String(Math.trunc(n)));
  for (const v of variantes) {
    const re = new RegExp(`(^|[^\\d])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\d]|$)`);
    if (re.test(t)) return true;
  }
  return false;
};

function acharProposta(
  propostas: PropostaLida[],
  nome: string | null,
): number | "ambigua" | "nenhuma" {
  if (propostas.length === 1) return 0;
  if (!nome) return "ambigua";
  const n = semAcento(nome).trim();
  const generica = n.match(/proposta\s*(\d+)/);
  if (generica) {
    const i = Number(generica[1]) - 1;
    return i >= 0 && i < propostas.length ? i : "nenhuma";
  }
  const i = propostas.findIndex((p) => {
    const c = semAcento(p.comprador ?? "");
    return c.length > 0 && (c.includes(n) || n.includes(c));
  });
  return i >= 0 ? i : "nenhuma";
}

const rotuloComprador = (p: PropostaLida, i: number) =>
  p.comprador && p.comprador.trim() ? nomeBonito(p.comprador) : `Proposta ${i + 1}`;

export function aplicarAlteracao(
  e: EstudoSalvo,
  alt: AlteracaoPedida,
  textoDoProdutor: string,
): ResultadoDaAlteracao {
  const t = semAcento(textoDoProdutor);
  const ref = referenciaDoEstudo(e);
  const novo: EstudoSalvo = {
    ...e,
    propostas: e.propostas.map((p) => ({ ...p })),
    criadoEm: new Date().toISOString(),
  };
  const mudancas: string[] = [];

  // Só vale o que o produtor escreveu agora: nada de número vindo do modelo.
  const preco =
    alt.preco != null && alt.preco > 0 && numeroNoTexto(alt.preco, textoDoProdutor)
      ? alt.preco
      : null;
  let prazo: number | null = null;
  if (alt.a_vista === true && /a ?vista|avista/.test(t)) prazo = 0;
  else if (
    alt.prazo_dias != null &&
    alt.prazo_dias >= 0 &&
    numeroNoTexto(alt.prazo_dias, textoDoProdutor)
  )
    prazo = alt.prazo_dias;
  const frete: FreteLido | null =
    alt.frete === "retirado" && /retir|fazenda|porteira|propriedade|fob/.test(t)
      ? "fob_retirado"
      : alt.frete === "entregue" && /entreg|cif|posto|destino|porto|armazem|levar|deixar/.test(t)
        ? "cif_entregue"
        : null;
  const quantidade =
    alt.quantidade_sacas != null &&
    alt.quantidade_sacas > 0 &&
    numeroNoTexto(alt.quantidade_sacas, textoDoProdutor)
      ? alt.quantidade_sacas
      : null;
  const taxa =
    alt.taxa_mensal_pct != null &&
    alt.taxa_mensal_pct > 0 &&
    alt.taxa_mensal_pct <= 10 &&
    numeroNoTexto(alt.taxa_mensal_pct, textoDoProdutor)
      ? alt.taxa_mensal_pct
      : null;
  const refManual =
    alt.referencia_manual != null &&
    alt.referencia_manual > 0 &&
    numeroNoTexto(alt.referencia_manual, textoDoProdutor)
      ? alt.referencia_manual
      : null;

  if (
    preco == null &&
    prazo == null &&
    frete == null &&
    quantidade == null &&
    taxa == null &&
    refManual == null
  ) {
    return {
      ok: false,
      mensagem:
        'Não entendi o que mudar. Me diga o valor novo, por exemplo: "a Cargill topou 130", "se pagar à vista", "meu dinheiro rende 1,5% ao mês" ou "o preço aqui é 140".',
    };
  }

  if (refManual != null) {
    if (Math.abs(refManual - e.ref.preco) / e.ref.preco > 0.4) {
      return {
        ok: false,
        mensagem: `Você me passou ${brl(refManual)} de referência, mas o mercado está em ${brl(e.ref.preco)}: é uma diferença grande. Confere se é o valor certo e a unidade (por saca de ${e.ref.kgPorSaca ?? 60} kg) e me diga de novo.`,
      };
    }
    novo.referenciaManual = refManual;
    mudancas.push(
      `Referência: usei ${brl(refManual)}, que você informou, no lugar de ${brl(ref.preco)}.`,
    );
  }
  if (taxa != null) {
    novo.taxaMensal = taxa / 100;
    mudancas.push(
      `Custo do dinheiro: ${taxa.toString().replace(".", ",")}% ao mês (antes ${(e.taxaMensal * 100).toString().replace(".", ",")}%).`,
    );
  }

  const mexeEmProposta = preco != null || prazo != null || frete != null;
  // "A Cargill topar 130" é mudança na proposta que já existe, mesmo que o modelo marque "nova".
  const jaExiste =
    alt.nova_proposta === true && alt.comprador
      ? typeof acharProposta(novo.propostas.length > 1 ? novo.propostas : [], alt.comprador) ===
        "number"
      : false;
  if (alt.nova_proposta === true && preco != null && !jaExiste) {
    if (novo.propostas.length >= 8)
      return {
        ok: false,
        mensagem: "Já estou comparando 8 propostas, que é o máximo. Me diga qual tirar.",
      };
    const nomeDito =
      alt.comprador && semAcento(textoDoProdutor).includes(semAcento(alt.comprador).trim())
        ? alt.comprador
        : null;
    novo.propostas.push({
      comprador: nomeDito,
      produto: e.produto,
      preco,
      unidade_do_preco: ref.unidade === "saca" ? "saca" : ref.unidade,
      quantidade: null,
      unidade_da_quantidade: null,
      prazo_pagamento_dias: prazo,
      pagamento_texto: null,
      frete: frete ?? "nao_informado",
      local_entrega: null,
      umidade_max_pct: null,
      impureza_max_pct: null,
      validade: null,
      observacoes: null,
      trecho_lido: "",
    });
    mudancas.push(
      `Entrou uma proposta${nomeDito ? ` da ${nomeBonito(nomeDito)}` : ""}: ${brl(preco)}${prazo != null ? (prazo === 0 ? " à vista" : ` em ${prazo} dias`) : ""}.`,
    );
  } else if (mexeEmProposta) {
    const alvo = acharProposta(novo.propostas, alt.comprador);
    if (alvo === "ambigua") {
      return {
        ok: false,
        mensagem: `Qual proposta você quer mudar? Estou comparando: ${novo.propostas.map((p, i) => rotuloComprador(p, i)).join(", ")}. Me diga o nome e o valor novo.`,
      };
    }
    if (alvo === "nenhuma") {
      return {
        ok: false,
        mensagem: `Não achei essa proposta no estudo. Estou comparando: ${novo.propostas.map((p, i) => rotuloComprador(p, i)).join(", ")}. Qual delas você quer mudar? Se for uma proposta nova, diga o nome e o valor (por exemplo: "chegou outra proposta, a Coamo, 131").`,
      };
    }
    const p = novo.propostas[alvo]!;
    const nome = rotuloComprador(p, alvo);
    if (preco != null) {
      const unRef = ref.unidade === "saca" ? "saca" : ref.unidade;
      const antes =
        p.preco != null && p.preco > 0
          ? converterPreco(p.preco, p.unidade_do_preco, ref).valor
          : null;
      if (antes != null && Math.abs(antes - preco) < 0.005) {
        const original =
          p.unidade_do_preco !== unRef && p.unidade_do_preco !== "nao_informada"
            ? `${brl(p.preco!)} por ${p.unidade_do_preco} já equivale a `
            : "";
        mudancas.push(
          `${nome}: esse já era o preço da proposta (${original}${brl(preco)} por ${unRef}), então a conta não muda.`,
        );
      } else {
        const antesTxt =
          p.preco == null
            ? "(sem preço)"
            : p.unidade_do_preco !== unRef && p.unidade_do_preco !== "nao_informada"
              ? `${brl(p.preco)} por ${p.unidade_do_preco}${antes != null ? ` (${brl(antes)} por ${unRef})` : ""}`
              : brl(p.preco);
        mudancas.push(`${nome}: preço de ${antesTxt} para ${brl(preco)} por ${unRef}.`);
      }
      p.preco = preco;
      p.unidade_do_preco = ref.unidade === "saca" ? "saca" : ref.unidade;
    }
    if (prazo != null) {
      const antes =
        p.prazo_pagamento_dias == null
          ? "sem prazo informado"
          : p.prazo_pagamento_dias === 0
            ? "à vista"
            : `${p.prazo_pagamento_dias} dias`;
      mudancas.push(
        `${nome}: pagamento de ${antes} para ${prazo === 0 ? "à vista" : `${prazo} dias`}.`,
      );
      p.prazo_pagamento_dias = prazo;
    }
    if (frete != null) {
      mudancas.push(
        `${nome}: ${frete === "fob_retirado" ? "retirado na propriedade" : "entregue, frete por sua conta"}.`,
      );
      p.frete = frete;
    }
  }
  if (quantidade != null) {
    novo.quantidadeInformada = quantidade;
    for (const p of novo.propostas) {
      p.quantidade = null;
      p.unidade_da_quantidade = null;
    }
    mudancas.push(`Quantidade: ${quantidade.toLocaleString("pt-BR")} para o total.`);
  }
  if (mudancas.length === 0) {
    return {
      ok: false,
      mensagem: "Não consegui aplicar essa mudança no estudo. Me diga de novo qual valor mudar.",
    };
  }
  return { ok: true, estudo: novo, mudancas };
}

// ---------------------------------------------------------------------------
// Contexto para o modelo (só para conversa livre sobre o estudo)
// ---------------------------------------------------------------------------

/** Resumo do estudo, escrito por código, para o modelo só repetir números que existem. */
export function contextoDoEstudo(e: EstudoSalvo): string {
  const ref = referenciaDoEstudo(e);
  const av = avaliar(e);
  const linhas = av.map((a) => {
    const partes = [`${nomeDe(a)}: ${a.preco != null ? brl(a.preco) : "preço não lido"}`];
    if (a.prazoDias != null) partes.push(a.prazoDias === 0 ? "à vista" : `${a.prazoDias} dias`);
    if (a.custoDoPrazo) partes.push(`à vista equivale a ${brl(a.precoEfetivo!)}`);
    if (a.frete !== "nao_informado")
      partes.push(a.frete === "cif_entregue" ? "entregue" : "retirado");
    if (a.diferenca != null && !a.suspeita)
      partes.push(
        `${brl(Math.abs(a.diferenca))} ${a.diferenca >= 0 ? "acima" : "abaixo"} da referência (${pct(a.diferencaPct ?? 0)})`,
      );
    if (a.suspeita) partes.push("valor suspeito, sem veredito");
    return `- ${partes.join("; ")}`;
  });
  return `ESTUDO DE PROPOSTA RECENTE deste produtor (conta feita por código; use SOMENTE estes números):
Produto: ${e.produto} em ${e.uf}. Referência: ${brl(ref.preco)} (${ref.rotulo}; ${ref.fonte}, ${dataBr(ref.data)}). Custo do dinheiro usado: ${(e.taxaMensal * 100).toString().replace(".", ",")}% ao mês.
${linhas.join("\n")}
Se o produtor questionar a análise, discordar, pedir explicação, mudar valor/prazo/frete/quantidade, informar outro custo do dinheiro ou outro preço de referência, chame explicar_estudo ou refazer_estudo (eles respondem prontos). NUNCA refaça a conta nem cite número que não esteja acima. Não recomende comprar, vender ou aceitar: o estudo só compara com o mercado.`;
}

void ehComparavel;
