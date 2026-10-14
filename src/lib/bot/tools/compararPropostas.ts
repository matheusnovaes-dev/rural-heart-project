import type { SupabaseClient } from "@supabase/supabase-js";

import { montarRespostaDeEstudo } from "@/lib/bot/estudoDeProposta";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { PropostaLida, UnidadeDoPreco } from "@/lib/bot/propostas/tipos";
import { trechoDoComprador } from "@/lib/bot/propostas/gatilho";
import type { ProdutorContexto } from "@/lib/bot/types";

type PropostaDoModelo = {
  comprador: string | null;
  preco: number;
  unidade: "saca" | "arroba" | "tonelada" | "kg" | null;
  prazo_dias: number | null;
  frete: "retirado" | "entregue" | null;
  quantidade_sacas: number | null;
  validade: string | null;
};

// Mesma rede de segurança determinística das outras ferramentas (alertas,
// cadastro): todo número que o modelo passar precisa ter vindo de verdade de
// alguma mensagem do PRODUTOR. Uma proposta inventada pode fazer o produtor
// recusar uma oferta boa ou aceitar uma ruim, então este é o número mais
// sensível de todos.
function numeroFoiDito(n: number, texto: string, historico: HistoricoLinha[]): boolean {
  const inteiro = String(Math.trunc(n));
  const milhar = Math.trunc(n).toLocaleString("pt-BR");
  const falas = [texto, ...historico.filter((h) => h.role === "user").map((h) => h.conteudo)];
  return falas.some((f) => f.includes(inteiro) || f.includes(milhar));
}

/**
 * Compara UMA ou várias propostas que o produtor contou em texto com o preço
 * de mercado e, havendo mais de uma, ranqueia. O estudo sai pronto de
 * `montarRespostaDeEstudo` (o mesmo que lê foto e PDF): o modelo só repassa o
 * que o produtor disse, nunca escreve a conta.
 */
export async function compararPropostas(
  supabase: SupabaseClient,
  args: { produto: string; uf: string; propostas: PropostaDoModelo[] },
  ctx: { historico: HistoricoLinha[]; texto: string; produtor: ProdutorContexto },
) {
  // O modelo às vezes escreve a palavra "null" como texto em vez de null de verdade.
  const limpa = (v: unknown) =>
    typeof v === "string" && ["null", "none", ""].includes(v.trim().toLowerCase()) ? null : v;
  const lista = (args.propostas ?? []).slice(0, 8).map((p) => ({
    ...p,
    comprador: limpa(p.comprador) as string | null,
    unidade: limpa(p.unidade) as PropostaDoModelo["unidade"],
    frete: limpa(p.frete) as PropostaDoModelo["frete"],
    validade: limpa(p.validade) as string | null,
  }));
  const ufDoModelo = limpa(args.uf) as string | null;

  // Nome de comprador só vale se o produtor o escreveu: o modelo chegou a inventar
  // "Cargill" numa frase que não citava ninguém.
  const textoDoProdutor = [
    ctx.texto,
    ...ctx.historico.filter((h) => h.role === "user").map((h) => h.conteudo),
  ]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const p of lista) {
    if (p.comprador) {
      const nome = p.comprador
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
      if (!textoDoProdutor.includes(nome)) p.comprador = null;
    }
  }
  if (lista.length === 0) return { encontrado: false, erro: "sem_propostas" as const };

  for (const p of lista) {
    if (!numeroFoiDito(p.preco, ctx.texto, ctx.historico)) {
      return { encontrado: false, erro: "preco_nao_confirmado" as const };
    }
  }

  // Cada dado só vale para o comprador cujo trecho da fala o menciona: o modelo
  // chegou a passar "30 dias" (que era da Bunge) também para a Cargill, e a marcar
  // "entregue" sem ninguém dizer. O que não tem evidência vira null (desconhecido),
  // nunca um chute.
  const nomes = lista.map((p) => p.comprador);
  const falas = [
    ctx.texto,
    ...ctx.historico.filter((h) => h.role === "user").map((h) => h.conteudo),
  ];
  const evidencias = (p: PropostaDoModelo): string[] => {
    const locais = falas.map((f) => trechoDoComprador(f, p.comprador, nomes));
    // sem nome do comprador (ou nome fora do texto): vale a fala inteira
    return falas.flatMap((f, i) => {
      const l = locais[i];
      return l ? [l.trecho, l.global] : [f.toLowerCase()];
    });
  };
  const tem = (p: PropostaDoModelo, re: RegExp) =>
    evidencias(p).some((t) => re.test(t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  const UNIDADE_RE: Record<string, RegExp> = {
    saca: /\b(sacas?|sc)\b/,
    arroba: /\b(arrobas?|@)\b|@/,
    tonelada: /\b(toneladas?|ton|t)\b/,
    kg: /\b(kg|quilos?)\b/,
  };
  for (const p of lista) {
    if (p.unidade && !tem(p, UNIDADE_RE[p.unidade]!)) p.unidade = null;
    if (p.frete === "retirado" && !tem(p, /retir|fazenda|porteira|propriedade|fob/)) p.frete = null;
    if (p.frete === "entregue" && !tem(p, /entreg|cif|posto|destino|porto|armazem|levar|deixar/))
      p.frete = null;
    if (p.prazo_dias != null) {
      const dias = p.prazo_dias;
      const ok =
        dias === 0
          ? tem(p, /a\s*vista|avista/)
          : evidencias(p).some((t) => new RegExp(`(^|\\D)${dias}(\\D|$)`).test(t));
      if (!ok) p.prazo_dias = null;
    }
    if (
      p.quantidade_sacas != null &&
      !numeroFoiDito(p.quantidade_sacas, ctx.texto, ctx.historico)
    ) {
      p.quantidade_sacas = null;
    }
    if (
      p.validade &&
      !falas.some((f) => f.toLowerCase().includes(p.validade!.toLowerCase().slice(0, 5)))
    ) {
      p.validade = null;
    }
  }

  const propostas: PropostaLida[] = lista.map((p) => ({
    comprador: p.comprador,
    produto: args.produto,
    preco: p.preco,
    unidade_do_preco: (p.unidade ?? "nao_informada") as UnidadeDoPreco,
    quantidade: p.quantidade_sacas,
    unidade_da_quantidade: p.quantidade_sacas != null ? "saca" : null,
    prazo_pagamento_dias: p.prazo_dias,
    pagamento_texto: null,
    frete:
      p.frete === "retirado"
        ? "fob_retirado"
        : p.frete === "entregue"
          ? "cif_entregue"
          : "nao_informado",
    local_entrega: null,
    umidade_max_pct: null,
    impureza_max_pct: null,
    validade: p.validade,
    observacoes: null,
    trecho_lido: "",
  }));

  const resposta = await montarRespostaDeEstudo({
    supabase,
    produtor: {
      ...ctx.produtor,
      uf: ufDoModelo || ctx.produtor.uf,
      cultura_principal: args.produto,
    },
    propostas,
    origem: "texto",
  });
  return { encontrado: true as const, resposta_pronta: resposta };
}
