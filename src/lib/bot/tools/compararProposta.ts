import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarPreco } from "@/lib/bot/tools/preco";
import type { HistoricoLinha } from "@/lib/bot/prompt";

const brl = (n: number) =>
  `R$${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Mesma rede de segurança determinística das outras ferramentas (alertas,
// cadastro): o preço que o modelo passar precisa ter vindo de verdade de
// alguma mensagem do PRODUTOR — aqui é o número mais sensível de todos,
// porque uma proposta inventada pode fazer o produtor recusar uma oferta
// boa ou aceitar uma ruim achando que não é.
function precoFoiDitoPeloProdutor(
  preco: number,
  texto: string,
  historico: HistoricoLinha[],
): boolean {
  const inteiro = String(Math.trunc(preco));
  if (texto.includes(inteiro)) return true;
  return historico.some((h) => h.role === "user" && h.conteudo.includes(inteiro));
}

/**
 * "O comprador te ofereceu um preço — tá bom ou tá te lowballando?" Pedido
 * do Matheus 2026-10-12 (ideia já discutida em 2026-08-26, "proposal
 * comparison" — maior potencial de diferencial real, segundo aquela
 * conversa). Versão por TEXTO: o produtor descreve a oferta que recebeu
 * ("Cargill ofereceu 126 na soja disponível"), o bot compara com a
 * referência de mercado e diz a diferença em R$ (e no total, se ele disser
 * quantas sacas). NÃO lê foto/PDF — o bot é só-texto hoje (ver prompt.ts);
 * isso aqui só processa o que o produtor digitou/ditou.
 */
export async function compararProposta(
  supabase: SupabaseClient,
  args: {
    produto: string;
    uf: string;
    preco_oferecido: number;
    comprador: string | null;
    sacas: number | null;
  },
  ctx: { historico: HistoricoLinha[]; texto: string },
) {
  if (!precoFoiDitoPeloProdutor(args.preco_oferecido, ctx.texto, ctx.historico)) {
    return { encontrado: false, erro: "preco_nao_confirmado" as const };
  }

  const referencia = await buscarPreco(supabase, {
    produto: args.produto,
    uf: args.uf,
    incluir_frete: false,
  });
  if (!referencia.encontrado || !referencia.precos || referencia.precos.length === 0) {
    return { encontrado: false, erro: "sem_referencia" as const };
  }

  const precoReferencia = referencia.precos[0]!.preco;
  if (precoReferencia === 0) {
    return { encontrado: false, erro: "sem_referencia" as const };
  }

  const diferencaAbsoluta = args.preco_oferecido - precoReferencia;
  const diferencaPercentual = (diferencaAbsoluta / precoReferencia) * 100;
  const diferencaTotal = args.sacas != null ? diferencaAbsoluta * args.sacas : null;

  return {
    encontrado: true,
    preco_oferecido: args.preco_oferecido,
    preco_referencia: precoReferencia,
    data_referencia: referencia.precos[0]!.data_referencia,
    fonte_referencia: referencia.precos[0]!.fonte,
    diferenca_absoluta: Math.round(diferencaAbsoluta * 100) / 100,
    diferenca_percentual: Math.round(diferencaPercentual * 10) / 10,
    diferenca_total: diferencaTotal != null ? Math.round(diferencaTotal * 100) / 100 : null,
    // Frase pronta em português, escrita por código — bot cita como vem.
    frase: montarFrase({
      produto: args.produto,
      comprador: args.comprador,
      precoOferecido: args.preco_oferecido,
      precoReferencia,
      diferencaPercentual,
      diferencaTotal,
      sacas: args.sacas,
    }),
  };
}

// Achado real testando ao vivo (bateria adversarial 2026-10-12): boi é
// vendido por ARROBA, não por saca — mas a frase pronta dizia "sacas" pra
// qualquer produto. 4 de 5 vezes o modelo até preencheu o valor certo (ex:
// 18 arrobas) no campo `sacas`, só a palavra que saía errada pro produtor.
function unidadeDoProduto(produto: string): string {
  return produto.toUpperCase() === "BOI" ? "arrobas" : "sacas";
}

function montarFrase(params: {
  produto: string;
  comprador: string | null;
  precoOferecido: number;
  precoReferencia: number;
  diferencaPercentual: number;
  diferencaTotal: number | null;
  sacas: number | null;
}): string {
  const {
    produto,
    comprador,
    precoOferecido,
    precoReferencia,
    diferencaPercentual,
    diferencaTotal,
    sacas,
  } = params;
  const quemOfereceu = comprador ? ` da ${comprador}` : "";
  const direcao = diferencaPercentual >= 0 ? "acima" : "abaixo";
  const partes = [
    `A proposta${quemOfereceu} (${brl(precoOferecido)}) está ${Math.abs(diferencaPercentual).toFixed(1).replace(".", ",")}% ${direcao} da referência de mercado (${brl(precoReferencia)}).`,
  ];
  if (diferencaTotal != null && sacas != null) {
    const ganhouOuPerdeu = diferencaTotal >= 0 ? "a mais" : "a menos";
    partes.push(
      `Nas suas ${sacas} ${unidadeDoProduto(produto)}, isso é ${brl(Math.abs(diferencaTotal))} ${ganhouOuPerdeu}.`,
    );
  }
  return partes.join(" ");
}
