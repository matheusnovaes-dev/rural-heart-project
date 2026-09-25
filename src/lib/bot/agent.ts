import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildContextoInstitucional,
  buildContextoPlanos,
  buildContextoProdutor,
  buildHistoryMessages,
  buildRegrasCadastroAnonimo,
  buildRegrasClienteSemLogin,
  SYSTEM_PROMPT,
  type HistoricoLinha,
} from "@/lib/bot/prompt";
import { executarTool, TOOLS } from "@/lib/bot/tools/index";
import { mensagemBloqueioAcesso, verificarAcessoWhatsapp } from "@/lib/bot/tools/acesso";
import { gerarLinkDeAcesso, tipoDeAcesso } from "@/lib/bot/tools/linkAcesso";
import type { ResultadoBuscarLeite } from "@/lib/bot/tools/leite";
import { ehPedidoDeSair, RESPOSTA_SAIDA_DE_MENSAGENS } from "@/lib/recuperacaoCadastro";
import { normalizarWhatsapp } from "@/lib/telefone";
import type { ProdutorContexto } from "@/lib/bot/types";
import {
  coletarNumerosPermitidos,
  conversaFalaDeCadastro,
  classificarPedidoDeAcesso,
  corrigirLinkDePainelParaClienteSemLogin,
  garantirMediaDasPracas,
  garantirParidade,
  garantirReferenciaMercado,
  garantirCanalDeTexto,
  garantirCotacaoLeite,
  garantirRelacaoLeiteMilho,
  medidasNaoAutorizadas,
  garantirRotaFrete,
  respostaCadastroCriado,
  respostaEntrarNoPainel,
  respostaLinkDeAcesso,
  respostaOfertaDeAcesso,
  RESPOSTA_FALHA_AO_GERAR_LINK,
  valoresNaoAutorizados,
  type FreteCitado,
} from "@/lib/bot/guardas";

const MODEL = "gpt-4o-mini";
const MAX_TOOL_ROUNDS = 6;

const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "resposta_bot",
    strict: true,
    schema: {
      type: "object",
      properties: {
        resposta: {
          type: "string",
          description: "Resposta final em português, sem markdown, até 500 caracteres.",
        },
        precisa_humano: { type: "boolean" },
      },
      required: ["resposta", "precisa_humano"],
      additionalProperties: false,
    },
  },
};

export type RespostaAgente = {
  resposta: string;
  precisa_humano: boolean;
  cadastro_criado: boolean;
  // true quando a própria resposta já trata de cadastro (oferta, confirmação,
  // pedido de UF/cultura pro cadastro) — o n8n não emenda o convite padrão
  // "crie um cadastro grátis" nesse caso, que ficava redundante e confuso.
  convite_dispensado: boolean;
};

// Rede de segurança determinística: o prompt já proíbe fechar a resposta
// com uma oferta de ajuda genérica ("se precisar de algo, é só avisar"),
// mas testando ao vivo isso ainda escapa em ~1/3 das respostas mesmo depois
// de várias rodadas de reforço no texto do prompt — é um hábito do modelo
// que instrução sozinha não elimina de forma confiável. Em vez de insistir
// só no prompt, remove a frase de fechamento aqui, garantido por código.
const PADRAO_FECHAMENTO_SE_PRECISAR =
  /(?:^|[.!?]\s+)(?:se precisar|caso precise|precisando)[^.!?]*?\b(?:avis\w*|\bfala\b|\bfalar\b|\bfale\b|pergunt\w*|cham\w*|acess\w*|confer\w*|conf(?:ira|ere)|check\w*|clic\w*|olh\w*)[^.!?]*[.!?]?\s*$/i;
const PADRAO_FECHAMENTO_DISPOSICAO =
  /(?:^|[.!?]\s+)(?:qualquer\s+d[uú]vida[^.!?]*)?(?:fico|estou)\s+[aà]\s+disposi[cç][aã]o[^.!?]*[.!?]?\s*$/i;

