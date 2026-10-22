/**
 * Estoque, meta de margem e aviso de venda do Caderno da fazenda (plano Prata e Ouro).
 *
 * Junta o que o Caderno já sabe (custo por saca, colheitas e vendas) com o preço de hoje: "você tem 8.000 sacas, seu
 * custo é R$ 62, o preço chegou a R$ 142 e a sua margem a 28%, acima da sua meta de 25%". É conta com o que o
 * produtor lançou, nunca recomendação de venda, e o texto diz isso.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { culturaMencionada, normalizarCultura } from "@/config/culturas";
import {
  calcularEstoque,
  dataLonga,
  extensoParaDigitos,
  formatarQuantidade,
  formatarReais,
  margemPctNoPreco,
  mesmaCultura,
  precoAlvoDaMargem,
  type RegistroFazenda,
} from "@/lib/fazenda.shared";
import { temAcessoPrata } from "@/lib/planos.shared";
import type { ProdutorContexto } from "@/lib/bot/types";
import {
  SEM_ACENTO,
  TEXTO_RECURSO_PRATA,
  lerRegistros,
  planoDoProdutor,
  precoDeHoje,
} from "@/lib/bot/tools/fazendaBase";
import {
  MARCA_PERGUNTA_AREA,
  custoDaCultura,
  lerAreas,
  salvarMetaDeMargem,
  type AreaCultura,
} from "@/lib/bot/tools/fazendaCusto";

// ---------------------------------------------------------------------------------------------
// Ler o pedido
// ---------------------------------------------------------------------------------------------

/** "meta de margem 25%", "me avisa quando a margem da soja chegar a 30%", "quero vender com margem de 25%". */
export function margemAlvoDoTexto(texto: string): number | null {
  const t = extensoParaDigitos(texto).replace(/\s+/g, " ");
  if (!/\bmargem\b/.test(t) && !/\bmeta\b/.test(t)) return null;
  const m = t.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:%|por ?cento)/);
  if (!m) return null;
  const pct = Number(m[1]!.replace(",", "."));
  if (!Number.isFinite(pct) || pct < 3 || pct > 90) return null;
  const quer =
    /\b(meta|alvo|me avis\w*|avis\w*|quero vender|vender (com|a|quando|so|apenas))\b/.test(t);
  if (!quer) return null;
  if (t.includes("?") && !/\bavis\w*\b/.test(t)) return null;
  return pct;
}

export type AcaoDeAviso = "pausar" | "ligar" | "remover";

/** "pausar o aviso de margem", "liga o aviso de venda", "tira a meta de margem". */
export function acaoDoAvisoDeMargem(texto: string): AcaoDeAviso | null {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.split(" ").length > 12) return null;
  if (
    /\b(tira|tirar|remove|remover|apaga|apagar|cancela|cancelar|exclui|excluir)\b.*\bmeta\b.*\bmargem\b/.test(
      t,
    )
  )
    return "remover";
  if (
    /\b(pausa|pausar|desliga|desligar|para|parar|chega de)\b.*\b(aviso|avisos)\b.*\b(margem|venda)\b|\bnao quero mais\b.*\b(aviso|avisos)\b.*\b(margem|venda)\b/.test(
      t,
    )
  )
    return "pausar";
  if (
    /\b(liga|ligar|ativa|ativar|volta|voltar|retoma|retomar)\b.*\b(aviso|avisos)\b.*\b(margem|venda)\b/.test(
      t,
    )
  )
    return "ligar";
  return null;
}

export function ehPedidoDeEstoque(texto: string): boolean {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.split(" ").length > 10 || /\d/.test(t)) return false;
  return /\b(meu estoque|estoque (de|da|do|atual)|ver o estoque|como esta o estoque|quanto (eu )?tenho (em estoque|guardado|estocado|de estoque)|quantas sacas (eu )?(tenho|ainda tenho|sobraram|restam)|quanto falta vender|o que (eu )?(ainda )?(tenho|falta) (pra|para) vender|sacas (guardadas|sem vender|a vender))\b/.test(
    t,
  );
}

export function ehPedidoDePrecoAlvo(texto: string): boolean {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.split(" ").length > 12 || /\d/.test(t)) return false;
  return /\b(preco alvo|a que preco (eu )?(devo |posso )?vender|qual preco (eu )?(devo |posso )?vender|preco de equilibrio|quando (eu )?(posso|devo) vender|minha meta de margem)\b/.test(
    t,
  );
}

