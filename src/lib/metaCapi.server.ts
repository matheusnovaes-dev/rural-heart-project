import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";

import { montarEventoCapi } from "@/lib/metaCapi";

const trackConversaoSchema = z.object({
  eventId: z.string().min(1),
  // Padrão CompleteRegistration (cadastro concluído); "Lead" é a etapa 1 do formulário.
  evento: z.enum(["CompleteRegistration", "Lead"]).optional(),
  plano: z.string().min(1).optional(),
  valor: z.number().optional(),
  email: z.string().email().optional(),
  whatsapp: z.string().optional(),
  // Só quando a chamada vem do navegador do visitante (site): cookies da Meta
  // e URL da página. Chamadas feitas pelo servidor (bot) não mandam isso, pra
  // não atribuir o IP/navegador do n8n a um produtor.
  doNavegador: z.boolean().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  urlOrigem: z.string().url().optional(),
});

/**
 * Envia o evento de conversão (CompleteRegistration) direto pro Meta via
 * Conversions API — servidor pra servidor, sem depender do navegador do
 * visitante. Achado real 2026-09-11: a única conversão de anúncio real até
 * agora nunca gerou esse evento no Meta — o Pixel (window.fbq) não disparou
 * nenhum evento durante aquela sessão inteira (veio do navegador interno do
 * Instagram, que é conhecido por restringir script de terceiro). Sem esse
 * evento, a Meta otimiza a entrega dos anúncios só por clique, cega quanto
 * a quem realmente vira cliente — e não dá pra montar público de remarketing
 * excluindo quem já converteu.
 *
 * `eventId` é o mesmo passado pro fbq() do navegador (trackCadastroConcluido
 * em metaPixel.ts) — a Meta deduplica os dois lados pelo event_id quando
 * ambos chegam, então manter os dois (Pixel + CAPI) é estratégia
 * recomendada pela própria Meta, não redundância inútil: quando o
 * navegador coopera, some com sinal extra (fbp/fbc); quando não (como no
 * caso real que achamos), o CAPI garante que o evento chegue de qualquer
 * jeito.
 */
export const trackConversaoServidor = createServerFn({ method: "POST" })
  .validator(trackConversaoSchema)
  .handler(async ({ data }) => {
    const pixelId = process.env["META_PIXEL_ID"];
    const accessToken = process.env["META_CAPI_ACCESS_TOKEN"];
    if (!pixelId || !accessToken) return { ok: false as const };

    const evento = montarEventoCapi(data, {
      userAgent: data.doNavegador ? getRequestHeader("user-agent") : undefined,
      ip: data.doNavegador
        ? (getRequestHeader("cf-connecting-ip") ??
          getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim())
        : undefined,
      agora: Math.floor(Date.now() / 1000),
    });

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [evento],
          access_token: accessToken,
        }),
      });
      if (!res.ok) {
        console.error("Falha ao enviar conversão pro Meta CAPI:", await res.text());
        return { ok: false as const };
      }
      return { ok: true as const };
    } catch (err) {
      console.error("Erro ao chamar Meta Conversions API:", err);
      return { ok: false as const };
    }
  });
