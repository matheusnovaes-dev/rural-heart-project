/**
 * Ações do caderno no painel que mexem em mais de uma tabela: o lembrete do vencimento (a pagar e a receber) e a
 * baixa ("recebi", "paguei"). Mesmo comportamento do bot (src/lib/bot/tools/fazendaPendencias.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { formatarReais, hojeBrasilia, type RegistroFazenda } from "@/lib/fazenda.shared";

/** Lembrete às 8h (Brasília) do dia do vencimento. Devolve o id, ou null quando o horário já passou. */
export async function criarLembreteDoVencimento(
  supabase: SupabaseClient,
  produtor: { id: string; whatsapp: string },
  userId: string,
  r: Pick<RegistroFazenda, "tipo" | "valor" | "descricao" | "cultura" | "vence_em">,
): Promise<string | null> {
  if (!r.vence_em || r.valor === null) return null;
  const enviarEm = new Date(`${r.vence_em}T08:00:00-03:00`);
  if (enviarEm.getTime() < Date.now() + 10 * 60_000) return null;
  const acao = r.tipo === "venda" ? "Receber" : "Pagar";
  const oque =
    r.tipo === "venda" ? `venda${r.cultura ? ` de ${r.cultura.toLowerCase()}` : ""}` : r.descricao;
  const { data, error } = await supabase
    .from("lembretes")
    .insert({
      produtor_id: produtor.id,
      criado_por: userId,
      titulo: `${acao} ${formatarReais(r.valor)}: ${oque}`.slice(0, 200),
      descricao: "Do caderno da fazenda.",
      enviar_em: enviarEm.toISOString(),
      whatsapp_destino: produtor.whatsapp,
      status: "pendente",
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function cancelarLembrete(
  supabase: SupabaseClient,
  lembreteId: string | null,
): Promise<void> {
  if (!lembreteId) return;
  await supabase
    .from("lembretes")
    .update({ status: "cancelado" })
    .eq("id", lembreteId)
    .eq("status", "pendente");
}

/** Marca como pago ou recebido: passa a contar nas contas na data de hoje e cancela o lembrete. */
export async function darBaixaNoPainel(
  supabase: SupabaseClient,
  r: RegistroFazenda,
  dia: string = hojeBrasilia(),
): Promise<boolean> {
  const { error } = await supabase
    .from("fazenda_registros")
    .update({ situacao: "realizado", realizado_em: dia, ocorrido_em: dia })
    .eq("id", r.id)
    .eq("situacao", "pendente");
  if (error) return false;
  await cancelarLembrete(supabase, r.lembrete_id);
  return true;
}
