import { createFileRoute } from "@tanstack/react-router";

import { produtoresComAcesso } from "@/lib/acessoConta.server";
import { limitarResumo } from "@/lib/bot/reengajamento";
import { lerAreas } from "@/lib/bot/tools/fazendaCusto";
import { lerRegistros, planoDoProdutor } from "@/lib/bot/tools/fazendaBase";
import { montarAvisoDeMargem } from "@/lib/bot/tools/fazendaMeta";
import type { ProdutorContexto } from "@/lib/bot/types";
import { temAcessoPrata } from "@/lib/planos.shared";
import { enviarMensagemProativa } from "@/lib/proativa.server";
import { supabaseServiceRole } from "@/lib/supabase.server";

type ProdutorLinha = ProdutorContexto & {
  whatsapp: string | null;
  proativa_enviada_em: string | null;
  mensagem_proativa_ativa: boolean | null;
};

// Mesma lógica de variantes de telefone usada nos outros crons (DDD + com/sem o 9º dígito).
function variantesTelefone(whatsapp: string): string[] {
  const ddd = whatsapp.slice(0, 2);
  const resto = whatsapp.slice(2);
  let variante = whatsapp;
  if (resto.length === 9 && resto[0] === "9") variante = ddd + resto.slice(1);
  else if (resto.length === 8) variante = ddd + "9" + resto;
  return [...new Set([whatsapp, variante])];
}

/**
 * Aviso de venda por margem (plano Prata e Ouro): o produtor definiu uma meta de margem ("meta de margem 25%") e, quando o
 * preço de hoje leva a margem dele a essa meta, recebe UMA mensagem (no máximo uma por dia, e só se o preço subiu 3% para
 * repetir dentro de 7 dias). Só quem pediu a meta recebe. Divide a regra de "no máximo 1 mensagem proativa por dia" com
 * /api/cron/mensagem-proativa (usa proativa_enviada_em), respeita o desligar dos avisos automáticos e só vale para quem
 * já conversou com o bot. Travado em `automacoes_config` (chave "aviso_margem"); `?simular=1` mostra sem enviar.
 */
export const Route = createFileRoute("/api/cron/aviso-margem")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env["CRON_SECRET"];
        if (!cronSecret || !process.env["SB_URL"] || !process.env["SB_SERVICE_ROLE_KEY"]) {
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
          .eq("chave", "aviso_margem")
          .maybeSingle();
        if (!config?.ativa && !simular) return Response.json({ ativa: false });

        const agora = new Date();
        const inicioDoDiaBrt = new Date(`${agora.toISOString().slice(0, 10)}T03:00:00.000Z`);
        if (agora < inicioDoDiaBrt) inicioDoDiaBrt.setUTCDate(inicioDoDiaBrt.getUTCDate() - 1);

        const { data: comMeta } = await supabase
          .from("fazenda_areas")
          .select("produtor_id")
          .not("margem_alvo_pct", "is", null)
          .eq("aviso_venda_ativo", true);
        const ids = [
          ...new Set((comMeta ?? []).map((a) => (a as { produtor_id: string }).produtor_id)),
        ];
        if (ids.length === 0) return Response.json({ candidatos: 0, enviados: 0, pulados: 0 });

        const comAcesso = await produtoresComAcesso(supabase);
        const { data: produtores } = await supabase
          .from("produtores")
          .select(
            "id, nome, uf, cultura_principal, municipio, lat, lon, user_id, whatsapp, proativa_enviada_em, mensagem_proativa_ativa",
          )
          .in("id", ids)
          .returns<ProdutorLinha[]>();

        let enviados = 0;
        let pulados = 0;
        const simulados: { nome: string; texto: string }[] = [];

        for (const p of produtores ?? []) {
          try {
            if (!p.whatsapp || !p.uf || p.mensagem_proativa_ativa === false) {
              pulados++;
              continue;
            }
            if (comAcesso && !comAcesso.has(p.id!)) {
              pulados++;
              continue;
            }
            if (!temAcessoPrata(await planoDoProdutor(supabase, p.id))) {
              pulados++;
              continue;
            }
            if (p.proativa_enviada_em && new Date(p.proativa_enviada_em) >= inicioDoDiaBrt) {
              pulados++;
              continue;
            }
            const { count } = await supabase
              .from("bot_conversas")
              .select("telefone", { count: "exact", head: true })
              .in(
                "telefone",
                variantesTelefone(p.whatsapp).map((v) => `55${v}`),
              );
            if (!count) {
              pulados++;
              continue;
            }

            const areas = await lerAreas(supabase, p.id!);
            const safra = await lerRegistros(supabase, p.id!, "safra");
            let aviso: { texto: string; preco: number; cultura: string } | null = null;
            for (const a of areas) {
              const r = await montarAvisoDeMargem(
                supabase,
                p,
                a,
                areas,
                safra.registros,
                safra.rotulo,
                agora,
              );
              if (r) {
                aviso = { ...r, cultura: a.cultura };
                break;
              }
            }
            if (!aviso) {
              pulados++;
              continue;
            }
            const texto = limitarResumo(aviso.texto);
            if (simular) {
              simulados.push({ nome: p.nome, texto });
              continue;
            }
            await enviarMensagemProativa(p.whatsapp, p.nome, texto);
            await supabase
              .from("fazenda_areas")
              .update({ ultimo_aviso_em: agora.toISOString(), ultimo_aviso_preco: aviso.preco })
              .eq("produtor_id", p.id!)
              .eq("cultura", aviso.cultura);
            await supabase
              .from("produtores")
              .update({ proativa_enviada_em: agora.toISOString() })
              .eq("id", p.id!);
            enviados++;
          } catch (err) {
            console.error(`Falha no aviso de margem (produtor ${p.id}):`, err);
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
