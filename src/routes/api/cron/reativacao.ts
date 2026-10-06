import { createFileRoute } from "@tanstack/react-router";

import { supabaseServiceRole } from "@/lib/supabase.server";
import { montarResumoReengajamento } from "@/lib/bot/reengajamento";

type AssinaturaTrialVencido = {
  id: string;
  produtor_id: string | null;
  trial_expira_em: string;
};

type Produtor = {
  nome: string;
  whatsapp: string | null;
  uf: string | null;
  cultura_principal: string | null;
};

const DIAS_NOVO_TRIAL = 7;

// Mesma lógica de variantes de telefone do /api/cron/reengajamento (DDD +
// com/sem o 9º dígito) — sem isso essa rota acharia "nunca conversou" pra
// quem já conversou, e mandaria o lembrete à toa.
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
 * Lembrete de reativação — achado real 2026-10-06 analisando os "nunca
 * mandou mensagem": diferente de /api/cron/reengajamento (que avisa quem
 * AINDA está no trial e sumiu), essa cobre quem deixou o trial vencer sem
 * NUNCA ter mandado uma mensagem sequer — hoje esse grupo não recebe nada
 * (reengajamento só roda com trial_expira_em no futuro). Como a pessoa
 * nunca viu o produto funcionar, a oferta aqui não é só "volta a
 * conversar": reabre um trial novo de verdade (reseta trial_expira_em) no
 * mesmo instante que manda a mensagem, pra quem clicar já encontrar o
 * painel liberado — nunca promete acesso que não existe ainda.
 */
export const Route = createFileRoute("/api/cron/reativacao")({
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

        const { data: candidatos } = await supabase
          .from("assinaturas")
          .select("id, produtor_id, trial_expira_em")
          .eq("status", "trial")
          .is("reativacao_enviado_em", null)
          .lt("trial_expira_em", agora.toISOString())
          .not("produtor_id", "is", null)
          .returns<AssinaturaTrialVencido[]>();

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

            // Diferente do /api/cron/reengajamento (que só olha mensagem
            // RECENTE), aqui é "nunca mandou mensagem NENHUMA alguma vez" —
            // quem já conversou (mesmo que tenha sumido depois) não é esse
            // público, é o de reengajamento.
            const telefonesCompletos = variantesTelefone(produtor.whatsapp).map((v) => `55${v}`);
            const { count: totalMensagens } = await supabase
              .from("bot_conversas")
              .select("telefone", { count: "exact", head: true })
              .in("telefone", telefonesCompletos);

            if (totalMensagens && totalMensagens > 0) {
              pulados++;
              continue;
            }

            const resumo = await montarResumoReengajamento(supabase, {
              uf: produtor.uf,
              cultura_principal: produtor.cultura_principal,
            });
            if (!resumo) {
              // Sem dado real pra essa cultura/UF agora — não manda lembrete
              // vazio. Sem marcar reativacao_enviado_em: tenta de novo no
              // próximo cron, quando talvez já tenha dado.
              pulados++;
              continue;
            }

            await notificarWhatsAppReativacao(produtor.whatsapp, produtor.nome, resumo);

            const novoTrialExpiraEm = new Date(agora.getTime() + DIAS_NOVO_TRIAL * 86_400_000);
            await supabase
              .from("assinaturas")
              .update({
                reativacao_enviado_em: agora.toISOString(),
                trial_expira_em: novoTrialExpiraEm.toISOString(),
              })
              .eq("id", assinatura.id);
            enviados++;
          } catch (err) {
            // Uma falha não pode travar o lote inteiro.
            console.error(`Falha ao reativar (assinatura ${assinatura.id}):`, err);
          }
        }

        return Response.json({ candidatos: candidatos?.length ?? 0, enviados, pulados });
      },
    },
  },
});

async function notificarWhatsAppReativacao(whatsapp: string, nome: string, resumo: string) {
  const webhookUrl = process.env["N8N_COBRANCA_WEBHOOK_URL"];
  const token = process.env["N8N_COBRANCA_TOKEN"];
  if (!webhookUrl || !token) return;

  const primeiroNome = nome.trim().split(" ")[0] || nome;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-safralume-token": token },
    body: JSON.stringify({
      telefone: `55${whatsapp}`,
      template: "reativacao_trial_safralume",
      nome: primeiroNome,
      resumo,
    }),
  });
}
