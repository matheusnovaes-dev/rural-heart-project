import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { pricingPlans } from "@/config/site";
import { supabaseServiceRole } from "@/lib/supabase.server";
import { normalizarWhatsapp } from "@/lib/telefone";
import { montarResumoReengajamento } from "@/lib/bot/reengajamento";

const enviarBoasVindasSchema = z.object({
  nome: z.string().min(1),
  whatsapp: z.string().min(10),
  // Produtor solo já vem com o plano escolhido. Produtor convidado por
  // cooperativa não tem plano próprio (quem paga é a cooperativa) — nesse
  // caso manda o id dela pra buscar o plano dela mesma, com service role
  // (o RLS não libera essa leitura pra quem acabou de entrar agora).
  plano: z.string().min(1).optional(),
  cooperativaId: z.string().uuid().optional(),
  // Quando vier (cadastro solo, não convite de cooperativa), monta um
  // resumo com dado REAL de valor (preço/progresso de safra/ferrugem) pra
  // primeira mensagem já mostrar o produto funcionando, em vez de só
  // confirmar o cadastro — achado 2026-10-05: 76% dos cadastros nunca
  // mandam a primeira mensagem sozinhos, então essa é a única chance real
  // de mostrar valor sem depender da pessoa tomar a iniciativa.
  uf: z.string().optional(),
  culturaPrincipal: z.string().optional(),
});

/**
 * Chama o produtor no WhatsApp assim que ele se cadastra (formulário
 * rápido, onboarding completo ou convite de cooperativa), se apresentando
 * e explicando o plano — em vez de depender dele descobrir o número da
 * empresa sozinho. Usa um template aprovado pelo Meta (obrigatório:
 * ninguém trocou mensagem com o número ainda, então uma mensagem de texto
 * solta não seria entregue). Falha aqui não pode travar o cadastro — é um
 * extra, não um requisito.
 */
export const enviarBoasVindasWhatsApp = createServerFn({ method: "POST" })
  .validator(enviarBoasVindasSchema)
  .handler(async ({ data }) => {
    const webhookUrl = process.env["N8N_BOAS_VINDAS_WEBHOOK_URL"];
    const token = process.env["N8N_BOAS_VINDAS_TOKEN"];
    if (!webhookUrl || !token) return { ok: false as const };

    let planoId = data.plano;
    if (!planoId && data.cooperativaId) {
      try {
        const supabaseUrl = process.env["SB_URL"];
        const serviceRoleKey = process.env["SB_SERVICE_ROLE_KEY"];
        if (supabaseUrl && serviceRoleKey) {
          const supabase = createClient(supabaseUrl, serviceRoleKey);
          const { data: assinatura } = await supabase
            .from("assinaturas")
            .select("plano")
            .eq("cooperativa_id", data.cooperativaId)
            .maybeSingle();
          planoId = assinatura?.plano;
        }
      } catch (err) {
        console.error("Falha ao buscar plano da cooperativa pro WhatsApp de boas-vindas:", err);
      }
    }
    if (!planoId) return { ok: false as const };
    const planoNome = pricingPlans.find((p) => p.id === planoId)?.name ?? planoId;

    // Best-effort, nunca trava o cadastro: sem uf/cultura (ex: convite de
    // cooperativa, que ainda não tem cultura própria) ou sem dado real pra
    // essa cultura/UF agora, cai no fallback — template do WhatsApp não
    // aceita parâmetro vazio, não dá pra mandar null pro n8n.
    const FALLBACK_SEM_RESUMO =
      "Já pode perguntar o preço da sua cultura, previsão do tempo ou pedir um alerta automático.";
    let resumo: string = FALLBACK_SEM_RESUMO;
    if (data.uf && data.culturaPrincipal) {
      try {
        const real = await montarResumoReengajamento(supabaseServiceRole(), {
          uf: data.uf,
          cultura_principal: data.culturaPrincipal,
        });
        if (real) resumo = real;
      } catch (err) {
        console.error("Falha ao montar resumo de valor pro WhatsApp de boas-vindas:", err);
      }
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-safralume-token": token },
        body: JSON.stringify({
          telefone: `55${data.whatsapp.replace(/\D/g, "")}`,
          nome: data.nome.split(" ")[0] || data.nome,
          plano: planoNome,
          resumo,
        }),
      });
      return { ok: true as const };
    } catch (err) {
      console.error("Falha ao enviar boas-vindas por WhatsApp:", err);
      return { ok: false as const };
    }
  });

const verificarConversaSchema = z.object({ accessToken: z.string().min(1) });

/**
 * `bot_conversas` tem RLS sem nenhuma política (bloqueia até leitura própria
 * do dono), então o dashboard não consegue checar isso direto do cliente —
 * precisa de service role. Usada só pra decidir se o convite "fica de olho
 * no WhatsApp" já pode sumir de vez (ver ProdutorHome): antes disso era um
 * dispensar manual que persistia pra sempre, mesmo sem nenhuma conversa
 * real ter acontecido. Falha aqui é sempre "não conversou ainda" (fail
 * safe pro lado de mostrar o convite de novo, nunca escondê-lo à toa).
 */
export const verificarConversaWhatsapp = createServerFn({ method: "POST" })
  .validator(verificarConversaSchema)
  .handler(async ({ data }) => {
    try {
      const supabase = supabaseServiceRole();
      const { data: userData } = await supabase.auth.getUser(data.accessToken);
      if (!userData.user) return { jaConversou: false as const };

      const { data: produtor } = await supabase
        .from("produtores")
        .select("whatsapp")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!produtor?.whatsapp) return { jaConversou: false as const };

      const { count } = await supabase
        .from("bot_conversas")
        .select("telefone", { count: "exact", head: true })
        .eq("telefone", normalizarWhatsapp(produtor.whatsapp));
      return { jaConversou: !!count && count > 0 };
    } catch (err) {
      console.error("Falha ao verificar conversa no WhatsApp:", err);
      return { jaConversou: false as const };
    }
  });
