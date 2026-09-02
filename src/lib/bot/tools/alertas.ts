import type { SupabaseClient } from "@supabase/supabase-js";

type ContextoProdutor = {
  id: string;
  user_id: string | null;
};

export async function criarAlertaPreco(
  supabase: SupabaseClient,
  args: { cultura: string; uf: string; limite: number; direcao: "acima" | "abaixo" },
  ctx: { produtor: ContextoProdutor; telefone: string },
) {
  if (!ctx.produtor.user_id) {
    return { sucesso: false, motivo: "conta_sem_login" };
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
