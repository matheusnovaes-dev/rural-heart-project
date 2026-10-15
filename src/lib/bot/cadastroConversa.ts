/**
 * Cadastro pelo WhatsApp conduzido por código. Achado real 2026-10-15: dois leads do anúncio
 * ficaram presos num ciclo (um respondeu "Sim" cinco vezes e o bot repetiu a mesma pergunta cinco
 * vezes). A mensagem de abertura pedia duas coisas ("qual sua cultura e estado?" e "responda quero
 * testar") e o modelo conduzia o passo a passo sozinho, sem saber que já tinha perguntado a mesma
 * coisa. Aqui o código decide o próximo passo olhando o que o produtor já disse e o que o bot já
 * perguntou: uma pergunta por vez, com opções numeradas, aceitando "sim" e sem repetir a mesma
 * frase. Na terceira falha seguida chama a equipe em vez de insistir.
 *
 * Só vale para quem ainda não tem cadastro. Pergunta de verdade ("quanto está a soja?") continua
 * indo para o modelo.
 */
import { culturaMencionada } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { MARCADOR_DE_CONTATO } from "@/lib/bot/contatoHumano";
import type { HistoricoLinha } from "@/lib/bot/prompt";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** minúsculo, sem acento, só letras/números/espaço. */
const norm = (s: string) =>
  semAcento(s.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ---------- textos do bot (os marcadores dizem em que passo a conversa está) ----------

export const MARC_MENU = "Responda com o número";
const MARC_UF = "Em qual estado fica a sua produção";
const MARC_CORRIGIR = "Me diga de novo, numa mensagem só";

const RE_CONFIRMA = /confirma:?\s*crio seu cadastro/i;
const RE_CAFE = /ar[aá]bica ou conillon/i;
const RE_UF =
  /em qual estado (fica|voc[eê] est[aá]|voc[eê] produz)|qual (é )?o seu estado|qual é seu estado|sigla do estado/i;
const RE_CULTURA =
  /o que voc[eê] produz|qual (é )?a sua cultura|sua cultura (principal|e estado)|cultura e estado|o que voc[eê] planta/i;
const RE_CONVITE = /quero testar|cadastro gr[aá]tis|teste gr[aá]tis/i;

const OPCOES = ["soja", "milho", "boi", "café", "leite de vaca"] as const;
const MENU = `1 Soja\n2 Milho\n3 Boi (gado)\n4 Café\n5 Leite\n6 Outro (é só escrever o nome)`;

export const PERGUNTA_CULTURA = `Pra começar, o que você produz? ${MARC_MENU}:\n${MENU}`;

function perguntaCultura(tentativa: number): string {
  if (tentativa <= 0) return PERGUNTA_CULTURA;
  return `Entendi! Só falta saber o que você produz pra eu criar seu cadastro grátis. ${MARC_MENU} (ou escreva o nome, tipo "soja"):\n${MENU}`;
}

function perguntaCafe(): string {
  return `Seu café é arábica ou conillon? ${MARC_MENU}:\n1 Arábica\n2 Conillon`;
}

function perguntaUf(cultura: string | null, tentativa: number): string {
  // O reconhecimento no começo ("Soja, certo!") é também como o código lembra a cultura escolhida
  // no menu numérico: a resposta "3" não diz "boi" em lugar nenhum do histórico.
  const ack = cultura ? `${maiuscula(cultura)}, certo! ` : "";
  if (tentativa <= 0) {
    return `${ack}${MARC_UF}? Pode escrever a sigla ou o nome do estado (ex: MG ou Goiás).`;
  }
  return `${ack}Só falta o estado. ${MARC_UF}? Escreva a sigla, tipo MG, GO ou MT.`;
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function nomeDoEstado(uf: string): string {
  return ufs.find((u) => u.value === uf)?.label ?? uf;
}

function perguntaConfirma(cultura: string, uf: string): string {
  return `Confirma: crio seu cadastro grátis de 7 dias como produtor de ${cultura} em ${nomeDoEstado(uf)}? Responda *sim* pra eu criar. Se algo estiver errado, é só me dizer o certo.`;
}

const PEDIR_CORRECAO = `Sem problema! ${MARC_CORRIGIR}: o que você produz e em que estado (ex: soja em Goiás).`;

const FIM_DO_ESCALAR = "pra te ajudar a começar";
const JA_AVISADO = "A nossa equipe já foi avisada e vai te chamar por aqui";

const ESCALAR = `Sem problema, a gente resolve! ${MARCADOR_DE_CONTATO} e alguém te chama aqui no WhatsApp ${FIM_DO_ESCALAR}.`;

// ---------- leitura da fala do produtor ----------

const TOKENS_SIM = new Set(
  (
    "sim ss s simm simmm isso mesmo pode ser criar quero eu vou claro que ok okay bora vamos vamo com certeza confirmo " +
    "uhum aham positivo certo exato senhor sr beleza blz fechado demorou manda mandar vai la fazer favor por gostaria " +
    "tambem testar cadastrar cadastro me comecar tudo bem ta ata sim pode"
  ).split(" "),
);
const TOKENS_SIM_FORTES = new Set(
  "sim ss s simm simmm isso pode quero claro ok okay bora vamos vamo confirmo uhum aham positivo certo exato beleza blz fechado demorou manda".split(
    " ",
  ),
);

/** "Sim", "Ss", "Pode criar", "Quero sim", "Sim eu", "Eu vou sim", 👍. */
export function ehAfirmacao(texto: string): boolean {
  if (/^[\s👍✅🙏👌]+$/u.test(texto) && /[👍✅🙏👌]/u.test(texto)) return true;
  const tokens = norm(texto).split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 5) return false;
  return tokens.every((t) => TOKENS_SIM.has(t)) && tokens.some((t) => TOKENS_SIM_FORTES.has(t));
}

export function ehNegacao(texto: string): boolean {
  const tokens = norm(texto).split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 6) return false;
  return /^(nao|n|errado|incorreto|negativo|nope)$/.test(tokens[0]!);
}

