import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";

const trackConversaoSchema = z.object({
  eventId: z.string().min(1),
  plano: z.string().min(1),
  valor: z.number().optional(),
  email: z.string().email().optional(),
  whatsapp: z.string().optional(),
});

function sha256(valor: string): string {
  return crypto.createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
}

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

    const userData: Record<string, string[]> = {};
    if (data.email) userData["em"] = [sha256(data.email)];
    if (data.whatsapp) {
      const digitos = data.whatsapp.replace(/\D/g, "");
      const comDdi = digitos.startsWith("55") ? digitos : `55${digitos}`;
      userData["ph"] = [sha256(comDdi)];
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: "CompleteRegistration",
              event_time: Math.floor(Date.now() / 1000),
              event_id: data.eventId,
              action_source: "website",
              user_data: userData,
              custom_data: { content_name: data.plano, currency: "BRL", value: data.valor },
            },
          ],
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
