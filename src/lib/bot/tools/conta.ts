import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizarWhatsapp } from "@/lib/telefone";
import type { HistoricoLinha } from "@/lib/bot/prompt";

// Mesma rede de segurança determinística usada em alertas.ts: o prompt já
// exige confirmação numa mensagem separada antes de criar a conta, mas
// testando ao vivo o modelo às vezes pula direto pra criação na primeira
// mensagem — não vale o risco de criar conta sem confirmação real, então
// exige que a ÚLTIMA mensagem do assistente já seja essa pergunta.
function aindaPrecisaConfirmar(historico: HistoricoLinha[]): boolean {
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  const ultima = [...ordenado].reverse().find((h) => h.role === "assistant")?.conteudo;
  if (!ultima) return true;
  return !(/confirma/i.test(ultima) && /(conta|cadastr)/i.test(ultima));
}

/**
 * Cadastro de teste (7 dias, plano Bronze, sem cartão) criado direto na
 * conversa do WhatsApp — pra quem chegou via anúncio e não quer sair pro
 * site preencher formulário. Sem CPF/CNPJ e sem login no painel ainda
 * (isso fica pra quando/se ele quiser acessar o painel web depois); o
 * produtor já sai dessa conversa recebendo preço/alerta/clima como
 * qualquer assinante Bronze.
 */
export async function criarContaTeste(
  supabase: SupabaseClient,
  args: { uf: string; cultura_principal: string },
  ctx: {
    telefone: string;
    produtor: { nome: string; user_id: string | null };
    historico: HistoricoLinha[];
  },
) {
  if (ctx.produtor.user_id) {
    return { sucesso: false, motivo: "ja_tem_conta" };
  }
  if (aindaPrecisaConfirmar(ctx.historico)) {
    return { sucesso: false, motivo: "precisa_confirmar_primeiro" };
  }

  const whatsapp = normalizarWhatsapp(ctx.telefone);

  const { data: existente } = await supabase
    .from("produtores")
    .select("id")
    .eq("whatsapp", whatsapp)
    .maybeSingle();
  if (existente) {
    return { sucesso: false, motivo: "ja_tem_conta" };
  }

  const { data: produtor, error: erroProdutor } = await supabase
    .from("produtores")
    .insert({
      nome: ctx.produtor.nome,
      whatsapp,
      cultura_principal: args.cultura_principal,
      uf: args.uf,
    })
    .select("id")
    .single();
  // Corrida rara (duas mensagens quase simultâneas confirmando ao mesmo
  // tempo): a constraint unique em `whatsapp` pega o que o SELECT acima
  // não pegou — trata como "já tem conta", não como erro de verdade.
  if (erroProdutor) {
    return { sucesso: false, motivo: erroProdutor.code === "23505" ? "ja_tem_conta" : "erro_ao_criar" };
  }
  if (!produtor) {
    return { sucesso: false, motivo: "erro_ao_criar" };
  }

  const { error: erroAssinatura } = await supabase
    .from("assinaturas")
    .insert({ produtor_id: produtor.id, plano: "bronze" });
  if (erroAssinatura) {
    return { sucesso: false, motivo: "erro_ao_criar" };
  }

  return { sucesso: true };
}
