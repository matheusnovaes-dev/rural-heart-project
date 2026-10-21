/**
 * Custo por saca e margem no Caderno da fazenda: junta o que o produtor lançou de gasto com a área da
 * cultura (que ele informa uma vez) e com o preço de mercado de hoje. A produtividade vem do que ele
 * colheu e lançou, do que ele informou, ou da média da Conab do estado, nessa ordem, e a resposta diz qual.
 *
 * É uma ESTIMATIVA e o texto diz isso: só entra o que foi lançado (arrendamento, juros e o que não foi
 * anotado ficam de fora).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { culturaMencionada, normalizarCultura } from "@/config/culturas";
import {
  calcularCustoEMargem,
  extensoParaDigitos,
  formatarQuantidade,
  formatarReais,
  intervaloDoPeriodo,
  kgPorSaca,
  mesmaCultura,
  precoAlvoDaMargem,
  resumir,
  somarGastosDaCultura,
  type RegistroFazenda,
} from "@/lib/fazenda.shared";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { ProdutorContexto } from "@/lib/bot/types";
import { SEM_ACENTO, lerRegistros, precoDeHoje, ultimaDoBot } from "@/lib/bot/tools/fazendaBase";
import { buscarProducaoHistoricaConab } from "@/lib/bot/tools/mercado";

export type AreaCultura = {
  cultura: string;
  area_ha: number;
  produtividade_sc_ha: number | null;
  /** meta de margem sobre o preço, em % (plano Prata) */
  margem_alvo_pct?: number | null;
  aviso_venda_ativo?: boolean;
  ultimo_aviso_em?: string | null;
  ultimo_aviso_preco?: number | null;
};

export const MARCA_PERGUNTA_AREA = "Quantos hectares de ";

export async function lerAreas(
  supabase: SupabaseClient,
  produtorId: string,
): Promise<AreaCultura[]> {
  const { data, error } = await supabase
    .from("fazenda_areas")
    .select(
      "cultura, area_ha, produtividade_sc_ha, margem_alvo_pct, aviso_venda_ativo, ultimo_aviso_em, ultimo_aviso_preco",
    )
    .eq("produtor_id", produtorId)
    .order("area_ha", { ascending: false });
  if (error) console.error("Erro ao ler as áreas da fazenda:", error);
  return ((data ?? []) as AreaCultura[]).map((a) => ({
    cultura: a.cultura,
    area_ha: Number(a.area_ha),
    produtividade_sc_ha: a.produtividade_sc_ha === null ? null : Number(a.produtividade_sc_ha),
    margem_alvo_pct:
      a.margem_alvo_pct === null || a.margem_alvo_pct === undefined
        ? null
        : Number(a.margem_alvo_pct),
    aviso_venda_ativo: a.aviso_venda_ativo !== false,
    ultimo_aviso_em: a.ultimo_aviso_em ?? null,
    ultimo_aviso_preco:
      a.ultimo_aviso_preco === null || a.ultimo_aviso_preco === undefined
        ? null
        : Number(a.ultimo_aviso_preco),
  }));
}

export async function salvarArea(
  supabase: SupabaseClient,
  produtorId: string,
  a: AreaCultura,
): Promise<boolean> {
  const { error } = await supabase.from("fazenda_areas").upsert(
    {
      produtor_id: produtorId,
      cultura: normalizarCultura(a.cultura),
      area_ha: a.area_ha,
      produtividade_sc_ha: a.produtividade_sc_ha,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "produtor_id,cultura" },
  );
  if (error) console.error("Erro ao salvar a área da cultura:", error);
  return !error;
}

