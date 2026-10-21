/**
 * Caderno da fazenda no WhatsApp: lançar gasto, venda, plantio e colheita por mensagem (ou áudio, que
 * o n8n já transcreve), pedir o resumo e desfazer o último lançamento. O painel lê a mesma tabela
 * (`fazenda_registros`).
 *
 * Regra de ouro: o modelo só ENTENDE a frase e preenche os campos. O que vai para o caderno é
 * conferido por código (o valor tem que estar escrito na conversa), e a confirmação que o produtor lê
 * é montada por código com o que foi gravado de fato, nunca com o que o modelo "acha" que gravou.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CATEGORIAS_GASTO,
  TIPOS_REGISTRO,
  categoriaDeTexto,
  categoriaValida,
  dataCurta,
  descreverRegistro,
  formatarQuantidade,
  formatarReais,
  hojeBrasilia,
  intervaloDoPeriodo,
  numerosDoTexto,
  resumir,
  somarDias,
  valorConfere,
  type PeriodoCaderno,
  type RegistroFazenda,
  type TipoRegistro,
} from "@/lib/fazenda.shared";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { ProdutorContexto } from "@/lib/bot/types";
import { buscarPreco } from "@/lib/bot/tools/preco";

/** Marca que aparece em toda confirmação, para o "desfazer" saber de que se trata. */
export const MARCA_CONFIRMACAO_CADERNO = "Anotei no caderno";

const COLUNAS =
  "id, tipo, ocorrido_em, valor, descricao, categoria, cultura, talhao, quantidade, unidade, preco_unitario, origem, criado_em";

type ArgsRegistro = {
  tipo: string;
  descricao?: string | null;
  valor?: number | null;
  cultura?: string | null;
  talhao?: string | null;
  categoria?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
  preco_unitario?: number | null;
  data?: string | null;
};

export type ResultadoRegistro =
  | { sucesso: true; duplicado: boolean; confirmacao: string; registro: RegistroFazenda }
  | {
      sucesso: false;
      motivo:
        | "sem_cadastro"
        | "tipo_invalido"
        | "faltou_valor"
        | "faltou_descricao"
        | "parece_plano_ou_pergunta"
        | "numero_nao_confere"
        | "conta_nao_fecha"
        | "data_invalida"
        | "erro_ao_gravar";
      detalhe?: string;
    };

const numeroOuNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

const textoOuNull = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max) : null;
};

const UNIDADES: Record<string, string> = {
  saca: "sacas",
  sacas: "sacas",
  sc: "sacas",
  sacos: "sacas",
  arroba: "arrobas",
  arrobas: "arrobas",
  "@": "arrobas",
  ha: "ha",
  hectare: "ha",
  hectares: "ha",
  alqueire: "alqueires",
  alqueires: "alqueires",
  kg: "kg",
  quilo: "kg",
  quilos: "kg",
  tonelada: "t",
  toneladas: "t",
  t: "t",
  litro: "L",
  litros: "L",
  l: "L",
  cabeca: "cabeças",
  cabecas: "cabeças",
  cabeça: "cabeças",
  cabeças: "cabeças",
};

function unidadePadrao(u: string | null): string | null {
  if (!u) return null;
  const k = u.trim().toLowerCase();
  return UNIDADES[k] ?? textoOuNull(k, 20);
}

/** Números que a pessoa escreveu nesta mensagem e nas últimas dela (o valor pode ter vindo antes). */
function numerosDaConversa(texto: string, historico: HistoricoLinha[]): number[] {
  const recentes = [...historico]
    .filter((h) => h.role === "user")
    .sort((a, b) => b.ordem - a.ordem)
    .slice(0, 4)
    .map((h) => h.conteudo);
  return numerosDoTexto([texto, ...recentes].join(" \n "));
}

