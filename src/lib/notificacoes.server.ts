import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { pricingPlans } from "@/config/site";

const enviarBoasVindasSchema = z.object({
  nome: z.string().min(1),
  whatsapp: z.string().min(10),
  // Produtor solo já vem com o plano escolhido. Produtor convidado por
  // cooperativa não tem plano próprio (quem paga é a cooperativa) — nesse
  // caso manda o id dela pra buscar o plano dela mesma, com service role
  // (o RLS não libera essa leitura pra quem acabou de entrar agora).
  plano: z.string().min(1).optional(),
  cooperativaId: z.string().uuid().optional(),
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

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-safralume-token": token },
        body: JSON.stringify({
          telefone: `55${data.whatsapp.replace(/\D/g, "")}`,
          nome: data.nome.split(" ")[0] || data.nome,
          plano: planoNome,
        }),
      });
      return { ok: true as const };
    } catch (err) {
      console.error("Falha ao enviar boas-vindas por WhatsApp:", err);
      return { ok: false as const };
    }
  });
