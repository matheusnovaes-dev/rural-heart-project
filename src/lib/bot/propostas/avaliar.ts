import type {
  PropostaAvaliada,
  PropostaLida,
  ReferenciaDeMercado,
  UnidadeDoPreco,
} from "@/lib/bot/propostas/tipos";

/** Custo do dinheiro usado só pra ilustrar o peso do prazo (1% ao mês). O estudo avisa que é uma hipótese. */
export const TAXA_MENSAL_PADRAO = 0.01;

/** Acima disso a proposta fica longe demais do mercado pra ser crível: provável erro de leitura ou de unidade. */
export const LIMITE_SUSPEITA_PCT = 30;

const arredonda2 = (n: number) => Math.round(n * 100) / 100;

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const nomeDaUnidade = (ref: ReferenciaDeMercado) =>
  ref.unidade === "saca" ? `saca de ${ref.kgPorSaca ?? 60} kg` : ref.unidade;

/** "20/10/2026" ou "2026-10-20" vira data; "até sexta" não vira nada. */
export function lerData(texto: string | null | undefined): Date | null {
  if (!texto) return null;
  let m = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!));
  m = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return null;
}

type Conversao = { valor: number | null; conversao: string | null; alerta: string | null };

/** Leva o preço lido para a unidade da referência (saca, arroba ou litro). */
export function converterPreco(
  preco: number,
  unidade: UnidadeDoPreco,
  ref: ReferenciaDeMercado,
): Conversao {
  const kg = ref.kgPorSaca ?? 60;
  if (ref.unidade === "saca") {
    if (unidade === "saca") return { valor: preco, conversao: null, alerta: null };
    if (unidade === "tonelada") {
      const v = arredonda2((preco * kg) / 1000);
      return {
        valor: v,
        conversao: `${brl(preco)} por tonelada = ${brl(v)} por ${nomeDaUnidade(ref)}`,
        alerta: null,
      };
    }
    if (unidade === "kg") {
      const v = arredonda2(preco * kg);
      return {
        valor: v,
        conversao: `${brl(preco)} por kg = ${brl(v)} por ${nomeDaUnidade(ref)}`,
        alerta: null,
      };
    }
    if (unidade === "arroba" || unidade === "litro") {
      return {
        valor: null,
        conversao: null,
        alerta: `O preço está por ${unidade}, e a referência é por saca.`,
      };
    }
  } else if (ref.unidade === unidade) {
    return { valor: preco, conversao: null, alerta: null };
  } else if (unidade !== "outra" && unidade !== "nao_informada") {
    return {
      valor: null,
      conversao: null,
      alerta: `O preço está por ${unidade}, e a referência é por ${ref.unidade}.`,
    };
  }
  // "outra" / "nao_informada": só assume a unidade da referência se o número faz sentido nela.
  const razao = preco / ref.preco;
  if (razao >= 0.6 && razao <= 1.6) {
    return {
      valor: preco,
      conversao: null,
      alerta: `A unidade não estava escrita: considerei ${nomeDaUnidade(ref)}, a mesma da referência.`,
    };
  }
  return {
    valor: null,
    conversao: null,
    alerta: "Não consegui saber a unidade do preço (por saca, por tonelada...).",
  };
}

function converterQuantidade(
  q: number | null,
  unidade: UnidadeDoPreco | null,
  ref: ReferenciaDeMercado,
): number | null {
  if (q == null || q <= 0) return null;
  const kg = ref.kgPorSaca ?? 60;
  if (ref.unidade === "saca") {
    if (unidade === "saca" || unidade === "nao_informada" || unidade == null) return q;
    if (unidade === "tonelada") return Math.round((q * 1000) / kg);
    if (unidade === "kg") return Math.round(q / kg);
    return null;
  }
  if (ref.unidade === unidade || unidade === "nao_informada" || unidade == null) return q;
  return null;
}

export function veredito(pct: number): PropostaAvaliada["veredito"] {
  if (pct >= 1) return "acima";
  if (pct > -1) return "em_linha";
  if (pct > -5) return "um_pouco_abaixo";
  return "abaixo";
}

