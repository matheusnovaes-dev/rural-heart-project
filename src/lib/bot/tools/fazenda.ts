/**
 * Caderno da fazenda no WhatsApp: lançar gasto, venda, plantio e colheita por mensagem (ou áudio, que
 * o n8n já transcreve), a pagar e a receber com lembrete, resumo com custo por saca e desfazer. O painel
 * lê a mesma tabela (`fazenda_registros`).
 *
 * Regra de ouro: o modelo só ENTENDE a frase e preenche os campos. O que vai para o caderno é
 * conferido por código (o valor tem que estar escrito na conversa), e a confirmação que o produtor lê
 * é montada por código com o que foi gravado de fato, nunca com o que o modelo "acha" que gravou.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CATEGORIAS_GASTO,
  COLUNAS_REGISTRO,
  TIPOS_REGISTRO,
  categoriaDeTexto,
  categoriaValida,
  dataCurta,
  dataLonga,
  descreverRegistro,
  formatarQuantidade,
  formatarReais,
  fraseDeVencimento,
  hojeBrasilia,
  numerosDoTexto,
  resumirPendencias,
  resumir,
  somarDias,
  talhaoChave,
  valorConfere,
  type PeriodoCaderno,
  type RegistroFazenda,
  type TipoRegistro,
} from "@/lib/fazenda.shared";
import { culturaMencionada } from "@/config/culturas";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { ProdutorContexto } from "@/lib/bot/types";
import {
  MARCA_DE_PLANO_OU_DUVIDA,
  SEM_ACENTO,
  VERBOS_DE_LANCAMENTO,
  dataDoTexto,
  indicaPendencia,
  lerPendentes,
  lerRegistros,
  numeroOuNull,
  numerosDaConversa,
  precoDeHoje,
  textoOuNull,
  ultimaDoBot,
  unidadeDoTexto,
  unidadePadrao,
  vencimentoDoTexto,
} from "@/lib/bot/tools/fazendaBase";
import { cancelarLembrete, criarLembreteDoVencimento } from "@/lib/bot/tools/fazendaPendencias";
import { custoDaCultura, lerAreas, linhaCurtaDoCusto } from "@/lib/bot/tools/fazendaCusto";
import type { EstudoSalvo } from "@/lib/bot/propostas/tipos";

export { dataDoTexto, unidadeDoTexto, vencimentoDoTexto };

/** Marca que aparece em toda confirmação, para o "desfazer" saber de que se trata. */
export const MARCA_CONFIRMACAO_CADERNO = "Anotei no caderno";

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
  /** AAAA-MM-DD, só para a pagar ou a receber */
  vence_em?: string | null;
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
        | "faltou_vencimento"
        | "vencimento_invalido"
        | "parece_plano_ou_pergunta"
        | "numero_nao_confere"
        | "conta_nao_fecha"
        | "data_invalida"
        | "erro_ao_gravar";
      detalhe?: string;
    };

/** "vou receber/pagar" é pendência (vale lançar); o resto de "vou/quero/preciso" é plano. */
function temMarcaDePlano(t: string): boolean {
  const semPendencia = t.replace(
    /\b(vou|vai|vao|irei|irao|tenho que|tenho de|devo) (receber|pagar)\b/g,
    " ",
  );
  return MARCA_DE_PLANO_OU_DUVIDA.test(semPendencia);
}

/** Quando o bot perguntou "pra quando vence?" e a pessoa responde só a data. */
export function ehRespostaDeVencimento(texto: string, historico: HistoricoLinha[]): boolean {
  const anterior = ultimaDoBot(historico);
  if (!anterior) return false;
  if (
    !/\b(pra quando vence|qual (o )?vencimento|que dia (vence|voce recebe|você recebe|voce paga|você paga)|quando (vence|vai vencer))\b/i.test(
      SEM_ACENTO(anterior),
    )
  ) {
    return false;
  }
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.split(" ").length <= 8 && vencimentoDoTexto(texto, hojeBrasilia()) !== null;
}