export async function registrarNaFazenda(
  supabase: SupabaseClient,
  args: ArgsRegistro,
  ctx: { produtor: ProdutorContexto; texto: string; historico: HistoricoLinha[] },
): Promise<ResultadoRegistro> {
  const { produtor } = ctx;
  if (!produtor.id) return { sucesso: false, motivo: "sem_cadastro" };
  if (!TIPOS_REGISTRO.includes(args.tipo as TipoRegistro)) {
    return { sucesso: false, motivo: "tipo_invalido" };
  }
  const tipo = args.tipo as TipoRegistro;
  const hoje = hojeBrasilia();

  // Plano ("vou comprar adubo semana que vem") e pergunta ("e se eu vendesse a 140?") não são
  // lançamentos. Quando a pessoa só está respondendo "quanto foi?", a mensagem de agora é só o número.
  if (ehPlanoOuHipotese(ctx.texto) && !ehContinuacaoDeLancamento(ctx.texto, ctx.historico)) {
    return {
      sucesso: false,
      motivo: "parece_plano_ou_pergunta",
      detalhe:
        "isso soa como plano ou pergunta, não como algo que já aconteceu; não anote. Diga que quando acontecer é só avisar",
    };
  }

  // A data escrita pela pessoa ("ontem", "dia 15") vale mais que a que o modelo calculou.
  const data = dataDoTexto(ctx.texto, hoje) ?? textoOuNull(args.data, 10) ?? hoje;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
    data > somarDias(hoje, 1) ||
    data < somarDias(hoje, -900)
  ) {
    return { sucesso: false, motivo: "data_invalida", detalhe: `hoje é ${hoje}` };
  }

  let valor = numeroOuNull(args.valor);
  const quantidade = numeroOuNull(args.quantidade);
  const precoUnitario = numeroOuNull(args.preco_unitario);
  const conversa = numerosDaConversa(ctx.texto, ctx.historico);

  if (tipo === "gasto" || tipo === "venda") {
    if (valor === null && quantidade !== null && precoUnitario !== null) {
      valor = Math.round(quantidade * precoUnitario * 100) / 100;
    }
    if (valor === null || valor <= 0) return { sucesso: false, motivo: "faltou_valor" };
    // Valor, quantidade e preço têm que estar escritos na conversa. Quando o valor é a conta
    // quantidade x preço, basta os dois fatores estarem escritos.
    const contaDosFatores =
      quantidade !== null &&
      precoUnitario !== null &&
      Math.abs(valor - quantidade * precoUnitario) <= Math.max(0.5, valor * 0.002);
    if (
      !valorConfere(valor, conversa) &&
      !(
        contaDosFatores &&
        valorConfere(quantidade!, conversa) &&
        valorConfere(precoUnitario!, conversa)
      )
    ) {
      return {
        sucesso: false,
        motivo: "numero_nao_confere",
        detalhe: `o valor ${valor} não aparece como está escrito na conversa; confirme o valor com o produtor`,
      };
    }
    if (
      quantidade !== null &&
      precoUnitario !== null &&
      !contaDosFatores &&
      Math.abs(valor - quantidade * precoUnitario) > Math.max(1, valor * 0.01)
    ) {
      return {
        sucesso: false,
        motivo: "conta_nao_fecha",
        detalhe: `${quantidade} x ${precoUnitario} dá ${Math.round(quantidade * precoUnitario * 100) / 100}, não ${valor}; peça pro produtor confirmar`,
      };
    }
  } else if (quantidade !== null && !valorConfere(quantidade, conversa)) {
    return {
      sucesso: false,
      motivo: "numero_nao_confere",
      detalhe: `a quantidade ${quantidade} não aparece como está escrita na conversa`,
    };
  }

  let cultura = textoOuNull(args.cultura, 40);
  // "plantei milho": o modelo às vezes põe o milho só na descrição
  if (!cultura && (tipo === "plantio" || tipo === "colheita")) {
    const d = textoOuNull(args.descricao, 40);
    if (d && d.split(" ").length <= 3 && !/\d/.test(d))
      cultura = d.replace(/^(plantio|colheita) de /i, "");
  }
  const talhao = textoOuNull(args.talhao, 60);
  let descricao = textoOuNull(args.descricao, 200);
  if (!descricao) {
    if (tipo === "plantio") descricao = `Plantio${cultura ? ` de ${cultura.toLowerCase()}` : ""}`;
    else if (tipo === "colheita")
      descricao = `Colheita${cultura ? ` de ${cultura.toLowerCase()}` : ""}`;
    else if (tipo === "venda") descricao = `Venda${cultura ? ` de ${cultura.toLowerCase()}` : ""}`;
    else return { sucesso: false, motivo: "faltou_descricao" };
  }
  const categoria = tipo === "gasto" ? categoriaValida(args.categoria, descricao) : null;
  const unidade =
    unidadePadrao(args.unidade ?? null) ?? (quantidade !== null ? unidadeDoTexto(ctx.texto) : null);

  // Mensagem repetida em segundos (o WhatsApp reenvia, o produtor toca duas vezes): não lança em dobro.
  const dezMinutos = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: recentes } = await supabase
    .from("fazenda_registros")
    .select(COLUNAS)
    .eq("produtor_id", produtor.id)
    .eq("tipo", tipo)
    .eq("ocorrido_em", data)
    .is("apagado_em", null)
    .gte("criado_em", dezMinutos);
  const repetido = ((recentes ?? []) as RegistroFazenda[]).find(
    (r) =>
      (r.valor ?? null) === (valor ?? null) &&
      r.descricao.toLowerCase() === descricao!.toLowerCase() &&
      (r.cultura ?? null) === (cultura ?? null),
  );
  if (repetido) {
    return {
      sucesso: true,
      duplicado: true,
      registro: repetido,
      confirmacao: `${MARCA_CONFIRMACAO_CADERNO}: ${descreverRegistro(repetido).slice(7)}. Esse eu já tinha lançado agora mesmo, então não repeti.`,
    };
  }

  const { data: gravado, error } = await supabase
    .from("fazenda_registros")
    .insert({
      produtor_id: produtor.id,
      tipo,
      ocorrido_em: data,
      valor: tipo === "gasto" || tipo === "venda" ? valor : null,
      descricao,
      categoria,
      cultura,
      talhao,
      quantidade,
      unidade,
      preco_unitario:
        precoUnitario ??
        (tipo === "venda" && valor && quantidade
          ? Math.round((valor / quantidade) * 100) / 100
          : null),
      origem: "whatsapp",
    })
    .select(COLUNAS)
    .single();
  if (error || !gravado) {
    console.error("Erro ao gravar no caderno da fazenda:", error);
    return { sucesso: false, motivo: "erro_ao_gravar" };
  }
  const registro = gravado as RegistroFazenda;
  const confirmacao = await montarConfirmacao(supabase, produtor, registro);
  return { sucesso: true, duplicado: false, registro, confirmacao };
}

