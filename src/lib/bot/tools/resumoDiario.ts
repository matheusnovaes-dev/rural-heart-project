import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricoLinha } from "@/lib/bot/prompt";

// Mesma rede de segurança determinística usada em alertas.ts/conta.ts: exige
// que a ÚLTIMA mensagem do assistente já seja a pergunta de confirmação,
// antes de aceitar a ativação/desativação de verdade.
function aindaPrecisaConfirmar(historico: HistoricoLinha[]): boolean {
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  const ultima = [...ordenado].reverse().find((h) => h.role === "assistant")?.conteudo;
  if (!ultima) return true;
  return !(/confirma/i.test(ultima) && /resumo/i.test(ultima));
}

// Mesmo padrão de valorFoiDitoPeloProdutor em alertas.ts: a hora que a
// ferramenta recebeu precisa ter vindo de alguma mensagem do PRODUTOR, nunca
// só porque o assistente propôs um horário na pergunta de confirmação.
function horaFoiDitaPeloProdutor(
  hora: number,
  texto: string,
  historico: HistoricoLinha[],
): boolean {
  const str = String(hora);
  if (texto.includes(str)) return true;
  return historico.some((h) => h.role === "user" && h.conteudo.includes(str));
}

/**
 * Resumo diário configurável ("bom dia resumido") — pedido do Matheus
 * 2026-10-12. Diferente da mensagem proativa (só manda quando preço/clima/
 * câmbio mudou de verdade), este é sempre enviado no horário que o
 * produtor escolher, todo dia, se ele ligou a opção. `hora` é 0-23,
 * horário de Brasília.
 */
export async function configurarResumoDiario(
  supabase: SupabaseClient,
  args: { ativo: boolean; hora: number | null },
  ctx: { produtor: { id: string | null }; historico: HistoricoLinha[]; texto: string },
) {
  if (!ctx.produtor.id) {
    return { sucesso: false, motivo: "sem_cadastro" };
  }
  if (aindaPrecisaConfirmar(ctx.historico)) {
    return { sucesso: false, motivo: "precisa_confirmar_primeiro" };
  }
  if (args.ativo && (args.hora == null || args.hora < 0 || args.hora > 23)) {
    return { sucesso: false, motivo: "hora_invalida" };
  }
  if (
    args.ativo &&
    args.hora != null &&
    !horaFoiDitaPeloProdutor(args.hora, ctx.texto, ctx.historico)
  ) {
    return { sucesso: false, motivo: "hora_nao_confirmada" };
  }
  const { error } = await supabase
    .from("produtores")
    .update({
      resumo_diario_ativo: args.ativo,
      resumo_diario_hora: args.ativo ? args.hora : null,
    })
    .eq("id", ctx.produtor.id);
  if (error) return { sucesso: false, motivo: "erro_ao_salvar" };
  return { sucesso: true, ativo: args.ativo, hora: args.hora };
}
