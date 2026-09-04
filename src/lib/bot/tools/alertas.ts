import type { SupabaseClient } from "@supabase/supabase-js";

import { limiteAlertas, type Plano } from "@/lib/planos.shared";
import type { HistoricoLinha } from "@/lib/bot/prompt";

type ContextoProdutor = {
  id: string;
  user_id: string | null;
};

// Rede de segurança determinística, mesmo motivo das outras em agent.ts: o
// prompt já exige 2 mensagens (pergunta de confirmação, depois criação) pra
// qualquer alerta, mas testando ao vivo o modelo às vezes chama
// criar_alerta_preco/criar_alerta_clima direto na primeira mensagem, sem
// nunca ter perguntado "Confirma: ...?" antes — criando um alerta que o
// produtor não pediu de forma inequívoca. Em vez de confiar só na
// instrução, exige que a ÚLTIMA mensagem do assistente no histórico já
// seja essa pergunta de confirmação (convenção usada no prompt: "Confirma:
// alerta de ...?") antes de aceitar a criação de verdade.
const PERGUNTA_DE_CONFIRMACAO_DE_ALERTA = /confirma/i;

function ultimaMensagemDoAssistente(historico: HistoricoLinha[]): string | null {
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  const ultima = [...ordenado].reverse().find((h) => h.role === "assistant");
  return ultima?.conteudo ?? null;
}

function aindaPrecisaConfirmar(historico: HistoricoLinha[]): boolean {
  const ultima = ultimaMensagemDoAssistente(historico);
  if (!ultima) return true;
  return !(PERGUNTA_DE_CONFIRMACAO_DE_ALERTA.test(ultima) && /alerta/i.test(ultima));
}

/** Mesmo teto do plano usado no dashboard (alertas.tsx) — preço + clima
 * somados, contados por produtor_id. Consulta a assinatura por produtor_id
 * (não por cooperativa) de propósito: o bot sempre fala com um produtor
 * individual, nunca com uma persona "admin de cooperativa" — é exatamente
 * o mesmo caminho que a página do dashboard usa quando quem está logado é
 * o produtor em si, não um admin de cooperativa. */
async function limiteDeAlertasAtingido(supabase: SupabaseClient, produtorId: string) {
  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("plano")
    .eq("produtor_id", produtorId)
    .maybeSingle();
  const plano = (assinatura?.plano as Plano | undefined) ?? null;
  const limite = limiteAlertas(plano);
  if (limite === Infinity) return false;

  const [{ count: countPreco }, { count: countClima }] = await Promise.all([
    supabase
      .from("alertas_preco")
      .select("id", { count: "exact", head: true })
      .eq("produtor_id", produtorId)
      .eq("ativo", true),
    supabase
      .from("alertas_clima")
      .select("id", { count: "exact", head: true })
      .eq("produtor_id", produtorId)
      .eq("ativo", true),
  ]);
  return (countPreco ?? 0) + (countClima ?? 0) >= limite;
}

export async function criarAlertaPreco(
  supabase: SupabaseClient,
  args: { cultura: string; uf: string; limite: number; direcao: "acima" | "abaixo" },
  ctx: { produtor: ContextoProdutor; telefone: string; historico: HistoricoLinha[] },
) {
  if (!ctx.produtor.user_id) {
    return { sucesso: false, motivo: "conta_sem_login" };
  }
  if (aindaPrecisaConfirmar(ctx.historico)) {
    return { sucesso: false, motivo: "precisa_confirmar_primeiro" };
  }
  if (await limiteDeAlertasAtingido(supabase, ctx.produtor.id)) {
    return { sucesso: false, motivo: "limite_atingido" };
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
  ctx: { produtor: ContextoProdutor; telefone: string; historico: HistoricoLinha[] },
) {
  if (!ctx.produtor.user_id) {
    return { sucesso: false, motivo: "conta_sem_login" };
  }
  if (aindaPrecisaConfirmar(ctx.historico)) {
    return { sucesso: false, motivo: "precisa_confirmar_primeiro" };
  }
  if (await limiteDeAlertasAtingido(supabase, ctx.produtor.id)) {
    return { sucesso: false, motivo: "limite_atingido" };
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