// ---------------------------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------------------------

async function lerRegistros(
  supabase: SupabaseClient,
  produtorId: string,
  periodo: PeriodoCaderno,
): Promise<{ registros: RegistroFazenda[]; rotulo: string; erro: boolean }> {
  const { desde, ate, rotulo } = intervaloDoPeriodo(periodo);
  const { data, error } = await supabase
    .from("fazenda_registros")
    .select(COLUNAS)
    .eq("produtor_id", produtorId)
    .is("apagado_em", null)
    .gte("ocorrido_em", desde)
    .lte("ocorrido_em", ate)
    .order("ocorrido_em", { ascending: false })
    .limit(3000);
  if (error) console.error("Erro ao ler o caderno da fazenda:", error);
  return { registros: (data ?? []) as RegistroFazenda[], rotulo, erro: !!error };
}

/** Preço de mercado hoje da cultura vendida, só para colocar ao lado do que o produtor recebeu. */
async function precoDeHoje(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  cultura: string | null,
): Promise<{ preco: number; uf: string } | null> {
  if (!cultura || !produtor.uf) return null;
  try {
    const r = await buscarPreco(
      supabase,
      { produto: cultura.toUpperCase(), uf: produtor.uf, incluir_frete: false },
      { lat: produtor.lat, lon: produtor.lon, culturaCadastrada: produtor.cultura_principal },
    );
    if (!r.encontrado || !r.precos?.length) return null;
    const saca = r.precos.filter((p) => /sc|saca/i.test(p.unidade ?? ""));
    const base = r.preco_medio_regioes ?? saca[0]?.preco ?? null;
    return typeof base === "number" && base > 0 ? { preco: base, uf: produtor.uf } : null;
  } catch {
    return null;
  }
}

