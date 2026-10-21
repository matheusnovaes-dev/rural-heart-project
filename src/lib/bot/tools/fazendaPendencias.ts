/**
 * A pagar e a receber no Caderno da fazenda: lançamento com vencimento (situacao = 'pendente'), lembrete no dia
 * do vencimento (a tabela `lembretes`, que o n8n já envia pelo WhatsApp) e a baixa quando o produtor diz
 * "recebi" ou "paguei". Tudo por código: o que vira baixa e qual lançamento é decidido aqui, não pelo modelo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COLUNAS_REGISTRO,
  fraseDeVencimento,
  formatarReais,
  hojeBrasilia,
  numerosDoTexto,
  resumirPendencias,
  somarDias,
  valorConfere,
  dataLonga,
  type Pendencia,
  type RegistroFazenda,
} from "@/lib/fazenda.shared";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { ProdutorContexto } from "@/lib/bot/types";
import { SEM_ACENTO, dataDoTexto, lerPendentes, ultimaDoBot } from "@/lib/bot/tools/fazendaBase";

/** Hora do lembrete no dia do vencimento (Brasília). */
const HORA_DO_LEMBRETE_UTC = 11; // 08h em Brasília

const rotuloDoLancamento = (r: RegistroFazenda): string => {
  if (r.tipo === "venda") return `venda${r.cultura ? ` de ${r.cultura.toLowerCase()}` : ""}`;
  return r.descricao;
};

