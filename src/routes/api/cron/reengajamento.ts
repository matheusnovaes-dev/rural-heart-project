import { createFileRoute } from "@tanstack/react-router";

import { supabaseServiceRole } from "@/lib/supabase.server";
import { montarResumoReengajamento } from "@/lib/bot/reengajamento";

type AssinaturaTrial = {
  id: string;
  produtor_id: string | null;
  created_at: string;
};

type Produtor = {
  nome: string;
  whatsapp: string | null;
  uf: string | null;
  cultura_principal: string | null;
};

const HORAS_SEM_INTERACAO = 36;

// Número de celular brasileiro chega em duas variantes (com ou sem o 9º
// dígito após o DDD) dependendo de como foi digitado/salvo — achado real
// comparando produtores.whatsapp com bot_conversas.telefone: o mesmo
// produtor (o próprio Matheus) aparecia salvo em formatos diferentes nas
// duas tabelas. Sem checar as duas variantes, essa rota acharia "nunca
// conversou" pra gente que já conversou, e mandaria o lembrete à toa.
function variantesTelefone(whatsapp: string): string[] {
  const ddd = whatsapp.slice(0, 2);
  const resto = whatsapp.slice(2);
  let variante = whatsapp;
  if (resto.length === 9 && resto[0] === "9") {
    variante = ddd + resto.slice(1);
  } else if (resto.length === 8) {
    variante = ddd + "9" + resto;
  }
  return [...new Set([whatsapp, variante])];
}

/**
 * Lembrete de retomada — achado real analisando os 28 primeiros cadastros
 * (2026-09-30): 18 nunca mandaram mensagem nenhuma pro bot, e quase todos
 * os outros sumiram na mesma sessão do cadastro, sem nunca mais voltar.
 * Diferente do aviso de trial acabando (que é sobre prazo), esse é sobre
 * retomar contato com quem esfriou — só dispara quando tem algo REAL e
 * específico pra contar (preço, progresso de safra, ferrugem), nunca um
 * "oi, tudo bem?" genérico. Chamado pelo mesmo cron externo do aviso-trial.
 */
export const Route = createFileRoute("/api/cron/reengajamento")({
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
        const agora = new Date();
        const limiteSemInteracao = new Date(agora.getTime() - HORAS_SEM_INTERACAO * 3_600_000);

        const { data: candidatos } = await supabase
          .from("assinaturas")
          .select("id, produtor_id, created_at")
          .eq("status", "trial")
          .is("reengajamento_enviado_em", null)
          .gt("trial_expira_em", agora.toISOString())
          .lte("created_at", limiteSemInteracao.toISOString())
          .not("produtor_id", "is", null)
          .returns<AssinaturaTrial[]>();

        let enviados = 0;
        let pulados = 0;

        for (const assinatura of candidatos ?? []) {
          try {
            const { data: produtor } = await supabase
              .from("produtores")
              .select("nome, whatsapp, uf, cultura_principal")
              .eq("id", assinatura.produtor_id!)
              .maybeSingle<Produtor>();

            if (!produtor?.whatsapp || !produtor.uf || !produtor.cultura_principal) {
              pulados++;
              continue;
            }

            const telefonesCompletos = variantesTelefone(produtor.whatsapp).map((v) => `55${v}`);
            const { data: ultimaMensagem } = await supabase
              .from("bot_conversas")
              .select("created_at")
              .in("telefone", telefonesCompletos)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle<{ created_at: string }>();

            // Já conversou recentemente (independente de quando o trial
            // começou) — não interrompe quem já tá ativo.
            if (ultimaMensagem && new Date(ultimaMensagem.created_at) > limiteSemInteracao) {
              pulados++;
              continue;
            }

            const resumo = await montarResumoReengajamento(supabase, {
              uf: produtor.uf,
              cultura_principal: produtor.cultura_principal,
            });
            if (!resumo) {
              // Sem dado real pra essa cultura/UF agora — não manda lembrete vazio.
              pulados++;
              continue;
            }

            await notificarWhatsAppReengajamento(produtor.whatsapp, produtor.nome, resumo);
            await supabase
              .from("assinaturas")
              .update({ reengajamento_enviado_em: agora.toISOString() })
              .eq("id", assinatura.id);
            enviados++;
          } catch (err) {
            // Uma falha não pode travar o lote inteiro.
            console.error(`Falha ao reengajar (assinatura ${assinatura.id}):`, err);
          }
        }

        return Response.json({ candidatos: candidatos?.length ?? 0, enviados, pulados });
      },
    },
  },
});

async function notificarWhatsAppReengajamento(whatsapp: string, nome: string, resumo: string) {
  const webhookUrl = process.env["N8N_COBRANCA_WEBHOOK_URL"];
  const token = process.env["N8N_COBRANCA_TOKEN"];
  if (!webhookUrl || !token) return;

  const primeiroNome = nome.trim().split(" ")[0] || nome;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-safralume-token": token },
    body: JSON.stringify({
      telefone: `55${whatsapp}`,
      template: "reengajamento_safralu",
      nome: primeiroNome,
      resumo,
    }),
  });
}