async function montarConfirmacao(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  r: RegistroFazenda,
): Promise<string> {
  const { registros, rotulo } = await lerRegistros(supabase, produtor.id!, "mes");
  const mes = resumir(registros);
  const linha = descreverRegistro(r).slice(7).trim();
  let extra = "";
  if (r.tipo === "gasto") {
    extra = ` Em ${rotulo} você já lançou ${formatarReais(mes.gastos)} em gastos.`;
  } else if (r.tipo === "venda") {
    extra = ` Em ${rotulo}: ${formatarReais(mes.vendas)} em vendas e ${formatarReais(mes.gastos)} em gastos.`;
    if (r.preco_unitario && /saca/i.test(r.unidade ?? "")) {
      const hoje = await precoDeHoje(supabase, produtor, r.cultura);
      if (hoje) {
        const dif = r.preco_unitario - hoje.preco;
        extra += ` Pra comparar: hoje o mercado em ${hoje.uf} está em ${formatarReais(hoje.preco)} a saca (${
          Math.abs(dif) < 0.005
            ? "igual ao seu preço"
            : dif > 0
              ? `você vendeu ${formatarReais(dif)} acima`
              : `você vendeu ${formatarReais(-dif)} abaixo`
        }).`;
      }
    }
  }
  return `${MARCA_CONFIRMACAO_CADERNO}: ${linha}.${extra} Se algo ficou errado, diga "desfazer".`;
}

export type ResultadoResumo = {
  vazio: boolean;
  texto: string;
};

