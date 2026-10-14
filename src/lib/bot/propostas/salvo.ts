import type { SupabaseClient } from "@supabase/supabase-js";

import type { HistoricoLinha } from "@/lib/bot/prompt";
import type { EstudoSalvo } from "@/lib/bot/propostas/tipos";

/**
 * O estudo fica guardado na própria conversa (tabela bot_conversas, que só aceita
 * os papéis user/assistant) como uma linha marcada. O cérebro tira essas linhas do
 * histórico ANTES de qualquer outra coisa, então o modelo nunca as vê; só o código
 * de acompanhamento (explicar a conta, refazer com outro valor) lê o estudo.
 */
export const MARCA_DO_ESTUDO = "§ESTUDO§";

/** Quanto tempo o estudo vale para perguntas de acompanhamento. */
export const HORAS_DE_VALIDADE_DO_ESTUDO = 6;

export function serializarEstudo(e: EstudoSalvo): string {
  return MARCA_DO_ESTUDO + JSON.stringify(e);
}

export function lerEstudoSalvo(conteudo: string): EstudoSalvo | null {
  if (!conteudo.startsWith(MARCA_DO_ESTUDO)) return null;
  try {
    const e = JSON.parse(conteudo.slice(MARCA_DO_ESTUDO.length)) as EstudoSalvo;
    return e && e.v === 1 && Array.isArray(e.propostas) && e.ref ? e : null;
  } catch {
    return null;
  }
}

export const ehLinhaDeEstudo = (h: { conteudo?: string | null }) =>
  typeof h.conteudo === "string" && h.conteudo.startsWith(MARCA_DO_ESTUDO);

/** Separa o histórico em (conversa de verdade, estudo mais recente ainda válido). */
export function separarEstudoDoHistorico(
  historico: HistoricoLinha[],
  agora: Date = new Date(),
): { historico: HistoricoLinha[]; estudo: EstudoSalvo | null } {
  const limpo = historico.filter((h) => !ehLinhaDeEstudo(h));
  const marcadas = historico
    .filter(ehLinhaDeEstudo)
    .sort((a, b) => (b.ordem ?? 0) - (a.ordem ?? 0));
  for (const m of marcadas) {
    const e = lerEstudoSalvo(m.conteudo);
    if (!e) continue;
    const idade = agora.getTime() - Date.parse(e.criadoEm);
    if (Number.isFinite(idade) && idade <= HORAS_DE_VALIDADE_DO_ESTUDO * 3600 * 1000) {
      return { historico: limpo, estudo: e };
    }
    break;
  }
  return { historico: limpo, estudo: null };
}

/** Guarda o estudo na conversa. Falhar aqui não pode derrubar a resposta ao produtor. */
export async function salvarEstudo(
  supabase: SupabaseClient,
  telefone: string,
  estudo: EstudoSalvo,
): Promise<void> {
  try {
    const { error } = await supabase.from("bot_conversas").insert({
      telefone,
      role: "assistant",
      conteudo: serializarEstudo(estudo),
      precisa_humano: false,
    });
    if (error) console.error("Não salvou o estudo da proposta:", error.message);
  } catch (err) {
    console.error("Não salvou o estudo da proposta:", err);
  }
}
