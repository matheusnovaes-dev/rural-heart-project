import { normalizarWhatsapp } from "@/lib/telefone";
import { inserirComOrigem } from "@/lib/origem";
import { lerCookiesMeta, trackCadastroIniciado } from "@/lib/metaPixel";
import { trackConversaoServidor } from "@/lib/metaCapi.server";

/**
 * Registro do início do cadastro (etapa 1, WhatsApp já digitado): grava em
 * cadastro_iniciados e dispara o Lead (pixel no navegador + API de Conversões,
 * mesmo eventId pra a Meta deduplicar). Fica fora do componente pra qualquer
 * CTA da landing (hero, barra fixa, calculadora) registrar o início do mesmo
 * jeito, sem duplicar nem divergir da lógica do formulário.
 *
 * O query builder do supabase-js só dispara o fetch quando algo consome a
 * Promise (await ou .then) — um "void" sozinho nunca chega a mandar a
 * requisição (achado real: isso já tinha quebrado em silêncio o log de falha
 * e o insert em "leads"). .then() em vez de await de propósito: log é
 * best-effort e não pode atrasar a transição pra etapa 2. Rastreamento NUNCA
 * pode impedir a pessoa de avançar (ex: navegador antigo sem
 * crypto.randomUUID), por isso o try/catch.
 */
const iniciosJaRegistrados = new Set<string>();

export function registrarInicioDeCadastro(whatsappBruto: string) {
  const whatsapp = normalizarWhatsapp(whatsappBruto);
  // Vários CTAs (hero, calculadora, rodapé) podem receber o MESMO número na
  // mesma visita: sem isso cada envio disparava outro Lead com eventId novo,
  // que a Meta não consegue deduplicar, e outra linha em cadastro_iniciados.
  if (iniciosJaRegistrados.has(whatsapp)) return;
  iniciosJaRegistrados.add(whatsapp);
  void inserirComOrigem("cadastro_iniciados", { whatsapp });
  try {
    const eventIdLead = crypto.randomUUID();
    trackCadastroIniciado(eventIdLead);
    trackConversaoServidor({
      data: {
        eventId: eventIdLead,
        evento: "Lead",
        whatsapp,
        doNavegador: true,
        ...lerCookiesMeta(),
      },
    }).catch(() => {});
  } catch {
    // sem rastreio de Lead nesse navegador; o fluxo segue.
  }
}