/**
 * Se a conversa fala de dinheiro a RECEBER ou a PAGAR, devolve o tipo certo (venda ou gasto). A resposta "dia 25" a "Pra
 * quando vence?" não repete o verbo, e o modelo já trocou "vou receber" por "a pagar" (visto ao vivo).
 */
export function direcaoDaPendencia(
  texto: string,
  historico: HistoricoLinha[],
): "venda" | "gasto" | null {
  const mensagens = [
    texto,
    ...[...historico]
      .filter((h) => h.role === "user")
      .sort((a, b) => b.ordem - a.ordem)
      .slice(0, 3)
      .map((h) => h.conteudo),
  ];
  for (const m of mensagens) {
    const t = SEM_ACENTO(m);
    const recebe = /\b(receb\w*|a receber)\b/.test(t);
    const paga = /\b(pag\w*|a pagar|devo|dever)\b/.test(t);
    if (recebe && !paga) return "venda";
    if (paga && !recebe) return "gasto";
  }
  return null;
}

export async function registrarNaFazenda(
  supabase: SupabaseClient,
  args: ArgsRegistro,
  ctx: {
    produtor: ProdutorContexto;
    texto: string;
    historico: HistoricoLinha[];
    telefone?: string;
    estudo?: EstudoSalvo | null;
  },
): Promise<ResultadoRegistro> {
  const { produtor } = ctx;
  if (!produtor.id) return { sucesso: false, motivo: "sem_cadastro" };
  if (!TIPOS_REGISTRO.includes(args.tipo as TipoRegistro)) {
    return { sucesso: false, motivo: "tipo_invalido" };
  }
  let tipo = args.tipo as TipoRegistro;
  const hoje = hojeBrasilia();
  const tNorm = SEM_ACENTO(ctx.texto);
  // a pagar ou a receber: o tipo vem do verbo escrito (receber = venda, pagar = gasto), não da escolha do modelo
  if (
    (tipo === "gasto" || tipo === "venda") &&
    (indicaPendencia(ctx.texto) || ehRespostaDeVencimento(ctx.texto, ctx.historico))
  ) {
    const dir = direcaoDaPendencia(ctx.texto, ctx.historico);
    if (dir) tipo = dir;
  }

  // "vou receber 10 mil do milho" lançado como anotação: é a receber (venda) ou a pagar (gasto), com vencimento.
  if (
    tipo !== "gasto" &&
    tipo !== "venda" &&
    (indicaPendencia(ctx.texto) || ehRespostaDeVencimento(ctx.texto, ctx.historico)) &&
    /\d/.test(ctx.texto)
  ) {
    return {
      sucesso: false,
      motivo: "faltou_vencimento",
      detalhe:
        'isso é dinheiro a receber ou a pagar: refaça a chamada com tipo "venda" (a receber) ou "gasto" (a pagar), nunca "nota"; se a data de vencimento não foi dita, pergunte "Pra quando vence?"',
    };
  }

  // A pagar ou a receber: a mensagem fala de dinheiro que ainda vai sair ou entrar, com data.
  const querPendente =
    (tipo === "gasto" || tipo === "venda") &&
    (indicaPendencia(ctx.texto) || ehRespostaDeVencimento(ctx.texto, ctx.historico));

  // Plano ("vou comprar adubo semana que vem") e pergunta ("e se eu vendesse a 140?") não são
  // lançamentos. Quando a pessoa só está respondendo "quanto foi?", a mensagem de agora é só o número.
  const ehPergunta = tNorm.includes("?");
  const ehPlano = temMarcaDePlano(tNorm) && !VERBOS_DE_LANCAMENTO.test(tNorm);
  if (
    ehPergunta ||
    (ehPlano && !querPendente && !ehContinuacaoDeLancamento(ctx.texto, ctx.historico))
  ) {
    if (!(querPendente && !ehPergunta)) {
      return {
        sucesso: false,
        motivo: "parece_plano_ou_pergunta",
        detalhe:
          "isso soa como plano ou pergunta, não como algo que já aconteceu; não anote. Diga que quando acontecer é só avisar",
      };
    }
  }

  let situacao: "realizado" | "pendente" = "realizado";
  let venceEm: string | null = null;
  if (querPendente) {
    venceEm = vencimentoDoTexto(ctx.texto, hoje);
    if (!venceEm) {
      const doModelo = textoOuNull(args.vence_em, 10);
      if (doModelo && /^\d{4}-\d{2}-\d{2}$/.test(doModelo)) venceEm = doModelo;
    }
    if (!venceEm) {
      return {
        sucesso: false,
        motivo: "faltou_vencimento",
        detalhe: 'pergunte "Pra quando vence?" (uma pergunta só) e espere a data',
      };
    }
    if (venceEm < hoje || venceEm > somarDias(hoje, 900)) {
      return {
        sucesso: false,
        motivo: "vencimento_invalido",
        detalhe: `o vencimento ${venceEm} não é uma data futura razoável; hoje é ${hoje}; confirme a data com o produtor`,
      };
    }
    situacao = "pendente";
  }

  // A data escrita pela pessoa ("ontem", "dia 15") vale mais que a que o modelo calculou. Em a pagar e
  // a receber o "dia 30" é o vencimento, não o dia em que aconteceu.
  const dataEscrita =
    situacao === "pendente"
      ? /\b(ontem|anteontem|hoje)\b/.test(tNorm)
        ? dataDoTexto(ctx.texto, hoje)
        : null
      : dataDoTexto(ctx.texto, hoje);
  const data = dataEscrita ?? (situacao === "pendente" ? null : textoOuNull(args.data, 10)) ?? hoje;
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
  // Números do estudo de proposta recente também valem (o produtor fechou "a proposta do comprador B").
  const doEstudo = (ctx.estudo?.propostas ?? []).flatMap((p) =>
    [p.preco, p.quantidade].filter((n): n is number => typeof n === "number"),
  );
  const conversa = [
    ...numerosDaConversa(ctx.texto, ctx.historico),
    ...(ctx.estudo ? [...doEstudo, ctx.estudo.quantidadeInformada ?? 0] : []),
  ];

  if (tipo === "gasto" || tipo === "venda") {
    if (valor === null && quantidade !== null && precoUnitario !== null) {
      valor = Math.round(quantidade * precoUnitario * 100) / 100;
    }
    if (valor === null || valor <= 0) return { sucesso: false, motivo: "faltou_valor" };
    if (valor > 50_000_000) {
      return {
        sucesso: false,
        motivo: "numero_nao_confere",
        detalhe: `o valor ${valor} é muito alto (acima de R$ 50 milhões); confirme o valor com o produtor`,
      };
    }
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
  if (!cultura && tipo === "venda") {
    const mencionada = [
      ctx.texto,
      ...ctx.historico.filter((h) => h.role === "user").map((h) => h.conteudo),
    ]
      .map((m) => culturaMencionada(m))
      .find((c) => !!c);
    if (mencionada) cultura = mencionada;
  }
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
  const tresMinutos = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: recentes } = await supabase
    .from("fazenda_registros")
    .select(COLUNAS_REGISTRO)
    .eq("produtor_id", produtor.id)
    .eq("tipo", tipo)
    .eq("ocorrido_em", data)
    .is("apagado_em", null)
    .neq("situacao", "rascunho")
    .gte("criado_em", tresMinutos);
  const repetido = ((recentes ?? []) as RegistroFazenda[]).find(
    (r) =>
      (r.valor ?? null) === (valor ?? null) &&
      r.descricao.toLowerCase() === descricao!.toLowerCase() &&
      (r.cultura ?? null) === (cultura ?? null) &&
      r.situacao === situacao,
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
      situacao,
      vence_em: venceEm,
    })
    .select(COLUNAS_REGISTRO)
    .single();
  if (error || !gravado) {
    console.error("Erro ao gravar no caderno da fazenda:", error);
    return { sucesso: false, motivo: "erro_ao_gravar" };
  }
  let registro = gravado as RegistroFazenda;

  if (situacao === "pendente") {
    const lembreteId = await criarLembreteDoVencimento(
      supabase,
      produtor,
      ctx.telefone ?? "",
      registro,
    );
    if (lembreteId) {
      await supabase
        .from("fazenda_registros")
        .update({ lembrete_id: lembreteId })
        .eq("id", registro.id);
      registro = { ...registro, lembrete_id: lembreteId };
    }
    return {
      sucesso: true,
      duplicado: false,
      registro,
      confirmacao: confirmacaoDePendencia(registro),
    };
  }
  const confirmacao = await montarConfirmacao(supabase, produtor, registro);
  return { sucesso: true, duplicado: false, registro, confirmacao };
}

