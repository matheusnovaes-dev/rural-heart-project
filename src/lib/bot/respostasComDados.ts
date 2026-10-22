import type { SupabaseClient } from "@supabase/supabase-js";

import { pricingPlans } from "@/config/site";
import { ufs } from "@/config/ufs";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import { atualizarLocalizacao } from "@/lib/bot/tools/localizacao";
import type { ProdutorContexto } from "@/lib/bot/types";

/**
 * Respostas por CÓDIGO para pedidos em que o modelo errou na auditoria de 2026-10-16 (bateria de ~50 mensagens
 * contra o bot de produção): o gpt-4o-mini respondia outra coisa (ferrugem no lugar de "minha cidade é Sinop"),
 * prometia o que o bot não faz ("cancela todos meus alertas" pedia confirmação para sempre, sem ferramenta
 * nenhuma que cancele), não respondia ("quais alertas eu tenho"), dava opinião de investimento e mostrava o plano
 * Bronze com teste grátis para quem já é Prata. Mesma regra de [[feedback_bot_conditional_rules_in_code]]:
 * o que tem resposta certa e determinística sai daqui, não da boa vontade do modelo.
 */
export type RespostaComDados = {
  resposta: string;
  precisa_humano: boolean;
  convite_dispensado: boolean;
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const ehNome = (candidato: string) => {
  const c = semAcento(candidato);
  return ufs.some((u) => semAcento(u.label) === c || u.value.toLowerCase() === c);
};

// ---------------------------------------------------------------- cidade do produtor

const PREFIXO_DE_CIDADE =
  "(?:minha cidade (?:é|e|eh)|a minha cidade (?:é|e|eh)|moro (?:em|na cidade de|no município de|no municipio de)|sou (?:de|da cidade de)|agora (?:sou de|moro em)|mudei (?:de cidade )?(?:pra|para|pro)|me mudei (?:pra|para)|fico em|minha fazenda (?:fica )?(?:em|na cidade de))";
const DECLARACAO_DE_CIDADE = new RegExp(`${PREFIXO_DE_CIDADE}\\s+(.{2,70})$`, "iu");
const PERGUNTA_OU_DADO = /\?|pre[cç]o|quanto|cota[cç][aã]o|previs[aã]o|vai chover/i;
// "mudei pra cultura de milho", "mudei pro plano Prata": não é cidade (achado na bateria de 2026-10-16)
const NAO_COMECA_CIDADE =
  /^(?:a |o |um |uma |outr[ao]s? |cultura|culturas|plano|planos|lavoura|produ[cç][aã]o|plantar|plantio|cria[cç][aã]o|soja|milho|caf[eé]|boi|gado|trigo|arroz|feij[aã]o|algod[aã]o|cana|leite|bronze|prata|ouro)\b/i;

export type CidadeDeclarada = { cidade: string; uf: string | null; explicita: boolean };

/** "minha cidade é Sinop", "mudei pra Lucas do Rio Verde MT": a cidade (e a UF, se veio) que a pessoa disse ser dela. */
export function lerCidadeDeclarada(texto: string): CidadeDeclarada | null {
  const t = texto.trim().replace(/[.!]+$/, "");
  if (t.length > 110 || PERGUNTA_OU_DADO.test(t)) return null;
  const m = t.match(DECLARACAO_DE_CIDADE);
  if (!m) return null;
  let bruto = m[1]!.trim().replace(/\s+(?:mesmo|agora|hoje)$/i, "");

  let uf: string | null = null;
  const comSigla = bruto.match(/^(.*?)[\s,/-]+([A-Za-z]{2})$/);
  if (comSigla && ufs.some((u) => u.value === comSigla[2]!.toUpperCase())) {
    bruto = comSigla[1]!.trim();
    uf = comSigla[2]!.toUpperCase();
  } else {
    for (const u of ufs) {
      const nome = semAcento(u.label);
      const b = semAcento(bruto);
      if (b.endsWith(` ${nome}`) || b.endsWith(`, ${nome}`)) {
        bruto = bruto.slice(0, bruto.length - nome.length).replace(/[\s,/-]+$/, "");
        uf = u.value;
        break;
      }
    }
  }
  const cidade = bruto.replace(/[,;]+$/, "").trim();
  if (NAO_COMECA_CIDADE.test(cidade)) return null;
  if (cidade.length < 2 || cidade.length > 50 || !/^[\p{L}][\p{L}\s'’.-]*$/u.test(cidade))
    return null;
  // "sou de Minas", "moro em Goiás": é estado, não cidade. Deixa o fluxo normal conduzir.
  if (ehNome(cidade) || semAcento(cidade) === "minas") return null;
  return { cidade, uf, explicita: !/^(?:mudei|me mudei)/i.test(m[0]!) };
}

export async function responderCidadeDeclarada(
  supabase: SupabaseClient,
  texto: string,
  produtor: ProdutorContexto,
): Promise<RespostaComDados | null> {
  if (!produtor.id) return null;
  const dita = lerCidadeDeclarada(texto);
  if (!dita) return null;
  const uf = dita.uf ?? produtor.uf;
  if (!uf) return null;
  const nomeUf = ufs.find((u) => u.value === uf)?.label ?? uf;
  const r = await atualizarLocalizacao(supabase, { municipio: dita.cidade, uf }, { produtor });
  if (r.sucesso) {
    return {
      resposta: `Anotei: sua cidade agora é ${r.municipio}/${r.uf}. Passo a usar ela no frete e na previsão do tempo.`,
      precisa_humano: false,
      convite_dispensado: true,
    };
  }
  // "mudei pra X" sem cidade reconhecível pode ser outra coisa: deixa o fluxo normal conduzir
  if (r.motivo === "cidade_nao_encontrada" && dita.explicita) {
    return {
      resposta: `Não achei "${dita.cidade}" em ${nomeUf}. Confere pra mim o nome da cidade e o estado?`,
      precisa_humano: false,
      convite_dispensado: true,
    };
  }
  return null;
}

// ---------------------------------------------------------------- alertas: listar e cancelar

const CRIAR_ALERTA = /\b(cri(?:a|ar|e)|quero (?:um|o|receber)|configur\w+|me avis\w+|nov[oa])\b/i;
const LISTAR_ALERTAS =
  /(?:\b(?:quais|meus|mostra\w*|ver|list\w+|me (?:mostra|fala|diz)|tenho)\b.{0,30}\balertas?\b|\balertas?\b.{0,25}\b(?:eu )?(?:tenho|ativos?|configurad\w+|criad\w+|cadastrad\w+)\b)/i;
const CANCELAR_ALERTA =
  /\b(?:cancel\w*|exclu\w*|apag\w*|remov\w*|delet\w*|desativ\w*|tira\w*|pa?rar (?:de )?(?:receber )?)\b.{0,35}\balertas?\b/i;

export function ehPedidoDeListarAlertas(texto: string): boolean {
  const t = texto.trim();
  if (
    /\b(existem|existe|posso|pode|podem|voc[eê]s?|vcs?|dispon[ií]ve\w*|ofere\w+|funcionam|tipos?)\b/i.test(
      t,
    )
  )
    return false;
  return (
    t.length <= 90 && !CRIAR_ALERTA.test(t) && !CANCELAR_ALERTA.test(t) && LISTAR_ALERTAS.test(t)
  );
}

export function ehPedidoDeCancelarAlerta(texto: string): boolean {
  const t = texto.trim();
  return (
    t.length <= 110 &&
    CANCELAR_ALERTA.test(t) &&
    !/resumo|novidades|mensagens?|avisos? (?:de )?marketing/i.test(t)
  );
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const CLIMA_TEXTO: Record<string, (limite: number) => string> = {
  chuva_forte: (l) => `chuva forte, chance acima de ${l}%`,
  geada: (l) => `geada, mínima abaixo de ${l}°C`,
  seca_prolongada: (l) => `seca prolongada, chance de chuva abaixo de ${l}% na semana`,
  vento_forte: (l) => `vento forte, rajada acima de ${l} km/h`,
};

const ONDE_VER_ALERTAS = (produtor: ProdutorContexto) =>
  produtor.user_id
    ? "Pra cancelar ou editar, é pelo painel, na aba Alertas: https://safralume.com.br/dashboard/alertas"
    : "Pra cancelar ou editar, é pelo painel, na aba Alertas. Se ainda não tem login, me peça o link de acesso que eu mando.";

export async function responderListaDeAlertas(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
): Promise<RespostaComDados | null> {
  if (!produtor.id) return null;
  const id = produtor.id;
  const [preco, cambio, clima, leilao, resumo] = await Promise.all([
    supabase
      .from("alertas_preco")
      .select("cultura, uf, limite, direcao")
      .eq("produtor_id", id)
      .eq("ativo", true),
    supabase
      .from("alertas_cambio")
      .select("limite, direcao")
      .eq("produtor_id", id)
      .eq("ativo", true),
    supabase
      .from("alertas_clima")
      .select("uf, cidade, condicao, limite")
      .eq("produtor_id", id)
      .eq("ativo", true),
    supabase
      .from("alertas_leilao")
      .select("uf, tipo_preferido")
      .eq("produtor_id", id)
      .eq("ativo", true),
    supabase
      .from("produtores")
      .select("resumo_diario_ativo, resumo_diario_hora")
      .eq("id", id)
      .maybeSingle(),
  ]);
  // Se alguma leitura falhar, é melhor não responder por código do que afirmar "você não tem alertas".
  if (preco.error || cambio.error || clima.error || leilao.error) return null;

  const linhas: string[] = [];
  for (const a of preco.data ?? []) {
    const sobe = a.direcao !== "abaixo";
    linhas.push(
      `• ${capitalizar(String(a.cultura))} em ${a.uf}: aviso quando ${sobe ? "passar de" : "ficar abaixo de"} R$${brl(Number(a.limite))}`,
    );
  }
  for (const a of cambio.data ?? []) {
    const sobe = a.direcao !== "abaixo";
    linhas.push(
      `• Dólar: aviso quando ${sobe ? "passar de" : "ficar abaixo de"} R$${brl(Number(a.limite))}`,
    );
  }
  for (const a of clima.data ?? []) {
    const descricao = (CLIMA_TEXTO[String(a.condicao)] ?? (() => String(a.condicao)))(
      Number(a.limite),
    );
    const onde = a.cidade ? `${a.cidade}/${a.uf}` : `${a.uf} (previsão da capital)`;
    linhas.push(`• Clima em ${onde}: ${descricao}`);
  }
  for (const a of leilao.data ?? []) {
    const tipo =
      a.tipo_preferido === "qualquer" || !a.tipo_preferido
        ? "qualquer tipo"
        : `${a.tipo_preferido}`;
    linhas.push(
      `• Leilão de gado (${tipo}${a.uf ? `, ${a.uf}` : ", qualquer estado"}): aviso quando entrar um novo na agenda`,
    );
  }
  const resumoAtivo = resumo.data?.resumo_diario_ativo === true;

  if (linhas.length === 0 && !resumoAtivo) {
    return {
      resposta:
        'Você não tem alerta ativo agora. Pra criar um, é só me dizer, por exemplo: "me avisa quando a soja passar de R$140".',
      precisa_humano: false,
      convite_dispensado: true,
    };
  }
  const partes = ["Seus alertas ativos:", ...linhas];
  if (linhas.length === 0) partes.push("• Nenhum alerta de preço, câmbio, clima ou leilão.");
  if (resumoAtivo)
    partes.push(`• Resumo diário: todo dia às ${resumo.data?.resumo_diario_hora ?? "?"}h`);
  partes.push("", ONDE_VER_ALERTAS(produtor));
  return { resposta: partes.join("\n"), precisa_humano: false, convite_dispensado: true };
}

export function respostaDeCancelarAlerta(produtor: ProdutorContexto): RespostaComDados {
  return {
    resposta: `Por aqui eu não consigo cancelar alertas. ${ONDE_VER_ALERTAS(produtor)} Lá você cancela (fica no histórico) ou exclui de vez.`,
    precisa_humano: false,
    convite_dispensado: true,
  };
}

// ---------------------------------------------------------------- planos

const PERGUNTA_DE_PLANOS = new RegExp(
  [
    "quanto\\s+(?:custa|é|e|fica|sai)\\s+(?:o|os|a|as)?\\s*(?:plano|planos|assinatura|mensalidade)",
    "(?:valor|valores|pre[cç]o|pre[cç]os|custo)\\s+(?:do|dos|da|das)\\s+(?:plano|planos|assinatura|mensalidade)",
    "(?:qual|quais)\\s+(?:o|os|a|as)?\\s*(?:valor|valores|pre[cç]os?)\\s+(?:do|dos|da|das)\\s+planos?",
    "mensalidade",
    "quais\\s+(?:s[aã]o\\s+)?(?:os\\s+)?planos",
  ].join("|"),
  "iu",
);
const PERGUNTA_VAGA_DE_PRECO =
  /^\s*(?:e\s+)?(?:quanto|qual)\s+(?:custa|é o valor|o valor|é o preço|o preço)\s*[?!.]*\s*$/iu;

export function ehPerguntaDePlanos(texto: string): boolean {
  const t = texto.trim();
  return t.length <= 110 && PERGUNTA_DE_PLANOS.test(t);
}

export function ehPerguntaVagaDePreco(texto: string): boolean {
  return PERGUNTA_VAGA_DE_PRECO.test(texto.trim());
}

const DESCRICAO_DO_PLANO: Record<string, string> = {
  bronze:
    "preço da sua região comparado com o porto, sinal de venda, calculadora de safra, estudo de proposta (3 por dia) e até 3 alertas",
  prata:
    "tudo do Bronze, mais alertas sem limite, estudo de proposta com ranking (15 por dia), leilões de gado, até 3 funcionários e preço de defensivos e fertilizantes",
  ouro: "tudo do Prata, mais acompanhar outras culturas e estados, funcionários sem limite e suporte prioritário",
};

const NOME_DO_PLANO = (p: string) => capitalizar(p);

export async function responderPlanos(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
): Promise<RespostaComDados> {
  let situacao = "";
  if (produtor.id) {
    const { data } = await supabase
      .from("assinaturas")
      .select("plano, status, trial_expira_em")
      .eq("produtor_id", produtor.id)
      .maybeSingle();
    if (data?.plano) {
      if (data.status === "ativa") {
        situacao = `Seu plano hoje é o ${NOME_DO_PLANO(data.plano)}.`;
      } else if (
        data.status === "trial" &&
        data.trial_expira_em &&
        new Date(data.trial_expira_em) > new Date()
      ) {
        const ate = new Date(data.trial_expira_em).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        });
        situacao = `Você está no teste grátis (plano ${NOME_DO_PLANO(data.plano)}) até ${ate}.`;
      }
    }
  }
  const linhas = pricingPlans.map(
    (p) => `• ${p.name}, R$${p.price} por mês: ${DESCRICAO_DO_PLANO[p.id] ?? p.audience}`,
  );
  const fecho = produtor.id
    ? produtor.user_id
      ? "Pra mudar de plano: https://safralume.com.br/dashboard/assinatura"
      : 'Pra assinar ou mudar de plano, é só me responder "quero assinar" que eu mando o link.'
    : "O teste grátis dura 7 dias e não pede cartão.";
  return {
    resposta: [
      "Os planos do Safralume, por mês:",
      ...linhas,
      "",
      [situacao, fecho].filter(Boolean).join(" "),
    ].join("\n"),
    precisa_humano: false,
    convite_dispensado: !!produtor.id,
  };
}

export function respostaDePrecoSemAssunto(): RespostaComDados {
  return {
    resposta:
      "Se você quer saber o valor do Safralume: o plano Bronze custa R$39 por mês (pequenos produtores), o Prata R$129 e o Ouro R$299. O teste de 7 dias é grátis e não pede cartão. Se queria o preço de uma cultura (soja, milho, boi, café...), é só me dizer qual que eu busco.",
    precisa_humano: false,
    convite_dispensado: true,
  };
}

/** A última fala do bot era sobre plano/assinatura: um "quanto custa?" solto é sobre isso. */
export function conversaEraDePlanos(historico: HistoricoLinha[]): boolean {
  const ultima = [...historico]
    .sort((a, b) => b.ordem - a.ordem)
    .find((h) => h.role === "assistant");
  return !!ultima && /\b(plano|planos|assinatura|assinar)\b/i.test(ultima.conteudo);
}

// ---------------------------------------------------------------- conversão de unidades

const KG = {
  saca: 60,
  sacas: 60,
  arroba: 15,
  arrobas: 15,
  kg: 1,
  quilo: 1,
  quilos: 1,
  tonelada: 1000,
  toneladas: 1000,
  t: 1000,
} as const;
type Unidade = keyof typeof KG;
const NOME_UNIDADE: Record<string, string> = {
  saca: "saca",
  arroba: "arroba",
  kg: "kg",
  tonelada: "tonelada",
};

function normalizaUnidade(u: string): "saca" | "arroba" | "kg" | "tonelada" {
  const x = u.toLowerCase() as Unidade;
  const kg = KG[x];
  if (kg === 60) return "saca";
  if (kg === 15) return "arroba";
  if (kg === 1000) return "tonelada";
  return "kg";
}

const CONVERSAO = new RegExp(
  "quant[oa]s?\\s+(arrobas?|sacas?|kg|quilos?|toneladas?)\\s+(?:tem|t[eê]m|vale|valem|s[aã]o|equivale|equivalem|d[aá]|d[aã]o)\\s+(?:em|numa?|uma?|de)?\\s*(\\d[\\d.,]*)\\s*(arrobas?|sacas?|kg|quilos?|toneladas?|t)\\b",
  "iu",
);

function lerNumero(s: string): number | null {
  let t = s.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const plural = (n: number, u: string) =>
  u === "kg" ? "kg" : n === 1 ? u : u === "tonelada" ? "toneladas" : `${u}s`;

/** "quantas arrobas tem em 100 sacas?": conta exata, por código (saca 60 kg, arroba 15 kg, tonelada 1.000 kg). */
export function responderConversaoDeUnidade(texto: string): RespostaComDados | null {
  const m = texto.trim().match(CONVERSAO);
  if (!m) return null;
  const alvo = normalizaUnidade(m[1]!);
  const origem = normalizaUnidade(m[3]!);
  const qtd = lerNumero(m[2]!);
  if (qtd === null || alvo === origem) return null;
  const totalKg = qtd * KG[origem];
  const resultado = totalKg / KG[alvo];
  const nomeOrigem = NOME_UNIDADE[origem]!;
  const nomeAlvo = NOME_UNIDADE[alvo]!;
  const detalhe =
    origem === "saca" ? " (saca de 60 kg)" : origem === "arroba" ? " (arroba de 15 kg)" : "";
  return {
    resposta: `${fmt(qtd)} ${plural(qtd, nomeOrigem)}${detalhe} equivalem a ${fmt(resultado)} ${plural(resultado, nomeAlvo)}. Considerei saca de 60 kg, arroba de 15 kg e tonelada de 1.000 kg.`,
    precisa_humano: false,
    convite_dispensado: true,
  };
}

// ---------------------------------------------------------------- opinião de investimento

const DECISAO_DE_INVESTIMENTO =
  /(?:\binvestir\b|\binvestimentos?\b|\b(?:comprar|vender|arrendar)\s+(?:uma?\s+|a\s+|minha\s+|nossa\s+)?(?:terras?|fazendas?|im[oó]ve(?:l|is)|a[cç][oõ]es|bitcoin|cripto\w*|apartamentos?|trator(?:es)?|m[aá]quinas?)\b)/i;

export function ehPedidoDeOpiniaoDeInvestimento(texto: string): boolean {
  const t = texto.trim();
  return t.length <= 120 && DECISAO_DE_INVESTIMENTO.test(t);
}

export function respostaDeInvestimento(): RespostaComDados {
  return {
    resposta:
      "Essa é uma decisão sua, e eu não faço recomendação de investimento. O que eu posso é trazer os dados pra você decidir: preço de hoje, sinal de venda, tendência da B3, clima e a comparação das propostas que você receber. Quer ver algum deles?",
    precisa_humano: false,
    convite_dispensado: true,
  };
}

// ---------------------------------------------------------------- outras respostas fixas

const PEDIDO_LGPD =
  /\b(?:exclu\w+|apag\w+|delet\w+|remov\w+|elimin\w+)\b.{0,25}\b(?:minha conta|meus dados|meu cadastro|meus? informa[cç][oõ]es)\b|\blgpd\b|direito (?:ao|de) esquecimento/i;
export const ehPedidoDeExcluirDados = (t: string) => t.length <= 140 && PEDIDO_LGPD.test(t);
export function respostaDeExcluirDados(): RespostaComDados {
  return {
    resposta:
      "Cancelar a assinatura não apaga seus dados. Pra excluir sua conta e seus dados, já avisei a nossa equipe, que confirma o pedido com você por aqui.",
    precisa_humano: true,
    convite_dispensado: true,
  };
}

const PERGUNTA_DE_PAGAMENTO =
  /(?:cobram|aceita\w*|pago|pagar|pagamento|formas? de pagamento).{0,35}\b(?:pix|boleto|cart[aã]o)\b|\b(?:pix|boleto|cart[aã]o)\b.{0,25}\b(?:aceit\w+|pode|posso|serve|tem)\b|\bformas? de pagamento\b/i;
export const ehPerguntaDePagamento = (t: string) =>
  t.length <= 110 && PERGUNTA_DE_PAGAMENTO.test(t);
export function respostaDePagamento(): RespostaComDados {
  return {
    resposta:
      "Aceitamos Pix, boleto e cartão de crédito, pela Asaas (plataforma de pagamentos). O teste de 7 dias é grátis e não pede cartão.",
    precisa_humano: false,
    convite_dispensado: true,
  };
}

const PEDIDO_DE_LINK_DO_SITE =
  /\b(?:link|endere[cç]o|url)\b.{0,15}\b(?:do )?(?:site|safralume)\b|\bqual (?:[ée] )?o site\b|\bme (?:manda|passa|envia) o site\b/i;
export const ehPedidoDeLinkDoSite = (t: string) => t.length <= 80 && PEDIDO_DE_LINK_DO_SITE.test(t);
export function respostaDeLinkDoSite(produtor: ProdutorContexto): RespostaComDados {
  return {
    resposta: produtor.user_id
      ? "O site é https://safralume.com.br. Seu painel fica em https://safralume.com.br/login (e-mail e senha)."
      : "O site é https://safralume.com.br. Pra entrar no painel, é só me pedir o link de acesso que eu mando.",
    precisa_humano: false,
    convite_dispensado: true,
  };
}

const CHUVA_EM_MM =
  /(?:chuva|chuvas|precipita\w+).{0,30}(?:acumulad\w+|milim\w+|\bmm\b|volume)|\b(?:quantos?)\s+(?:mm|milimetros|milímetros)\b|\bmil[ií]metros\b/i;
export const ehPerguntaDeChuvaEmMm = (t: string) => t.length <= 120 && CHUVA_EM_MM.test(t);
export function respostaDeChuvaEmMm(): RespostaComDados {
  return {
    resposta:
      "Eu não tenho o volume de chuva em milímetros nem o acumulado do mês: só a chance de chuva (%) e as temperaturas dos próximos dias. Quer a previsão da sua cidade?",
    precisa_humano: false,
    convite_dispensado: true,
  };
}

const PERGUNTA_AGRONOMICA =
  /\b(?:umidade ideal|ponto de colheita|aduba[cç][aã]o|dosagem|dose de|qual (?:a )?(?:melhor )?(?:cultivar|variedade)|espa[cç]amento|popula[cç][aã]o de plantas|como (?:controlar|combater|tratar)|pulveriz\w+|quanto de (?:adubo|calc[aá]rio|semente)|(?:indica|recomenda\w*|qual (?:o )?melhor)[^.?!]{0,25}(?:adubo|fertilizante|defensivo|semente|herbicida|fungicida|inseticida|veneno))\b/i;
export const ehPerguntaAgronomica = (t: string) => t.length <= 140 && PERGUNTA_AGRONOMICA.test(t);
export function respostaAgronomica(): RespostaComDados {
  return {
    resposta:
      "Isso é orientação agronômica e eu não tenho fonte segura pra te passar: o melhor é falar com o seu agrônomo ou a assistência técnica (Emater, Embrapa). Posso ajudar com preço, clima, janela de plantio oficial, sinal de venda e comparação de propostas.",
    precisa_humano: false,
    convite_dispensado: true,
  };
}

const AGRADECIMENTO_OU_OK =
  /^\s*(?:ok(?:ay)?|blz|beleza|valeu|vlw|show|top|certo|entendi|perfeito|massa|fechou|legal|j[oó]ia|t[aá] bom|tudo bem|obrigad[oa]s?|brigad[oa])?[\s!.,]*(?:[\u{1F44D}\u{1F64F}\u{1F44F}\u2705\u{1F60A}\u{1F91D}\u{1F44C}\u{1F33E}]\uFE0F?[\s!.,]*)*$/iu;
const SIM_SOLTO = /^\s*(?:sim|s|isso|pode|claro|quero|confirmo|confirmar)[\s!.]*$/i;

function ultimaDoAssistente(historico: HistoricoLinha[]): string | null {
  const u = [...historico].sort((a, b) => b.ordem - a.ordem).find((h) => h.role === "assistant");
  return u?.conteudo ?? null;
}

/** "👍", "ok", "valeu" depois de uma resposta sem pergunta pendente; "sim" solto sem conversa nenhuma antes. */
/** Quantas respostas de cortesia ("Por nada!", 👍, 🌱) o bot deu seguidas, da mais recente para trás. */
function acenosSeguidos(historico: HistoricoLinha[]): number {
  const bot = [...historico]
    .filter((h) => h.role === "assistant")
    .sort((a, b) => b.ordem - a.ordem)
    .map((h) => h.conteudo.trim());
  let n = 0;
  for (const m of bot) {
    if (m.startsWith("Por nada!") || m === "👍" || m === "🌱") n++;
    else break;
  }
  return n;
}

export function responderAcenoSolto(
  texto: string,
  historico: HistoricoLinha[],
): RespostaComDados | null {
  const t = texto.trim();
  if (!t || t.length > 40) return null;
  const ultima = ultimaDoAssistente(historico);
  if (AGRADECIMENTO_OU_OK.test(t) && /[\p{L}\p{Extended_Pictographic}]/u.test(t)) {
    if (ultima && /\?|Confirma/i.test(ultima)) return null; // tem pergunta pendente: o fluxo normal entende o "ok"
    // Quem manda vários "ok / ta bom / obrigado" seguidos não precisa de "Por nada!" toda vez: a 2ª vez só um 👍, a 3ª uma 🌱.
    const seguidos = acenosSeguidos(historico);
    return {
      resposta:
        seguidos === 0
          ? "Por nada! Qualquer coisa é só chamar aqui. 🌾"
          : seguidos === 1
            ? "👍"
            : "🌱",
      precisa_humano: false,
      convite_dispensado: true,
    };
  }
  if (SIM_SOLTO.test(t) && !ultima) {
    return {
      resposta:
        "Sim pra quê? 🙂 Me conta o que você precisa: o preço de uma cultura, a previsão do tempo, criar um alerta...",
      precisa_humano: false,
      convite_dispensado: true,
    };
  }
  return null;
}

const TROCAR_CULTURA =
  /\b(?:mudar|trocar|alterar|mudei|troquei|passei|passar)\b.{0,25}\b(?:cultura|cadastro|lavoura)\b.{0,25}\b(?:pra|para|de|do|da)\b/i;
export const ehPedidoDeTrocarCultura = (t: string) =>
  t.length <= 110 && TROCAR_CULTURA.test(t) && !/\b(?:plano|cidade)\b/i.test(t);
export function respostaDeTrocarCultura(): RespostaComDados {
  return {
    resposta:
      'Por aqui eu não mudo a cultura do seu cadastro. Mas você pode me pedir o preço de qualquer cultura quando quiser, por exemplo: "quanto tá o milho?". Se quiser trocar a cultura principal do cadastro, abra um chamado em Suporte no painel que a equipe ajusta.',
    precisa_humano: false,
    convite_dispensado: true,
  };
}

const SITUACAO_DA_CONTA =
  /\b(?:quando (?:vence|acaba|termina|expira)|vencimento|meu teste|meu plano|minha assinatura|(?:qual|que) (?:[ée] )?(?:o )?(?:meu )?plano (?:eu )?(?:tenho|estou)|que plano (?:eu )?(?:tenho|estou))\b/i;
export const ehPerguntaDeSituacaoDaConta = (t: string) =>
  t.length <= 80 && SITUACAO_DA_CONTA.test(t);

/** Plano e teste do produtor, direto do banco (o modelo inventava "seu teste acabou" para quem já assina). */
export async function responderSituacaoDaConta(
  supabase: SupabaseClient,
  produtor: ProdutorContexto,
): Promise<RespostaComDados | null> {
  if (!produtor.id) return null;
  const { data } = await supabase
    .from("assinaturas")
    .select("plano, status, trial_expira_em")
    .eq("produtor_id", produtor.id)
    .maybeSingle();
  if (!data?.plano) return null;
  const plano = NOME_DO_PLANO(data.plano);
  if (data.status === "ativa") {
    return {
      resposta: `Você é assinante do plano ${plano}, com a assinatura ativa. Pra ver o plano e a cobrança: https://safralume.com.br/dashboard/assinatura`,
      precisa_humano: false,
      convite_dispensado: true,
    };
  }
  if (data.status === "trial" && data.trial_expira_em) {
    const fim = new Date(data.trial_expira_em);
    const dia = fim.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    if (fim > new Date()) {
      return {
        resposta: `Você está no teste grátis do plano ${plano}, que vai até ${dia}. Depois disso, pra continuar, é só escolher o plano.`,
        precisa_humano: false,
        convite_dispensado: true,
      };
    }
    return {
      resposta: `Seu teste grátis do plano ${plano} acabou em ${dia}. Pra continuar, é só responder "quero assinar" que eu mando o link.`,
      precisa_humano: false,
      convite_dispensado: true,
    };
  }
  return null; // inadimplente, cancelada...: o fluxo de cobrança já cuida disso
}

// ---------------------------------------------------------------- alerta sem dizer de quê

const MENCIONA_ALERTA = /\balertas?\b/i;
const ALERTA_JA_ESPECIFICO =
  /chuva|geada|seca|vento|clima|pre[cç]o|soja|milho|boi|caf[eé]|d[oó]lar|c[aâ]mbio|leil[aã]o|trigo|arroz|feij[aã]o|algod[aã]o|cana|leite|avis\w+|passar|cair|subir|abaixo|acima|\d|resumo/i;

/**
 * "a cidade que quero que alerta é Belo Horizonte", sem conversa de alerta antes: o modelo respondia preço de soja.
 * Quando só se fala de "alerta" sem dizer de quê e a conversa não estava num pedido de alerta, pergunta de quê.
 */
export function ehPedidoDeAlertaSemTipo(texto: string, historico: HistoricoLinha[]): boolean {
  const t = texto.trim();
  if (t.length > 110 || !MENCIONA_ALERTA.test(t) || ALERTA_JA_ESPECIFICO.test(t)) return false;
  if (ehPedidoDeListarAlertas(t) || ehPedidoDeCancelarAlerta(t)) return false;
  const ultima = ultimaDoAssistente(historico);
  return !(ultima && /alerta|confirma/i.test(ultima));
}

export function respostaDeAlertaSemTipo(): RespostaComDados {
  return {
    resposta:
      'Que alerta você quer criar? Posso te avisar de clima (chuva forte, geada, seca ou vento, até pela previsão de uma cidade), do preço de uma cultura, do dólar ou de leilão de gado. Me diz, por exemplo: "me avisa quando a soja passar de R$140" ou "alerta de chuva forte em Sorriso".',
    precisa_humano: false,
    convite_dispensado: true,
  };
}

// ---------------------------------------------------------------- alerta de clima: pergunta de confirmação direta

const PEDIDO_DE_ALERTA_DE_CLIMA =
  /\b(?:alerta|avis\w+)\b[^.?!]{0,30}\b(chuva forte|geada|seca(?: prolongada)?|vento(?: forte)?)\b(?:\s+(?:em|no|na|para|pra|de)\s+([\p{L}][\p{L}'’ ]{1,40}?))?\s*[.!]?$/iu;
const FRASE_DO_LIMITE: Record<string, string> = {
  "chuva forte": "quando a chance de chuva passar de 70%",
  geada: "quando a mínima prevista ficar abaixo de 3°C",
  seca: "quando a chance de chuva ficar abaixo de 20% na semana toda",
  vento: "quando a rajada prevista passar de 40 km/h",
};

/**
 * "quero um alerta de chuva forte em Sorriso" sem número: o modelo perguntava "qual probabilidade?" e só na resposta
 * seguinte fazia a confirmação, então o produtor confirmava duas vezes (visto em 2026-10-17). Aqui a confirmação já vem
 * com o limite padrão (o mesmo do painel). A criação continua sendo do modelo, no turno seguinte, depois do "sim".
 */
export function perguntaDeConfirmarAlertaDeClima(
  texto: string,
  produtor: ProdutorContexto,
  historico: HistoricoLinha[],
): RespostaComDados | null {
  const t = texto.trim();
  if (!produtor.id || t.length > 100 || /\d|hora|amanh|depois|manh[aã]|noite|tarde/i.test(t))
    return null;
  const ultima = ultimaDoAssistente(historico);
  if (ultima && /confirma/i.test(ultima)) return null;
  const m = t.match(PEDIDO_DE_ALERTA_DE_CLIMA);
  if (!m) return null;
  const chave = m[1]!.toLowerCase().startsWith("seca")
    ? "seca"
    : m[1]!.toLowerCase().startsWith("vento")
      ? "vento"
      : m[1]!.toLowerCase();
  const nomeCondicao =
    chave === "seca" ? "seca prolongada" : chave === "vento" ? "vento forte" : chave;
  let onde = (m[2] ?? "")
    .trim()
    .replace(/\s+(?:se|quando|caso)\b.*$/i, "")
    .trim();
  const ehEstadoOuSigla = ehNome(onde);
  if (!onde) onde = produtor.uf ?? "";
  if (!onde || (!ehEstadoOuSigla && /^(?:mim|mim mesmo|minha regi[aã]o|aqui)$/i.test(onde)))
    onde = produtor.uf ?? "";
  if (!onde) return null;
  // Estado (nome ou sigla): vale a previsão da capital, e o produtor é avisado de que pode pedir a de uma cidade.
  const siglaEncontrada = ufs.find((u) => u.value === onde.toUpperCase());
  const ehEstado = ehNome(onde);
  const ondeTexto = siglaEncontrada ? siglaEncontrada.label : onde;
  const nota = ehEstado ? " (previsão da capital; pra usar a de uma cidade, é só dizer qual)" : "";
  return {
    resposta: `Confirma: alerta de ${nomeCondicao} em ${ondeTexto}${nota} ${FRASE_DO_LIMITE[chave]}?`,
    precisa_humano: false,
    convite_dispensado: true,
  };
}
