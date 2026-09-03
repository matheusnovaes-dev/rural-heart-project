import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseServiceRole } from "@/lib/supabase.server";

const planoLabel: Record<string, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

/**
 * Avisa por WhatsApp em vez de e-mail — reaproveita o mesmo número/credencial
 * que o bot já usa pra "Notificar humano" (n8n, não duplicamos token do
 * WhatsApp aqui). Se o n8n estiver fora do ar, o chamado já foi gravado no
 * banco de qualquer forma — só o aviso em tempo real que falha.
 */
async function notificarChamadoWhatsApp(params: {
  nome: string;
  contato: string;
  plano: string;
  assunto: string;
  mensagem: string;
}) {
  const token = process.env["N8N_CHAMADO_SUPORTE_TOKEN"];
  if (!token) return;
  try {
    await fetch("https://n8n.safralume.com.br/webhook/chamado-suporte", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-safralume-token": token },
      body: JSON.stringify({
        nome: params.nome,
        contato: params.contato,
        plano: planoLabel[params.plano] ?? params.plano,
        prefixo: params.plano === "ouro" ? "🔥 PRIORIDADE OURO — " : "",
        assunto: params.assunto,
        mensagem: params.mensagem,
      }),
    });
  } catch (err) {
    console.error("Falha ao notificar chamado via WhatsApp:", err);
  }
}

/**
 * O plano de quem abriu o chamado é lido do banco aqui dentro (não confiado
 * do cliente) — senão qualquer um poderia mandar plano="ouro" direto na
 * chamada e furar a fila de prioridade.
 */
export const abrirTicket = createServerFn({ method: "POST" })
  .validator(
    z.object({
      accessToken: z.string(),
      assunto: z.string().min(1).max(200),
      mensagem: z.string().min(1).max(4000),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = supabaseServiceRole();
    const { data: userData, error: authError } = await supabase.auth.getUser(data.accessToken);
    if (authError || !userData.user) {
      throw new Error("Sessão inválida ou expirada. Atualize a página e tente de novo.");
    }
    const userId = userData.user.id;

    const [{ data: produtorRows }, { data: membroRows }] = await Promise.all([
      supabase.from("produtores").select("id, nome, whatsapp").eq("user_id", userId).limit(1),
      supabase
        .from("cooperativa_membros")
        .select("cooperativas(id, nome)")
        .eq("user_id", userId)
        .limit(1),
    ]);

    const produtor = produtorRows?.[0];
    const membro = membroRows?.[0];
    const cooperativa = membro?.cooperativas as unknown as
      { id: string; nome: string } | { id: string; nome: string }[] | null;
    const cooperativaRow = Array.isArray(cooperativa) ? cooperativa[0] : cooperativa;

    if (!produtor && !cooperativaRow) {
      throw new Error("Não encontramos sua conta. Atualize a página e tente de novo.");
    }

    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("plano")
      .eq(produtor ? "produtor_id" : "cooperativa_id", produtor ? produtor.id : cooperativaRow!.id)
      .maybeSingle();
    const plano = assinatura?.plano ?? "bronze";

    const nome = produtor?.nome ?? cooperativaRow!.nome;
    const contato = produtor?.whatsapp ?? userData.user.email ?? "sem contato cadastrado";

    const { error: insertError } = await supabase.from("tickets_suporte").insert({
      produtor_id: produtor?.id ?? null,
      cooperativa_id: cooperativaRow?.id ?? null,
      nome,
      contato,
      plano,
      assunto: data.assunto,
      mensagem: data.mensagem,
    });
    if (insertError) throw new Error("Não foi possível registrar o chamado. Tenta de novo.");

    await notificarChamadoWhatsApp({
      nome,
      contato,
      plano,
      assunto: data.assunto,
      mensagem: data.mensagem,
    });

    return { ok: true };
  });