/** Resumo pronto para mandar (texto montado por código, números todos do banco). */
export async function resumoDaFazenda(
  supabase: SupabaseClient,
  args: { periodo?: string | null; categoria?: string | null; cultura?: string | null },
  produtor: ProdutorContexto,
): Promise<ResultadoResumo | { erro: "sem_cadastro" | "erro_ao_ler" }> {
  if (!produtor.id) return { erro: "sem_cadastro" };
  const periodo = (["mes", "mes_passado", "safra", "ano", "tudo"] as const).includes(
    args.periodo as PeriodoCaderno,
  )
    ? (args.periodo as PeriodoCaderno)
    : "mes";
  const lido = await lerRegistros(supabase, produtor.id, periodo);
  if (lido.erro) return { erro: "erro_ao_ler" };
  let registros = lido.registros;
  const catBruta = textoOuNull(args.categoria, 40);
  const catMapeada = catBruta ? categoriaDeTexto(catBruta) : null;
  const filtroCat = (catMapeada && catMapeada !== "Outros" ? catMapeada : catBruta)?.toLowerCase();
  const filtroCult = textoOuNull(args.cultura, 40)?.toLowerCase();
  if (filtroCat) {
    registros = registros.filter(
      (r) => r.tipo === "gasto" && (r.categoria ?? "").toLowerCase().includes(filtroCat),
    );
  }
  if (filtroCult)
    registros = registros.filter((r) => (r.cultura ?? "").toLowerCase().includes(filtroCult));

  if (registros.length === 0 && !filtroCat && !filtroCult && periodo === "mes") {
    const todos = await lerRegistros(supabase, produtor.id, "tudo");
    if (todos.registros.length === 0) return { vazio: true, texto: textoCadernoVazio() };
  }
  const r = resumir(registros);
  const linhas: string[] = [];
  const titulo =
    filtroCat || filtroCult ? `${lido.rotulo}, só ${filtroCat ?? filtroCult}` : lido.rotulo;
  linhas.push(`Caderno da fazenda, ${titulo}`);
  linhas.push("");
  if (registros.length === 0) {
    linhas.push("Nada lançado nesse período.");
  } else {
    if (r.nGastos > 0) {
      linhas.push(
        `Gastos: ${formatarReais(r.gastos)} (${r.nGastos} ${r.nGastos === 1 ? "lançamento" : "lançamentos"})`,
      );
      for (const c of r.porCategoria.slice(0, 4))
        linhas.push(`  • ${c.categoria}: ${formatarReais(c.total)}`);
      if (r.porCategoria.length > 4) {
        const resto = r.porCategoria.slice(4).reduce((s, c) => s + c.total, 0);
        linhas.push(`  • Outras categorias: ${formatarReais(resto)}`);
      }
    }
    if (r.nVendas > 0) {
      linhas.push(
        `Vendas: ${formatarReais(r.vendas)} (${r.nVendas} ${r.nVendas === 1 ? "venda" : "vendas"})`,
      );
      for (const c of r.porCultura.filter((x) => x.venda > 0).slice(0, 3)) {
        const qtd =
          c.quantidadeVendida > 0 && c.unidadeVenda
            ? `${formatarQuantidade(c.quantidadeVendida)} ${c.unidadeVenda}`
            : null;
        const preco = c.precoMedioVenda ? ` a ${formatarReais(c.precoMedioVenda)} em média` : "";
        linhas.push(`  • ${c.cultura}: ${formatarReais(c.venda)}${qtd ? ` (${qtd}${preco})` : ""}`);
      }
    }
    if (!filtroCat && !filtroCult && (r.nGastos > 0 || r.nVendas > 0)) {
      const sinal = r.resultado >= 0 ? "a favor" : "no vermelho";
      linhas.push(`Resultado do que foi lançado: ${formatarReais(Math.abs(r.resultado))} ${sinal}`);
    }
    if (r.plantios.length > 0 || r.colheitas.length > 0) {
      linhas.push("Plantio e colheita:");
      for (const x of [...r.plantios.slice(0, 3), ...r.colheitas.slice(0, 3)]) {
        linhas.push(`  • ${descreverRegistro(x)}`);
      }
    }
    if (r.ultimos.length) {
      linhas.push("");
      linhas.push("Últimos lançamentos:");
      for (const u of r.ultimos.slice(0, 3)) linhas.push(`  • ${descreverRegistro(u)}`);
    }
  }

  // Mercado de hoje ao lado da venda média (só quando dá pra comparar de verdade).
  if (!filtroCat && periodo !== "tudo") {
    const principal = r.porCultura.find(
      (c) => c.precoMedioVenda && /saca/i.test(c.unidadeVenda ?? ""),
    );
    if (principal) {
      const hoje = await precoDeHoje(supabase, produtor, principal.cultura);
      if (hoje) {
        linhas.push("");
        linhas.push(
          `Sua venda média de ${principal.cultura.toLowerCase()} foi ${formatarReais(principal.precoMedioVenda!)} a saca; hoje o mercado em ${hoje.uf} está em ${formatarReais(hoje.preco)}.`,
        );
      }
    }
  }

  // O que vem pela frente (lembretes já criados).
  try {
    const { data: lembretes } = await supabase
      .from("lembretes")
      .select("titulo, enviar_em")
      .eq("produtor_id", produtor.id)
      .eq("status", "pendente")
      .gte("enviar_em", new Date().toISOString())
      .order("enviar_em", { ascending: true })
      .limit(3);
    if (lembretes && lembretes.length) {
      linhas.push("");
      linhas.push("Pra frente:");
      for (const l of lembretes as { titulo: string; enviar_em: string }[]) {
        const dia = hojeBrasilia(new Date(l.enviar_em));
        linhas.push(`  • ${dataCurta(dia)}  ${l.titulo}`);
      }
    }
  } catch {
    /* sem lembretes, segue */
  }

  linhas.push("");
  linhas.push(
    'Pra lançar é só escrever, por exemplo: "gastei 3 mil de diesel", "vendi 200 sacas a 135" ou "plantei milho dia 15". Para o mês passado, a safra ou o ano, é só pedir.',
  );
  return { vazio: false, texto: linhas.join("\n") };
}

