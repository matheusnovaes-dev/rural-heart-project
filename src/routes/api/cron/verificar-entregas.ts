import { createFileRoute } from "@tanstack/react-router";

import { supabaseServiceRole } from "@/lib/supabase.server";

type FalhaWhatsapp = { telefone: string; created_at: string };

type Assinatura = {
  id: string;
  produtor_id: string;
  reativacao_enviado_em: string | null;
  reativacao_retentativas: number;
  reengajamento_enviado_em: string | null;
  reengajamento_retentativas: number;
};

// Mesma lógica de variantes de telefone usada em reativacao.ts/reengajamento.ts.
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

// Janela entre "mandamos a mensagem" e "a Meta avisou que não entregou" —
// generosa o bastante pra cobrir o callback de status chegando atrasado, mas
// curta o bastante pra não casar com um envio completamente sem relação.
const JANELA_CORRELACAO_HORAS = 6;

/**
 * Lê whatsapp_falhas (populada por um webhook externo de status do
 * WhatsApp, fora deste repo — nada no código daqui escrevia ou lia essa
 * tabela antes) e reabre UMA tentativa pra quem foi marcado como "já
 * reativado"/"já reengajado" mas a mensagem nunca chegou de verdade.
 *
 * Achado real 2026-10-08: "accepted" na resposta da API do WhatsApp não
 * quer dizer "entregue" — Ricardo Campos e Renan Luz (reativação de
 * 2026-10-07) foram marcados como contactados e nunca receberam nada.
 *
 * Só reabre pro erro genérico "Message undeliverable" (131026) — NUNCA
 * pro "not delivered to maintain healthy ecosystem engagement" (131049,
 * o throttle de quality score do WhatsApp): reenviar na hora pra um
 * número que acabou de ser barrado por excesso de mensagem só pioraria
 * exatamente o risco que a gente tenta evitar. Máximo 1 retentativa por
 * pessoa (reativacao_retentativas/reengajamento_retentativas) — depois
 * disso, se falhar de novo, é sinal de número inválido de verdade, não
 * vale ficar tentando pra sempre.
 */
export const Route = createFileRoute("/api/cron/verificar-entregas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env["CRON_SECRET"];
        if (!cronSecret) {
          return new Response("Missing server configuration", { status: 500 });
        }
        if (request.headers.get("x-cron-secret") !== cronSecret) {
          return new Response("Token inválido", { status: 401 });
        }

        const supabase = supabaseServiceRole();
        const desde = new Date(Date.now() - 24 * 3_600_000);

        const { data: falhas } = await supabase
          .from("whatsapp_falhas")
          .select("telefone, created_at")
          .eq("codigo_erro", 131026)
          .gte("created_at", desde.toISOString())
          .returns<FalhaWhatsapp[]>();

        let reabertos = 0;
        let semCorrespondencia = 0;
        let jaTentouAntes = 0;

        for (const falha of falhas ?? []) {
          try {
            // telefone em whatsapp_falhas vem com "55" na frente (mesmo
            // formato que o código manda pra API) — tira pra comparar com
            // produtores.whatsapp, que não tem o DDI.
            const semDdi = falha.telefone.startsWith("55")
              ? falha.telefone.slice(2)
              : falha.telefone;
            const variantes = variantesTelefone(semDdi);

            const { data: produtor } = await supabase
              .from("produtores")
              .select("id")
              .in("whatsapp", variantes)
              .maybeSingle();

            if (!produtor) {
              semCorrespondencia++;
              continue;
            }

            const { data: assinatura } = await supabase
              .from("assinaturas")
              .select(
                "id, produtor_id, reativacao_enviado_em, reativacao_retentativas, reengajamento_enviado_em, reengajamento_retentativas",
              )
              .eq("produtor_id", produtor.id)
              .maybeSingle<Assinatura>();

            if (!assinatura) {
              semCorrespondencia++;
              continue;
            }

            const falhaEm = new Date(falha.created_at).getTime();
            const dentroDaJanela = (envioIso: string) =>
              Math.abs(falhaEm - new Date(envioIso).getTime()) <=
              JANELA_CORRELACAO_HORAS * 3_600_000;

            if (
              assinatura.reativacao_enviado_em &&
              assinatura.reativacao_retentativas < 1 &&
              dentroDaJanela(assinatura.reativacao_enviado_em)
            ) {
              await supabase
                .from("assinaturas")
                .update({
                  reativacao_enviado_em: null,
                  // Reabre o trial de verdade: ele nunca recebeu a notícia
                  // de que ganhou os 7 dias, então "vencido de novo" é o
                  // estado honesto até a retentativa funcionar.
                  trial_expira_em: new Date(Date.now() - 60_000).toISOString(),
                  reativacao_retentativas: assinatura.reativacao_retentativas + 1,
                })
                .eq("id", assinatura.id);
              reabertos++;
            } else if (
              assinatura.reengajamento_enviado_em &&
              assinatura.reengajamento_retentativas < 1 &&
              dentroDaJanela(assinatura.reengajamento_enviado_em)
            ) {
              await supabase
                .from("assinaturas")
                .update({
                  reengajamento_enviado_em: null,
                  reengajamento_retentativas: assinatura.reengajamento_retentativas + 1,
                })
                .eq("id", assinatura.id);
              reabertos++;
            } else {
              jaTentouAntes++;
            }
          } catch (err) {
            console.error(`Falha ao processar whatsapp_falhas (telefone ${falha.telefone}):`, err);
          }
        }

        return Response.json({
          falhas_verificadas: falhas?.length ?? 0,
          reabertos,
          sem_correspondencia: semCorrespondencia,
          ja_tinha_tentado_antes: jaTentouAntes,
        });
      },
    },
  },
});