/** "tenho 5.000 sacas de soja no armazém": contagem de estoque (sem pergunta). */
export function pareceContagemDeEstoque(texto: string): boolean {
  const t = SEM_ACENTO(texto);
  if (t.includes("?")) return false;
  if (!/\d/.test(t) || !/\b(sacas?|sc)\b/.test(t)) return false;
  return /\b(estoque|armazem|armazenad\w*|silo|paiol|guardad\w*|estocad\w*|sem vender|a vender|ainda tenho)\b/.test(
    t,
  );
}

// ---------------------------------------------------------------------------------------------
// Conta
// ---------------------------------------------------------------------------------------------

const nomeDaCultura = (c: string) => c.toLowerCase();

async function gatePrata(supabase: SupabaseClient, produtor: ProdutorContexto): Promise<boolean> {
  return temAcessoPrata(await planoDoProdutor(supabase, produtor.id));
}

/** Texto do preço-alvo e da posição de hoje. */
function linhasDaMeta(
  cultura: string,
  custoPorSaca: number | null,
  meta: number | null,
  preco: { preco: number; uf: string } | null,
): string[] {
  const L: string[] = [];
  if (custoPorSaca === null) {
    L.push(
      `Ainda não consigo calcular o preço-alvo: lance os gastos da ${nomeDaCultura(cultura)} e eu faço a conta.`,
    );
    return L;
  }
  if (meta) {
    const alvo = precoAlvoDaMargem(custoPorSaca, meta);
    if (alvo !== null) {
      L.push(
        `Com custo de ${formatarReais(custoPorSaca)} por saca e meta de ${formatarQuantidade(meta)}% de margem, o preço-alvo é ${formatarReais(alvo)} a saca.`,
      );
      if (preco) {
        const hoje = margemPctNoPreco(custoPorSaca, preco.preco);
        const falta = alvo - preco.preco;
        L.push(
          falta <= 0
            ? `Hoje o preço está em ${formatarReais(preco.preco)} em ${preco.uf}, margem de ${formatarQuantidade(hoje ?? 0)}%: você já está acima da meta.`
            : `Hoje o preço está em ${formatarReais(preco.preco)} em ${preco.uf}, margem de ${formatarQuantidade(hoje ?? 0)}%: faltam ${formatarReais(falta)} por saca pra chegar na meta.`,
        );
      }
    }
  }
  return L;
}

export async function textoDoEstoque(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
): Promise<string> {
  if (!produtor.id) return "";
  if (!(await gatePrata(supabase, produtor))) return TEXTO_RECURSO_PRATA;
  const { registros, rotulo } = await lerRegistros(supabase, produtor.id, "safra");
  const culturas = [
    ...new Set(
      registros
        .filter(
          (r) =>
            ["colheita", "venda", "estoque"].includes(r.tipo) &&
            !!r.cultura &&
            /saca/i.test(r.unidade ?? ""),
        )
        .map((r) => normalizarCultura(r.cultura!)),
    ),
  ];
  const itens = culturas
    .map((c) => ({ c, e: calcularEstoque(registros, c) }))
    .filter((x): x is { c: string; e: NonNullable<ReturnType<typeof calcularEstoque>> } => !!x.e);
  if (itens.length === 0) {
    return [
      "Ainda não tenho o suficiente pra calcular o seu estoque.",
      "",
      "Diga quantas sacas você tem guardadas, por exemplo:",
      '  • "tenho 5.000 sacas de soja no armazém"',
      "ou lance as colheitas e as vendas que eu faço a conta.",
    ].join("\n");
  }
  const areas = await lerAreas(supabase, produtor.id);
  const L: string[] = [`Estoque de grãos, ${rotulo}`, ""];
  for (const { c, e } of itens) {
    L.push(`${c.charAt(0).toUpperCase() + c.slice(1)}: ${formatarQuantidade(e.sacas)} sacas`);
    L.push(
      e.base === "contagem"
        ? `  contagem de ${dataLonga(e.baseData!)}, mais ${formatarQuantidade(e.colhidas)} colhidas e menos ${formatarQuantidade(e.vendidas)} vendidas depois`
        : `  ${formatarQuantidade(e.colhidas)} colhidas e ${formatarQuantidade(e.vendidas)} vendidas na safra (sem contagem lançada)`,
    );
    if (e.aReceber > 0)
      L.push(`  ${formatarQuantidade(e.aReceber)} dessas vendas ainda estão a receber`);
    const preco = await precoDeHoje(supabase, produtor, c);
    if (preco && e.sacas > 0) {
      L.push(
        `  Ao preço de hoje (${formatarReais(preco.preco)} em ${preco.uf}): ${formatarReais(Math.round(e.sacas * preco.preco))}`,
      );
    }
    const area = areas.find((a) => mesmaCultura(a.cultura, c));
    if (area) {
      const custo = await custoDaCultura(supabase, produtor, area, areas, registros, rotulo);
      for (const l of linhasDaMeta(
        c,
        custo.conta.custoPorSaca,
        area.margem_alvo_pct ?? null,
        preco,
      )) {
        L.push(`  ${l}`);
      }
    }
    L.push("");
  }
  L.push(
    'Pra corrigir, é só dizer a contagem de novo ("tenho 7.500 sacas de soja"). Pra ser avisado quando a margem bater a sua meta: "meta de margem 25%".',
  );
  return L.join("\n");
}