function textoCadernoVazio(): string {
  return [
    "Seu caderno da fazenda ainda está vazio. Aqui você anota o que acontece na fazenda só escrevendo (ou mandando áudio), e depois pede o resumo quando quiser.",
    "",
    "Exemplos:",
    '  • "gastei 12 mil de adubo no talhão 3"',
    '  • "vendi 500 sacas de soja a 135"',
    '  • "plantei milho dia 15"',
    "",
    'Para ver tudo, escreva "resumo da fazenda". Também dá pra ver e editar no painel.',
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------
// Desfazer
// ---------------------------------------------------------------------------------------------

/** Apaga (soft delete) o último lançamento feito por aqui. */
export async function desfazerUltimoRegistro(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
): Promise<{ sucesso: boolean; texto: string }> {
  if (!produtor.id) return { sucesso: false, texto: "" };
  const { data } = await supabase
    .from("fazenda_registros")
    .select(COLUNAS)
    .eq("produtor_id", produtor.id)
    .eq("origem", "whatsapp")
    .is("apagado_em", null)
    .order("criado_em", { ascending: false })
    .limit(1);
  const ultimo = (data ?? [])[0] as RegistroFazenda | undefined;
  if (!ultimo) {
    return {
      sucesso: false,
      texto:
        "Não achei nenhum lançamento feito por aqui para desfazer. Se for um do painel, dá pra apagar lá na tela Fazenda.",
    };
  }
  const { error } = await supabase
    .from("fazenda_registros")
    .update({ apagado_em: new Date().toISOString() })
    .eq("id", ultimo.id)
    .eq("produtor_id", produtor.id);
  if (error) {
    console.error("Erro ao desfazer lançamento:", error);
    return {
      sucesso: false,
      texto: "Não consegui desfazer agora. Tenta de novo em instantes, ou apaga pelo painel.",
    };
  }
  return { sucesso: true, texto: `Pronto, apaguei: ${descreverRegistro(ultimo).slice(7).trim()}.` };
}

// ---------------------------------------------------------------------------------------------
// Ler o que a pessoa escreveu: data, unidade, plano futuro e "isto é um lançamento"
// ---------------------------------------------------------------------------------------------

const VERBOS_DE_LANCAMENTO =
  /\b(gastei|gastamos|paguei|pagamos|comprei|compramos|vendi|vendemos|plantei|plantamos|semeei|semeamos|colhi|colhemos|apliquei|aplicamos|pulverizei|abasteci|contratei|investi|desembolsei)\b/;
const MARCA_DE_PLANO_OU_DUVIDA =
  /\b(vou|vamos|pretendo|pretendemos|quero|queria|queremos|preciso|precisamos|devo|devia|planejo|planejamos|pensando em|se eu|e se|ser[aá] que|talvez|ia )\b/;

/** O produtor está contando algo que JÁ aconteceu (gastei, vendi, plantei...), sem ser pergunta nem plano. */
export function pareceLancamentoNoCaderno(texto: string): boolean {
  const t = SEM_ACENTO(texto);
  if (t.includes("?")) return false;
  return VERBOS_DE_LANCAMENTO.test(t) && !MARCA_DE_PLANO_OU_DUVIDA.test(t);
}

/** "Quanto foi?" respondido só com o número: continua um lançamento começado na mensagem anterior. */
export function ehContinuacaoDeLancamento(texto: string, historico: HistoricoLinha[]): boolean {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .trim();
  if (!t || t.split(/\s+/).length > 6 || !/\d/.test(t)) return false;
  const ultima = [...historico]
    .filter((h) => h.role === "assistant")
    .sort((a, b) => b.ordem - a.ordem)[0];
  return (
    !!ultima &&
    /\b(quanto (foi|custou|deu|pagou|gastou)|qual (foi )?o valor|valor total|quanto ficou)\b/i.test(
      SEM_ACENTO(ultima.conteudo),
    )
  );
}

/** Plano ou dúvida ("vou comprar adubo", "e se eu vendesse") sem nada que tenha acontecido. */
export function ehPlanoOuHipotese(texto: string): boolean {
  const t = SEM_ACENTO(texto);
  if (t.includes("?")) return true;
  return MARCA_DE_PLANO_OU_DUVIDA.test(t) && !VERBOS_DE_LANCAMENTO.test(t);
}

const MESES_ABREV: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

/** Data dita com todas as letras ("ontem", "dia 15", "15/10", "dia 3 de setembro"), em AAAA-MM-DD. */
export function dataDoTexto(texto: string, hoje: string): string | null {
  const t = SEM_ACENTO(texto);
  if (/\banteontem\b/.test(t)) return somarDias(hoje, -2);
  if (/\bontem\b/.test(t)) return somarDias(hoje, -1);
  if (/\bhoje\b/.test(t)) return hoje;
  const [ano, mes, dia] = hoje.split("-").map(Number) as [number, number, number];
  const monta = (a: number, m: number, d: number): string | null => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const iso = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    // 31 de fevereiro e afins: a data não existe
    return new Date(`${iso}T12:00:00Z`).getUTCDate() === d ? iso : null;
  };
  const barra = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (barra) {
    const a = barra[3] ? (barra[3].length === 2 ? 2000 + Number(barra[3]) : Number(barra[3])) : ano;
    let iso = monta(a, Number(barra[2]), Number(barra[1]));
    if (iso && !barra[3] && iso > hoje) iso = monta(ano - 1, Number(barra[2]), Number(barra[1]));
    return iso;
  }
  const porExtenso = t.match(
    /\bdia (\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/,
  );
  if (porExtenso) {
    const m = MESES_ABREV[porExtenso[2]!]!;
    let iso = monta(ano, m, Number(porExtenso[1]));
    if (iso && iso > hoje) iso = monta(ano - 1, m, Number(porExtenso[1]));
    return iso;
  }
  const soDia = t.match(/\bdia (\d{1,2})\b/);
  if (soDia) {
    const d = Number(soDia[1]);
    if (d <= dia) return monta(ano, mes, d);
    // dia que ainda não chegou neste mês: é do mês passado
    return mes === 1 ? monta(ano - 1, 12, d) : monta(ano, mes - 1, d);
  }
  return null;
}

/** Unidade escrita junto de um número ("500 sacas", "50 hectares", "30 arrobas"). */
export function unidadeDoTexto(texto: string): string | null {
  const t = SEM_ACENTO(texto);
  const m = t.match(
    /\d[\d.,]*\s*(?:mil\s*)?(sacas?|sacos?|sc|arrobas?|@|toneladas?|kg|quilos?|litros?|cabecas?|hectares?|ha|alqueires?)\b/,
  );
  return m ? unidadePadrao(m[1]!) : null;
}

/** "quanto gastei de adubo (esse mês)": o recorte pedido, para responder só o que foi perguntado. */
export function pedidoDeGastoPorCategoria(
  texto: string,
): { categoria: string | null; busca: string; periodo: PeriodoCaderno } | null {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = t.match(
    /^quanto (?:eu )?(?:gastei|paguei|gastamos) (?:de|com|em|no|na|nos|nas|do|da) (.+?)(?: (?:esse|este|neste|nesse|no|na|nesta|nessa|nos ultimos) (mes|ano|safra))?(?: ate agora| ate hoje)?$/,
  );
  if (!m) return null;
  const busca = m[1]!.trim();
  if (!busca || busca.split(" ").length > 4 || /^(ano|mes|safra|total|tudo|geral)$/.test(busca))
    return null;
  const cat = categoriaDeTexto(busca);
  const periodo: PeriodoCaderno = m[2] === "ano" ? "ano" : m[2] === "safra" ? "safra" : "mes";
  return { categoria: cat === "Outros" ? null : cat, busca, periodo };
}

// ---------------------------------------------------------------------------------------------
// Reconhecer o pedido por código (não depende do modelo)
// ---------------------------------------------------------------------------------------------

const SEM_ACENTO = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "resumo da fazenda", "meu caderno", "quanto gastei esse mês"... sem filtro de categoria. */
export function periodoDoPedidoDeResumo(texto: string): PeriodoCaderno | null {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.split(" ").length > 9) return null;
  const pedido =
    /\b(resumo|balanco|situacao|como (esta|ta|anda|andam)|panorama|extrato|relatorio)\b.*\b(fazenda|propriedade|caderno|gastos|contas)\b/.test(
      t,
    ) ||
    /\b(meu|ver o|abrir o|mostra o|mostrar o|manda o) caderno\b/.test(t) ||
    /\bcaderno da fazenda\b/.test(t) ||
    /^(quanto|o que) (eu )?(gastei|vendi|anotei|lancei)( (este|esse|no|neste|nesse|na|nessa|nesta) (mes|ano|safra))?( ate agora| ate hoje)?$/.test(
      t,
    ) ||
    /^(meus gastos|minhas vendas|meus lancamentos|minhas anotacoes)( (do|desse|deste|da|do ultimo) (mes|ano|safra))?$/.test(
      t,
    );
  if (!pedido) return null;
  if (/\bmes passado|ultimo mes|mes anterior\b/.test(t)) return "mes_passado";
  if (/\bsafra\b/.test(t)) return "safra";
  if (/\b(ano|2026|2025)\b/.test(t)) return "ano";
  if (/\b(tudo|total|geral|completo)\b/.test(t)) return "tudo";
  return "mes";
}

/**
 * "Desfazer"/"apaga o último lançamento". "Cancelar" fica de fora de propósito (é cancelamento de
 * assinatura). "Desfazer" sozinho só vale logo depois de uma confirmação do caderno.
 */
export function ehPedidoDeDesfazerRegistro(texto: string, historico: HistoricoLinha[]): boolean {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.split(" ").length > 7) return false;
  if (/\bcancel/.test(t)) return false;
  const verbo = /\b(desfaz\w*|desfeito|apag\w*|exclu\w*|remov\w*|tira\w*)\b/.test(t);
  if (!verbo) return false;
  if (/\b(ultimo|ultima|registro|lancamento|anotacao|anotei|lancei)\b/.test(t)) {
    return !/\b(conta|assinatura|plano|alerta|lembrete|cadastro|dados)\b/.test(t);
  }
  const ultimaDoBot = [...historico]
    .filter((h) => h.role === "assistant")
    .sort((a, b) => b.ordem - a.ordem)[0];
  return !!ultimaDoBot && ultimaDoBot.conteudo.includes(MARCA_CONFIRMACAO_CADERNO);
}

/** A resposta afirma que anotou, mas nenhuma anotação foi gravada nesta rodada. */
export function afirmaTerAnotadoNoCaderno(resposta: string): boolean {
  if (/\b(alerta|lembrete|aviso)\b/i.test(resposta)) return false;
  return /\b(anotei|anotado|registrei|registrado|lancei|lan[çc]ado|guardei)\b[^.\n]{0,60}\b(caderno|fazenda|gasto|venda|plantio|colheita)\b/i.test(
    resposta,
  );
}

export const CATEGORIAS_PARA_O_MODELO = CATEGORIAS_GASTO;
