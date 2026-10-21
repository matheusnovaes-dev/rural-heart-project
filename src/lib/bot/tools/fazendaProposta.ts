/**
 * "Fechei com o comprador B": depois de um estudo de proposta, o produtor diz que fechou e a venda entra no
 * caderno com o preço e o prazo da proposta (a prazo vira a receber, com lembrete no dia). Por código: o preço
 * vem do estudo, a quantidade do que ele disse (ou da que informou no estudo).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COLUNAS_REGISTRO,
  formatarQuantidade,
  formatarReais,
  hojeBrasilia,
  somarDias,
  type RegistroFazenda,
} from "@/lib/fazenda.shared";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { EstudoSalvo, PropostaLida } from "@/lib/bot/propostas/tipos";
import type { ProdutorContexto } from "@/lib/bot/types";
import { confirmacaoDoRegistro } from "@/lib/bot/tools/fazenda";
import { SEM_ACENTO, textoOuNull, ultimaDoBot } from "@/lib/bot/tools/fazendaBase";
import { criarLembreteDoVencimento } from "@/lib/bot/tools/fazendaPendencias";

const MARCA_QUAL_COMPRADOR = "Fechou com qual comprador?";
const MARCA_QUANTAS_SACAS = "Quantas sacas você vendeu";

/** "fechei com o comprador B", "aceitei a proposta", "vendi pra cooperativa". Passado: "vou fechar" é plano. */
export function ehFechamentoDeProposta(texto: string): boolean {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.split(" ").length > 16 || texto.includes("?")) return false;
  if (/\b(vou|vamos|queria|quero|se eu|e se|talvez|devo)\b/.test(t)) return false;
  return /\b(fechei|fechamos|aceitei|aceitamos|topei|topamos|fechado com)\b/.test(t);
}

const norm = (s: string) =>
  SEM_ACENTO(s)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function compradorCitado(texto: string, propostas: PropostaLida[]): PropostaLida[] {
  const t = ` ${norm(texto)} `;
  return propostas.filter((p) => {
    if (!p.comprador) return false;
    const palavras = norm(p.comprador)
      .split(" ")
      .filter((w) => w.length >= 3);
    // basta uma palavra do nome (ex: "cargill" em "Cargill Sorriso") aparecer na mensagem
    return palavras.some((w) => t.includes(` ${w} `)) || t.includes(` ${norm(p.comprador)} `);
  });
}

function sacasDoTexto(texto: string): number | null {
  const m = SEM_ACENTO(texto).match(/(\d[\d.,]*)\s*(mil\s*)?(?:sacas?|sacos?|sc)\b/);
  if (!m) return null;
  const base = Number(m[1]!.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(base)) return null;
  return m[2] ? base * 1000 : base;
}

export async function tratarFechamentoDeProposta(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  texto: string,
  historico: HistoricoLinha[],
  estudo: EstudoSalvo | null,
  telefone: string,
): Promise<string | null> {
  if (!produtor.id || !estudo) return null;
  const anterior = ultimaDoBot(historico);
  const continuacao =
    !!anterior &&
    (anterior.includes(MARCA_QUAL_COMPRADOR) || anterior.includes(MARCA_QUANTAS_SACAS));
  if (!ehFechamentoDeProposta(texto) && !continuacao) return null;

  const validas = estudo.propostas.filter(
    (p) => typeof p.preco === "number" && p.preco > 0 && p.unidade_do_preco === "saca",
  );
  if (validas.length === 0) return null; // preço por arroba ou tonelada: o produtor lança dizendo o valor

  // Continuando "Quantas sacas você vendeu?": o comprador está na pergunta anterior; a conversa tem o resto.
  const recentes = [...historico]
    .filter((h) => h.role === "user")
    .sort((a, b) => b.ordem - a.ordem)
    .slice(0, 3)
    .map((h) => h.conteudo);
  const base = continuacao ? [texto, ...recentes].join(" . ") : texto;

  let alvo: PropostaLida | undefined;
  const citados = compradorCitado(base, validas);
  if (citados.length === 1) alvo = citados[0];
  else if (validas.length === 1) alvo = validas[0];
  if (!alvo) {
    const lista = validas
      .slice(0, 6)
      .map((p, i) => `${i + 1}) ${p.comprador ?? "Comprador"}: ${formatarReais(p.preco!)} por saca`)
      .join("\n");
    return `${MARCA_QUAL_COMPRADOR}\n${lista}\nMe diga o nome do comprador.`;
  }

  const qtd =
    sacasDoTexto(base) ??
    estudo.quantidadeInformada ??
    (alvo.unidade_da_quantidade === "saca" && alvo.quantidade ? alvo.quantidade : null);
  if (!qtd || qtd <= 0) {
    return `${MARCA_QUANTAS_SACAS} para ${alvo.comprador ?? "esse comprador"}? Me diga o número de sacas, por exemplo: 500 sacas.`;
  }

  const hoje = hojeBrasilia();
  const valor = Math.round(qtd * alvo.preco! * 100) / 100;
  const prazo = alvo.prazo_pagamento_dias ?? 0;
  const pendente = prazo > 0;
  const venceEm = pendente ? somarDias(hoje, prazo) : null;
  const cultura = textoOuNull(estudo.produto, 40)?.toLowerCase() ?? null;
  const { data, error } = await supabase
    .from("fazenda_registros")
    .insert({
      produtor_id: produtor.id,
      tipo: "venda",
      ocorrido_em: hoje,
      valor,
      descricao: `Venda para ${textoOuNull(alvo.comprador, 80) ?? "comprador do estudo"}`,
      cultura,
      quantidade: qtd,
      unidade: "sacas",
      preco_unitario: alvo.preco,
      origem: "whatsapp",
      situacao: pendente ? "pendente" : "realizado",
      vence_em: venceEm,
    })
    .select(COLUNAS_REGISTRO)
    .single();
  if (error || !data) {
    console.error("Erro ao lançar venda do estudo:", error);
    return "Não consegui anotar a venda agora. Tente de novo em instantes, ou escreva, por exemplo: vendi 500 sacas a 135.";
  }
  let registro = data as RegistroFazenda;
  if (pendente) {
    const lembreteId = await criarLembreteDoVencimento(supabase, produtor, telefone, registro);
    if (lembreteId) {
      await supabase
        .from("fazenda_registros")
        .update({ lembrete_id: lembreteId })
        .eq("id", registro.id);
      registro = { ...registro, lembrete_id: lembreteId };
    }
  }
  const confirmacao = await confirmacaoDoRegistro(supabase, produtor, registro);
  return `${confirmacao}\n(Usei o preço de ${formatarReais(alvo.preco!)} por saca da proposta${alvo.comprador ? ` de ${alvo.comprador}` : ""} e ${formatarQuantidade(qtd)} sacas${prazo > 0 ? `, com pagamento em ${prazo} dias` : ", à vista"}.)`;
}