function removerFechamentoGenerico(resposta: string): string {
  const semSePrecisar = resposta.replace(PADRAO_FECHAMENTO_SE_PRECISAR, "").trimEnd();
  const candidato = semSePrecisar || resposta;
  const semDisposicao = candidato.replace(PADRAO_FECHAMENTO_DISPOSICAO, "").trimEnd();
  // Se a resposta inteira era só a frase de fechamento, melhor manter o
  // texto original do que devolver uma mensagem vazia pro produtor.
  return semDisposicao || resposta;
}

// Rota de frete: o prompt já pede origem E destino numa frase curta quando
// vem frete de referência, mas testando ao vivo o modelo cita só uma das duas (ou
// nenhuma). A checagem em si mora em guardas.ts (garantirRotaFrete) — aqui só
// extrai a rota REAL que a ferramenta buscar_preco devolveu.
function extrairUltimoFreteCitado(messages: OpenAIMessage[]): FreteCitado | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  let ultimo: FreteCitado | null = null;
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const parsed = JSON.parse(m.content ?? "{}");
      const frete = parsed?.frete;
      if (frete?.municipio_origem && frete?.municipio_destino) {
        ultimo = { origem: frete.municipio_origem, destino: frete.municipio_destino };
      }
    } catch {
      // resultado de tool malformado não pode derrubar a resposta — ignora.
    }
  }
  return ultimo;
}

// Mesma rede de segurança determinística de novo: o prompt já proíbe
// explicitamente lista com "-"/"*"/"1." no início da linha e "**negrito**"
// (o WhatsApp mostra os caracteres literalmente, quebrado) — mas testando
// com perguntas sobre planos/preço isso escapou de duas formas diferentes
// (lista com traço numa resposta, numeração "1."/"2."/"3." em outra). Em
// vez de insistir só no prompt, converte pra prosa corrida separada por
// "·", igual a instrução já pede como alternativa.
const PADRAO_LINHA_DE_LISTA = /^\s*(?:[-*]|\d+[.)])\s+/;

function removerMarkdownProibido(resposta: string): string {
  const semNegrito = resposta.replace(/\*\*(.+?)\*\*/g, "$1");
  const linhas = semNegrito.split("\n");
  if (!linhas.some((l) => PADRAO_LINHA_DE_LISTA.test(l))) return semNegrito;
  return linhas
    .map((l) => l.replace(PADRAO_LINHA_DE_LISTA, "").trim())
    .filter((l) => l.length > 0)
    .join(" · ");
}

// Média das praças que buscar_preco devolveu, só quando a resposta é sobre UMA
// consulta de preço (com duas culturas, não dá pra saber a qual a frase
// acrescentada se refere).
function extrairMediaDasPracas(messages: OpenAIMessage[]): number | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const medias: (number | null)[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const parsed = JSON.parse(m.content ?? "{}");
      medias.push(
        typeof parsed?.preco_medio_regioes === "number" ? parsed.preco_medio_regioes : null,
      );
    } catch {
      medias.push(null);
    }
  }
  return medias.length === 1 ? medias[0]! : null;
}

// Referência de mercado que buscar_preco trouxe (estado sem dado recente), só
// quando a resposta é sobre UMA consulta de preço.
function extrairReferenciaMercado(
  messages: OpenAIMessage[],
): { valores: number[]; frase: string } | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const achadas: ({ valores: number[]; frase: string } | null)[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const r = JSON.parse(m.content ?? "{}")?.referencia_mercado;
      achadas.push(
        r && Array.isArray(r.valores) && typeof r.frase === "string"
          ? { valores: r.valores as number[], frase: r.frase }
          : null,
      );
    } catch {
      achadas.push(null);
    }
  }
  return achadas.length === 1 ? achadas[0]! : null;
}

