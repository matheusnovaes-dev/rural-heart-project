import { createFileRoute } from "@tanstack/react-router";

import { runAgent, type RespostaAgente } from "@/lib/bot/agent";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { ProdutorContexto } from "@/lib/bot/types";
import { supabaseServiceRole } from "@/lib/supabase.server";

type RequestBody = {
  telefone: string;
  texto: string;
  produtor: ProdutorContexto;
  historico: HistoricoLinha[];
};

const TIMEOUT_MS = 25_000;

const FALLBACK_DURO: RespostaAgente = {
  resposta: "Desculpa, não consegui pensar numa resposta agora. Pode tentar de novo em instantes?",
  precisa_humano: true,
};

/**
 * "Cérebro" do bot WhatsApp — chamado pelo n8n (que continua dono da fila,
 * transcrição de áudio e envio da mensagem) com a pergunta do produtor e o
 * histórico recente, roda o loop de function-calling com a OpenAI, e
 * devolve a resposta pronta pra enviar. Sempre 200 quando processado (até
 * em fallback) — só 401/400/500 são falha de infraestrutura de verdade.
 */
export const Route = createFileRoute("/api/bot/responder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["BOT_BRAIN_TOKEN"];
        const openaiApiKey = process.env["OPENAI_API_KEY"];
        const supabaseUrl = process.env["SB_URL"];
        const serviceRoleKey = process.env["SB_SERVICE_ROLE_KEY"];

        if (!token || !openaiApiKey || !supabaseUrl || !serviceRoleKey) {
          return new Response("Missing server configuration", { status: 500 });
        }

        if (request.headers.get("x-safralume-token") !== token) {
          return new Response("Token inválido", { status: 401 });
        }

        let body: RequestBody;
        try {
          body = (await request.json()) as RequestBody;
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }
        if (!body.telefone || !body.texto || !body.produtor) {
          return new Response("Campos obrigatórios ausentes", { status: 400 });
        }

        const supabase = supabaseServiceRole();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const resposta = await runAgent({
            telefone: body.telefone,
            texto: body.texto,
            historico: body.historico ?? [],
            produtor: body.produtor,
            supabase,
            apiKey: openaiApiKey,
            signal: controller.signal,
          });
          return Response.json(resposta);
        } catch (err) {
          console.error("Erro no agente do bot:", err);
          return Response.json(FALLBACK_DURO);
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});