/** Guarda a meta de margem da cultura (precisa já ter a área). Devolve false se não achou a cultura ou deu erro. */
export async function salvarMetaDeMargem(
  supabase: SupabaseClient,
  produtorId: string,
  cultura: string,
  metaPct: number | null,
  avisoAtivo?: boolean,
): Promise<boolean> {
  const mudanca: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (metaPct !== undefined) mudanca["margem_alvo_pct"] = metaPct;
  if (avisoAtivo !== undefined) mudanca["aviso_venda_ativo"] = avisoAtivo;
  if (metaPct !== null) {
    // meta nova: o aviso pode disparar de novo
    mudanca["ultimo_aviso_em"] = null;
    mudanca["ultimo_aviso_preco"] = null;
  }
  const { data, error } = await supabase
    .from("fazenda_areas")
    .update(mudanca)
    .eq("produtor_id", produtorId)
    .eq("cultura", normalizarCultura(cultura))
    .select("id");
  if (error) console.error("Erro ao salvar a meta de margem:", error);
  return !error && (data ?? []).length > 0;
}

/** Média da Conab do estado em sacas por hectare (safra mais recente com dado). */
export async function produtividadeConab(
  supabase: SupabaseClient,
  cultura: string,
  uf: string | null,
): Promise<{ scHa: number; safra: string } | null> {
  if (!uf) return null;
  try {
    const r = await buscarProducaoHistoricaConab(supabase, { produto: cultura, uf });
    if (!("disponivel" in r) || !r.disponivel || !("atual" in r) || !r.atual) return null;
    const kg = r.atual.produtividade_kg_ha;
    if (!kg || kg <= 0) return null;
    return { scHa: Math.round((kg / kgPorSaca(cultura)) * 10) / 10, safra: r.atual.safra };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Conta
// ---------------------------------------------------------------------------------------------

export type CustoDaCultura = {
  cultura: string;
  area: AreaCultura;
  gastosDaCultura: number;
  gastosSemCulturaIncluidos: number;
  gastosSemCulturaFora: number;
  conta: ReturnType<typeof calcularCustoEMargem>;
  produtividadeUsada: number | null;
  origemProdutividade: "colhido" | "informada" | "conab" | null;
  safraConab: string | null;
  preco: { preco: number; uf: string } | null;
  rotuloSafra: string;
};

/** Faz a conta de uma cultura com os lançamentos da safra. `registrosDaSafra` já vem sem pendente e sem rascunho. */
export async function custoDaCultura(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  area: AreaCultura,
  todasAsAreas: AreaCultura[],
  registrosDaSafra: RegistroFazenda[],
  rotuloSafra: string,
): Promise<CustoDaCultura> {
  const soma = somarGastosDaCultura(registrosDaSafra, area.cultura, todasAsAreas.length);
  const gastosDaCultura = soma.daCultura;
  const somaSem = soma.semCulturaIncluidos + soma.semCulturaFora;
  const incluiSem = soma.semCulturaIncluidos > 0 || todasAsAreas.length === 1;
  const resumo = resumir(registrosDaSafra);
  const colhido = resumo.colhidoPorCultura.find(
    (c) => mesmaCultura(c.cultura, area.cultura) && /saca/i.test(c.unidade ?? ""),
  );
  const conab = area.produtividade_sc_ha
    ? null
    : await produtividadeConab(supabase, area.cultura, produtor.uf);
  const preco = await precoDeHoje(supabase, produtor, area.cultura);
  const conta = calcularCustoEMargem({
    gastos: gastosDaCultura + (incluiSem ? somaSem : 0),
    area_ha: area.area_ha,
    produtividade_sc_ha: area.produtividade_sc_ha,
    produtividadeConab: conab?.scHa ?? null,
    sacasColhidas: colhido?.quantidade ?? null,
    precoHoje: preco?.preco ?? null,
  });
  const produtividadeUsada =
    conta.sacas && area.area_ha > 0 ? Math.round((conta.sacas / area.area_ha) * 10) / 10 : null;
  return {
    cultura: area.cultura,
    area,
    gastosDaCultura,
    gastosSemCulturaIncluidos: incluiSem ? somaSem : 0,
    gastosSemCulturaFora: incluiSem ? 0 : somaSem,
    conta,
    produtividadeUsada,
    origemProdutividade: conta.sacasOrigem,
    safraConab: conab?.safra ?? null,
    preco,
    rotuloSafra,
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function textoDoCusto(c: CustoDaCultura, uf: string | null): string {
  const L: string[] = [];
  const nome = c.cultura.toLowerCase();
  L.push(`Custo e margem da ${nome}, ${c.rotuloSafra}`);
  L.push("");
  L.push(`Área: ${formatarQuantidade(c.area.area_ha)} ha`);
  const gastoTotal = c.conta.gastos;
  if (gastoTotal <= 0) {
    L.push(
      `Você ainda não lançou gastos de ${nome} nesta safra, então não dá pra calcular o custo.`,
    );
    L.push('Pra lançar é só escrever, por exemplo: "gastei 12 mil de adubo na soja".');
    return L.join("\n");
  }
  L.push(
    `Gastos lançados: ${formatarReais(gastoTotal)} (${formatarReais(c.conta.custoPorHa)} por hectare)`,
  );
  if (c.gastosSemCulturaIncluidos > 0) {
    L.push(
      `  incluindo ${formatarReais(c.gastosSemCulturaIncluidos)} lançados sem cultura, que contei como da ${nome}`,
    );
  }
  if (c.conta.sacas) {
    const como =
      c.origemProdutividade === "colhido"
        ? "o que você colheu e lançou"
        : c.origemProdutividade === "informada"
          ? `${formatarQuantidade(c.produtividadeUsada ?? 0)} sacas por hectare, que você informou`
          : `${formatarQuantidade(c.produtividadeUsada ?? 0)} sacas por hectare, média da Conab${
              uf ? ` em ${uf}` : ""
            }${c.safraConab ? ` (safra ${c.safraConab})` : ""}`;
    L.push(`Produção considerada: ${formatarQuantidade(c.conta.sacas)} sacas (${como})`);
    if (c.conta.colheitaParcial !== null) {
      L.push(
        `  Você já lançou ${formatarQuantidade(c.conta.colheitaParcial)} sacas colhidas, mas a colheita ainda parece parcial, então usei a estimativa.`,
      );
    }
  }
  if (c.conta.custoPorSaca !== null) {
    L.push(`Custo por saca: ${formatarReais(c.conta.custoPorSaca)}`);
  } else {
    L.push(
      "Não consegui estimar a produção. Me diga quantas sacas por hectare você espera colher.",
    );
  }
  if (c.preco && c.conta.margemPorSaca !== null) {
    L.push("");
    L.push(
      `Preço de hoje${c.preco.uf ? ` em ${c.preco.uf}` : ""}: ${formatarReais(c.preco.preco)} a saca`,
    );
    const sinal = c.conta.margemPorSaca >= 0 ? "Margem estimada" : "Resultado estimado";
    L.push(
      `${sinal}: ${formatarReais(Math.abs(c.conta.margemPorSaca))} por saca${
        c.conta.margemPorSaca < 0 ? " NEGATIVA" : ""
      }${c.conta.margemPct !== null ? ` (${formatarQuantidade(Math.abs(c.conta.margemPct))}% do preço)` : ""}`,
    );
  }
  L.push("");
  L.push(
    "É uma estimativa: conta só o que foi lançado no caderno. Arrendamento, juros e o que você não anotou ficam de fora, então a margem real tende a ser menor.",
  );
  if (c.gastosSemCulturaFora > 0) {
    L.push(
      `Tem ${formatarReais(c.gastosSemCulturaFora)} lançados sem cultura que não entraram. Se forem da ${nome}, dá pra ajustar no painel.`,
    );
  }
  if (c.conta.custoPorSaca !== null) {
    const piso = Math.ceil(c.conta.custoPorSaca);
    L.push(
      `Pra ser avisado se o preço chegar perto do seu custo, é só pedir: "me avisa se a ${nome} ficar abaixo de R$ ${piso}".`,
    );
  }
  return L.join("\n");
}

/** Linha curta para o resumo da fazenda. */
export function linhaCurtaDoCusto(c: CustoDaCultura): string | null {
  if (c.conta.custoPorSaca === null) return null;
  const margem =
    c.conta.margemPct !== null
      ? `, margem de ${formatarQuantidade(c.conta.margemPct)}% sobre o preço de hoje`
      : "";
  return `${cap(c.cultura.toLowerCase())}: custo de ${formatarReais(c.conta.custoPorSaca)} por saca${margem}`;
}

// ---------------------------------------------------------------------------------------------
// Pedidos e respostas por código
// ---------------------------------------------------------------------------------------------

/** "custo por saca", "minha margem", "estou no lucro?", "custo por hectare". */
export function ehPedidoDeCusto(texto: string): boolean {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.split(" ").length > 12 || /\d/.test(t)) return false;
  return /\b(custo (por|da|de|do) (saca|hectare|ha|producao|lavoura|safra|plantio)|quanto (custa|esta custando|me custa) (produzir|a saca|cada saca|plantar)|minha margem|margem (da|de|por|do) (soja|milho|saca|safra|lavoura|cultura|cafe|trigo|feijao|arroz|algodao)|(estou|to|tou|esta|ta) (no )?(lucro|prejuizo|ganhando|perdendo)|ponto de equilibrio|lucro (da|por) (saca|safra))\b/.test(
    t,
  );
}

function numeroDe(s: string): number | null {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Hectares e sacas por hectare escritos na mensagem ("500 hectares", "60 sacas por hectare", "60 sc/ha"). */
export function areaEProdutividadeDoTexto(texto: string): {
  area_ha: number | null;
  produtividade: number | null;
} {
  const t = SEM_ACENTO(texto);
  let produtividade: number | null = null;
  const pm = t.match(/(\d[\d.,]*)\s*(?:sacas?|sc)\s*(?:por|\/|a)\s*(?:hectare|ha)\b/);
  if (pm) produtividade = numeroDe(pm[1]!);
  const semProd = pm ? t.replace(pm[0], " ") : t;
  let area: number | null = null;
  const am = semProd.match(/(\d[\d.,]*)\s*(?:mil\s*)?(?:hectares?|ha)\b/);
  if (am) {
    const base = numeroDe(am[1]!);
    area = base !== null && /mil\s*(?:hectares?|ha)/.test(am[0]) ? base * 1000 : base;
  }
  if (area !== null && (area <= 0 || area > 5_000_000)) area = null;
  if (produtividade !== null && (produtividade < 1 || produtividade > 500)) produtividade = null;
  return { area_ha: area, produtividade };
}

/** "minha área de soja é 500 hectares", "planto 800 ha de milho": guarda a área. */
export function areaDeCulturaPorFrase(
  texto: string,
): { cultura: string; area_ha: number; produtividade: number | null } | null {
  const t = SEM_ACENTO(texto);
  if (t.includes("?") || t.split(" ").length > 22) return null;
  if (!/\b(planto|plantei|plantamos|tenho|minha area|area de|area da|area com|cultivo)\b/.test(t))
    return null;
  const { area_ha, produtividade } = areaEProdutividadeDoTexto(texto);
  const cultura = culturaMencionada(texto);
  if (!area_ha || !cultura) return null;
  return { cultura, area_ha, produtividade };
}

export async function tratarPedidoDeCusto(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  texto: string,
): Promise<string | null> {
  if (!produtor.id) return null;
  const areas = await lerAreas(supabase, produtor.id);
  const citada = culturaMencionada(texto);
  const cultura = citada ?? (areas.length === 1 ? areas[0]!.cultura : produtor.cultura_principal);
  if (areas.length === 0 || !cultura) {
    const nome = (cultura ?? "soja").toLowerCase();
    return `Pra calcular o custo por saca eu preciso da área. ${MARCA_PERGUNTA_AREA}${nome} você planta? Se souber, diga também as sacas por hectare, por exemplo: "500 hectares, 60 sacas por hectare".`;
  }
  const alvo = areas.find((a) => mesmaCultura(a.cultura, cultura));
  if (!alvo) {
    return `Ainda não tenho a área da ${cultura.toLowerCase()}. ${MARCA_PERGUNTA_AREA}${cultura.toLowerCase()} você planta? Se souber, diga também as sacas por hectare.`;
  }
  const { registros, rotulo } = await lerRegistros(supabase, produtor.id, "safra");
  const c = await custoDaCultura(supabase, produtor, alvo, areas, registros, rotulo);
  return textoDoCusto(c, produtor.uf);
}

/**
 * Resposta à pergunta "Quantos hectares de soja você planta?": guarda a área (e a produtividade, se veio) e já
 * devolve a conta. null quando a mensagem não é resposta a essa pergunta.
 */
export async function tratarRespostaDeArea(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  texto: string,
  historico: HistoricoLinha[],
): Promise<string | null> {
  if (!produtor.id) return null;
  const anterior = ultimaDoBot(historico);
  if (!anterior || !anterior.includes(MARCA_PERGUNTA_AREA)) return null;
  const m = anterior.match(/Quantos hectares de ([^\s?]+(?: [^\s?]+)?) você planta/);
  const cultura = m ? (culturaMencionada(m[1]!) ?? normalizarCultura(m[1]!)) : null;
  if (!cultura) return null;
  const { area_ha, produtividade } = areaEProdutividadeDoTexto(extensoParaDigitos(texto));
  // resposta só com o número ("500", "quinhentos") vale como hectares
  const solto = extensoParaDigitos(texto)
    .trim()
    .match(/^(\d[\d.,]*)$/);
  const area = area_ha ?? (solto ? numeroDe(solto[1]!) : null);
  if (!area || area <= 0 || area > 5_000_000) return null;
  const ok = await salvarArea(supabase, produtor.id, {
    cultura,
    area_ha: area,
    produtividade_sc_ha: produtividade,
  });
  if (!ok)
    return "Não consegui guardar a área agora. Tente de novo em instantes, ou informe no painel, na tela Fazenda.";
  const areas = await lerAreas(supabase, produtor.id);
  const alvo = areas.find((a) => mesmaCultura(a.cultura, cultura))!;
  // a pergunta pode trazer uma meta de margem ("Pra definir a meta de 25% de margem da soja eu preciso da área")
  const metaDaPergunta = anterior.match(/meta de (\d{1,2}(?:[.,]\d+)?)% de margem/);
  let metaSalva: number | null = null;
  if (metaDaPergunta) {
    const pct = Number(metaDaPergunta[1]!.replace(",", "."));
    if (
      pct >= 3 &&
      pct <= 90 &&
      (await salvarMetaDeMargem(supabase, produtor.id, cultura, pct, true))
    ) {
      metaSalva = pct;
      alvo.margem_alvo_pct = pct;
    }
  }
  const { registros, rotulo } = await lerRegistros(supabase, produtor.id, "safra");
  const c = await custoDaCultura(supabase, produtor, alvo, areas, registros, rotulo);
  let extra = "";
  if (metaSalva !== null) {
    const precoAlvo =
      c.conta.custoPorSaca !== null ? precoAlvoDaMargem(c.conta.custoPorSaca, metaSalva) : null;
    extra = `\n\nMeta de margem guardada: ${formatarQuantidade(metaSalva)}%. Eu te aviso aqui no WhatsApp quando a margem chegar nela, no máximo uma vez por dia.${
      precoAlvo !== null
        ? ` Com o seu custo, o preço-alvo é ${formatarReais(precoAlvo)} a saca.`
        : ""
    }`;
  }
  return `Anotei: ${formatarQuantidade(area)} ha de ${cultura.toLowerCase()}.\n\n${textoDoCusto(c, produtor.uf)}${extra}`;
}

/** "minha área de soja é 500 hectares" fora de uma pergunta: guarda e confirma. */
export async function tratarAreaDeFrase(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  texto: string,
): Promise<string | null> {
  if (!produtor.id) return null;
  const a = areaDeCulturaPorFrase(texto);
  if (!a) return null;
  const ok = await salvarArea(supabase, produtor.id, {
    cultura: a.cultura,
    area_ha: a.area_ha,
    produtividade_sc_ha: a.produtividade,
  });
  if (!ok) return null;
  return `Anotei: ${formatarQuantidade(a.area_ha)} ha de ${a.cultura.toLowerCase()}${
    a.produtividade ? `, ${formatarQuantidade(a.produtividade)} sacas por hectare` : ""
  }. Agora é só pedir "custo por saca" que eu calculo a sua margem com o que você lançou de gasto.`;
}

export { intervaloDoPeriodo };
