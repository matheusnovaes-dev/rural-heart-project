import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Valor que não depende de abrir o painel. Feedback real de um cliente que cancelou (2026-10-20): "não é algo que uso
 * todo dia". O Safralume já avisa por conta própria quando o preço mexe 3% ou mais, ou quando vem geada ou chuva forte
 * (cron /api/cron/mensagem-proativa, só para quem já conversou com o bot), mas quase ninguém sabia. Na primeira resposta
 * com preço, o código acrescenta este aviso uma vez só (o modelo não faz isso de forma confiável) e convida para o
 * resumo diário, que o bot já sabe configurar.
 */
export const MARCA_AVISO_AUTOMATICO = "Já deixei ligado";

export const TEXTO_AVISO_AUTOMATICO =
  "🔔 Já deixei ligado: se o preço da sua cultura mexer 3% ou mais, ou se vier geada ou chuva forte no seu estado, eu te aviso aqui no WhatsApp. Quer também um resumo todo dia? É só me dizer o horário (por exemplo, 7h).";

type Linha = { role: "user" | "assistant"; conteudo: string };

/** Só nos primeiros contatos, só quando a resposta traz preço e nunca repete. */
export function deveAvisarAutomatico(resposta: string, historico: Linha[] = []): boolean {
  if (resposta.includes(MARCA_AVISO_AUTOMATICO)) return false;
  if (!/R\$\s?\d/.test(resposta)) return false;
  // Só resposta de PREÇO DE MERCADO com dado (unidade de mercado ou fonte). Achados de 2026-10-21: "Ainda não temos preço de
  // cana em SP" (referências de outros estados) prometeria um aviso que não existe, e o preço de um plano ("R$ 39/mês")
  // ou o estudo de uma proposta não são o preço da cultura dele.
  if (/ainda n[ãa]o temos|n[ãa]o temos (o )?pre[çc]o|n[ãa]o encontrei/i.test(resposta))
    return false;
  if (
    /\b(proposta|estudo|plano|assinatura|cobran[çc]a|cancel\w*|mensalidade)\b|\/m[êe]s/i.test(
      resposta,
    )
  )
    return false;
  if (
    !/\b(BBM|Conab|IEA|DERAL|Emater|Epagri|Imea|Conseleite)\b|(por|\/)\s*(saca|sc\b|arroba|@|tonelada|60 kg|50 kg|litro)/i.test(
      resposta,
    )
  ) {
    return false;
  }
  if (
    historico.some((h) => h.role === "assistant" && h.conteudo.includes(MARCA_AVISO_AUTOMATICO))
  ) {
    return false;
  }
  return historico.filter((h) => h.role === "user").length <= 6;
}

export async function avisoAutomaticoSeCabe(
  supabase: SupabaseClient,
  produtorId: string | null,
  resposta: string,
  historico: Linha[],
): Promise<string | null> {
  if (!produtorId || !deveAvisarAutomatico(resposta, historico)) return null;
  try {
    // Quem pediu para parar as mensagens proativas não recebe a promessa.
    const { data } = await supabase
      .from("produtores")
      .select("mensagem_proativa_ativa")
      .eq("id", produtorId)
      .maybeSingle();
    if (data?.mensagem_proativa_ativa === false) return null;
    return TEXTO_AVISO_AUTOMATICO;
  } catch {
    return null;
  }
}

/**
 * "Não uso todo dia", "uso pouco", "não sei se vale pagar": a objeção que apareceu no cancelamento real de 2026-10-20.
 * Antes o modelo ignorava a frase e respondia com um preço. Decidido por código. Não pega "não vale a pena vender".
 */
const PADRAO_POUCO_USO =
  /\bn[ãa]o\s+(uso|vou\s+usar|preciso\s+usar)\s+(isso\s+|o\s+app\s+|o\s+safralume\s+)?(todo\s+dia|todos\s+os\s+dias|toda\s+hora|muito|o\s+suficiente)|\b(uso|usei)\s+pouco\b|\bn[ãa]o\s+(sei\s+se\s+)?vale\s+(a\s+pena\s+)?(pagar|assinar)\b/i;

export function ehObjecaoDePoucoUso(texto: string): boolean {
  return PADRAO_POUCO_USO.test(texto);
}

export const RESPOSTA_POUCO_USO =
  "Faz sentido, e dá pra usar sem abrir nada todo dia. O Safralume te avisa aqui no WhatsApp quando o preço da sua cultura mexer 3% ou mais, ou quando vier geada ou chuva forte no seu estado. Também dá pra criar um alerta no preço que você quiser, ou pedir um resumo todo dia no horário que escolher. Quer que eu ligue um deles agora? E se um dia achar que não precisa, dá pra pausar a cobrança em vez de cancelar.";