const RE_INTENCAO_DE_CADASTRO =
  /quero\s+(testar|me\s+cadastrar|experimentar|o\s+teste|fazer\s+o\s+cadastro|criar\s+(meu\s+)?cadastro)|me\s+cadastr|criar\s+(meu\s+)?cadastro|fazer\s+(o\s+)?cadastro|testar\s+gr[aá]tis/i;

const INICIO_DE_PERGUNTA =
  /^(quanto|quando|qual|quais|como|onde|por que|porque|pq|o que|quem|tem|existe|posso|da pra|voce|vcs|vc)\b/;

/** Pergunta de verdade (preço, como funciona...) vai para o modelo, não é resposta ao cadastro. */
function ehPergunta(texto: string): boolean {
  const n = norm(texto);
  if (/\?/.test(texto) && n.split(" ").length > 2) return true;
  return INICIO_DE_PERGUNTA.test(n);
}

const AMBIGUAS = new Set(["se", "to", "pa", "ma", "al", "ac", "am", "pe", "pi", "ce", "ap", "ro"]);

/** Estado citado no texto (sigla ou nome), ou null. Sigla solta só vale onde não confunde com palavra. */
export function ufDoTexto(texto: string): string | null {
  const n = ` ${norm(texto)} `;
  const tokens = n.trim().split(" ").filter(Boolean);
  // nomes por extenso, do mais longo para o mais curto ("mato grosso do sul" antes de "mato grosso")
  const nomes = ufs
    .map((u) => ({ uf: u.value as string, nome: norm(u.label) }))
    .concat([{ uf: "MG", nome: "minas" }])
    .sort((a, b) => b.nome.length - a.nome.length);
  for (const { uf, nome } of nomes) {
    if (uf === "PA" && nome === "para") continue;
    if (n.includes(` ${nome} `)) return uf;
  }
  // "pará" só com acento, ou depois de "em/no/do/estado" (sem acento é a palavra "para")
  if (
    /pará/i.test(texto) ||
    / (em|no|do|estado|sou|moro) para /.test(n) ||
    tokens.join(" ") === "para"
  ) {
    return "PA";
  }
  const siglas = new Set(ufs.map((u) => u.value.toLowerCase()));
  // sigla escrita em maiúscula pelo produtor ("MT", "Soja MG")
  for (const m of texto.matchAll(/(?<![\p{L}\d])([A-Z]{2})(?![\p{L}\d])/gu)) {
    if (siglas.has(m[1]!.toLowerCase())) return m[1]!;
  }
  // sigla depois de "em/no/na/de/do/uf/estado"
  const apos = n.match(/ (?:em|no|na|de|do|da|uf|estado) ([a-z]{2}) /);
  if (apos && siglas.has(apos[1]!)) return apos[1]!.toUpperCase();
  // mensagem curta ("go", "soja mg"): vale a sigla que não é palavra comum
  if (tokens.length <= 2) {
    for (const t of tokens) {
      if (t.length === 2 && siglas.has(t) && !AMBIGUAS.has(t)) return t.toUpperCase();
    }
  }
  return null;
}

export type CulturaLida = { cultura: string | null; cafeSemTipo: boolean; outro: boolean };

