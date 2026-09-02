import { createFileRoute } from "@tanstack/react-router";

import { enviarEmailTrialExpirando } from "@/lib/email";
import { supabaseServiceRole } from "@/lib/supabase.server";

type AssinaturaTrial = {
  id: string;
  plano: string;
  produtor_id: string | null;
  cooperativa_id: string | null;
  trial_expira_em: string;
};

/**
 * Avisa quem tá com teste grátis acabando (1-2 dias antes), pra dar chance
 * de escolher um plano e configurar o pagamento ANTES do painel travar —
 * sem isso, a única forma de saber que o trial acabou seria descobrir na
 * marra ao ser barrado. Chamado por um cron externo (GitHub Actions do
 * conab-ingestor, 1x/dia), autenticado por um segredo compartilhado — não
 * pela Asaas, então não reaproveita o token do webhook dela.
 */
export const Route = createFileRoute("/api/cron/aviso-trial")({
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
        const daquiA2Dias = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

        const { data: assinaturas } = await supabase
          .from("assinaturas")
          .select("id, plano, produtor_id, cooperativa_id, trial_expira_em")
          .eq("status", "trial")
          .is("aviso_trial_enviado_em", null)
          .gt("trial_expira_em", new Date().toISOString())
          .lte("trial_expira_em", daquiA2Dias)
          .returns<AssinaturaTrial[]>();

        let enviados = 0;
        for (const assinatura of assinaturas ?? []) {
          const diasRestantes = Math.max(
            0,
            Math.ceil((new Date(assinatura.trial_expira_em).getTime() - Date.now()) / 86_400_000),
          );

          try {
            if (assinatura.produtor_id) {
              const { data: produtor } = await supabase
                .from("produtores")
                .select("nome, whatsapp")
                .eq("id", assinatura.produtor_id)
                .maybeSingle();
              if (produtor?.whatsapp) {
                await notificarWhatsAppTrial(produtor.whatsapp, produtor.nome, diasRestantes);
              }
            } else if (assinatura.cooperativa_id) {
              // Uma cooperativa pode ter mais de um admin — avisa todos, não
              // só "o" admin (uma cooperativa com 2+ admins não pode ficar
              // sem aviso nenhum).
              const { data: admins } = await supabase
                .from("cooperativa_membros")
                .select("nome, email")
                .eq("cooperativa_id", assinatura.cooperativa_id)
                .eq("papel", "admin");
              for (const admin of admins ?? []) {
                if (!admin.email) continue;
                await enviarEmailTrialExpirando({
                  to: admin.email,
                  nome: admin.nome ?? "produtor",
                  plano: assinatura.plano,
                  diasRestantes,
                });
              }
            }
            await supabase
              .from("assinaturas")
              .update({ aviso_trial_enviado_em: new Date().toISOString() })
              .eq("id", assinatura.id);
            enviados++;
          } catch (err) {
            // Um envio falhar não pode travar os outros do lote.
            console.error(`Falha ao avisar trial expirando (assinatura ${assinatura.id}):`, err);
          }
        }

        return Response.json({ processados: assinaturas?.length ?? 0, enviados });
      },
    },
  },
});

async function notificarWhatsAppTrial(whatsapp: string, nome: string, diasRestantes: number) {
  const webhookUrl = process.env["N8N_COBRANCA_WEBHOOK_URL"];
  const token = process.env["N8N_COBRANCA_TOKEN"];
  if (!webhookUrl || !token) return;

  const primeiroNome = nome.split(" ")[0] || nome;
  const prazo =
    diasRestantes <= 0 ? "hoje" : `em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-safralume-token": token },
    body: JSON.stringify({
      telefone: `55${whatsapp}`,
      template: "trial_expirando_safralu",
      nome: primeiroNome,
      prazo,
    }),
  });
}