// Paridade de porto que buscar_preco calculou, só quando a resposta é sobre UMA
// consulta de preço (a frase pronta é escrita por código; ver lib/paridade.ts).
function extrairParidade(messages: OpenAIMessage[]): { valor: number; frase: string } | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const achadas: ({ valor: number; frase: string } | null)[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const f = JSON.parse(m.content ?? "{}")?.frete_e_paridade;
      achadas.push(
        f?.tipo === "paridade" && typeof f.paridade === "number" && typeof f.frase === "string"
          ? { valor: f.paridade, frase: f.frase }
          : null,
      );
    } catch {
      achadas.push(null);
    }
  }
  return achadas.length === 1 ? achadas[0]! : null;
}

// Resultado de buscar_leite, só quando a resposta é sobre UMA consulta de leite
// (as frases prontas são escritas por código; ver tools/leite.ts).
type ResultadoLeiteDoTurno = {
  chamou: boolean;
  fraseRelacao: string | null;
  cotacao: { preco: number; frase: string } | null;
};

function extrairResultadoLeite(messages: OpenAIMessage[]): ResultadoLeiteDoTurno {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const resultados: Partial<ResultadoBuscarLeite>[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_leite") continue;
    try {
      resultados.push(JSON.parse(m.content ?? "{}"));
    } catch {
      resultados.push({});
    }
  }
  if (resultados.length !== 1)
    return { chamou: resultados.length > 0, fraseRelacao: null, cotacao: null };
  const r = resultados[0]!;
  const frase = r.relacao_milho?.frase_relacao;
  const c = r.cotacao_recente;
  return {
    chamou: true,
    fraseRelacao: typeof frase === "string" ? frase : null,
    cotacao:
      c && typeof c.preco === "number" && typeof c.frase_cotacao === "string"
        ? { preco: c.preco, frase: c.frase_cotacao }
        : null,
  };
}

const FALLBACK_DURO: RespostaAgente = {
  resposta: "Desculpa, não consegui pensar numa resposta agora. Pode tentar de novo em instantes?",
  precisa_humano: true,
  cadastro_criado: false,
  convite_dispensado: false,
};

// Última linha de defesa contra número inventado (ver guardas.ts): se mesmo
// depois de uma chance de se corrigir a resposta ainda cita um valor em R$
// que nenhuma fonte sustenta, é melhor dizer a verdade do que mandar um
// preço falso pra um produtor tomar decisão em cima dele.
const RESPOSTA_SEM_VALOR_CONFIAVEL =
  "Não consegui confirmar esse valor com segurança agora. Me diz a cultura e o estado que eu busco de novo direto na fonte.";

// Mesma rede de segurança determinística de cima, agora pra escalada de
// cobrança/reembolso — o prompt já pede pra escalar (precisa_humano=true)
// qualquer pergunta sobre cobrança, erro de pagamento ou reembolso, mas
// testando ao vivo isso às vezes não escala (ex: "fui cobrado errado, quero
// reembolso" virou precisa_humano=false, respondendo só "cancele pelo
// painel"). Diferente da frase de fechamento (só estética), aqui o risco de
// deixar passar é dinheiro de verdade não indo pra revisão humana — por
// isso força true quando a mensagem do produtor bate com esse padrão,
// independente do que o modelo decidiu.
const PADRAO_COBRANCA_SENSIVEL =
  /cobr(an[çc]a|ado|aram|ei)|reembolso|estorno|fatura|dinheiro de volta|pagamento errado|cart[aã]o.*errado|valor errado/i;

function precisaEscalarPorCobranca(textoProdutor: string): boolean {
  return PADRAO_COBRANCA_SENSIVEL.test(textoProdutor);
}

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