export function avaliarPropostas(
  propostas: PropostaLida[],
  ref: ReferenciaDeMercado,
  opts: { taxaMensal?: number; quantidadePadrao?: number | null; hoje?: Date | undefined } = {},
): PropostaAvaliada[] {
  const taxa = opts.taxaMensal ?? TAXA_MENSAL_PADRAO;
  const hoje = opts.hoje ?? new Date();
  const hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());

  return propostas.map((p, i) => {
    const alertas: string[] = [];
    let preco: number | null = null;
    let conversao: string | null = null;

    if (p.preco != null && p.preco > 0) {
      const c = converterPreco(p.preco, p.unidade_do_preco, ref);
      preco = c.valor;
      conversao = c.conversao;
      if (c.alerta) alertas.push(c.alerta);
    } else {
      alertas.push("Não consegui ler o preço dessa linha.");
    }

    const prazo = p.prazo_pagamento_dias;
    let precoEfetivo = preco;
    let custoDoPrazo: number | null = null;
    if (preco != null && prazo != null && prazo > 0) {
      precoEfetivo = arredonda2(preco / (1 + (taxa * prazo) / 30));
      custoDoPrazo = arredonda2(preco - precoEfetivo);
    }
    if (prazo == null) alertas.push("O prazo de pagamento não está informado.");

    if (p.frete === "cif_entregue") {
      alertas.push(
        "Preço entregue: o frete até o destino sai do seu bolso. Desconte antes de comparar.",
      );
    } else if (p.frete === "nao_informado") {
      alertas.push("Não diz se o preço é na sua propriedade ou entregue (quem paga o frete).");
    }

    const validade = lerData(p.validade);
    const validadeVencida = validade != null && validade.getTime() < hojeUtc;
    if (validadeVencida)
      alertas.push(`A validade (${p.validade}) já passou: confirme se o preço ainda vale.`);

    let diferenca: number | null = null;
    let diferencaPct: number | null = null;
    let suspeita = false;
    if (precoEfetivo != null) {
      diferenca = arredonda2(precoEfetivo - ref.preco);
      diferencaPct = Math.round(((precoEfetivo - ref.preco) / ref.preco) * 1000) / 10;
      suspeita = Math.abs(diferencaPct) > LIMITE_SUSPEITA_PCT;
      if (suspeita) {
        alertas.push(
          "O valor está muito longe do mercado: pode ser erro de leitura ou de unidade.",
        );
      }
    }

    const quantidade =
      converterQuantidade(p.quantidade, p.unidade_da_quantidade, ref) ??
      opts.quantidadePadrao ??
      null;
    const diferencaTotal =
      diferenca != null && quantidade != null && !suspeita
        ? Math.round(diferenca * quantidade)
        : null;

    let ver: PropostaAvaliada["veredito"] = "indefinido";
    if (diferencaPct != null && !suspeita && p.frete !== "cif_entregue")
      ver = veredito(diferencaPct);

    return {
      indice: i,
      comprador: p.comprador,
      produto: p.produto,
      precoLido: p.preco,
      unidadeLida: p.unidade_do_preco,
      preco,
      conversao,
      prazoDias: prazo,
      frete: p.frete,
      localEntrega: p.local_entrega,
      precoEfetivo,
      custoDoPrazo,
      diferenca,
      diferencaPct: diferencaPct,
      quantidade,
      diferencaTotal,
      umidadeMax: p.umidade_max_pct,
      impurezaMax: p.impureza_max_pct,
      validade: p.validade,
      validadeVencida,
      suspeita,
      alertas,
      veredito: ver,
    };
  });
}

/** Propostas que dá para ranquear de verdade: com preço, sem suspeita e sem frete por descontar. */
export function ehComparavel(a: PropostaAvaliada): boolean {
  return a.precoEfetivo != null && !a.suspeita && a.frete !== "cif_entregue";
}

/** Do melhor preço efetivo ao pior; as não comparáveis ficam de fora. */
export function ranquear(avaliadas: PropostaAvaliada[]): PropostaAvaliada[] {
  return avaliadas.filter(ehComparavel).sort((a, b) => b.precoEfetivo! - a.precoEfetivo!);
}
