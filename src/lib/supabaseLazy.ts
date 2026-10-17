import type { SupabaseClient } from "@supabase/supabase-js";

let promessa: Promise<SupabaseClient | null> | null = null;

/**
 * Carrega o cliente do Supabase (~52KB comprimido) só quando alguém precisa dele. A landing não usa o cliente para
 * desenhar nada: ele só entra no cadastro, na prévia de preços e no login. Importá-lo estático no AuthProvider fazia todo
 * celular baixar e executar esse JS antes do primeiro desenho. Páginas internas (painel, login) seguem importando
 * `@/lib/supabase` direto, então para elas nada muda.
 */
export function carregarSupabase(): Promise<SupabaseClient | null> {
  promessa ??= import("@/lib/supabase").then((m) => m.supabase);
  return promessa;
}
