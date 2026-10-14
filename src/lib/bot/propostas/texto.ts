import { ranquear } from "@/lib/bot/propostas/avaliar";
import type {
  PropostaAvaliada,
  ReferenciaDeMercado,
  TipoDeDocumento,
} from "@/lib/bot/propostas/tipos";

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const brlInteiro = (n: number) =>
  `R$ ${Math.round(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${Math.abs(n).toFixed(1).replace(".", ",")}%`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const MEDALHAS = ["🥇", "🥈", "🥉"];

export const AVISO_DE_ESTUDO =
  "Comparação com preço de referência público, não é recomendação de investimento.";

function unidadeCurta(ref: ReferenciaDeMercado): string {
  return ref.unidade === "saca" ? "saca" : ref.unidade;
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "COOPERATIVA AGRÍCOLA VALE VERDE" vira "Cooperativa Agrícola Vale Verde"; nomes já normais ficam como estão. */
export function nomeBonito(nome: string): string {
  const n = nome.trim();
  if (n.length < 4 || n !== n.toUpperCase() || !/[A-ZÀ-Ú]/.test(n)) return n;
  return n
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) =>
      /^s\.?\/?a\.?$/.test(w)
        ? "S.A."
        : MINUSCULAS.has(w) && i > 0
          ? w
          : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

const NOMES_GENERICOS = new Set([
  "comprador",
  "compradora",
  "oferta",
  "proposta",
  "trading",
  "empresa",
  "cooperativa",
  "frigorifico",
  "industria",
  "armazem",
  "null",
  "none",
]);
const semAcentoMinusculo = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function nomeDe(a: PropostaAvaliada): string {
  const nome = a.comprador?.trim();
  return nome && !NOMES_GENERICOS.has(semAcentoMinusculo(nome))
    ? nomeBonito(nome)
    : `Proposta ${a.indice + 1}`;
}

function linhaDoQueLi(a: PropostaAvaliada): string {
  const partes: string[] = [];
  if (a.precoLido != null) {
    const un =
      a.unidadeLida === "nao_informada" || a.unidadeLida === "outra" ? "" : ` por ${a.unidadeLida}`;
    partes.push(`${brl(a.precoLido)}${un}`);
  } else {
    partes.push("preço ilegível");
  }
  if (a.prazoDias != null)
    partes.push(a.prazoDias === 0 ? "à vista" : `pagamento em ${a.prazoDias} dias`);
  if (a.frete === "fob_retirado") partes.push("retirado na propriedade");
  if (a.frete === "cif_entregue") partes.push("entregue, frete por sua conta");
  if (
    a.localEntrega &&
    !(a.frete === "fob_retirado" && /propriedade|fazenda|porteira|retir/i.test(a.localEntrega))
  ) {
    partes.push(a.localEntrega);
  }
  if (a.umidadeMax != null) partes.push(`umidade até ${String(a.umidadeMax).replace(".", ",")}%`);
  if (a.impurezaMax != null)
    partes.push(`impureza até ${String(a.impurezaMax).replace(".", ",")}%`);
  if (a.validade) {
    const v = a.validade.replace(/(\d{4})-(\d{2})-(\d{2})/, "$3/$2/$1");
    if (/^\d+\s*dias?$/i.test(v.trim())) partes.push(`válida por ${v.trim()}`);
    else partes.push(`válida ${/^at[eé](\s|$)/i.test(v) ? v : `até ${v}`}`);
  }
  let linha = `• *${nomeDe(a)}*: ${partes.join(" · ")}`;
  if (a.conversao) linha += `\n  (${a.conversao})`;
  return linha;
}

function linhaContraMercado(
  a: PropostaAvaliada,
  ref: ReferenciaDeMercado,
  compacta = false,
): string {
  const nome = nomeDe(a);
  if (a.preco == null)
    return (
      `• *${nome}*: não consegui comparar, ${a.alertas.find((x) => /unidade|preço/i.test(x)) ?? "falta informação"}`.replace(
        /\.$/,
        "",
      ) + "."
    );
  if (a.suspeita) {
    return `• *${nome}*: ${brl(a.precoLido ?? a.preco)} está muito longe do mercado. Pode ser erro de leitura ou de unidade. Me diga o valor e a unidade que estão escritos.`;
  }
  const dif = a.diferenca ?? 0;
  const dir = dif >= 0 ? "acima" : "abaixo";
  const efetivoNota =
    a.custoDoPrazo != null && a.custoDoPrazo > 0
      ? ` (já contando o prazo: ${brl(a.precoEfetivo ?? a.preco)} à vista)`
      : "";
  if (a.frete === "cif_entregue") {
    const antes =
      dif >= 0
        ? `${brl(Math.abs(dif))} acima da referência, mas antes de descontar o frete`
        : `${brl(Math.abs(dif))} abaixo da referência, e isso antes de descontar o frete`;
    return `• *${nome}*: ${brl(a.preco)} entregue${efetivoNota} está ${antes}.`;
  }
  const base = `• *${nome}*: ${brl(a.preco)}${efetivoNota} está ${brl(Math.abs(dif))} ${dir} (${pct(a.diferencaPct ?? 0)})`;
  if (compacta) return base + ".";
  return (
    base +
    (a.diferencaTotal != null && a.quantidade != null
      ? `. Em ${num(a.quantidade)} ${a.quantidade === 1 ? unidadeCurta(ref) : unidadeCurta(ref) + "s"}, são ${brlInteiro(Math.abs(a.diferencaTotal))} a ${dif >= 0 ? "mais" : "menos"}`
      : "") +
    "."
  );
}

function secaoDePrazo(avaliadas: PropostaAvaliada[], taxaMensal: number): string | null {
  const comPrazo = avaliadas.filter(
    (a) => a.custoDoPrazo != null && a.custoDoPrazo > 0 && a.preco != null && !a.suspeita,
  );
  if (comPrazo.length === 0) return null;
  const linhas = comPrazo.map(
    (a) =>
      `• *${nomeDe(a)}*: pagando em ${a.prazoDias} dias, vale ${brl(a.precoEfetivo!)} à vista (o prazo custa ${brl(a.custoDoPrazo!)})`,
  );
  const taxa = (taxaMensal * 100).toFixed(0).replace(".", ",");
  return `*Pelo prazo*\n${linhas.join("\n")}\nConta com custo do dinheiro de ${taxa}% ao mês. Se o seu for outro, me diga que eu refaço.`;
}

function secaoDeRanking(avaliadas: PropostaAvaliada[], ref: ReferenciaDeMercado): string | null {
  const ordem = ranquear(avaliadas);
  if (ordem.length < 2) return null;
  const linhas = ordem.map((a, i) => {
    const efetivo = a.precoEfetivo!;
    const nota = a.custoDoPrazo ? ` (${brl(a.preco!)} em ${a.prazoDias} dias)` : "";
    const lugar = MEDALHAS[i] ?? `${i + 1}º`;
    return `${lugar} *${nomeDe(a)}*: ${brl(efetivo)}${a.custoDoPrazo ? " à vista" : ""}${nota}`;
  });
  const melhor = ordem[0]!;
  const pior = ordem.at(-1)!;
  const difSaca = melhor.precoEfetivo! - pior.precoEfetivo!;
  const difPct = (difSaca / pior.precoEfetivo!) * 100;
  let fecho = `Da melhor para a pior: ${brl(difSaca)} por ${unidadeCurta(ref)} de diferença (${pct(difPct)}).`;
  const qtd = melhor.quantidade ?? pior.quantidade;
  if (qtd) fecho += ` Em ${num(qtd)} ${unidadeCurta(ref)}s, são ${brlInteiro(difSaca * qtd)}.`;
  const fora = avaliadas.filter((a) => !ordem.includes(a));
  const nota =
    fora.length > 0
      ? `\nFora do ranking: ${fora.map(nomeDe).join(", ")} (${fora.some((a) => a.frete === "cif_entregue") ? "preço entregue, falta descontar o frete" : "falta confirmar o valor"}).`
      : "";
  return `*Ranking* (melhor preço efetivo primeiro)\n${linhas.join("\n")}\n${fecho}${nota}`;
}

function secaoDeFaixa(avaliadas: PropostaAvaliada[], ref: ReferenciaDeMercado): string | null {
  const f = ref.faixa90d;
  if (!f || f.max - f.min < 0.5) return null;
  const alvo = ranquear(avaliadas)[0];
  if (!alvo || alvo.precoEfetivo == null) return null;
  const valor = alvo.precoEfetivo;
  let onde: string;
  if (valor > f.max) onde = "acima da máxima do período";
  else if (valor < f.min) onde = "abaixo da mínima do período";
  else {
    const posicao = (valor - f.min) / (f.max - f.min);
    onde =
      posicao >= 2 / 3
        ? "no terço de cima da faixa"
        : posicao >= 1 / 3
          ? "no meio da faixa"
          : "no terço de baixo da faixa";
  }
  return `*Nos últimos 90 dias*\nO preço de referência andou entre ${brl(f.min)} e ${brl(f.max)}. ${avaliadas.length > 1 ? `A melhor proposta (${brl(valor)})` : `Essa proposta (${brl(valor)})`} fica ${onde}.`;
}

function perguntas(avaliadas: PropostaAvaliada[]): string[] {
  const p: string[] = [];
  const algumaSemQualidade = avaliadas.every((a) => a.umidadeMax == null && a.impurezaMax == null);
  if (algumaSemQualidade) p.push("o desconto por umidade e impureza (classificação)");
  if (avaliadas.some((a) => a.frete === "nao_informado" || a.frete === "cif_entregue")) {
    p.push("quem paga o frete e até onde ele vai");
  }
  if (avaliadas.some((a) => a.prazoDias == null)) p.push("o prazo e a data certa do pagamento");
  if (avaliadas.some((a) => a.validade == null)) p.push("até quando o preço vale");
  if (avaliadas.some((a) => a.validadeVencida))
    p.push("se o preço ainda vale, já que a validade passou");
  return p.slice(0, 3);
}

function veredito(avaliadas: PropostaAvaliada[], ref: ReferenciaDeMercado): string {
  const ordem = ranquear(avaliadas);
  const alvo = ordem[0];
  if (!alvo) {
    const cif = avaliadas.find(
      (a) => a.frete === "cif_entregue" && a.diferenca != null && !a.suspeita,
    );
    if (cif) {
      const dif = Math.abs(cif.diferenca!);
      return cif.diferenca! < 0
        ? `Mesmo antes de descontar o frete, a proposta já está ${brl(dif)} abaixo da referência, e o frete deixa o resultado ainda pior. Vale negociar ou procurar outro comprador.`
        : `Antes do frete a proposta está ${brl(dif)} acima da referência. Só compensa se o frete até o destino custar menos que isso: pergunte a distância e o valor do frete.`;
    }
    return "Ainda não dá para dizer: confirme os valores e a unidade que estão escritos e eu refaço a conta.";
  }
  const alvoPreco = brl(ref.preco);
  const todasAbaixo =
    ordem.length > 1 &&
    ordem.every((a) => a.veredito === "abaixo" || a.veredito === "um_pouco_abaixo");
  const quem =
    avaliadas.length > 1
      ? `A melhor é a de *${nomeDe(alvo)}*.${todasAbaixo ? " Nenhuma chega na referência de hoje." : ""} `
      : "";
  switch (alvo.veredito) {
    case "acima":
      return `${quem}Está acima do mercado hoje. Se prazo, umidade e frete estiverem bons, vale fechar.`;
    case "em_linha":
      return `${quem}Está em linha com o mercado: é um preço justo. Dá para tentar um pouco mais, mas não está fora da curva.`;
    case "um_pouco_abaixo":
      return `${quem}Está um pouco abaixo do mercado. Vale pedir ${alvoPreco}, a referência de hoje, para fechar.`;
    case "abaixo":
      return `${quem}Está abaixo do mercado. Vale negociar: peça pelo menos ${alvoPreco}, a referência de hoje, ou compare com outros compradores antes de aceitar.`;
    default:
      return `${quem}Ainda não dá para dizer, falta confirmar alguns dados.`;
  }
}

export type EntradaDoEstudo = {
  origem: "midia" | "texto";
  tipoDocumento?: TipoDeDocumento | undefined;
  confianca?: "alta" | "media" | "baixa" | undefined;
  avaliadas: PropostaAvaliada[];
  ref: ReferenciaDeMercado;
  produto: string;
  uf: string;
  taxaMensal: number;
  /** Quantas linhas lidas ficaram de fora (outros produtos além do limite). */
  omitidas?: number | undefined;
  /** Quando a referência é de outro estado que o do cadastro (o do local descrito no documento). */
  avisoUf?: string | undefined;
  /** Bloco extra (ex: outros produtos de uma tabela), colocado antes do fecho. */
  extras?: string | undefined;
};

/** Texto final do estudo, em WhatsApp, 100% montado por código. */
export function montarEstudo(e: EntradaDoEstudo): string {
  const { avaliadas, ref } = e;
  const varias = avaliadas.length > 1;
  const titulo =
    e.tipoDocumento === "tabela_de_precos" || e.tipoDocumento === "anotacao_de_precos"
      ? `📄 *Estudo das cotações de ${e.produto}*`
      : varias
        ? `📄 *Estudo das propostas de ${e.produto}*`
        : `📄 *Estudo da proposta de ${e.produto}*`;

  const blocos: string[] = [titulo];
  if (e.confianca === "baixa") {
    blocos.push("⚠️ A imagem está difícil de ler. Confira os valores abaixo antes de decidir.");
  }

  blocos.push(
    `*${e.origem === "midia" ? "O que li" : "O que você me contou"}*\n${avaliadas.map((a) => linhaDoQueLi(a)).join("\n")}`,
  );

  const faixaPracas =
    ref.min != null && ref.max != null && ref.max > ref.min
      ? ` (praças de ${brl(ref.min)} a ${brl(ref.max)})`
      : "";
  blocos.push(
    `*Contra o mercado hoje*\nReferência: ${brl(ref.preco)} por ${ref.unidade === "saca" ? `saca de ${ref.kgPorSaca ?? 60} kg` : ref.unidade}, ${ref.rotulo}${faixaPracas}. Fonte: ${ref.fonte}, ${dataBr(ref.data)}.\n${avaliadas.map((a) => linhaContraMercado(a, ref, avaliadas.length >= 3)).join("\n")}`,
  );

  const prazo = secaoDePrazo(avaliadas, e.taxaMensal);
  if (prazo) blocos.push(prazo);
  const ranking = secaoDeRanking(avaliadas, ref);
  if (ranking) blocos.push(ranking);
  const faixa = secaoDeFaixa(avaliadas, ref);
  if (faixa) blocos.push(faixa);

  // Falando ("126 na soja") ninguém diz a unidade; só avisa dela quando veio de um documento.
  const padraoDeAlerta =
    e.origem === "texto" ? /validade|Não consegui/ : /validade|unidade não|Não consegui/;
  const alertas = [
    ...new Set(avaliadas.flatMap((a) => a.alertas.filter((x) => padraoDeAlerta.test(x)))),
  ];
  if (e.avisoUf) alertas.unshift(e.avisoUf);
  if (ref.aproximada) {
    alertas.unshift(
      `Não há preço recente de ${e.produto} em ${e.uf}: usei outros estados como referência aproximada.`,
    );
  }
  if (alertas.length > 0) blocos.push(`*Atenção*\n${alertas.map((a) => `• ${a}`).join("\n")}`);

  blocos.push(
    `*Veredito*\n${veredito(avaliadas, ref)}${ref.aproximada ? " Como a referência é de outros estados, trate como aproximação." : ""}`,
  );

  const nadaParaComparar = avaliadas.every((a) => a.preco == null || a.suspeita);
  const perg = nadaParaComparar ? [] : perguntas(avaliadas);
  if (perg.length > 0) {
    blocos.push(`*Antes de fechar, pergunte*\n${perg.map((p) => `• ${p}`).join("\n")}`);
  }

  if (e.extras) blocos.push(e.extras);
  if (e.omitidas && e.omitidas > 0) {
    blocos.push(
      `Tinha mais ${e.omitidas} ${e.omitidas === 1 ? "linha" : "linhas"} de outros produtos. Me diga qual você quer comparar.`,
    );
  }
  blocos.push(
    e.origem === "midia"
      ? `Li algo errado? Me diga que eu refaço a conta.\n_${AVISO_DE_ESTUDO}_`
      : `_${AVISO_DE_ESTUDO}_`,
  );

  let texto = blocos.join("\n\n");
  // WhatsApp lê melhor mensagem enxuta: se passou muito, corta o que é secundário.
  if (texto.length > 2600 && faixa) texto = texto.replace(`${faixa}\n\n`, "");
  if (texto.length > 2600 && perg.length > 0) {
    texto = texto.replace(/\*Antes de fechar, pergunte\*\n(?:• .*\n?)+\n?/, "");
  }
  return texto.replace(/\n{3,}/g, "\n\n").trim();
}