/** Cultura citada no texto ou escolhida no menu numerado. */
export function culturaDoTexto(texto: string, menuAtivo: boolean): CulturaLida {
  const vazio: CulturaLida = { cultura: null, cafeSemTipo: false, outro: false };
  const n = norm(texto);
  if (menuAtivo) {
    const m = n.match(/^(?:opcao |numero |n )?([1-6])$/);
    if (m) {
      const i = Number(m[1]);
      if (i === 6) return { ...vazio, outro: true };
      if (i === 4) return { ...vazio, cafeSemTipo: true };
      return { ...vazio, cultura: OPCOES[i - 1]! };
    }
  }
  if (/\b(conilon|conillon|robusta|canephora)\b/.test(n))
    return { ...vazio, cultura: "café conillon" };
  if (/\bcafe\b/.test(n) || /\bcafes\b/.test(n)) {
    if (/\barabica\b|\barabico\b/.test(n)) return { ...vazio, cultura: "café arábica" };
    return { ...vazio, cafeSemTipo: true };
  }
  const achada = culturaMencionada(texto);
  if (achada) return { ...vazio, cultura: achada };
  if (/\bleite\b/.test(n)) return { ...vazio, cultura: "leite de vaca" };
  if (/\bpecuaria\b/.test(n)) return { ...vazio, cultura: "boi" };
  if (/\bcana\b/.test(n)) return { ...vazio, cultura: "cana de açúcar" };
  if (/\balgodao\b/.test(n)) return { ...vazio, cultura: "algodão em pluma" };
  return vazio;
}

/** Resposta ao menu do café: 1/arábica, 2/conillon. */
function tipoDeCafe(texto: string): string | null {
  const n = norm(texto);
  if (/^(opcao |numero )?1$/.test(n) || /\barabica\b|\barabico\b/.test(n)) return "café arábica";
  if (/^(opcao |numero )?2$/.test(n) || /\b(conilon|conillon|robusta|canephora)\b/.test(n))
    return "café conillon";
  return null;
}

// ---------- estado da conversa ----------

type Passo = "confirma" | "cafe" | "uf" | "cultura" | "convite" | null;

function passoDe(msgBot: string | undefined): Passo {
  if (!msgBot) return null;
  if (RE_CONFIRMA.test(msgBot)) return "confirma";
  // Depois de chamar a equipe a conversa continua no passo da cultura (se a pessoa responder, segue).
  if (msgBot.includes(FIM_DO_ESCALAR) || msgBot.includes(JA_AVISADO)) return "cultura";
  if (RE_CAFE.test(msgBot)) return "cafe";
  if (RE_CULTURA.test(msgBot)) return "cultura";
  if (RE_UF.test(msgBot)) return "uf";
  if (RE_CONVITE.test(msgBot)) return "convite";
  return null;
}

/** Quantas respostas seguidas do bot (da mais recente para trás) estavam neste mesmo passo. */
function tentativasNoPasso(botDesc: string[], passo: Passo): number {
  let n = 0;
  for (const m of botDesc) {
    if (passoDe(m) !== passo) break;
    n++;
  }
  return n;
}

export type DecisaoCadastro =
  | { tipo: "responder"; resposta: string; precisa_humano: boolean }
  | { tipo: "criar"; uf: string; cultura: string }
  | null;

/** Lê o par cultura/UF de uma pergunta de confirmação que o próprio bot escreveu. */
function lerConfirmacao(msg: string): { cultura: string | null; uf: string | null } {
  const m = msg.match(/produtor de (.+?) (?:em|no|na) ([^?]+)\?/i);
  if (!m) return { cultura: null, uf: null };
  return { cultura: culturaDoTexto(m[1]!, false).cultura, uf: ufDoTexto(m[2]!) };
}

const AGRADECIMENTO_OU_DESPEDIDA = /obrigad|valeu|tchau|ate mais|ate logo|depois eu|mais tarde/;

