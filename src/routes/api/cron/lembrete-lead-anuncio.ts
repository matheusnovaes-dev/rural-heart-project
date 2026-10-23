import { createFileRoute } from "@tanstack/react-router";

import { escolherCandidatos, MARCA_DO_LEMBRETE, type Linha } from "@/lib/lembreteLeadAnuncio";
import { dentroDoHorarioDeEnvio } from "@/lib/recuperacaoCadastro";
import { supabaseServiceRole } from "@/lib/supabase.server";

/** DDD + últimos 8 dígitos: casa número com e sem o 9º dígito. */
const chave = (t: string) => {
  let d = t.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return `${d.slice(0, 2)}${d.slice(-8)}`;
};

/**
 * Lembrete dentro da janela de 24h para leads do anúncio que pararam no menu do cadastro (ver lib/lembreteLeadAnuncio.ts).
 * Chamado de 30 em 30 minutos por um workflow do n8n (que também faz o envio do WhatsApp com o que esta rota devolver em
 * `mensagens`). Travas: automação desligada por padrão (automacoes_config, chave "lembrete_lead_anuncio"), só 8h às 20h59 de
 * Brasília, no máximo 8 por rodada, uma vez por pessoa, nunca para cadastrado, quem pediu para sair ou foi passado à equipe.
 * `?simular=1` mostra quem receberia (telefone mascarado), sem gravar nada e sem exigir a automação ligada.
 */
export const Route = createFileRoute("/api/cron/lembrete-lead-anuncio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env["CRON_SECRET"];
        if (!cronSecret) return new Response("Missing server configuration", { status: 500 });
        if (request.headers.get("x-cron-secret") !== cronSecret) {
          return new Response("Token inválido", { status: 401 });
        }
        const simular = new URL(request.url).searchParams.get("simular") === "1";
        const supabase = supabaseServiceRole();

        const { data: config } = await supabase
          .from("automacoes_config")
          .select("ativa")
          .eq("chave", "lembrete_lead_anuncio")
          .maybeSingle();
        if (!config?.ativa && !simular) return Response.json({ ativa: false, mensagens: [] });
        if (!dentroDoHorarioDeEnvio(new Date()) && !simular) {
          return Response.json({ ativa: true, fora_do_horario: true, mensagens: [] });
        }

        const agora = Date.now();
        const desde = new Date(agora - 22 * 3_600_000).toISOString();
        const linhas: Linha[] = [];
        for (let pagina = 0; pagina < 6; pagina++) {
          const { data: lote } = await supabase
            .from("bot_conversas")
            .select("telefone, role, conteudo, created_at")
            .gte("created_at", desde)
            .order("created_at", { ascending: true })
            .range(pagina * 1000, pagina * 1000 + 999);
          linhas.push(...((lote ?? []) as Linha[]));
          if ((lote?.length ?? 0) < 1000) break;
        }

        const [{ data: produtores }, { data: lembrados }, { data: saiu }] = await Promise.all([
          supabase.from("produtores").select("whatsapp"),
          supabase
            .from("bot_conversas")
            .select("telefone")
            .eq("role", "assistant")
            .ilike("conteudo", `%${MARCA_DO_LEMBRETE}%`)
            .gte("created_at", new Date(agora - 3 * 86_400_000).toISOString()),
          supabase.from("whatsapp_optout").select("whatsapp"),
        ]);
        const set = (l: { [k: string]: string }[] | null, campo: string) =>
          new Set((l ?? []).map((x) => chave(x[campo] ?? "")));

        const candidatos = escolherCandidatos(linhas, {
          agora,
          jaCadastrados: set(produtores, "whatsapp"),
          jaLembrados: set(lembrados, "telefone"),
          optout: set(saiu, "whatsapp"),
          chave,
          max: 8,
        });

        if (simular) {
          return Response.json({
            simular: true,
            candidatos: candidatos.map((c) => ({
              telefone: `***${c.telefone.slice(-4)}`,
              passo: c.passo,
              parado_ha_min: c.minutosParado,
              texto: c.texto,
            })),
          });
        }

        // Marca como lembrado ANTES de o n8n enviar: nunca manda duas vezes, e o bot passa a enxergar a pergunta no histórico
        // (o cadastro retoma do ponto certo quando a pessoa responder).
        const mensagens: { telefone: string; texto: string }[] = [];
        for (const c of candidatos) {
          const { error } = await supabase.from("bot_conversas").insert({
            telefone: c.telefone,
            role: "assistant",
            conteudo: c.texto,
            precisa_humano: false,
          });
          if (!error) mensagens.push({ telefone: c.telefone, texto: c.texto });
        }
        return Response.json({ ativa: true, mensagens });
      },
    },
  },
});
