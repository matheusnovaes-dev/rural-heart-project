declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Não polui o dataset real com teste local: rodar o site em localhost (dev,
 * testes automatizados) já mandou PageView e CompleteRegistration de cadastro
 * de teste pro Meta, e isso entra na otimização dos anúncios.
 */
function pixelAtivo(): boolean {
  if (typeof window === "undefined" || !window.fbq) return false;
  return !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
}

function lerCookie(nome: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(?:^|; )${nome}=([^;]*)`));
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

/**
 * Cookies de navegador que a Meta usa pra ligar o evento do servidor ao clique
 * no anúncio (_fbp, _fbc). Sem eles a API de Conversões só acerta pelo
 * telefone/e-mail, e cadastro vindo de anúncio aparece como "sem origem". Se o
 * _fbc ainda não existe mas a URL trouxe o fbclid do anúncio, monta no formato
 * da Meta (fb.1.<timestamp>.<fbclid>).
 */
export function lerCookiesMeta(): { fbp?: string; fbc?: string; urlOrigem?: string } {
  if (typeof window === "undefined") return {};
  const fbp = lerCookie("_fbp");
  let fbc = lerCookie("_fbc");
  if (!fbc) {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
  }
  return {
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    urlOrigem: window.location.href,
  };
}

/** Dispara o evento padrão de conversão do Meta Pixel quando o cadastro
 * (produtor ou cooperativa) é concluído com sucesso — o objetivo real de
 * uma campanha de "cadastro/trial", não cliques ou pageview. `window.fbq`
 * só existe depois do script base carregar (ver __root.tsx); se a extensão
 * de bloqueio de anúncio do navegador removeu o script, isso simplesmente
 * não deve derrubar o cadastro em si. */
export function trackCadastroConcluido(params: {
  plano: string;
  valor?: number | undefined;
  eventId: string;
}) {
  if (!pixelAtivo()) return;
  window.fbq!(
    "track",
    "CompleteRegistration",
    { content_name: params.plano, currency: "BRL", value: params.valor },
    { eventID: params.eventId },
  );
}

/**
 * Etapa 1 do formulário concluída: a pessoa já deixou o WhatsApp, ou seja, já
 * é um lead com quem dá pra falar, mesmo se largar o cadastro na etapa 2.
 * Dispara o evento padrão "Lead" (que a campanha pode usar como meta de
 * otimização: acontece bem mais vezes que o cadastro completo, e a Meta
 * precisa de volume pra aprender quem converte) e mantém o evento
 * personalizado "CadastroIniciado" do histórico. O mesmo eventId vai pela API
 * de Conversões pra a Meta deduplicar.
 */
export function trackCadastroIniciado(eventId: string) {
  if (!pixelAtivo()) return;
  window.fbq!("track", "Lead", { content_name: "etapa_1_whatsapp" }, { eventID: eventId });
  window.fbq!("trackCustom", "CadastroIniciado");
}
