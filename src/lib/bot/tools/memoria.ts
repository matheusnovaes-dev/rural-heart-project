import type { SupabaseClient } from "@supabase/supabase-js";

export type CategoriaMemoria =
  "preocupacao" | "contexto_fazenda" | "relacao_comercial" | "plano_futuro";

export type MemoriaProdutor = {
  fato: string;
  categoria: CategoriaMemoria;
  criado_em: string;
};

// Teto de fatos injetados por conversa: cada um custa token em TODA mensagem
// da conversa (é contexto fixo, não histórico), e produtor antigo pode
// acumular dezenas — sem teto o custo cresce sem limite e os fatos mais
// antigos (menos relevantes) competem por atenção com os recentes.
const MAX_MEMORIAS_POR_CONSULTA = 8;

/** Fatos duráveis mais recentes sobre o produtor, de conversas anteriores
 * (não desta). Usado pra montar o bloco de contexto antes de cada resposta. */
export async function buscarMemoriasProdutor(
  supabase: SupabaseClient,
  produtorId: string,
): Promise<MemoriaProdutor[]> {
  const { data, error } = await supabase
    .from("bot_memoria_produtor")
    .select("fato, categoria, criado_em")
    .eq("produtor_id", produtorId)
    .eq("ativo", true)
    .order("criado_em", { ascending: false })
    .limit(MAX_MEMORIAS_POR_CONSULTA);
  if (error) {
    console.error("Erro ao buscar memória do produtor:", error);
    return [];
  }
  return (data ?? []) as MemoriaProdutor[];
}

const CATEGORIAS_VALIDAS = new Set<CategoriaMemoria>([
  "preocupacao",
  "contexto_fazenda",
  "relacao_comercial",
  "plano_futuro",
]);

export async function salvarMemoriaProdutor(
  supabase: SupabaseClient,
  args: { fato: string; categoria: string },
  produtorId: string | null,
): Promise<{ sucesso: boolean; motivo?: "sem_cadastro" | "categoria_invalida" }> {
  // Memória é um conceito ligado à conta (produtor_id) — quem ainda não se
  // cadastrou não tem onde guardar isso de um jeito que sobreviva entre
  // conversas (não tem produtor_id fixo, o telefone sozinho não basta pra
  // isso ser uma "conta").
  if (!produtorId) return { sucesso: false, motivo: "sem_cadastro" };
  if (!CATEGORIAS_VALIDAS.has(args.categoria as CategoriaMemoria)) {
    return { sucesso: false, motivo: "categoria_invalida" };
  }
  const { error } = await supabase.from("bot_memoria_produtor").insert({
    produtor_id: produtorId,
    fato: args.fato,
    categoria: args.categoria,
  });
  if (error) {
    console.error("Erro ao salvar memória do produtor:", error);
    return { sucesso: false };
  }
  return { sucesso: true };
}

/** "Esquece isso"/"apaga meus dados": desativa (soft delete) em vez de
 * apagar de vez — mantém rastro de auditoria de que existiu e foi removido
 * a pedido do próprio produtor. */
export async function esquecerMemoriaProdutor(
  supabase: SupabaseClient,
  produtorId: string | null,
): Promise<{ sucesso: boolean }> {
  if (!produtorId) return { sucesso: false };
  const { error } = await supabase
    .from("bot_memoria_produtor")
    .update({ ativo: false })
    .eq("produtor_id", produtorId)
    .eq("ativo", true);
  if (error) {
    console.error("Erro ao apagar memória do produtor:", error);
    return { sucesso: false };
  }
  return { sucesso: true };
}
