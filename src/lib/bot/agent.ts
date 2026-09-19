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
import type { ProdutorContexto } from "@/lib/bot/types";
import {
  coletarNumerosPermitidos,
  conversaFalaDeCadastro,
  corrigirLinkDePainelParaClienteSemLogin,
  garantirRotaFrete,
  perguntaSobrePainel,
  respostaCadastroCriado,
  respostaEntrarNoPainel,
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
// vem preço líquido, mas testando ao vivo o modelo cita só uma das duas (ou
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

  // Paywall determinístico: quem já tem conta mas o trial venceu (ou a
  // assinatura não está ativa) não pode continuar recebendo dado real pelo
  // bot de graça pra sempre — isso NUNCA pode ficar a cargo do modelo (mesmo
  // risco de qualquer outra ação sensível: o modelo não é confiável pra
  // recusar sozinho de forma consistente). Quem ainda não tem conta
  // (produtor.id null, fluxo anônimo) não passa por essa checagem.
  if (produtor.id) {
    const acesso = await verificarAcessoWhatsapp(supabase, produtor.id);
    if (!acesso.liberado) {
      return {
        resposta: mensagemBloqueioAcesso(acesso.comLogin),
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

    // Cliente que já tem login perguntando como entrar no painel: texto fixo
    // (o modelo já disse que o login era "com seu WhatsApp", o que é falso).
    if (
      produtor.id &&
      produtor.user_id &&
      perguntaSobrePainel(texto) &&
      !/cancel/i.test(texto) &&
      !precisaEscalarPorCobranca(texto)
    ) {
      return {
        resposta: respostaEntrarNoPainel(),
        precisa_humano: false,
        cadastro_criado: cadastroCriado,
        convite_dispensado: true,
      };
    }

    const resposta = garantirRotaFrete(
      removerMarkdownProibido(removerFechamentoGenerico(parsed.resposta)),
      extrairUltimoFreteCitado(messages),
    );

    const naoAutorizados = valoresNaoAutorizados(
      resposta,
      coletarNumerosPermitidos(messages, texto, historico),
    );
    if (naoAutorizados.length > 0) {
      if (podeCorrigir && !jaTentouCorrigirValor) {
        jaTentouCorrigirValor = true;
        const lista = naoAutorizados.map((v) => `R$${v.toFixed(2).replace(".", ",")}`).join(", ");
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
        const parsed = JSON.parse(mensagem.content) as { resposta: string; precisa_humano: boolean };
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
  } catch {
    return FALLBACK_DURO;
  }
}
