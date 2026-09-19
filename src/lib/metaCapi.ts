import crypto from "node:crypto";

export type DadosEventoCapi = {
  eventId: string;
  /** Padrão CompleteRegistration (cadastro concluído); "Lead" é a etapa 1 do formulário. */
  evento?: "CompleteRegistration" | "Lead" | undefined;
  plano?: string | undefined;
  valor?: number | undefined;
  email?: string | undefined;
  whatsapp?: string | undefined;
  /** Só quando a chamada vem do navegador do visitante (ver metaCapi.server.ts). */
  doNavegador?: boolean | undefined;
  fbp?: string | undefined;
  fbc?: string | undefined;
  urlOrigem?: string | undefined;
};

export function sha256(valor: string): string {
  return crypto.createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
}

/**
 * Monta o evento da API de Conversões (função pura, testável). Sinais de
 * navegador (cookies da Meta, IP, user agent, URL) só entram quando a chamada
 * veio do navegador do visitante: chamadas do servidor (o bot) não têm isso, e
 * o IP/navegador da requisição seria o do n8n, não o do produtor.
 */
export function montarEventoCapi(
  data: DadosEventoCapi,
  contexto: { userAgent?: string | undefined; ip?: string | undefined; agora: number },
) {
  const userData: Record<string, string | string[]> = {};
  if (data.email) userData["em"] = [sha256(data.email)];
  if (data.whatsapp) {
    const digitos = data.whatsapp.replace(/\D/g, "");
    const comDdi = digitos.startsWith("55") ? digitos : `55${digitos}`;
    userData["ph"] = [sha256(comDdi)];
  }
  if (data.doNavegador) {
    if (data.fbp) userData["fbp"] = data.fbp;
    if (data.fbc) userData["fbc"] = data.fbc;
    if (contexto.userAgent) userData["client_user_agent"] = contexto.userAgent;
    if (contexto.ip) userData["client_ip_address"] = contexto.ip;
  }

  const evento = data.evento ?? "CompleteRegistration";
  const customData: Record<string, unknown> =
    evento === "Lead"
      ? { content_name: "etapa_1_whatsapp" }
      : { content_name: data.plano, currency: "BRL", value: data.valor };

  return {
    event_name: evento,
    event_time: contexto.agora,
    event_id: data.eventId,
    action_source: "website",
    ...(data.doNavegador && data.urlOrigem ? { event_source_url: data.urlOrigem } : {}),
    user_data: userData,
    custom_data: customData,
  };
}