/**
 * Meta de margem, pausa e preço-alvo. Devolve o texto, ou null quando a mensagem não é disso. A meta precisa da área
 * da cultura: sem ela, pergunta os hectares com a meta escrita na própria pergunta, e a resposta fecha o pedido.
 */
export async function tratarMetaDeMargem(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  texto: string,
): Promise<string | null> {
  if (!produtor.id) return null;
  const meta = margemAlvoDoTexto(texto);
  const acao = acaoDoAvisoDeMargem(texto);
  const pedePrecoAlvo = ehPedidoDePrecoAlvo(texto);
  if (meta === null && !acao && !pedePrecoAlvo) return null;
  if (!(await gatePrata(supabase, produtor))) return TEXTO_RECURSO_PRATA;

  const areas = await lerAreas(supabase, produtor.id);
  const citada = culturaMencionada(texto);
  const cultura =
    citada ??
    (areas.length === 1
      ? areas[0]!.cultura
      : (areas.find((a) => a.margem_alvo_pct)?.cultura ?? produtor.cultura_principal));
  if (!cultura) return "De qual cultura? Por exemplo: meta de margem 25% na soja.";
  const nome = nomeDaCultura(cultura);
  const area: AreaCultura | undefined = areas.find((a) => mesmaCultura(a.cultura, cultura));

  if (acao) {
    if (!area || !area.margem_alvo_pct)
      return `Você ainda não tem meta de margem definida pra ${nome}.`;
    if (acao === "remover") {
      await salvarMetaDeMargem(supabase, produtor.id, cultura, null);
      return `Pronto, tirei a meta de margem da ${nome}. Quando quiser outra, é só dizer, por exemplo: meta de margem 25%.`;
    }
    const ativo = acao === "ligar";
    await salvarMetaDeMargem(supabase, produtor.id, cultura, area.margem_alvo_pct, ativo);
    return ativo
      ? `Pronto, voltei a te avisar quando a margem da ${nome} chegar a ${formatarQuantidade(area.margem_alvo_pct)}%.`
      : `Pronto, pausei o aviso de margem da ${nome}. A meta de ${formatarQuantidade(area.margem_alvo_pct)}% continua guardada: pra voltar, diga "ligar o aviso de margem".`;
  }

  if (meta === null && (!area || !area.margem_alvo_pct)) {
    return `Ainda não tem meta de margem pra ${nome}. Diga qual é, por exemplo: meta de margem 25%, que eu calculo o preço-alvo.`;
  }
  if (!area) {
    return `Pra definir a meta de ${formatarQuantidade(meta ?? 0)}% de margem da ${nome} eu preciso da área. ${MARCA_PERGUNTA_AREA}${nome} você planta? Se souber, diga também as sacas por hectare.`;
  }

  const alvoPct = meta ?? area.margem_alvo_pct ?? null;
  if (meta !== null) {
    const ok = await salvarMetaDeMargem(supabase, produtor.id, cultura, meta, true);
    if (!ok)
      return "Não consegui guardar a meta agora. Tente de novo em instantes, ou defina no painel, na tela Fazenda.";
  }
  const { registros, rotulo } = await lerRegistros(supabase, produtor.id, "safra");
  const custo = await custoDaCultura(
    supabase,
    produtor,
    { ...area, margem_alvo_pct: alvoPct },
    areas,
    registros,
    rotulo,
  );
  const L: string[] = [];
  if (meta !== null) {
    L.push(
      `Pronto: eu te aviso aqui no WhatsApp quando a margem da ${nome} chegar a ${formatarQuantidade(meta)}%, no máximo uma vez por dia.`,
    );
    L.push("");
  }
  L.push(...linhasDaMeta(cultura, custo.conta.custoPorSaca, alvoPct, custo.preco));
  L.push("");
  L.push(
    'Pra pausar, diga "pausar o aviso de margem". É uma conta com o que você lançou no caderno, não é recomendação de venda.',
  );
  return L.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Aviso de venda (cron)
// ---------------------------------------------------------------------------------------------

const DIA_MS = 24 * 3600 * 1000;

export type AvisoDeMargem = { texto: string; preco: number };

/**
 * O aviso de uma cultura, ou null quando não cabe: sem meta, pausado, sem custo ou preço, margem abaixo da meta, ou já
 * avisado há pouco (no mínimo 20h entre avisos; até 7 dias só repete se o preço subiu 3% desde o último aviso).
 */
export async function montarAvisoDeMargem(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  area: AreaCultura,
  areas: AreaCultura[],
  registrosDaSafra: RegistroFazenda[],
  rotuloSafra: string,
  agora: Date = new Date(),
): Promise<AvisoDeMargem | null> {
  const meta = area.margem_alvo_pct ?? null;
  if (!meta || area.aviso_venda_ativo === false) return null;
  const ultimo = area.ultimo_aviso_em ? Date.parse(area.ultimo_aviso_em) : null;
  if (ultimo && agora.getTime() - ultimo < 20 * 3600 * 1000) return null;
  const custo = await custoDaCultura(
    supabase,
    produtor,
    area,
    areas,
    registrosDaSafra,
    rotuloSafra,
  );
  const c = custo.conta.custoPorSaca;
  if (c === null || !custo.preco) return null;
  const margem = margemPctNoPreco(c, custo.preco.preco);
  if (margem !== null && margem < 0)
    return avisoDePrecoAbaixoDoCusto(area, custo, c, margem, ultimo, agora, registrosDaSafra);
  if (margem === null || margem < meta) return null;
  if (ultimo && agora.getTime() - ultimo < 7 * DIA_MS) {
    const antes = area.ultimo_aviso_preco ?? 0;
    if (!(antes > 0 && custo.preco.preco >= antes * 1.03)) return null;
  }
  const est = calcularEstoque(registrosDaSafra, area.cultura);
  const nome = nomeDaCultura(area.cultura);
  const partes = [
    `A ${nome} em ${custo.preco.uf} chegou a ${formatarReais(custo.preco.preco)} a saca (média das praças).`,
    `Pelo seu custo de ${formatarReais(c)} por saca, sua margem está em ${formatarQuantidade(margem)}%, acima da meta de ${formatarQuantidade(meta)}% que você definiu.`,
  ];
  if (est && est.sacas > 0) {
    partes.push(
      `Você tem cerca de ${formatarQuantidade(est.sacas)} sacas sem vender, que a esse preço valem ${formatarReais(Math.round(est.sacas * custo.preco.preco))}.`,
    );
  }
  partes.push("É conta com o que você lançou, não é recomendação de venda.");
  return { texto: partes.join(" "), preco: custo.preco.preco };
}

/**
 * Preço abaixo do seu custo por saca: vale para quem definiu meta de margem (já aceitou receber avisos) e não repete
 * enquanto o preço continuar abaixo: só avisa de novo depois de 7 dias, ou se ele voltou a cobrir o custo e caiu de novo.
 * O último preço avisado fica em ultimo_aviso_preco, então "último aviso abaixo do custo" é ultimo_aviso_preco < custo.
 */
function avisoDePrecoAbaixoDoCusto(
  area: AreaCultura,
  custo: Awaited<ReturnType<typeof custoDaCultura>>,
  c: number,
  margem: number,
  ultimo: number | null,
  agora: Date,
  registrosDaSafra: RegistroFazenda[],
): AvisoDeMargem | null {
  const preco = custo.preco!;
  const antes = area.ultimo_aviso_preco ?? null;
  const jaAvisadoAbaixo = ultimo !== null && antes !== null && antes < c;
  if (jaAvisadoAbaixo && agora.getTime() - ultimo! < 7 * DIA_MS) return null;
  const nome = nomeDaCultura(area.cultura);
  const estimado = custo.conta.sacasOrigem === "conab";
  const partes = [
    `A ${nome} em ${preco.uf} está em ${formatarReais(preco.preco)} a saca (média das praças), abaixo do seu custo de ${formatarReais(c)} por saca${estimado ? " (estimativa com a produção média da Conab, diga a sua pra afinar)" : ""}. A margem está em ${formatarQuantidade(margem)}%.`,
  ];
  const est = calcularEstoque(registrosDaSafra, area.cultura);
  if (est && est.sacas > 0) {
    partes.push(
      `Você tem cerca de ${formatarQuantidade(est.sacas)} sacas sem vender: a esse preço, cada saca fica ${formatarReais(c - preco.preco)} abaixo do custo.`,
    );
  }
  partes.push(
    "Quando a margem voltar à sua meta, eu te aviso. É conta com o que você lançou, não é recomendação de venda.",
  );
  return { texto: partes.join(" "), preco: preco.preco };
}
