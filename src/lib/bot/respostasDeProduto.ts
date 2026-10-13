import { funcionalidades } from "@/config/funcionalidades";
import { respostaNovidades } from "@/lib/bot/prompt";

/**
 * Perguntas sobre o PRÓPRIO produto, respondidas por código. Em teste com o
 * modelo real (2026-10-13) ele errou justamente estas: respondeu "o que têm de
 * novo?" com preço de soja, disse que "não consegue ouvir áudio" (o n8n
 * transcreve com Whisper), respondeu "diagnóstico de praga por foto?" falando de
 * alerta, e INVENTOU que a Asaas emite nota fiscal. Resposta de produto errada
 * custa confiança, então a verdade mora em config/funcionalidades.ts e no código,
 * não na boa vontade do modelo.
 */
export type RespostaDeProduto = { resposta: string; precisa_humano: boolean };

/**
 * Fronteira de palavra que entende acento: o \b do JavaScript trata "á", "ê" etc.
 * como não-letra e por isso "áudio" e "dá" nunca casavam (achado nos testes).
 */
const palavra = (padrao: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${padrao})(?![\\p{L}\\p{N}])`, "iu");

const CULTURAS_E_DADOS = palavra(
  "soja|milho|boi|gado|caf[eé]|trigo|arroz|feij[aã]o|algod[aã]o|leite|pre[cç]o|cota[cç][aã]o|mercado|clima|chuva|safra|d[oó]lar|diesel",
);

const NOVIDADES = palavra(
  "novidades?|o que (?:(?:voc[eê]s?|vcs?) )?(?:mudou|h[aá] de novo|tem de novo|t[eê]m de novo)|(?:tem|t[eê]m) (?:algo|coisa|alguma coisa|alguma novidade) (?:de )?nov[ao]|atualiza[cç][oõ]es",
);

export function ehPerguntaDeNovidades(texto: string): boolean {
  const t = texto.trim();
  if (t.length > 70 || CULTURAS_E_DADOS.test(t)) return false;
  return NOVIDADES.test(t);
}

const CATALOGO = new RegExp(
  "(?:o que (?:é|e) (?:o )?safralume|o que (?:o )?safralume (?:faz|oferece|tem)|o que (?:voc[eê]s?|vcs?) (?:fazem|oferecem)|quais (?:s[aã]o )?(?:as )?(?:funcionalidades|fun[cç][oõ]es|recursos)|o que (?:eu )?(?:posso|d[aá]) (?:pra )?(?:pedir|fazer) (?:aqui|por aqui|com (?:o )?(?:safralume|bot))|como (?:o )?safralume funciona|^\\s*como funciona\\??\\s*$)",
  "iu",
);

export function ehPerguntaDeCatalogo(texto: string): boolean {
  const t = texto.trim();
  return t.length <= 120 && CATALOGO.test(t);
}

const AUDIO = palavra("[aá]udios?");
const VERBO_DE_CAPACIDADE = palavra(
  "posso|pode|d[aá]|consigo|aceita|aceitam|entende|entendem|funciona|ouve|ouvem|escuta|escutam|l[eê]|leem|lêem|analisa|analisam|identifica|reconhece|diagn[oó]stic\\w*",
);

export function ehPerguntaDeAudio(texto: string): boolean {
  const t = texto.trim();
  return t.length <= 120 && AUDIO.test(t) && VERBO_DE_CAPACIDADE.test(t);
}

const FOTO_OU_PDF = palavra("fotos?|imagem|imagens|prints?|pdf");
const DIAGNOSTICO_DE_PRAGA = new RegExp(
  "diagn[oó]stic\\w*[^.?!]{0,40}(?:praga|doen[cç]a|lavoura|planta)|identific\\w*[^.?!]{0,20}(?:praga|doen[cç]a)",
  "iu",
);

export function ehPerguntaDeFotoOuPdf(texto: string): boolean {
  const t = texto.trim();
  if (t.length > 140) return false;
  if (DIAGNOSTICO_DE_PRAGA.test(t)) return true;
  return FOTO_OU_PDF.test(t) && VERBO_DE_CAPACIDADE.test(t);
}

const NOTA_FISCAL = palavra("nota fiscal|notas fiscais|nf-?e|nfs-?e|recibo");

export function ehPerguntaDeNotaFiscal(texto: string): boolean {
  return NOTA_FISCAL.test(texto);
}

export function respostaCatalogo(): string {
  const f = (id: string) => funcionalidades.find((x) => x.id === id)!;
  const item = (id: string, rotulo: string) => `• ${rotulo}: "${f(id).comoPedir}"`;
  return [
    "O Safralume é o seu assistente de mercado aqui no WhatsApp (e no painel, pelo navegador). Dá pra pedir, por exemplo:",
    "",
    item("preco", "Preço da sua região comparado com o porto"),
    item("sinal_venda", "Saber se é hora de vender"),
    item("alertas", "Aviso quando o preço ou o clima mudar"),
    item("resumo_diario", "Resumo diário no horário que você escolher"),
    item("comparar_proposta", "Comparar uma proposta de compra"),
    item("calculadora", "Quanto vale a sua safra"),
    "• Também tem janela de plantio, previsão do tempo, ferrugem da soja, dólar, diesel e futuros.",
    "",
    "Pode mandar texto ou áudio. Quer ver o que tem de novo? É só mandar: novidades.",
  ].join("\n");
}

const PEDIDO_DE_HUMANO = new RegExp(
  "(?:(?:falar|conversar|chamar|passar|ser atendid[oa]|atendimento)[^.?!]{0,25}(?:pessoa|humano|atendente|algu[eé]m|gente de verdade|suporte|equipe)|atendente|(?:quero|preciso d[eo]) (?:um )?humano|pessoa de verdade)",
  "iu",
);

export function ehPedidoDeHumano(texto: string): boolean {
  const t = texto.trim();
  return t.length <= 140 && PEDIDO_DE_HUMANO.test(t);
}

export function respostaDeProduto(texto: string): RespostaDeProduto | null {
  if (ehPedidoDeHumano(texto)) {
    return {
      resposta: "Claro! Já avisei a nossa equipe e alguém te responde por aqui assim que possível.",
      precisa_humano: true,
    };
  }
  if (ehPerguntaDeNotaFiscal(texto)) {
    return {
      resposta:
        "Sobre nota fiscal eu não tenho essa informação com segurança, e prefiro não chutar. Já avisei a nossa equipe pra te responder por aqui.",
      precisa_humano: true,
    };
  }
  if (ehPerguntaDeNovidades(texto)) return { resposta: respostaNovidades(), precisa_humano: false };
  if (ehPerguntaDeFotoOuPdf(texto)) {
    return {
      resposta:
        "Por enquanto só entendo texto e áudio: não leio foto nem PDF, e também não faço diagnóstico de praga ou doença por imagem. Se você me contar o que está vendo na lavoura, eu consulto o que dá, como os focos de ferrugem confirmados na sua região (soja).",
      precisa_humano: false,
    };
  }
  if (ehPerguntaDeAudio(texto)) {
    return {
      resposta:
        "Pode mandar áudio sim: eu transcrevo e respondo normalmente. Foto e PDF eu ainda não leio, só texto e áudio.",
      precisa_humano: false,
    };
  }
  if (ehPerguntaDeCatalogo(texto)) return { resposta: respostaCatalogo(), precisa_humano: false };
  return null;
}