async function chamarOpenAI(
  apiKey: string,
  messages: OpenAIMessage[],
  opts: { comTools: boolean; signal: AbortSignal },
) {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    response_format: RESPONSE_FORMAT,
    temperature: 0.5,
  };
  if (opts.comTools) {
    body["tools"] = TOOLS;
    body["tool_choice"] = "auto";
    body["parallel_tool_calls"] = true;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`OpenAI respondeu ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function responderPedidoDeAcesso(
  supabase: SupabaseClient,
  produtorId: string,
  pedido: "gerar" | "oferecer",
): Promise<RespostaAgente | null> {
  const base = { cadastro_criado: false, convite_dispensado: true };
  try {
    const tipo = await tipoDeAcesso(supabase, produtorId);
    if (tipo === "sem_cadastro") return null;
    if (tipo === "propria") {
      return { ...base, resposta: respostaEntrarNoPainel(), precisa_humano: false };
    }
    if (pedido === "oferecer") {
      return { ...base, resposta: respostaOfertaDeAcesso(), precisa_humano: false };
    }
    const r = await gerarLinkDeAcesso(supabase, produtorId);
    if (r.sucesso) {
      return { ...base, resposta: respostaLinkDeAcesso(r.link), precisa_humano: false };
    }
    if (r.motivo === "tem_login_proprio") {
      return { ...base, resposta: respostaEntrarNoPainel(), precisa_humano: false };
    }
    return { ...base, resposta: RESPOSTA_FALHA_AO_GERAR_LINK, precisa_humano: true };
  } catch (err) {
    console.error("Erro ao gerar link de acesso:", err);
    return { ...base, resposta: RESPOSTA_FALHA_AO_GERAR_LINK, precisa_humano: true };
  }
}

export async function runAgent(input: {
  telefone: string;
  texto: string;
  historico: HistoricoLinha[];
  produtor: ProdutorContexto;
  supabase: SupabaseClient;
  apiKey: string;
  signal: AbortSignal;
}): Promise<RespostaAgente> {
  const { telefone, texto, historico, produtor, supabase, apiKey, signal } = input;

  // Quem ainda não é cliente e responde SAIR à mensagem de recuperação sai da
  // lista de mensagens proativas. Decidido por código (é compromisso legal com
  // o usuário, não pode depender do modelo). Cliente cadastrado não entra: pra
  // ele "sair" pode significar outra coisa (painel, plano).
  if (!produtor.id && ehPedidoDeSair(texto)) {
    const { error } = await supabase
      .from("whatsapp_optout")
      .upsert(
        { whatsapp: normalizarWhatsapp(telefone), origem: "bot" },
        { onConflict: "whatsapp" },
      );
    if (error) {
      console.error("Erro ao registrar opt-out:", error);
      return {
        resposta:
          "Recebi seu pedido pra parar de receber mensagens. Vou pedir pra nossa equipe confirmar isso pra você.",
        precisa_humano: true,
        cadastro_criado: false,
        convite_dispensado: true,
      };
    }
    return {
      resposta: RESPOSTA_SAIDA_DE_MENSAGENS,
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

  // Paywall determinístico: quem já tem conta mas o trial venceu (ou a
  // assinatura não está ativa) não pode continuar recebendo dado real pelo
  // bot de graça pra sempre — isso NUNCA pode ficar a cargo do modelo (mesmo
  // risco de qualquer outra ação sensível: o modelo não é confiável pra
  // recusar sozinho de forma consistente). Quem ainda não tem conta
  // (produtor.id null, fluxo anônimo) não passa por essa checagem.
  // Pedido de acesso ao painel (link de uso único no WhatsApp) vem ANTES do
  // paywall: quem está com o teste vencido e não lembra como entrar precisa
  // justamente do painel pra assinar. Tudo aqui é decidido por código, sem o
  // modelo — é acesso à conta de alguém, não pode depender de improviso.
  if (produtor.id) {
    const pedido = classificarPedidoDeAcesso(texto, historico);
    if (pedido) {
      const respostaAcesso = await responderPedidoDeAcesso(supabase, produtor.id, pedido);
      if (respostaAcesso) return respostaAcesso;
    }
  }

  if (produtor.id) {
    const acesso = await verificarAcessoWhatsapp(supabase, produtor.id);
    if (!acesso.liberado) {
      return {
        resposta: mensagemBloqueioAcesso(acesso.comLogin, acesso.motivo),
        precisa_humano: false,
        cadastro_criado: false,
        convite_dispensado: false,
      };
    }
  }

  const messages: OpenAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContextoProdutor(produtor) },
    ...(produtor.id ? [] : [{ role: "system" as const, content: buildRegrasCadastroAnonimo() }]),
    ...(produtor.id && !produtor.user_id
      ? [{ role: "system" as const, content: buildRegrasClienteSemLogin() }]
      : []),
    { role: "system", content: buildContextoPlanos() },
    { role: "system", content: buildContextoInstitucional() },
    ...buildHistoryMessages(historico),
    { role: "user", content: texto },
  ];

  const ctx = { supabase, produtor, telefone, historico, texto };
  // Sinaliza pro n8n que a conta acabou de ser criada NESTA mensagem, pra ele
  // não emendar o convite de cadastro (que só faz sentido pra quem ainda não
  // tem conta) logo depois de "seu cadastro foi criado com sucesso" — sem
  // isso o convite aparecia de forma redundante/confusa após um cadastro OK.
  let cadastroCriado = false;
  let contaCriada: { uf: string; cultura: string } | null = null;
  let jaTentouCorrigirValor = false;

  // Fecha a resposta: aplica as redes de segurança de texto, troca a resposta
  // do modelo pela confirmação escrita por código quando o cadastro acabou
  // de ser criado, e barra valor em R$ que nenhuma fonte desta conversa
  // sustenta. Devolve null quando a resposta precisa de mais uma rodada
  // (pedido de correção de valor inventado).
  const fechar = (
    parsed: { resposta: string; precisa_humano: boolean },
    conteudoBruto: string | null | undefined,
    podeCorrigir: boolean,
  ): RespostaAgente | null => {
    if (cadastroCriado && contaCriada) {
      return {
        resposta: respostaCadastroCriado({
          nome: produtor.nome,
          uf: contaCriada.uf,
          cultura: contaCriada.cultura,
        }),
        precisa_humano: false,
        cadastro_criado: true,
        convite_dispensado: true,
      };
    }

    const numerosPermitidos = coletarNumerosPermitidos(messages, texto, historico);
    const leite = extrairResultadoLeite(messages);
    const resposta = garantirCanalDeTexto(
      garantirCotacaoLeite(
        garantirRelacaoLeiteMilho(
          garantirMediaDasPracas(
            garantirReferenciaMercado(
              garantirParidade(
                garantirRotaFrete(
                  removerMarkdownProibido(removerFechamentoGenerico(parsed.resposta)),
                  extrairUltimoFreteCitado(messages),
                ),
                extrairParidade(messages),
              ),
              extrairReferenciaMercado(messages),
            ),
            extrairMediaDasPracas(messages),
          ),
          leite.fraseRelacao,
          numerosPermitidos,
        ),
        leite.cotacao,
      ),
    );

    const naoAutorizados = valoresNaoAutorizados(resposta, numerosPermitidos);
    // Quantidades em kg/litros sem fonte (leite): sem frase pronta pra trocar,
    // segue o mesmo caminho do valor em R$ inventado (uma correção, depois recusa).
    // Só na conversa de leite: em outras culturas "15 kg" (arroba), "50 kg" etc.
    // são medidas legítimas que nenhuma ferramenta precisa devolver.
    const conversaDeLeite =
      /leite/i.test(texto) ||
      /leite/i.test(produtor.cultura_principal ?? "") ||
      leite.chamou ||
      messages.some(
        (m) =>
          m.role === "assistant" && m.tool_calls?.some((tc) => tc.function.name === "buscar_leite"),
      );
    const medidasInvalidas = conversaDeLeite
      ? medidasNaoAutorizadas(resposta, numerosPermitidos)
      : [];
    if (naoAutorizados.length > 0 || medidasInvalidas.length > 0) {
      if (podeCorrigir && !jaTentouCorrigirValor) {
        jaTentouCorrigirValor = true;
        const lista = [
          ...naoAutorizados.map((v) => `R$${v.toFixed(2).replace(".", ",")}`),
          ...medidasInvalidas.map((v) => String(v).replace(".", ",")),
        ].join(", ");
        messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
        messages.push({
          role: "system",
          content: `Correção obrigatória: sua resposta anterior citou ${lista}, que NÃO veio de nenhuma ferramenta consultada agora nem do que o produtor escreveu — é valor inventado ou copiado/ajustado de uma resposta anterior. Chame a ferramenta necessária de novo agora (ex: buscar_preco com a cultura e a UF do contexto) e responda usando SOMENTE os valores que ela retornar, sem reaproveitar nem ajustar números de mensagens anteriores. Se nenhuma ferramenta dá esse valor, não cite valor nenhum.`,
        });
        return null;
      }
      return {
        resposta: RESPOSTA_SEM_VALOR_CONFIAVEL,
        precisa_humano: false,
        cadastro_criado: cadastroCriado,
        convite_dispensado: cadastroCriado,
      };
    }

    // Cliente cadastrado só pelo WhatsApp (sem login no site): nenhum link
    // de /dashboard serve pra ele — ver guardas.ts.
    const semLogin = produtor.id && !produtor.user_id;
    const correcaoPainel = semLogin
      ? corrigirLinkDePainelParaClienteSemLogin(resposta, texto, precisaEscalarPorCobranca(texto))
      : null;
    if (correcaoPainel) {
      return { ...correcaoPainel, cadastro_criado: cadastroCriado, convite_dispensado: true };
    }

    return {
      resposta,
      precisa_humano: parsed.precisa_humano || precisaEscalarPorCobranca(texto),
      cadastro_criado: cadastroCriado,
      convite_dispensado: cadastroCriado || conversaFalaDeCadastro(resposta, historico),
    };
  };

  try {
    for (let rodada = 0; rodada < MAX_TOOL_ROUNDS; rodada++) {
      const json = await chamarOpenAI(apiKey, messages, { comTools: true, signal });
      const escolha = json.choices?.[0];
      const mensagem = escolha?.message;

      if (escolha?.finish_reason === "tool_calls" && mensagem?.tool_calls?.length) {
        messages.push({
          role: "assistant",
          content: mensagem.content ?? null,
          tool_calls: mensagem.tool_calls,
        });

        const resultados = await Promise.all(
          (mensagem.tool_calls as ToolCall[]).map(async (tc) => {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              args = {};
            }
            const resultado = await executarTool(tc.function.name, args, ctx);
            if (
              tc.function.name === "criar_conta_teste" &&
              (resultado as { sucesso?: boolean })?.sucesso === true
            ) {
              cadastroCriado = true;
              const r = resultado as { uf?: string; cultura_principal?: string };
              contaCriada = {
                uf: r.uf ?? String(args["uf"] ?? ""),
                cultura: r.cultura_principal ?? String(args["cultura_principal"] ?? ""),
              };
            }
            return { tool_call_id: tc.id, content: JSON.stringify(resultado) };
          }),
        );

        for (const r of resultados) {
          messages.push({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
        }
        continue;
      }

      if (mensagem?.content) {
        const parsed = JSON.parse(mensagem.content) as {
          resposta: string;
          precisa_humano: boolean;
        };
        const fechada = fechar(parsed, mensagem.content, true);
        if (fechada) return fechada;
        continue;
      }

      break;
    }

    // Rodadas esgotadas ainda pedindo tool — força uma resposta final com o
    // que já foi buscado, sem oferecer mais nenhuma tool pra chamar.
    const json = await chamarOpenAI(apiKey, messages, { comTools: false, signal });
    const conteudo = json.choices?.[0]?.message?.content;
    if (conteudo) {
      const parsed = JSON.parse(conteudo) as { resposta: string; precisa_humano: boolean };
      const fechada = fechar(parsed, conteudo, false);
      if (fechada) return fechada;
    }

    return FALLBACK_DURO;
  } catch (err) {
    // Antes engolia o erro em silêncio: uma rajada de 429 da OpenAI (limite de
    // tokens por minuto) virava "não consegui pensar numa resposta" sem nenhum
    // rastro nos logs de quem investiga.
    console.error("Erro no agente do bot:", err);
    return FALLBACK_DURO;
  }
}