/** Cria o lembrete do dia do vencimento. Devolve o id, ou null quando não cabe (hoje depois das 8h, passado). */
export async function criarLembreteDoVencimento(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  telefone: string,
  r: RegistroFazenda,
): Promise<string | null> {
  if (!produtor.id || !r.vence_em || r.valor === null) return null;
  const enviarEm = new Date(
    `${r.vence_em}T${String(HORA_DO_LEMBRETE_UTC).padStart(2, "0")}:00:00Z`,
  );
  // n8n envia tudo que está pendente e com horário vencido: nunca criar com horário que já passou.
  if (enviarEm.getTime() < Date.now() + 10 * 60_000) return null;
  // O envio de lembretes (n8n) coloca o 55 sozinho: o número guardado é só DDD + número (11 dígitos), como no painel.
  let digitos = "";
  const { data: p } = await supabase
    .from("produtores")
    .select("whatsapp")
    .eq("id", produtor.id)
    .maybeSingle<{ whatsapp: string | null }>();
  digitos = (p?.whatsapp ?? "").replace(/\D/g, "");
  if (!digitos) {
    digitos = telefone.replace(/\D/g, "");
    if (digitos.length >= 12 && digitos.startsWith("55")) digitos = digitos.slice(2);
  }
  if (!digitos) return null;
  const acao = r.tipo === "venda" ? "Receber" : "Pagar";
  const { data, error } = await supabase
    .from("lembretes")
    .insert({
      produtor_id: produtor.id,
      criado_por: produtor.user_id && produtor.user_id !== "x" ? produtor.user_id : null,
      titulo: `${acao} ${formatarReais(r.valor)}: ${rotuloDoLancamento(r)}`.slice(0, 200),
      descricao: `Do caderno da fazenda. ${
        r.tipo === "venda"
          ? 'Quando receber, é só dizer "recebi".'
          : 'Quando pagar, é só dizer "paguei".'
      }`,
      enviar_em: enviarEm.toISOString(),
      whatsapp_destino: digitos,
      status: "pendente",
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("Erro ao criar lembrete do vencimento:", error);
    return null;
  }
  return (data as { id: string }).id;
}

export async function cancelarLembrete(
  supabase: SupabaseClient,
  lembreteId: string | null,
): Promise<void> {
  if (!lembreteId) return;
  await supabase
    .from("lembretes")
    .update({ status: "cancelado" })
    .eq("id", lembreteId)
    .eq("status", "pendente");
}

/** Marca como pago ou recebido (entra nas contas na data da baixa). */
export async function darBaixa(
  supabase: SupabaseClient,
  produtorId: string,
  r: RegistroFazenda,
  dia: string,
  valorReal?: number | null,
): Promise<RegistroFazenda | null> {
  const mudanca: Record<string, unknown> = {
    situacao: "realizado",
    realizado_em: dia,
    ocorrido_em: dia,
  };
  if (valorReal && valorReal > 0 && r.valor !== null && Math.abs(valorReal - r.valor) > 0.005) {
    mudanca["valor"] = valorReal;
    if (r.quantidade && r.quantidade > 0) {
      mudanca["preco_unitario"] = Math.round((valorReal / r.quantidade) * 100) / 100;
    }
  }
  const { data, error } = await supabase
    .from("fazenda_registros")
    .update(mudanca)
    .eq("id", r.id)
    .eq("produtor_id", produtorId)
    .eq("situacao", "pendente")
    .is("apagado_em", null)
    .select(COLUNAS_REGISTRO)
    .single();
  if (error || !data) {
    console.error("Erro ao dar baixa:", error);
    return null;
  }
  await cancelarLembrete(supabase, r.lembrete_id);
  return data as RegistroFazenda;
}

// ---------------------------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------------------------

const linhaDaPendencia = (p: Pendencia) =>
  `  • ${rotuloDoLancamento(p.registro)}: ${formatarReais(p.registro.valor ?? 0)}, ${fraseDeVencimento(p.dias, p.vencimento)}`;

export function textoDePendencias(registros: RegistroFazenda[], hoje = hojeBrasilia()): string {
  const r = resumirPendencias(registros, hoje);
  if (r.aPagar.length === 0 && r.aReceber.length === 0) {
    return [
      "Não tem nada a pagar nem a receber anotado no caderno.",
      "",
      "Pra anotar, é só escrever, por exemplo:",
      '  • "vendi 500 sacas a 135 e recebo dia 30"',
      '  • "tenho que pagar 5 mil de arrendamento dia 10"',
      "Eu te lembro no dia, às 8h.",
    ].join("\n");
  }
  const linhas: string[] = ["A pagar e a receber", ""];
  if (r.aReceber.length) {
    linhas.push(`A receber: ${formatarReais(r.totalAReceber)} (${r.aReceber.length})`);
    for (const p of r.aReceber.slice(0, 6)) linhas.push(linhaDaPendencia(p));
  }
  if (r.aPagar.length) {
    linhas.push(`A pagar: ${formatarReais(r.totalAPagar)} (${r.aPagar.length})`);
    for (const p of r.aPagar.slice(0, 6)) linhas.push(linhaDaPendencia(p));
  }
  linhas.push("");
  linhas.push('Quando receber ou pagar, é só dizer "recebi" ou "paguei".');
  return linhas.join("\n");
}

/** "o que tenho a pagar", "contas a receber"... (pergunta, sem número). */
export function ehPedidoDePendencias(texto: string): boolean {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.split(" ").length > 9 || /\d/.test(t)) return false;
  return /\b(contas a (pagar|receber)|a pagar e a receber|(o que|quanto) (eu )?(tenho|devo|vou|falta|falto) (a |que |de )?(pagar|receber)|o que (eu )?(devo|tenho que pagar|vou receber)|meus (recebimentos|pagamentos|vencimentos)|quanto (me )?devem|vencimentos? (da|de) (hoje|semana|mes))\b/.test(
    t,
  );
}

// ---------------------------------------------------------------------------------------------
// "Recebi" e "paguei" dão baixa no que estava pendente
// ---------------------------------------------------------------------------------------------

const MARCA_ESCOLHA_RECEBER = "Qual deles você recebeu?";
const MARCA_ESCOLHA_PAGAR = "Qual deles você pagou?";

function tokens(s: string): string[] {
  return SEM_ACENTO(s)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 4 &&
        !/^(recebi|paguei|quitei|liquidei|recebemos|pagamos|valor|sacas|reais|todo|toda|mais|esse|essa|aquele|aquela|ainda|conta|parcela|resto)$/.test(
          w,
        ),
    );
}

type Escolha =
  | { tipo: "um"; registro: RegistroFazenda; valorDito: number | null }
  | { tipo: "varios"; opcoes: RegistroFazenda[] }
  | null;

/**
 * Decide qual pendente a pessoa quis baixar. Só devolve algo quando existe pendente do mesmo tipo e há
 * indício claro (valor igual, palavra em comum, ou um único pendente numa frase curta). Senão é um
 * lançamento novo ("paguei 3 mil de diesel") e o fluxo normal segue.
 */
