import type { SupabaseClient } from "@supabase/supabase-js";

import { limiteAlertas, type Plano } from "@/lib/planos.shared";

type ContextoProdutor = {
  id: string;
  user_id: string | null;
};

/** Mesmo teto do plano usado no dashboard (alertas.tsx) — preço + clima
 * somados, contados por produtor_id. Consulta a assinatura por produtor_id
 * (não por cooperativa) de propósito: o bot sempre fala com um produtor
 * individual, nunca com uma persona "admin de cooperativa" — é exatamente
 * o mesmo caminho que a página do dashboard usa quando quem está logado é
 * o produtor em si, não um admin de cooperativa. */
async function limiteDeAlertasAtingido(supabase: SupabaseClient, produtorId: string) {
  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("plano")
    .eq("produtor_id", produtorId)
    .maybeSingle();
  const plano = (assinatura?.plano as Plano | undefined) ?? null;
  const limite = limiteAlertas(plano);
  if (limite === Infinity) return false;

  const [{ count: countPreco }, { count: countClima }] = await Promise.all([
    supabase
      .from("alertas_preco")
      .select("id", { count: "exact", head: true })
      .eq("produtor_id", produtorId)
      .eq("ativo", true),
    supabase
      .from("alertas_clima")
      .select("id", { count: "exact", head: true })
      .eq("produtor_id", produtorId)
      .eq("ativo", true),
  ]);
  return (countPreco ?? 0) + (countClima ?? 0) >= limite;
}

export async function criarAlertaPreco(
  supabase: SupabaseClient,
  args: { cultura: string; uf: string; limite: number; direcao: "acima" | "abaixo" },
  ctx: { produtor: ContextoProdutor; telefone: string },
) {
  if (!ctx.produtor.user_id) {
    return { sucesso: false, motivo: "conta_sem_login" };
  }
  if (await limiteDeAlertasAtingido(supabase, ctx.produtor.id)) {
    return { sucesso: false, motivo: "limite_atingido" };
  }
  const { error } = await supabase.from("alertas_preco").insert({
    produtor_id: ctx.produtor.id,
    criado_por: ctx.produtor.user_id,
    cultura: args.cultura,
    uf: args.uf,
    limite: args.limite,
    direcao: args.direcao,
    whatsapp_destino: ctx.telefone,
  });
  if (error) return { sucesso: false, motivo: "erro_ao_criar" };
  return { sucesso: true };
}

export async function criarAlertaClima(
  supabase: SupabaseClient,
  args: {
    uf: string;
    condicao: "chuva_forte" | "geada" | "seca_prolongada" | "vento_forte";
    limite: number;
  },
  ctx: { produtor: ContextoProdutor; telefone: string },
) {
  if (!ctx.produtor.user_id) {
    return { sucesso: false, motivo: "conta_sem_login" };
  }
  if (await limiteDeAlertasAtingido(supabase, ctx.produtor.id)) {
    return { sucesso: false, motivo: "limite_atingido" };
  }
  const { error } = await supabase.from("alertas_clima").insert({
    produtor_id: ctx.produtor.id,
    criado_por: ctx.produtor.user_id,
    uf: args.uf,
    condicao: args.condicao,
    limite: args.limite,
    whatsapp_destino: ctx.telefone,
  });
  if (error) return { sucesso: false, motivo: "erro_ao_criar" };
  return { sucesso: true };
}
