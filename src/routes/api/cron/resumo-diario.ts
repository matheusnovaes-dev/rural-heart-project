import { createFileRoute } from "@tanstack/react-router";

import { produtoresComAcesso } from "@/lib/acessoConta.server";
import { supabaseServiceRole } from "@/lib/supabase.server";
import { montarResumoReativacao } from "@/lib/bot/reengajamento";

type Produtor = {
  id: string;
  nome: string;
  whatsapp: string | null;
  uf: string | null;
  cultura_principal: string | null;
  resumo_diario_hora: number | null;
  resumo_diario_enviado_em: string | null;
};

/**
 * Resumo diário ("bom dia resumido") — pedido do Matheus 2026-10-12.
 * Diferente de /api/cron/mensagem-proativa (só manda quando algo mudou de
 * verdade), este SEMPRE manda, uma vez por dia, no horário que o próprio
 * produtor escolheu (resumo_diario_hora, 0-23, horário de Brasília) — opt-in
 * via configurar_resumo_diario no bot. Roda de hora em hora; cada run só
 * processa quem escolheu a hora atual.
 *
 * Travado por padrão em `automacoes_config` (chave "resumo_diario") — só
 * ligar depois do template `resumo_diario_safralume` estar aprovado.
 * `?simular=1` mostra quem receberia o quê, sem mandar mensagem.
 */
export const Route = createFileRoute("/api/cron/resumo-diario")({
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

        const simular = new URL(request.url).searchParams.get("simular") === "1";
        const supabase = supabaseServiceRole();

        const { data: config } = await supabase
          .from("automacoes_config")
          .select("ativa")
          .eq("chave", "resumo_diario")
          .maybeSingle();
        if (!config?.ativa && !simular) return Response.json({ ativa: false });

        const agora = new Date();
        // % 24: em alguns ambientes a meia-noite sai como "24" com hour12:false,
        // e quem escolheu 0h nunca bateria.
        const horaBrt =
          Number(
            agora.toLocaleString("en-US", {
              timeZone: "America/Sao_Paulo",
              hour: "2-digit",
              hour12: false,
            }),
          ) % 24;

        const { data: produtores } = await supabase
          .from("produtores")
          .select(
            "id, nome, whatsapp, uf, cultura_principal, resumo_diario_hora, resumo_diario_enviado_em",
          )
          .eq("resumo_diario_ativo", true)
          .returns<Produtor[]>();

        // O GitHub Actions atrasa cron em horas (já medido: 2-4h), então exigir
        // "hora == hora atual" fazia quem escolheu 7h não receber nada no dia em
        // que a rodada de 7h caía em 8h. Agora vale a hora escolhida até
        // JANELA_ATRASO_H horas atrás; a trava de 20h abaixo evita repetir.
        const candidatos = (produtores ?? []).filter((p) => {
          if (p.resumo_diario_hora == null) return false;
          const atraso = (horaBrt - p.resumo_diario_hora + 24) % 24;
          return atraso <= JANELA_ATRASO_H;
        });

        let enviados = 0;
        let pulados = 0;
        const simulados: { nome: string; uf: string; cultura: string; resumo: string }[] = [];

        const comAcesso = await produtoresComAcesso(supabase);

        for (const produtor of candidatos) {
          try {
            if (comAcesso && !comAcesso.has(produtor.id)) {
              pulados++;
              continue;
            }
            if (!produtor.whatsapp || !produtor.uf || !produtor.cultura_principal) {
              pulados++;
              continue;
            }
            if (
              produtor.resumo_diario_enviado_em &&
              agora.getTime() - new Date(produtor.resumo_diario_enviado_em).getTime() <
                INTERVALO_MINIMO_MS
            ) {
              pulados++;
              continue;
            }

            const resumo = await montarResumoReativacao(
              supabase,
              { uf: produtor.uf, cultura_principal: produtor.cultura_principal },
              produtor.id,
            );
            if (!resumo) {
              pulados++;
              continue;
            }

            if (simular) {
              simulados.push({
                nome: produtor.nome,
                uf: produtor.uf,
                cultura: produtor.cultura_principal,
                resumo,
              });
              continue;
            }

            await notificarWhatsAppResumoDiario(produtor.whatsapp, produtor.nome, resumo);

            await supabase
              .from("produtores")
              .update({ resumo_diario_enviado_em: agora.toISOString() })
              .eq("id", produtor.id);
            enviados++;
          } catch (err) {
            console.error(`Falha ao mandar resumo diário (produtor ${produtor.id}):`, err);
          }
        }

        return Response.json({
          hora_brt: horaBrt,
          candidatos: candidatos.length,
          enviados,
          pulados,
          ...(simular ? { simulados } : {}),
        });
      },
    },
  },
});

const TEMPLATE_RESUMO_DIARIO = "resumo_diario_safralume";
const JANELA_ATRASO_H = 3;
// Menor que 24h de propósito (quem escolheu 7h e recebeu às 8h por atraso não
// pode ficar sem o do dia seguinte às 7h), maior que a janela de atraso.
const INTERVALO_MINIMO_MS = 20 * 60 * 60 * 1000;

async function notificarWhatsAppResumoDiario(whatsapp: string, nome: string, resumo: string) {
  const webhookUrl = process.env["N8N_COBRANCA_WEBHOOK_URL"];
  const token = process.env["N8N_COBRANCA_TOKEN"];
  // Lança em vez de retornar calado: o chamador só marca "enviado" se isto
  // não lançar, senão um webhook fora do ar queimava o dia do produtor.
  if (!webhookUrl || !token) throw new Error("webhook do n8n não configurado");

  const primeiroNome = nome.trim().split(" ")[0] || nome;

  const resposta = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-safralume-token": token },
    body: JSON.stringify({
      telefone: `55${whatsapp}`,
      template: TEMPLATE_RESUMO_DIARIO,
      nome: primeiroNome,
      resumo,
    }),
  });
  if (!resposta.ok) throw new Error(`webhook do n8n respondeu ${resposta.status}`);
}
