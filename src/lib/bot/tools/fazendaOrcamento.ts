/**
 * Orçamento por categoria de gasto (plano Prata e Ouro): "orçamento de adubo 100 mil" define, "meu orçamento" mostra,
 * "tirar orçamento de adubo" remove. O caderno compara com o gasto já realizado na safra (1/set a 31/ago) e avisa, na
 * confirmação do gasto, quando o lançamento leva a categoria a 80% ou a 100%. Tudo por código, sem modelo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  avisoDeOrcamento,
  categoriaDeTexto,
  extensoParaDigitos,
  formatarQuantidade,
  formatarReais,
  numerosDoTexto,
  situacaoDosOrcamentos,
  type OrcamentoFazenda,
  type RegistroFazenda,
  type SituacaoDoOrcamento,
} from "@/lib/fazenda.shared";
import { temAcessoPrata } from "@/lib/planos.shared";
import type { ProdutorContexto } from "@/lib/bot/types";
import { lerRegistros, planoDoProdutor, TEXTO_RECURSO_PRATA } from "@/lib/bot/tools/fazendaBase";

export type AcaoDeOrcamento = "definir" | "ver" | "remover";

const PALAVRA_DE_ORCAMENTO = /\b(orcament\w*|limite de gastos?|teto de gastos?|gastar no maximo)\b/;

/** O que a mensagem pede sobre orçamento, ou null quando não é disso. */
export function acaoDeOrcamento(texto: string): AcaoDeOrcamento | null {
  const t = extensoParaDigitos(texto)
    .replace(/[?!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!PALAVRA_DE_ORCAMENTO.test(t)) return null;
  const palavras = t.split(" ");
  if (
    /\b(tira|tirar|tire|remove|remover|apaga|apagar|exclui|excluir|cancela|cancelar|zera|zerar)\b/.test(
      t,
    )
  )
    return palavras.length <= 12 ? "remover" : null;
  const temNumero = numerosDoTexto(texto).some((n) => n >= 1 && n < 1_000_000_000);
  if (temNumero) {
    // "como faço um orçamento de 3 talhões?" e perguntas soltas não definem nada
    if (
      /\b(como|qual|quanto|quais)\b/.test(t) &&
      !/\b(quero|define|definir|coloca|colocar|fica|ficar|seja|e de|eh de)\b/.test(t)
    )
      return null;
    return palavras.length <= 16 ? "definir" : null;
  }
  if (palavras.length > 9) return null;
  if (
    /^(meu |meus |ver |mostra\w* |me mostra |como (esta|estao|anda|andam) (o |os )?(meu |meus )?|situacao do |quanto (ja )?(gastei|usei) d\w+ )?(o )?orcament\w*( da safra| da fazenda| por categoria| de \w+( \w+)?)?$/.test(
      t,
    )
  )
    return "ver";
  if (/\b(meu|meus)\b.*\borcament\w*|\borcament\w*.*\b(como esta|como anda|estao|esta)\b/.test(t))
    return "ver";
  return null;
}

/** A categoria citada ("orçamento de adubo"), ou null quando não dá pra saber. */
function categoriaCitada(texto: string): string | null {
  const t = extensoParaDigitos(texto).replace(PALAVRA_DE_ORCAMENTO, " ");
  const c = categoriaDeTexto(t);
  if (c !== "Outros") return c;
  return /\boutros?\b/.test(t) ? "Outros" : null;
}

async function lerOrcamentos(
  supabase: SupabaseClient,
  produtorId: string,
): Promise<{ lista: OrcamentoFazenda[]; erro: boolean }> {
  const { data, error } = await supabase
    .from("fazenda_orcamentos")
    .select("id, categoria, valor")
    .eq("produtor_id", produtorId);
  if (error) {
    console.error("Erro ao ler orçamentos da fazenda:", error);
    return { lista: [], erro: true };
  }
  return {
    lista: ((data ?? []) as { id: string; categoria: string; valor: number | string }[]).map(
      (o) => ({ id: o.id, categoria: o.categoria, valor: Number(o.valor) }),
    ),
    erro: false,
  };
}

function linhaDaSituacao(s: SituacaoDoOrcamento): string {
  const pct = `${formatarQuantidade(Math.round(s.pct))}%`;
  return s.restante >= 0
    ? `• ${s.categoria}: ${formatarReais(s.gasto)} de ${formatarReais(s.orcado)} (${pct}), restam ${formatarReais(s.restante)}`
    : `• ${s.categoria}: ${formatarReais(s.gasto)} de ${formatarReais(s.orcado)} (${pct}), passou ${formatarReais(-s.restante)}`;
}

const PERGUNTA_CATEGORIA =
  "De qual categoria? Por exemplo: adubo, defensivos, combustível, sementes, mão de obra, máquinas, frete, energia, arrendamento.";
const EXEMPLO = 'Diga, por exemplo: "orçamento de adubo 100 mil".';

export async function tratarOrcamento(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  texto: string,
): Promise<string | null> {
  if (!produtor.id) return null;
  const acao = acaoDeOrcamento(texto);
  if (!acao) return null;
  if (!temAcessoPrata(await planoDoProdutor(supabase, produtor.id))) return TEXTO_RECURSO_PRATA;

  const { lista, erro } = await lerOrcamentos(supabase, produtor.id);
  const categoria = categoriaCitada(texto);
  const safra = await lerRegistros(supabase, produtor.id, "safra");

  if (acao === "ver") {
    if (erro)
      return "Não consegui ler os orçamentos agora. Tente de novo em instantes, ou veja na tela Fazenda do painel.";
    if (lista.length === 0) return `Você ainda não definiu orçamento. ${EXEMPLO}`;
    const todas = situacaoDosOrcamentos(lista, safra.registros);
    const sit = categoria ? todas.filter((s) => s.categoria === categoria) : todas;
    if (sit.length === 0)
      return `Você não tem orçamento de ${categoria!.toLowerCase()}. ${EXEMPLO}`;
    return [
      `Orçamento por categoria, ${safra.rotulo}`,
      "",
      ...sit.map(linhaDaSituacao),
      "",
      "Conta só o gasto já pago; o que está a pagar entra quando você dá baixa. Pra mudar: orçamento de adubo 120 mil.",
    ].join("\n");
  }

  if (acao === "remover") {
    const alvo = categoria ?? (lista.length === 1 ? lista[0]!.categoria : null);
    if (!alvo) return lista.length === 0 ? "Você não tem orçamento definido." : PERGUNTA_CATEGORIA;
    const existe = lista.find((o) => o.categoria === alvo);
    if (!existe) return `Você não tem orçamento de ${alvo.toLowerCase()}.`;
    const { error } = await supabase
      .from("fazenda_orcamentos")
      .delete()
      .eq("produtor_id", produtor.id)
      .eq("categoria", alvo);
    if (error) return "Não consegui tirar o orçamento agora. Tente de novo em instantes.";
    return `Pronto, tirei o orçamento de ${alvo.toLowerCase()}. Os gastos continuam no caderno.`;
  }

  // definir
  if (!categoria) return `${PERGUNTA_CATEGORIA} Exemplo: "orçamento de adubo 100 mil".`;
  const valor = numerosDoTexto(texto).find((n) => n >= 1 && n < 1_000_000_000);
  if (valor === undefined) return `Qual o valor? ${EXEMPLO}`;
  const { error } = await supabase
    .from("fazenda_orcamentos")
    .upsert(
      { produtor_id: produtor.id, categoria, valor, atualizado_em: new Date().toISOString() },
      { onConflict: "produtor_id,categoria" },
    );
  if (error) {
    console.error("Erro ao guardar orçamento:", error);
    return "Não consegui guardar o orçamento agora. Tente de novo em instantes, ou defina na tela Fazenda do painel.";
  }
  const sit = situacaoDosOrcamentos([{ categoria, valor }], safra.registros)[0]!;
  const L = [
    `Pronto: orçamento de ${categoria.toLowerCase()} na ${safra.rotulo.toLowerCase().startsWith("safra") ? safra.rotulo : `safra ${safra.rotulo}`} em ${formatarReais(valor)}.`,
    sit.gasto > 0
      ? `Até agora você gastou ${formatarReais(sit.gasto)} (${formatarQuantidade(Math.round(sit.pct))}%)${sit.restante < 0 ? `, ${formatarReais(-sit.restante)} acima do orçamento` : ""}.`
      : "Ainda não há gasto lançado nessa categoria.",
    "Eu te aviso na confirmação do gasto quando você chegar a 80% e a 100%. Pra ver todos: meu orçamento.",
  ];
  return L.join(" ");
}

/**
 * Linha de aviso para colar na confirmação de um gasto realizado, quando ele leva a categoria a 80% ou 100% do
 * orçamento. Vazia quando não há orçamento (a consulta é uma só e, na maioria das vezes, volta sem linhas).
 */
export async function avisoDeOrcamentoDoGasto(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  r: RegistroFazenda,
): Promise<string | null> {
  if (
    !produtor.id ||
    r.tipo !== "gasto" ||
    r.situacao !== "realizado" ||
    !r.categoria ||
    !(r.valor && r.valor > 0)
  )
    return null;
  const { data, error } = await supabase
    .from("fazenda_orcamentos")
    .select("id, categoria, valor")
    .eq("produtor_id", produtor.id)
    .eq("categoria", r.categoria)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const orc = data[0] as { categoria: string; valor: number | string };
  if (!temAcessoPrata(await planoDoProdutor(supabase, produtor.id))) return null;
  const safra = await lerRegistros(supabase, produtor.id, "safra");
  const sit = situacaoDosOrcamentos(
    [{ categoria: orc.categoria, valor: Number(orc.valor) }],
    safra.registros,
  )[0]!;
  return avisoDeOrcamento(sit, r.valor);
}
