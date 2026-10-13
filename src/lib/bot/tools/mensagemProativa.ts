import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricoLinha } from "@/lib/bot/prompt";

// Mesma rede de segurança determinística usada em resumoDiario.ts/alertas.ts:
// exige que a ÚLTIMA mensagem do assistente já seja a pergunta de
// confirmação, antes de aceitar a desativação/reativação de verdade.
function aindaPrecisaConfirmar(historico: HistoricoLinha[]): boolean {
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  const ultima = [...ordenado].reverse().find((h) => h.role === "assistant")?.conteudo;
  if (!ultima) return true;
  return !(/confirma/i.test(ultima) && /proativ/i.test(ultima));
}

/**
 * Opt-out da mensagem proativa diária (preço/clima/câmbio) — pedido do
 * Matheus 2026-10-13: o template dela é categoria MARKETING na Meta, então
 * o produtor precisa ter um jeito real de pedir pra parar. Diferente de
 * configurarResumoDiario (opt-IN, começa desligado), esta é opt-OUT:
 * começa ligada pra quem já é engajado (comportamento atual, sem mudar
 * nada pra ninguém só por essa ferramenta existir) — só desliga quando o
 * produtor pedir de verdade.
 */
export async function configurarMensagemProativa(
  supabase: SupabaseClient,
  args: { ativa: boolean },
  ctx: { produtor: { id: string | null }; historico: HistoricoLinha[] },
) {
  if (!ctx.produtor.id) {
    return { sucesso: false, motivo: "sem_cadastro" };
  }
  if (aindaPrecisaConfirmar(ctx.historico)) {
    return { sucesso: false, motivo: "precisa_confirmar_primeiro" };
  }
  const { error } = await supabase
    .from("produtores")
    .update({ mensagem_proativa_ativa: args.ativa })
    .eq("id", ctx.produtor.id);
  if (error) return { sucesso: false, motivo: "erro_ao_salvar" };
  return { sucesso: true, ativa: args.ativa };
}
