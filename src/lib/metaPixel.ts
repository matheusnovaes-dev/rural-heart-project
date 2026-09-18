declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
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
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq(
    "track",
    "CompleteRegistration",
    { content_name: params.plano, currency: "BRL", value: params.valor },
    { eventID: params.eventId },
  );
}

/** Sinal de intenção (etapa 1 do formulário concluída, antes do cadastro
 * de fato existir). Não é evento padrão de conversão do Meta, então usa
 * trackCustom, não track — não deve interferir na otimização da campanha,
 * que continua mirando em CompleteRegistration. Serve só pra comparar, no
 * Gerenciador de Eventos, quantas pessoas chegam até aqui vs. quantas
 * terminam o cadastro. */
export function trackCadastroIniciado() {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("trackCustom", "CadastroIniciado");
}
