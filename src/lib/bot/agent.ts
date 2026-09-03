import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildContextoProdutor,
  buildHistoryMessages,
  SYSTEM_PROMPT,
  type HistoricoLinha,
} from "@/lib/bot/prompt";
import { executarTool, TOOLS } from "@/lib/bot/tools/index";
import type { ProdutorContexto } from "@/lib/bot/types";

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

export type RespostaAgente = { resposta: string; precisa_humano: boolean };

// Rede de segurança determinística: o prompt já proíbe fechar a resposta
// com uma oferta de ajuda genérica ("se precisar de algo, é só avisar"),
// mas testando ao vivo isso ainda escapa em ~1/3 das respostas mesmo depois
// de várias rodadas de reforço no texto do prompt — é um hábito do modelo
// que instrução sozinha não elimina de forma confiável. Em vez de insistir
// só no prompt, remove a frase de fechamento aqui, garantido por código.
const PADRAO_FECHAMENTO_SE_PRECISAR =
  /(?:^|[.!?]\s+)(?:se precisar|caso precise|precisando)[^.!?]*?\b(?:avis\w*|\bfala\b|\bfalar\b|\bfale\b|pergunt\w*|cham\w*|acess\w*|confer\w*|conf(?:ira|ere)|check\w*|clic\w*)[^.!?]*[.!?]?\s*$/i;
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

const FALLBACK_DURO: RespostaAgente = {
  resposta: "Desculpa, não consegui pensar numa resposta agora. Pode tentar de novo em instantes?",
  precisa_humano: true,
};

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

  const messages: OpenAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContextoProdutor(produtor) },
    ...buildHistoryMessages(historico),
    { role: "user", content: texto },
  ];

  const ctx = { supabase, produtor, telefone };

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
            return { tool_call_id: tc.id, content: JSON.stringify(resultado) };
          }),
        );

        for (const r of resultados) {
          messages.push({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
        }
        continue;
      }

      if (mensagem?.content) {
        const parsed = JSON.parse(mensagem.content) as RespostaAgente;
        return { ...parsed, resposta: removerFechamentoGenerico(parsed.resposta) };
      }

      break;
    }

    // Rodadas esgotadas ainda pedindo tool — força uma resposta final com o
    // que já foi buscado, sem oferecer mais nenhuma tool pra chamar.
    const json = await chamarOpenAI(apiKey, messages, { comTools: false, signal });
    const conteudo = json.choices?.[0]?.message?.content;
    if (conteudo) {
      const parsed = JSON.parse(conteudo) as RespostaAgente;
      return { ...parsed, resposta: removerFechamentoGenerico(parsed.resposta) };
    }

    return FALLBACK_DURO;
  } catch {
    return FALLBACK_DURO;
  }
}