function confirmacaoDePendencia(r: RegistroFazenda): string {
  const dias = r.vence_em
    ? Math.round(
        (Date.parse(`${r.vence_em}T12:00:00Z`) - Date.parse(`${hojeBrasilia()}T12:00:00Z`)) /
          86_400_000,
      )
    : 0;
  const venc = r.vence_em ? fraseDeVencimento(dias, r.vence_em) : "";
  const qtd =
    r.quantidade !== null && r.unidade
      ? `, ${formatarQuantidade(r.quantidade)} ${r.unidade}${r.preco_unitario ? ` a ${formatarReais(r.preco_unitario)}` : ""}`
      : "";
  const o = r.tipo === "venda" ? "A receber" : "A pagar";
  const oque =
    r.tipo === "venda"
      ? `venda${r.cultura ? ` de ${r.cultura.toLowerCase()}` : ""}${qtd}`
      : r.descricao;
  const lembrete = r.lembrete_id
    ? "Eu te lembro no dia, às 8h."
    : dias <= 0
      ? "Como é pra hoje, não vou criar lembrete."
      : "";
  const baixa =
    r.tipo === "venda"
      ? 'Quando receber, é só dizer "recebi".'
      : 'Quando pagar, é só dizer "paguei".';
  const oQue = r.tipo === "venda" ? `(${oque})` : `: ${oque}`;
  return `${MARCA_CONFIRMACAO_CADERNO}: ${o} ${formatarReais(r.valor ?? 0)}${r.tipo === "venda" ? ` ${oQue}` : oQue}, ${venc}. ${lembrete} ${baixa} Se algo ficou errado, diga "desfazer".`
    .replace(/\s{2,}/g, " ")
    .replace(/ \./g, ".");
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

/** A confirmação certa para o lançamento (a pagar ou realizado). */
export async function confirmacaoDoRegistro(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
  r: RegistroFazenda,
): Promise<string> {
  return r.situacao === "pendente"
    ? confirmacaoDePendencia(r)
    : montarConfirmacao(supabase, produtor, r);
}

export type ResultadoResumo = {
  vazio: boolean;
  texto: string;
};

/** Resumo pronto para mandar (texto montado por código, números todos do banco). */
export async function resumoDaFazenda(
  supabase: SupabaseClient,
  args: {
    periodo?: string | null;
    categoria?: string | null;
    cultura?: string | null;
    talhao?: string | null;
  },
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
  const filtroTal = textoOuNull(args.talhao, 60);
  if (filtroCat) {
    registros = registros.filter(
      (r) => r.tipo === "gasto" && (r.categoria ?? "").toLowerCase().includes(filtroCat),
    );
  }
  if (filtroCult)
    registros = registros.filter((r) => (r.cultura ?? "").toLowerCase().includes(filtroCult));
  if (filtroTal) {
    const chave = talhaoChave(filtroTal);
    registros = registros.filter((r) => !!r.talhao && talhaoChave(r.talhao).includes(chave));
  }
  const filtrado = !!(filtroCat || filtroCult || filtroTal);

  const pendentes = await lerPendentes(supabase, produtor.id);
  if (registros.length === 0 && !filtrado && periodo === "mes" && pendentes.length === 0) {
    const todos = await lerRegistros(supabase, produtor.id, "tudo");
    if (todos.registros.length === 0) return { vazio: true, texto: textoCadernoVazio() };
  }
  const r = resumir(registros);
  const linhas: string[] = [];
  const nomeDoFiltro = filtroTal ? (registros[0]?.talhao ?? filtroTal) : (filtroCat ?? filtroCult);
  const titulo = filtrado ? `${lido.rotulo}, só ${nomeDoFiltro}` : lido.rotulo;
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
    if (!filtrado && (r.nGastos > 0 || r.nVendas > 0)) {
      const sinal = r.resultado >= 0 ? "a favor" : "no vermelho";
      linhas.push(`Resultado do que foi lançado: ${formatarReais(Math.abs(r.resultado))} ${sinal}`);
    }
    if (!filtrado && r.porTalhao.length >= 2) {
      linhas.push("Por talhão:");
      for (const t of r.porTalhao.slice(0, 3))
        linhas.push(`  • ${t.talhao}: ${formatarReais(t.gasto)}`);
    }
    if (!filtrado && (r.plantios.length > 0 || r.colheitas.length > 0)) {
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

  // A pagar e a receber (de qualquer data).
  if (!filtrado && pendentes.length > 0) {
    const p = resumirPendencias(pendentes);
    linhas.push("");
    if (p.aReceber.length)
      linhas.push(
        `A receber: ${formatarReais(p.totalAReceber)} (${p.aReceber.length}), o próximo ${fraseDeVencimento(p.aReceber[0]!.dias, p.aReceber[0]!.vencimento)}`,
      );
    if (p.aPagar.length)
      linhas.push(
        `A pagar: ${formatarReais(p.totalAPagar)} (${p.aPagar.length}), o próximo ${fraseDeVencimento(p.aPagar[0]!.dias, p.aPagar[0]!.vencimento)}`,
      );
    if (p.vencidas > 0)
      linhas.push(`Atenção: ${p.vencidas} já ${p.vencidas === 1 ? "venceu" : "venceram"}.`);
  }

  // Custo por saca, quando a área da cultura já foi informada.
  if (!filtrado && periodo !== "tudo") {
    try {
      const areas = await lerAreas(supabase, produtor.id);
      if (areas.length > 0) {
        const safra = await lerRegistros(supabase, produtor.id, "safra");
        const linhasDeCusto: string[] = [];
        for (const a of areas.slice(0, 3)) {
          const c = await custoDaCultura(
            supabase,
            produtor,
            a,
            areas,
            safra.registros,
            safra.rotulo,
          );
          const l = linhaCurtaDoCusto(c);
          if (l) linhasDeCusto.push(`  • ${l}`);
        }
        if (linhasDeCusto.length) {
          linhas.push("");
          linhas.push(`Custo e margem (${safra.rotulo}):`);
          linhas.push(...linhasDeCusto);
        }
      } else if (r.nGastos > 0) {
        linhas.push("");
        linhas.push('Quer saber seu custo por saca e sua margem? Diga "custo por saca".');
      }
    } catch {
      /* sem custo, segue */
    }
  }

  // Mercado de hoje ao lado da venda média (só quando dá pra comparar de verdade).
  if (!filtrado && periodo !== "tudo") {
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
    .select(COLUNAS_REGISTRO)
    .eq("produtor_id", produtor.id)
    .eq("origem", "whatsapp")
    .is("apagado_em", null)
    .neq("situacao", "rascunho")
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
  await cancelarLembrete(supabase, ultimo.lembrete_id);
  const quando =
    ultimo.situacao === "pendente" && ultimo.vence_em
      ? ` (vencia em ${dataLonga(ultimo.vence_em)})`
      : "";
  const texto =
    ultimo.situacao === "pendente"
      ? `${ultimo.tipo === "venda" ? "A receber" : "A pagar"} ${formatarReais(ultimo.valor ?? 0)}: ${ultimo.tipo === "venda" ? `venda${ultimo.cultura ? ` de ${ultimo.cultura.toLowerCase()}` : ""}` : ultimo.descricao}${quando}`
      : descreverRegistro(ultimo).slice(7).trim();
  return { sucesso: true, texto: `Pronto, apaguei: ${texto}.` };
}

// ---------------------------------------------------------------------------------------------
// Ler o que a pessoa escreveu: plano futuro e "isto é um lançamento"
// ---------------------------------------------------------------------------------------------

/** O produtor está contando algo que JÁ aconteceu (gastei, vendi, plantei...) ou a pagar/receber, sem ser pergunta nem plano. */
export function pareceLancamentoNoCaderno(texto: string): boolean {
  const t = SEM_ACENTO(texto);
  if (t.includes("?")) return false;
  if (VERBOS_DE_LANCAMENTO.test(t) && !temMarcaDePlano(t)) return true;
  // a pagar ou a receber: "tenho que pagar 5 mil de arrendamento dia 10", "vou receber 60 mil dia 30"
  return indicaPendencia(t) && /\d/.test(t) && !temMarcaDePlano(t);
}

/** "Quanto foi?" respondido só com o número: continua um lançamento começado na mensagem anterior. */
export function ehContinuacaoDeLancamento(texto: string, historico: HistoricoLinha[]): boolean {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .trim();
  if (!t || t.split(/\s+/).length > 6 || !/\d/.test(t)) return false;
  const ultima = ultimaDoBot(historico);
  return (
    !!ultima &&
    /\b(quanto (foi|custou|deu|pagou|gastou)|qual (foi )?o valor|valor total|quanto ficou)\b/i.test(
      SEM_ACENTO(ultima),
    )
  );
}

/** Plano ou dúvida ("vou comprar adubo", "e se eu vendesse") sem nada que tenha acontecido. */
export function ehPlanoOuHipotese(texto: string): boolean {
  const t = SEM_ACENTO(texto);
  if (t.includes("?")) return true;
  return temMarcaDePlano(t) && !VERBOS_DE_LANCAMENTO.test(t);
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
  // talhão é outro recorte (pedidoDeGastoPorTalhao)
  if (/^(o |a )?(talhao|gleba|piquete|pasto|lote)\b/.test(busca)) return null;
  const cat = categoriaDeTexto(busca);
  const periodo: PeriodoCaderno = m[2] === "ano" ? "ano" : m[2] === "safra" ? "safra" : "mes";
  return { categoria: cat === "Outros" ? null : cat, busca, periodo };
}

/** "quanto gastei no talhão 3 (essa safra)". */
export function pedidoDeGastoPorTalhao(
  texto: string,
): { talhao: string; periodo: PeriodoCaderno } | null {
  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = t.match(
    /^(?:quanto|qual (?:o )?(?:gasto|custo)) (?:eu )?(?:gastei|paguei|gastamos|foi gasto|deu|custou)?\s*(?:no|na|em|do|da|de|com o|com a)\s*((?:talhao|gleba|piquete|pasto|lote|area)\s*[a-z0-9]{1,12}(?: [a-z0-9]{1,12})?)(?: (?:esse|este|neste|nesse|nesta|nessa|na|no) (mes|ano|safra))?(?: ate agora| ate hoje)?$/,
  );
  if (!m) return null;
  const periodo: PeriodoCaderno = m[2] === "mes" ? "mes" : m[2] === "ano" ? "ano" : "safra";
  return { talhao: m[1]!.trim(), periodo };
}

// ---------------------------------------------------------------------------------------------
// Reconhecer o pedido por código (não depende do modelo)
// ---------------------------------------------------------------------------------------------

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
  const ultima = ultimaDoBot(historico);
  return !!ultima && ultima.includes(MARCA_CONFIRMACAO_CADERNO);
}

/** A resposta afirma que anotou, mas nenhuma anotação foi gravada nesta rodada. */
export function afirmaTerAnotadoNoCaderno(resposta: string): boolean {
  if (/\b(alerta|lembrete|aviso)\b/i.test(resposta)) return false;
  return /\b(anotei|anotado|registrei|registrado|lancei|lan[çc]ado|guardei)\b[^.\n]{0,60}\b(caderno|fazenda|gasto|venda|plantio|colheita)\b/i.test(
    resposta,
  );
}

export const CATEGORIAS_PARA_O_MODELO = CATEGORIAS_GASTO;

export { dataCurta };