export function escolherPendenciaPorTexto(
  texto: string,
  pendentes: RegistroFazenda[],
  tipo: "gasto" | "venda",
): Escolha {
  const doTipo = pendentes.filter((p) => p.tipo === tipo && p.valor !== null);
  if (doTipo.length === 0) return null;
  const numeros = numerosDoTexto(texto);
  const palavras = tokens(texto);
  const porValor = doTipo.filter((p) => valorConfere(p.valor!, numeros));
  if (porValor.length === 1) return { tipo: "um", registro: porValor[0]!, valorDito: null };
  if (porValor.length > 1) {
    const refinado = porValor.filter((p) =>
      tokens(`${p.descricao} ${p.cultura ?? ""} ${p.categoria ?? ""}`).some((w) =>
        palavras.includes(w),
      ),
    );
    if (refinado.length === 1) return { tipo: "um", registro: refinado[0]!, valorDito: null };
    return { tipo: "varios", opcoes: porValor };
  }
  const porPalavra = doTipo.filter((p) =>
    tokens(`${p.descricao} ${p.cultura ?? ""} ${p.categoria ?? ""}`).some((w) =>
      palavras.includes(w),
    ),
  );
  if (porPalavra.length === 1) {
    // valor dito que não bate com o pendente: vale o que a pessoa disse (é o que de fato entrou ou saiu)
    const dito = numeros.find((n) => n >= 1) ?? null;
    return { tipo: "um", registro: porPalavra[0]!, valorDito: dito };
  }
  if (porPalavra.length > 1) return { tipo: "varios", opcoes: porPalavra };
  // sem número e sem palavra: "recebi" ou "paguei" sozinho
  if (numeros.length === 0 && palavras.length === 0) {
    if (doTipo.length === 1) return { tipo: "um", registro: doTipo[0]!, valorDito: null };
    return { tipo: "varios", opcoes: doTipo };
  }
  return null;
}

const VERBO_DE_BAIXA = /^(?:ja\s+|tambem\s+)?(recebi|recebemos|paguei|pagamos|quitei|liquidei)\b/;

export function tipoDaBaixa(texto: string): "gasto" | "venda" | null {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = t.match(VERBO_DE_BAIXA);
  if (!m || t.split(" ").length > 12) return null;
  return /^(recebi|recebemos)$/.test(m[1]!) ? "venda" : "gasto";
}

const textoDaBaixa = (r: RegistroFazenda, dia: string, ajuste: number | null): string => {
  const verbo = r.tipo === "venda" ? "Recebido" : "Pago";
  const valor = formatarReais(r.valor ?? 0);
  const venc = r.vence_em ? ` (vencia em ${dataLonga(r.vence_em)})` : "";
  const nota = ajuste !== null ? ` Ajustei o valor para ${valor}, que foi o que você disse.` : "";
  return `Dei baixa: ${verbo.toLowerCase()} ${valor}, ${rotuloDoLancamento(r)}${venc}. Entrou no caderno em ${dataLonga(dia)}.${nota}`;
};

function listaParaEscolher(opcoes: RegistroFazenda[], tipo: "gasto" | "venda"): string {
  const ordenadas = [...opcoes].sort((a, b) => (a.vence_em ?? "").localeCompare(b.vence_em ?? ""));
  return [
    tipo === "venda" ? MARCA_ESCOLHA_RECEBER : MARCA_ESCOLHA_PAGAR,
    ...ordenadas
      .slice(0, 9)
      .map(
        (p, i) =>
          `${i + 1}) ${rotuloDoLancamento(p)}: ${formatarReais(p.valor ?? 0)}${p.vence_em ? `, vence ${dataLonga(p.vence_em)}` : ""}`,
      ),
    "Responda com o número.",
  ].join("\n");
}

