import type { SupabaseClient } from "@supabase/supabase-js";

import { HORAS_DE_GRACA } from "@/lib/bot/cobranca";

/**
 * Quem pode receber aviso automático (alerta, resumo, sinal de venda): a mesma regra do bot
 * (verificarAcessoWhatsapp) e do painel. Assinatura ativa, trial dentro do prazo, inadimplente
 * ainda na carência ou produtor coberto por cooperativa. Achado em 2026-10-15: os envios
 * automáticos não olhavam a assinatura e continuavam saindo para conta cancelada, com trial
 * vencido ou cortada. Falha de leitura devolve null (não filtra), para não calar quem paga em dia.
 */
export async function produtoresComAcesso(supabase: SupabaseClient): Promise<Set<string> | null> {
  try {
    const agora = Date.now();
    const permitidos = new Set<string>();
    const pagina = 1000;
    for (let de = 0; ; de += pagina) {
      const { data, error } = await supabase
        .from("assinaturas")
        .select("produtor_id, status, trial_expira_em, updated_at")
        .not("produtor_id", "is", null)
        .order("id")
        .range(de, de + pagina - 1);
      if (error) throw error;
      for (const a of data ?? []) {
        const trialValido =
          a.status === "trial" &&
          !!a.trial_expira_em &&
          new Date(a.trial_expira_em).getTime() > agora;
        const naGraca =
          a.status === "inadimplente" &&
          (agora - new Date(a.updated_at).getTime()) / 3_600_000 < HORAS_DE_GRACA;
        if (a.status === "ativa" || trialValido || naGraca) permitidos.add(a.produtor_id);
      }
      if (!data || data.length < pagina) break;
    }
    for (let de = 0; ; de += pagina) {
      const { data, error } = await supabase
        .from("produtores")
        .select("id")
        .not("cooperativa_id", "is", null)
        .order("id")
        .range(de, de + pagina - 1);
      if (error) throw error;
      for (const p of data ?? []) permitidos.add(p.id);
      if (!data || data.length < pagina) break;
    }
    return permitidos;
  } catch (err) {
    console.error("Falha ao ler quem tem acesso; seguindo sem filtro:", err);
    return null;
  }
}
