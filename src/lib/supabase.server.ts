import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase service-role pro lado servidor (rotas em src/routes/api/
 * e módulos .server.ts). Extraído porque essa mesma criação de cliente já
 * estava duplicada em asaas/webhook.ts, cron/aviso-trial.ts e
 * asaas.server.ts — um quarto ponto de chamada (o agente do bot) era o
 * limite pra valer a pena centralizar.
 */
export function supabaseServiceRole() {
  const supabaseUrl = process.env["SB_URL"];
  const serviceRoleKey = process.env["SB_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SB_URL/SB_SERVICE_ROLE_KEY não configuradas.");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
