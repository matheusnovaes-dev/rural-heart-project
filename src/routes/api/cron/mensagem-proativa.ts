import { createFileRoute } from "@tanstack/react-router";

import { supabaseServiceRole } from "@/lib/supabase.server";
import { montarResumoProativoDiario } from "@/lib/bot/reengajamento";

type Assinatura = { produtor_id: string | null };

type Produtor = {
  id: string;
  nome: string;
  whatsapp: string | null;
  uf: string | null;
  cultura_principal: string | null;
  proativa_enviada_em: string | null;
  mensagem_proativa_ativa: boolean;
};

// Mesma lógica de variantes de telefone usada em /api/cron/reativacao e
// /api/cron/reengajamento (DDD + com/sem o 9º dígito).
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
 * Mensagem proativa diária (pedido do Matheus 2026-10-11) — diferente de
 * /api/cron/reengajamento (quem sumiu) e /api/cron/reativacao (quem nunca
 * conversou): esta é pra quem JÁ está engajado (já mandou mensagem pro bot
 * alguma vez) e tá com trial ou assinatura ativa — gatilho de retenção, não
 * de recuperação. Só manda quando montarResumoProativoDiario acha algo real
 * que valha a pena (preço moveu ou clima severo); a maioria dos produtores
 * não recebe nada na maioria dos dias, de propósito (ver comentário lá:
 * risco de "quality score" do WhatsApp se virar mensagem de preenchimento).
 *
 * Travada por padrão em `automacoes_config` (chave "mensagem_proativa_diaria"),
 * mesmo padrão de reativacao/recuperar-cadastro — só ligar depois do
 * template `mensagem_proativa_safralume` estar aprovado na Meta.
 * `?simular=1` mostra quem receberia o quê, sem mandar mensagem nem gravar
 * nada (nem precisa da automação ligada).
 */
export const Route = createFileRoute("/api/cron/mensagem-proativa")({
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
          .eq("chave", "mensagem_proativa_diaria")
          .maybeSingle();
        if (!config?.ativa && !simular) return Response.json({ ativa: false });

        const agora = new Date();
        // Início do dia em BRT, em UTC (BRT é UTC-3 o ano inteiro, sem
        // horário de verão) — mesmo cálculo usado em checagens manuais
        // desta sessão pra não confundir com o "hoje" em UTC puro.
        const inicioDoDiaBrt = new Date(`${agora.toISOString().slice(0, 10)}T03:00:00.000Z`);
        if (agora < inicioDoDiaBrt) inicioDoDiaBrt.setUTCDate(inicioDoDiaBrt.getUTCDate() - 1);

        const { data: assinaturas } = await supabase
          .from("assinaturas")
          .select("produtor_id")
          .in("status", ["trial", "ativa"])
          .not("produtor_id", "is", null)
          .returns<Assinatura[]>();

        const idsProdutores = [...new Set((assinaturas ?? []).map((a) => a.produtor_id!))];
        if (idsProdutores.length === 0)
          return Response.json({ candidatos: 0, enviados: 0, pulados: 0 });

        const { data: produtores } = await supabase
          .from("produtores")
          .select(
            "id, nome, whatsapp, uf, cultura_principal, proativa_enviada_em, mensagem_proativa_ativa",
          )
          .in("id", idsProdutores)
          .returns<Produtor[]>();

        let enviados = 0;
        let pulados = 0;
        const simulados: { nome: string; uf: string; cultura: string; resumo: string }[] = [];

        for (const produtor of produtores ?? []) {
          try {
            if (!produtor.whatsapp || !produtor.uf || !produtor.cultura_principal) {
              pulados++;
              continue;
            }

            if (produtor.mensagem_proativa_ativa === false) {
              pulados++;
              continue;
            }

            if (
              produtor.proativa_enviada_em &&
              new Date(produtor.proativa_enviada_em) >= inicioDoDiaBrt
            ) {
              pulados++;
              continue;
            }

            // Só pra quem já conversou alguma vez (oposto do filtro de
            // /api/cron/reativacao, que é só pra quem NUNCA conversou).
            const telefonesCompletos = variantesTelefone(produtor.whatsapp).map((v) => `55${v}`);
            const { count: totalMensagens } = await supabase
              .from("bot_conversas")
              .select("telefone", { count: "exact", head: true })
              .in("telefone", telefonesCompletos);

            if (!totalMensagens || totalMensagens === 0) {
              pulados++;
              continue;
            }

            const resumo = await montarResumoProativoDiario(supabase, {
              uf: produtor.uf,
              cultura_principal: produtor.cultura_principal,
            });
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

            await notificarWhatsAppProativa(produtor.whatsapp, produtor.nome, resumo);

            await supabase
              .from("produtores")
              .update({ proativa_enviada_em: agora.toISOString() })
              .eq("id", produtor.id);
            enviados++;
          } catch (err) {
            // Uma falha não pode travar o lote inteiro.
            console.error(`Falha ao mandar mensagem proativa (produtor ${produtor.id}):`, err);
          }
        }

        return Response.json({
          candidatos: produtores?.length ?? 0,
          enviados,
          pulados,
          ...(simular ? { simulados } : {}),
        });
      },
    },
  },
});

// _v4 porque as 3 primeiras tentativas (_v1..v3) foram rejeitadas por formato
// (faltava repetir o nome como variável no corpo e faltava o botão — mesma
// estrutura do reativacao_trial_safralume_v2, que já é aprovado) e não podem
// ser editadas nem apagadas depois de criadas, mesmo rejeitadas — mesmo caso
// do continuar_cadastro_safralume/boas_vindas_v1 órfãos.
const TEMPLATE_PROATIVA = "mensagem_proativa_safralume_v4";

async function notificarWhatsAppProativa(whatsapp: string, nome: string, resumo: string) {
  const webhookUrl = process.env["N8N_COBRANCA_WEBHOOK_URL"];
  const token = process.env["N8N_COBRANCA_TOKEN"];
  if (!webhookUrl || !token) return;

  const primeiroNome = nome.trim().split(" ")[0] || nome;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-safralume-token": token },
    body: JSON.stringify({
      telefone: `55${whatsapp}`,
      template: TEMPLATE_PROATIVA,
      nome: primeiroNome,
      resumo,
    }),
  });
}
