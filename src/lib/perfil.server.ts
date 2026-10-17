import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseServiceRole } from "@/lib/supabase.server";

/**
 * "O que o bot sabe sobre mim": a memória do bot (tabela bot_memoria_produtor) só é lida e escrita com a chave de serviço, então a tela
 * de perfil passa pelo servidor. O produtor é identificado pelo token da sessão (nunca por um id vindo do cliente), e
 * "esquecer" só desativa (soft delete), igual ao "esquece isso" dito ao bot.
 */
async function produtorDaSessao(accessToken: string) {
  const supabase = supabaseServiceRole();
  const { data: userData, error } = await supabase.auth.getUser(accessToken);
  if (error || !userData.user)
    throw new Error("Sessão inválida ou expirada. Atualize a página e tente de novo.");
  const { data: produtor } = await supabase
    .from("produtores")
    .select("id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  return { supabase, produtorId: (produtor?.id as string | undefined) ?? null };
}

export const listarMemoriaDoBot = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string() }))
  .handler(async ({ data }) => {
    const { supabase, produtorId } = await produtorDaSessao(data.accessToken);
    if (!produtorId)
      return [] as { id: string; fato: string; categoria: string; criado_em: string }[];
    const { data: linhas, error } = await supabase
      .from("bot_memoria_produtor")
      .select("id, fato, categoria, criado_em")
      .eq("produtor_id", produtorId)
      .eq("ativo", true)
      .order("criado_em", { ascending: false })
      .limit(50);
    if (error) throw new Error("Não consegui carregar agora. Tente de novo em instantes.");
    return (linhas ?? []) as { id: string; fato: string; categoria: string; criado_em: string }[];
  });

export const esquecerMemoriaDoBot = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string(), id: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const { supabase, produtorId } = await produtorDaSessao(data.accessToken);
    if (!produtorId) return { ok: false as const };
    let consulta = supabase
      .from("bot_memoria_produtor")
      .update({ ativo: false })
      .eq("produtor_id", produtorId)
      .eq("ativo", true);
    if (data.id) consulta = consulta.eq("id", data.id);
    const { error } = await consulta;
    return { ok: !error } as { ok: boolean };
  });
