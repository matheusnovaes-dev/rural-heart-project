/**
 * Pedido de contato humano ("me liga amanhã", "quero falar com alguém"): decidido por código.
 * Achado real 2026-10-14: um produtor escreveu "Me liga amanhã pela manhã", o bot respondeu "não
 * consigo fazer ligações" e NINGUÉM foi avisado: o modelo não marcava precisa_humano. Aqui, pedido
 * de ligação ou de falar com uma pessoa sempre avisa a equipe (o n8n manda o WhatsApp pro Matheus
 * com o nome, o telefone e o texto do pedido).
 *
 * Cuidado com falso positivo: "ligar/liga" também é "ligar o alerta" e "ligar o resumo diário".
 * Por isso só vale quando há "me", "pra mim", horário de ligação ou "ligação".
 */
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PADROES: RegExp[] = [
  // "me liga", "me ligue", "me ligar", "me telefona"
  /\bme\s+(liga|ligue|liguem|ligar|ligam|ligarem|telefona|telefone|telefonem|telefonar|chama\s+no\s+telefone)\b/,
  // "liga pra mim", "ligar para mim", "ligar no meu número"
  /\b(liga|ligue|ligar|telefona|telefonar)\s+(pra|para)\s+mim\b/,
  /\b(liga|ligue|ligar)\s+no\s+meu\b/,
  // "pode ligar amanhã", "podem ligar de manhã"
  /\b(pode|podem|poderia|poderiam)\s+ligar\s+(amanha|hoje|agora|depois|mais\s+tarde|de\s+manha|pela\s+manha|a\s+tarde|de\s+tarde|de\s+noite)\b/,
  // "uma ligação", "ligação amanhã"
  /\buma\s+liga[cç][aã]o\b/,
  /\bliga[cç][aã]o\s+(amanha|hoje|agora|a\s+tarde|de\s+manha|pela\s+manha|de\s+noite|pra\s+mim)\b/,
  /\b(retorn[ae]r?|retorno)\s+(a\s+)?liga[cç][aã]o\b/,
  // "falar com alguém / uma pessoa / atendente / humano ..."
  /\b(falar|conversar)\s+com\s+(um[a]?\s+)?(alguem|pessoa|humano|atendente|vendedor|consultor|especialista|responsavel|representante|gente\s+de\s+verdade)\b/,
  /\b(atendimento|atendente)\s+humano\b/,
  /\bquero\s+(um[a]?\s+)?atendente\b/,
];

// "Vocês ligam pra mim QUANDO o preço mexer?" é pergunta sobre alerta, não pedido de ligação.
const FRASE_DE_ALERTA =
  /\bquando\b.{0,40}\b(preco|clima|chover|chuva|geada|soja|milho|boi|cafe|dolar|passar|subir|cair|mexer|mudar|baixar)\b/;

export function ehPedidoDeContatoHumano(texto: string): boolean {
  const t = semAcento(texto);
  if (FRASE_DE_ALERTA.test(t)) return false;
  return PADROES.some((p) => p.test(t));
}

/** Resposta ao convite "se tiver um horário melhor, me diga": "pode ser às 9h", "de tarde", "amanhã cedo". */
const DETALHE_DE_HORARIO =
  /\b(\d{1,2}\s*(h|hs|hrs|horas|:\d{2})|(a|as)\s*\d{1,2}\b|amanha|hoje|manha|tarde|noite|cedo|depois|segunda|terca|quarta|quinta|sexta|sabado|domingo|meio\s*dia)\b/;

export function ehDetalheDeHorario(texto: string): boolean {
  return DETALHE_DE_HORARIO.test(semAcento(texto));
}

/** Marca dentro das respostas, para não avisar a equipe de novo a cada mensagem do mesmo pedido. */
export const MARCADOR_DE_CONTATO = "Já avisei a nossa equipe";

function primeiroNome(nome: string | null | undefined): string | null {
  const n = nome?.trim().split(/\s+/)[0];
  if (!n || /^(produtor|visitante)$/i.test(n) || n.length < 2) return null;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/**
 * @param avisosAnteriores quantas respostas recentes do bot já continham o marcador.
 *   0 = primeiro pedido (avisa a equipe), 1 = pediu de novo ou deu mais detalhe (avisa de novo),
 *   2 ou mais = só confirma, sem repetir o aviso (evita spam no WhatsApp da equipe).
 */
export function respostaDePedidoDeContato(
  nome: string | null | undefined,
  avisosAnteriores: number,
): { resposta: string; precisa_humano: boolean } {
  const pn = primeiroNome(nome);
  const chamado = pn ? `, ${pn}` : "";
  if (avisosAnteriores === 0) {
    return {
      resposta: `Entendi${chamado}! ${MARCADOR_DE_CONTATO} do seu pedido. Alguém entra em contato com você, por ligação ou aqui mesmo no WhatsApp, o quanto antes. Se tiver um horário melhor, é só me dizer aqui.`,
      precisa_humano: true,
    };
  }
  if (avisosAnteriores === 1) {
    return {
      resposta: `Anotado${chamado}! ${MARCADOR_DE_CONTATO} desse detalhe também. Assim que alguém puder, entra em contato com você.`,
      precisa_humano: true,
    };
  }
  return {
    resposta: `Seu pedido já está com a nossa equipe${chamado}. Assim que alguém puder, entra em contato com você.`,
    precisa_humano: false,
  };
}