export function decidirCadastro(params: {
  texto: string;
  historico: HistoricoLinha[];
}): DecisaoCadastro {
  const { texto } = params;
  const asc = [...params.historico].sort((a, b) => a.ordem - b.ordem);
  const botDesc = asc
    .filter((h) => h.role === "assistant")
    .reverse()
    .map((h) => h.conteudo);
  const ultimaBot = botDesc[0];
  const passo = passoDe(ultimaBot);
  const querCadastrar = RE_INTENCAO_DE_CADASTRO.test(texto);
  if (!passo && !querCadastrar) return null;
  if (ehPergunta(texto)) return null;
  const tokens = norm(texto).split(" ").filter(Boolean);

  const menuAtivo = !!ultimaBot && ultimaBot.includes(MARC_MENU);

  // Leitura da mensagem atual.
  let lida = culturaDoTexto(texto, menuAtivo && passo !== "cafe");
  const ufAtual = ufDoTexto(texto);
  if (passo === "cafe") {
    const tipo = tipoDeCafe(texto);
    if (tipo) lida = { cultura: tipo, cafeSemTipo: false, outro: false };
  }
  const trouxeAlgo = !!lida.cultura || !!ufAtual || lida.cafeSemTipo || lida.outro;

  // Fora de uma pergunta específica, só entra quem respondeu de fato ou pediu o cadastro.
  if (!trouxeAlgo) {
    if (ehNegacao(texto) && passo !== "confirma") return null;
    if (AGRADECIMENTO_OU_DESPEDIDA.test(norm(texto))) return null;
    if (passo === "convite" && !ehAfirmacao(texto) && !querCadastrar) return null;
    if (
      passo !== "convite" &&
      passo !== "confirma" &&
      !querCadastrar &&
      !ehAfirmacao(texto) &&
      tokens.length > 4
    ) {
      return null;
    }
  }

  let cultura: string | null = lida.cultura;
  let uf: string | null = ufAtual;
  let cafeSemTipo = lida.cafeSemTipo;

  if (passo === "confirma" && ultimaBot) {
    // Correção sobre o que o bot propôs: só muda o que o produtor corrigiu.
    const base = lerConfirmacao(ultimaBot);
    if (!lida.cultura && !ufAtual && !lida.cafeSemTipo) {
      if (ehAfirmacao(texto) && base.cultura && base.uf) {
        return { tipo: "criar", uf: base.uf, cultura: base.cultura };
      }
      if (ehNegacao(texto)) {
        return { tipo: "responder", resposta: PEDIR_CORRECAO, precisa_humano: false };
      }
      return null;
    }
    cultura = cultura ?? (cafeSemTipo ? null : base.cultura);
    uf = uf ?? base.uf;
  } else {
    // Completa com o que ele já tinha dito antes (mais recente primeiro), desde o último "diga de novo".
    const ordemDoReset = asc
      .filter((h) => h.role === "assistant" && h.conteudo.includes(MARC_CORRIGIR))
      .map((h) => h.ordem)
      .pop();
    const falasDesc = asc
      .filter((h) => h.role === "user" && (ordemDoReset == null || h.ordem > ordemDoReset))
      .reverse()
      .map((h) => h.conteudo)
      .slice(0, 8);
    // Cultura lembrada pelo reconhecimento da pergunta de estado ("Boi (gado), certo! Em qual estado...").
    if (!cultura && !cafeSemTipo && passo === "uf" && ultimaBot) {
      const ack = ultimaBot.match(/^(.+?), certo!/);
      if (ack) cultura = culturaDoTexto(ack[1]!, false).cultura;
    }
    for (const fala of falasDesc) {
      if (fala === texto) continue;
      if (!cultura && !cafeSemTipo) {
        const c = culturaDoTexto(fala, false);
        if (c.cultura) cultura = c.cultura;
        else if (c.cafeSemTipo) cafeSemTipo = true;
      }
      if (!uf) uf = ufDoTexto(fala);
      if ((cultura || cafeSemTipo) && uf) break;
    }
  }

  const alvo: "cafe" | "cultura" | "uf" | "confirma" =
    !cultura && cafeSemTipo ? "cafe" : !cultura ? "cultura" : !uf ? "uf" : "confirma";

  if (alvo === "confirma") {
    return { tipo: "responder", resposta: perguntaConfirma(cultura!, uf!), precisa_humano: false };
  }

  // Ainda falta algo: pergunta uma coisa só, sem repetir a frase anterior.
  const tentativas = tentativasNoPasso(botDesc, alvo);
  if (tentativas >= 2) {
    const jaChamouEquipe = botDesc.slice(0, 12).some((m) => m.includes(MARCADOR_DE_CONTATO));
    if (!jaChamouEquipe) return { tipo: "responder", resposta: ESCALAR, precisa_humano: true };
    // A equipe já foi avisada e a pessoa segue sem dizer o que produz: uma confirmação curta e
    // calma (uma vez), em vez de devolver para o modelo repetir a pergunta.
    if (botDesc.slice(0, 4).some((m) => m.includes(JA_AVISADO))) return null;
    return {
      tipo: "responder",
      resposta: `Tudo certo! ${JA_AVISADO}. Se quiser adiantar, me mande o que você produz e o estado, tipo "soja em MT", que eu mesmo crio seu cadastro.`,
      precisa_humano: false,
    };
  }
  if (alvo === "cafe")
    return { tipo: "responder", resposta: perguntaCafe(), precisa_humano: false };
  if (alvo === "uf") {
    return { tipo: "responder", resposta: perguntaUf(cultura, tentativas), precisa_humano: false };
  }
  if (lida.outro) {
    return {
      tipo: "responder",
      resposta: "Ok! Escreva o nome do que você produz (por exemplo: feijão, arroz, banana).",
      precisa_humano: false,
    };
  }
  return { tipo: "responder", resposta: perguntaCultura(tentativas), precisa_humano: false };
}
