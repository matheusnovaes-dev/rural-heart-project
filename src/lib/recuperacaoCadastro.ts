/**
 * Recuperação de cadastro: quem deixou o WhatsApp na etapa 1 do formulário e não
 * terminou recebe UMA mensagem no WhatsApp convidando a concluir (o cadastro
 * dá pra fazer respondendo a própria mensagem). Funções puras aqui; o envio
 * fica em routes/api/cron/recuperar-cadastro.ts.
 */

/** Espera antes de mandar: dá tempo de a pessoa terminar sozinha (a maioria termina em minutos). */
export const MINUTOS_ANTES_DE_ENVIAR = 45;
/** Depois disso o lead esfriou e a mensagem vira ruído: não manda mais. */
export const HORAS_MAXIMAS_PARA_ENVIAR = 24;
export const MAX_ENVIOS_POR_RODADA = 20;

/** Só manda de 8h às 20h59 no horário de Brasília (o Brasil não tem horário de verão desde 2019). */
export function dentroDoHorarioDeEnvio(agora: Date): boolean {
  const hora = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(agora),
  );
  return hora >= 8 && hora < 21;
}

/**
 * Celular brasileiro no formato nacional (DDD + 9 + 8 dígitos). Barra número
 * de teste ("00...") e telefone fixo, que não recebe WhatsApp.
 */
export function celularValidoParaEnvio(numero: string): boolean {
  return /^[1-9]\d9\d{8}$/.test(numero) && !numero.startsWith("0");
}

/**
 * O webhook de recuperação mora no mesmo n8n do de boas-vindas (mesmo token);
 * troca só o caminho pra não exigir uma variável de ambiente nova.
 */
export function urlDoWebhookDeRecuperacao(urlBoasVindas: string): string | null {
  const nova = urlBoasVindas.replace("boas-vindas-whatsapp", "recuperar-cadastro-whatsapp");
  return nova === urlBoasVindas ? null : nova;
}

/**
 * O envio só conta como feito se o n8n devolveu o resultado do WhatsApp com o
 * id da mensagem (wamid). O webhook responde 500 quando o token não bate ou o
 * WhatsApp recusa (template ainda não aprovado, número sem WhatsApp...).
 */
export function envioConfirmado(status: number, corpo: string): boolean {
  return status >= 200 && status < 300 && /"id"\s*:\s*"wamid\./.test(corpo);
}

/** Quem responde SAIR (ou variações) pedindo pra parar de receber mensagem. */
export function ehPedidoDeSair(texto: string): boolean {
  const t = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (/^(sair|parar|pare|stop|descadastrar|cancelar mensagens?)\W*$/.test(t)) return true;
  return /\bnao\s+quero\s+(mais\s+)?receber\b/.test(t);
}

export const RESPOSTA_SAIDA_DE_MENSAGENS =
  "Pronto, não vou mais te mandar mensagens. Se mudar de ideia, é só chamar aqui.";
