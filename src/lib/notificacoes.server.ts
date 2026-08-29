import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const enviarBoasVindasSchema = z.object({
  nome: z.string().min(1),
  whatsapp: z.string().min(10),
  plano: z.string().min(1),
});

/**
 * Chama o produtor no WhatsApp assim que ele se cadastra (formulário
 * rápido ou onboarding completo), se apresentando e explicando o plano —
 * em vez de depender dele descobrir o número da empresa sozinho. Usa um
 * template aprovado pelo Meta (obrigatório: ninguém trocou mensagem com o
 * número ainda, então uma mensagem de texto solta não seria entregue).
 * Falha aqui não pode travar o cadastro — é um extra, não um requisito.
 */
export const enviarBoasVindasWhatsApp = createServerFn({ method: "POST" })
  .validator(enviarBoasVindasSchema)
  .handler(async ({ data }) => {
    const webhookUrl = process.env["N8N_BOAS_VINDAS_WEBHOOK_URL"];
    const token = process.env["N8N_BOAS_VINDAS_TOKEN"];
    if (!webhookUrl || !token) return { ok: false as const };

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-safralume-token": token },
        body: JSON.stringify({
          telefone: `55${data.whatsapp.replace(/\D/g, "")}`,
          nome: data.nome.split(" ")[0] || data.nome,
          plano: data.plano,
        }),
      });
      return { ok: true as const };
    } catch (err) {
      console.error("Falha ao enviar boas-vindas por WhatsApp:", err);
      return { ok: false as const };
    }
  });