/** Mensagem que começa com "recebi" ou "paguei" e existe pendente: dá a baixa (ou pergunta qual). null = não é baixa. */
export async function tratarBaixa(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  texto: string,
  historico: HistoricoLinha[],
): Promise<string | null> {
  if (!produtor.id) return null;
  const hoje = hojeBrasilia();

  // 1) respondeu o número da lista "Qual deles você recebeu/pagou?"
  const anterior = ultimaDoBot(historico);
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const escolha = t.match(/^(?:o |a |numero |n )?(\d)$/);
  if (
    anterior &&
    escolha &&
    (anterior.includes(MARCA_ESCOLHA_RECEBER) || anterior.includes(MARCA_ESCOLHA_PAGAR))
  ) {
    const tipo = anterior.includes(MARCA_ESCOLHA_RECEBER) ? "venda" : "gasto";
    const pendentes = (await lerPendentes(supabase, produtor.id))
      .filter((p) => p.tipo === tipo)
      .sort((a, b) => (a.vence_em ?? "").localeCompare(b.vence_em ?? ""));
    const alvo = pendentes[Number(escolha[1]) - 1];
    if (!alvo)
      return (
        "Não achei esse número na lista. Escreva de novo o que você " +
        (tipo === "venda" ? "recebeu" : "pagou") +
        "."
      );
    const feito = await darBaixa(supabase, produtor.id, alvo, hoje);
    return feito
      ? textoDaBaixa(feito, hoje, null)
      : "Não consegui dar baixa agora. Tente de novo em instantes ou marque pelo painel.";
  }

  // 2) "recebi ..." / "paguei ..."
  const tipo = tipoDaBaixa(texto);
  if (!tipo) return null;
  const pendentes = await lerPendentes(supabase, produtor.id);
  const decisao = escolherPendenciaPorTexto(texto, pendentes, tipo);
  if (!decisao) return null;
  if (decisao.tipo === "varios") return listaParaEscolher(decisao.opcoes, tipo);
  const dia = dataDoTexto(texto, hoje) ?? hoje;
  const feito = await darBaixa(supabase, produtor.id, decisao.registro, dia, decisao.valorDito);
  if (!feito)
    return "Não consegui dar baixa agora. Tente de novo em instantes ou marque pelo painel.";
  return textoDaBaixa(
    feito,
    dia,
    decisao.valorDito !== null && decisao.valorDito !== decisao.registro.valor
      ? decisao.valorDito
      : null,
  );
}

/**
 * Uma frase do caderno para o resumo diário (uma linha só, porque vai dentro de um modelo do WhatsApp): o que vence
 * nos próximos 7 dias e, às segundas, o que foi lançado na semana. null quando não há nada a dizer.
 */
export async function trechoDoCadernoParaResumo(
  supabase: SupabaseClient,
  produtorId: string,
  agora: Date = new Date(),
): Promise<string | null> {
  try {
    const hoje = hojeBrasilia(agora);
    const pendentes = await lerPendentes(supabase, produtorId);
    const r = resumirPendencias(pendentes, hoje);
    const proximos = (l: Pendencia[]) => l.filter((p) => p.dias <= 7);
    const aReceber = proximos(r.aReceber);
    const aPagar = proximos(r.aPagar);
    const partes: string[] = [];
    const soma = (l: Pendencia[]) => l.reduce((t, p) => t + (p.registro.valor ?? 0), 0);
    if (aReceber.length)
      partes.push(
        `a receber ${formatarReais(soma(aReceber))} (${fraseDeVencimento(aReceber[0]!.dias, aReceber[0]!.vencimento)})`,
      );
    if (aPagar.length)
      partes.push(
        `a pagar ${formatarReais(soma(aPagar))} (${fraseDeVencimento(aPagar[0]!.dias, aPagar[0]!.vencimento)})`,
      );
    let semana = "";
    // segunda-feira (em Brasília): resumo da semana que passou
    const diaDaSemana = new Date(`${hoje}T12:00:00Z`).getUTCDay();
    if (diaDaSemana === 1) {
      const desde = somarDias(hoje, -7);
      const { data } = await supabase
        .from("fazenda_registros")
        .select("tipo, valor")
        .eq("produtor_id", produtorId)
        .eq("situacao", "realizado")
        .is("apagado_em", null)
        .gte("ocorrido_em", desde)
        .lt("ocorrido_em", hoje)
        .in("tipo", ["gasto", "venda"]);
      const linhas = (data ?? []) as { tipo: string; valor: number | null }[];
      const g = linhas.filter((x) => x.tipo === "gasto").reduce((t, x) => t + (x.valor ?? 0), 0);
      const v = linhas.filter((x) => x.tipo === "venda").reduce((t, x) => t + (x.valor ?? 0), 0);
      if (g > 0 || v > 0) {
        semana = `Na semana passada você lançou ${formatarReais(g)} em gastos e ${formatarReais(v)} em vendas.`;
      }
    }
    const vencimentos = partes.length ? `No seu caderno: ${partes.join(" e ")}.` : "";
    const texto = [vencimentos, semana].filter(Boolean).join(" ");
    return texto || null;
  } catch {
    return null;
  }
}
