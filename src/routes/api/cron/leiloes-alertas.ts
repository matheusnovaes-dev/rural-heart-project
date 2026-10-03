import { createFileRoute } from "@tanstack/react-router";

import { supabaseServiceRole } from "@/lib/supabase.server";

type AlertaLeilao = {
  id: string;
  produtor_id: string;
  uf: string | null;
  tipo_preferido: "presencial" | "virtual" | "qualquer";
  whatsapp_destino: string;
};

type Leilao = {
  id: string;
  titulo: string;
  data_hora: string | null;
  municipio: string | null;
  uf: string | null;
};

function ehVirtual(l: Leilao) {
  return (l.municipio ?? "").toUpperCase().startsWith("VIRTUAL");
}

function formatarData(iso: string | null) {
  if (!iso) return "data a confirmar";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Checa alertas de leilão (alertas_leilao) contra a agenda ingerida
 * (leiloes_agendados) e avisa só sobre leilão NOVO que esse alerta ainda não
 * notificou (leiloes_notificados) — assim o alerta fica "vivo", pegando
 * leilão novo conforme a agenda é atualizada, em vez de disparar uma vez só.
 * Chamado pelo cron diário do conab-ingestor, depois do ingest da agenda.
 */
export const Route = createFileRoute("/api/cron/leiloes-alertas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env["CRON_SECRET"];
        const supabaseUrl = process.env["SB_URL"];
        const serviceRoleKey = process.env["SB_SERVICE_ROLE_KEY"];

        if (!cronSecret || !supabaseUrl || !serviceRoleKey) {
          return new Response("Missing server configuration", { status: 500 });
        }
        if (request.headers.get("x-cron-secret") !== cronSecret) {
          return new Response("Token inválido", { status: 401 });
        }

        const supabase = supabaseServiceRole();

        const { data: alertas } = await supabase
          .from("alertas_leilao")
          .select("id, produtor_id, uf, tipo_preferido, whatsapp_destino")
          .eq("ativo", true)
          .returns<AlertaLeilao[]>();

        const { data: leiloes } = await supabase
          .from("leiloes_agendados")
          .select("id, titulo, data_hora, municipio, uf")
          .gte("data_hora", new Date().toISOString())
          .returns<Leilao[]>();

        let notificados = 0;
        let pulados = 0;

        for (const alerta of alertas ?? []) {
          try {
            const candidatos = (leiloes ?? []).filter((l) => {
              const virtual = ehVirtual(l);
              if (alerta.tipo_preferido === "presencial" && virtual) return false;
              if (alerta.tipo_preferido === "virtual" && !virtual) return false;
              if (!virtual && alerta.uf && l.uf !== alerta.uf) return false;
              return true;
            });
            if (candidatos.length === 0) {
              pulados++;
              continue;
            }

            const { data: jaNotificados } = await supabase
              .from("leiloes_notificados")
              .select("leilao_id")
              .eq("alerta_id", alerta.id)
              .in(
                "leilao_id",
                candidatos.map((c) => c.id),
              );
            const idsJaNotificados = new Set((jaNotificados ?? []).map((n) => n.leilao_id));
            const novos = candidatos.filter((c) => !idsJaNotificados.has(c.id));
            if (novos.length === 0) {
              pulados++;
              continue;
            }

            const { data: produtor } = await supabase
              .from("produtores")
              .select("nome")
              .eq("id", alerta.produtor_id)
              .maybeSingle<{ nome: string }>();
            if (!produtor) {
              pulados++;
              continue;
            }

            const resumo = novos
              .slice(0, 3)
              .map((l) => `${l.titulo} (${formatarData(l.data_hora)}${l.uf ? `, ${l.uf}` : ""})`)
              .join("; ");

            await notificarWhatsAppLeilao(alerta.whatsapp_destino, produtor.nome, resumo);
            await supabase
              .from("leiloes_notificados")
              .insert(novos.map((l) => ({ alerta_id: alerta.id, leilao_id: l.id })));
            notificados++;
          } catch (err) {
            console.error(`Falha ao notificar alerta de leilão ${alerta.id}:`, err);
          }
        }

        return Response.json({ alertas: alertas?.length ?? 0, notificados, pulados });
      },
    },
  },
});

async function notificarWhatsAppLeilao(whatsapp: string, nome: string, resumo: string) {
  const webhookUrl = process.env["N8N_COBRANCA_WEBHOOK_URL"];
  const token = process.env["N8N_COBRANCA_TOKEN"];
  if (!webhookUrl || !token) return;

  const primeiroNome = nome.trim().split(" ")[0] || nome;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-safralume-token": token },
    body: JSON.stringify({
      telefone: `55${whatsapp}`,
      template: "leilao_disponivel_safralu",
      nome: primeiroNome,
      resumo,
    }),
  });
}
