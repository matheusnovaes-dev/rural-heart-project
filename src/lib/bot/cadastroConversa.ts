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
import { PALAVRAS_DE_MUNICIPIOS } from "@/lib/bot/municipiosPalavras";
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
  /em qual estado (fica|voc[eê] est[aá]|voc[eê] produz|voc[eê] trabalha)|qual (é )?o seu estado|qual é seu estado|sigla do estado|saber o estado|em que estado|qual (é )?a sua uf|qual a uf|estado \(estado\)/i;
const RE_CULTURA =
  /o que voc[eê] (produz|planta)|qual (é )?a sua cultura|qual (é )?a cultura|cultura que voc[eê]|sua cultura (principal|e estado)|cultura principal|cultura e (o )?(estado|uf)|cultura\)? e (em )?qual/i;
const RE_CONVITE = /quero testar|cadastro gr[aá]tis|teste gr[aá]tis/i;

const OPCOES = ["soja", "milho", "boi", "café", "leite de vaca"] as const;
const MENU = `1 Soja\n2 Milho\n3 Boi (gado)\n4 Café\n5 Leite\n6 Outro (é só escrever o nome)`;

export const PERGUNTA_CULTURA = `Pra começar, o que você produz? ${MARC_MENU}:\n${MENU}`;

function perguntaCultura(tentativa: number): string {
  if (tentativa <= 0) return PERGUNTA_CULTURA;
  return `Entendi! Só falta saber o que você produz pra eu criar seu cadastro grátis. ${MARC_MENU} (ou escreva o nome, tipo "soja"):\n${MENU}`;
}

// Textos de re-pergunta (depois de uma resposta que não ajudou). Servem de marcador: só eles contam
// como falha seguida; a pergunta inicial e o reconhecimento de progresso ("Soja, certo!") não.
const MARCAS_DE_FALHA = [
  "Só falta saber o que você produz",
  "Só falta o estado",
  "Só falta saber o tipo do café",
];

function perguntaCafe(tentativa = 0): string {
  if (tentativa > 0) {
    return `Só falta saber o tipo do café. Seu café é arábica ou conillon? ${MARC_MENU}:\n1 Arábica\n2 Conillon`;
  }
  return `Seu café é arábica ou conillon? ${MARC_MENU}:\n1 Arábica\n2 Conillon`;
}

/**
 * Estados mais comuns de cada cultura, na ordem do menu numerado da re-pergunta de estado. Achado real de
 * 2026-10-21: uma produtora de café escreveu "Mamosso" e depois "Gongais" (provavelmente "Minas Gerais"), o bot
 * pediu a sigla de novo e já chamou a equipe. Com os estados mais prováveis em números, quem escreve errado
 * responde "1" em vez de empacar.
 */
export function ufsMaisComuns(cultura: string | null): string[] {
  const c = norm(cultura ?? "");
  if (c.startsWith("cafe"))
    return c.includes("conil") ? ["ES", "RO", "BA", "MT", "MG"] : ["MG", "SP", "ES", "BA", "PR"];
  if (c === "soja") return ["MT", "PR", "RS", "GO", "MS"];
  if (c === "milho") return ["MT", "PR", "GO", "MS", "RS"];
  if (c === "boi" || c.startsWith("bezerr") || c.startsWith("garrote") || c.startsWith("novilha"))
    return ["MT", "GO", "MS", "MG", "SP"];
  if (c.startsWith("leite")) return ["MG", "RS", "PR", "GO", "SC"];
  return ["MG", "SP", "GO", "MT", "PR"];
}

function menuDeUfs(cultura: string | null): string {
  const lista = ufsMaisComuns(cultura);
  return [
    ...lista.map((u, i) => `${i + 1} ${nomeDoEstado(u)} (${u})`),
    `${lista.length + 1} Outro estado`,
  ].join("\n");
}

function distanciaDeEdicao(a: string, b: string): number {
  // Damerau-Levenshtein: trocar duas letras vizinhas ("goais" por "goias") conta como 1 erro de digitação.
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Até 2 estados com nome parecido com o que a pessoa escreveu ("Gongais" lembra Minas Gerais e Goiás), só para o
 * bot PERGUNTAR "você quis dizer?". Nunca escolhe sozinho. Compara cada palavra digitada com o nome inteiro e com as
 * palavras do nome do estado; só vale distância pequena em relação ao tamanho.
 */
export function ufsParecidas(texto: string): string[] {
  return ufsParecidasComDistancia(texto).map(([uf]) => uf);
}

/**
 * Estado quando só UM é parecido e a diferença é de uma letra ("matogrosso", "goiaz"). Serve só no passo do estado: o bot
 * ainda mostra o estado na confirmação final ("crio seu cadastro ... em Goiás?") antes de criar, então não adivinha às cegas.
 */
export function ufUnicaMuitoParecida(texto: string): string | null {
  // compara o texto inteiro (sem espaços) com o NOME INTEIRO do estado: "norte" ou "grande" não podem virar estado
  const s = norm(texto).replace(/ /g, "");
  if (s.length < 5) return null;
  const nomes = ufs.map((u) => ({ uf: u.value as string, nome: norm(u.label).replace(/ /g, "") }));
  nomes.push({ uf: "MG", nome: "minas" });
  const achados = new Set<string>();
  for (const { uf, nome } of nomes)
    if (nome.length >= 5 && distanciaDeEdicao(s, nome) <= 1) achados.add(uf);
  return achados.size === 1 ? [...achados][0]! : null;
}

function ufsParecidasComDistancia(texto: string): [string, number][] {
  const palavras = norm(texto)
    .split(" ")
    .filter((t) => t.length >= 4);
  if (palavras.length === 0) return [];
  const pontos = new Map<string, number>();
  const nomes = ufs.map((u) => ({ uf: u.value as string, nome: norm(u.label) }));
  nomes.push({ uf: "MG", nome: "minas" });
  for (const { uf, nome } of nomes) {
    const alvos = [nome, ...nome.split(" ").filter((t) => t.length >= 4)];
    for (const p of palavras) {
      for (const a of alvos) {
        const d = distanciaDeEdicao(p, a);
        if (d / Math.max(p.length, a.length) <= 0.45 && d <= 3) {
          pontos.set(uf, Math.min(pontos.get(uf) ?? 99, d));
        }
      }
    }
  }
  return [...pontos.entries()].sort((a, b) => a[1] - b[1]).slice(0, 2);
}

/** O que a pessoa escreveu, repetido na explicação ("Não reconheci “X”"): só mensagens curtas e sem aspas. */
function ecoCurto(texto: string): string | null {
  const t = texto.replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
  return t.length >= 2 && t.length <= 30 ? t : null;
}

function perguntaUf(cultura: string | null, tentativa: number, recusado?: string): string {
  // O reconhecimento no começo ("Soja, certo!") é também como o código lembra a cultura escolhida
  // no menu numérico: a resposta "3" não diz "boi" em lugar nenhum do histórico.
  const ack = cultura ? `${maiuscula(cultura)}, certo! ` : "";
  if (tentativa <= 0) {
    return `${ack}${MARC_UF}? Pode escrever a sigla ou o nome do estado (ex: MG ou Goiás).`;
  }
  const eco = recusado ? ecoCurto(recusado) : null;
  const sugeridas = recusado ? ufsParecidas(recusado) : [];
  const explicacao = eco
    ? `Não reconheci “${eco}” como um estado${
        sugeridas.length
          ? sugeridas.length === 1
            ? `. Você quis dizer ${nomeDoEstado(sugeridas[0]!)} (${sugeridas[0]})? Se for, responda *sim*. `
            : `. Você quis dizer ${sugeridas.map((u) => `${nomeDoEstado(u)} (${u})`).join(" ou ")}? Se for, responda a sigla. `
          : ". "
      }`
    : "";
  return `${ack}${explicacao}Só falta o estado. ${MARC_UF}? ${MARC_MENU}:\n${menuDeUfs(cultura)}`;
}

const SO_NUMERO = /^\s*(\d)\s*[.)]?\s*$/;

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function nomeDoEstado(uf: string): string {
  return ufs.find((u) => u.value === uf)?.label ?? uf;
}

function perguntaConfirma(cultura: string, uf: string): string {
  return `Confirma: crio seu cadastro grátis de 7 dias como produtor de ${cultura} em ${nomeDoEstado(uf)}? Responda *sim* pra eu criar. Se algo estiver errado, é só me dizer o certo.`;
}

const PEDIR_CORRECAO = `Sem problema! ${MARC_CORRIGIR}: o que você produz e em que estado (ex: soja em Goiás).`;

const MARCA_NAO_PRODUZ = "Muita gente usa o Safralume sem plantar";
const NAO_PRODUZ =
  /^(nada|nenhum|nenhuma|nao produzo( nada)?|nao planto( nada)?|nao crio( nada)?|nao tenho( nada)?|nao trabalho com isso|so curios[oa]|so curiosidade|so olhando|curiosidade|nada ainda|ainda nao produzo)$/;

const FIM_DO_ESCALAR = "pra te ajudar a começar";
const JA_AVISADO = "A nossa equipe já foi avisada e vai te chamar por aqui";

const ESCALAR = `Sem problema, a gente resolve! ${MARCADOR_DE_CONTATO} e alguém te chama aqui no WhatsApp ${FIM_DO_ESCALAR}.`;

// ---------- leitura da fala do produtor ----------

const TOKENS_SIM = new Set(
  (
    "sim ss s simm simmm isso mesmo pode ser criar quero eu vou claro que ok okay bora vamos vamo com certeza confirmo " +
    "uhum aham positivo certo exato senhor sr beleza blz fechado demorou manda mandar vai la fazer favor por gostaria " +
    "tambem testar cadastrar cadastro me comecar tudo bem ta ata sim pode certinho show top perfeito combinado dale yes yep okei okey fechou topo bom certeza oks " +
    // Achado 2026-10-22: "Sim pode cria", "É isso", "Isso aí", "Sim, obrigado" não eram lidos como confirmação.
    "cria crie criar faz faca o a esta e ai obrigado obrigada valeu correto exatamente"
  ).split(" "),
);
const TOKENS_SIM_FORTES = new Set(
  (
    "sim ss s simm simmm isso pode quero claro ok okay bora vamos vamo confirmo uhum aham positivo certo exato beleza blz fechado demorou manda " +
    // Variações reais de "sim" no WhatsApp (achado 2026-10-21: "Okk" ficou sem resposta certa).
    "certinho show top perfeito combinado dale yes yep okei okey fechou topo bom certeza oks cria crie faz faca correto exatamente"
  ).split(" "),
);

/** "Sim", "Ss", "Pode criar", "Quero sim", "Sim eu", "Eu vou sim", 👍. */
export function ehAfirmacao(texto: string): boolean {
  // Emoji de positivo, com ou sem tom de pele (👍🏻).
  if (/^[\s👍✅🙏👌\u{1F3FB}-\u{1F3FF}]+$/u.test(texto) && /[👍✅🙏👌]/u.test(texto)) return true;
  const tokens = norm(texto).split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 5) return false;
  // Letra esticada ("okkk", "simmmm", "certooo") vale como a palavra normal.
  const base = (t: string) => (TOKENS_SIM.has(t) ? t : t.replace(/(.)\1+/g, "$1"));
  const forte = (t: string) => TOKENS_SIM_FORTES.has(t) || TOKENS_SIM_FORTES.has(base(t));
  const geral = (t: string) => TOKENS_SIM.has(t) || TOKENS_SIM.has(base(t));
  return tokens.every(geral) && tokens.some(forte);
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

/** Quantas respostas seguidas do bot (da mais recente para trás) foram re-perguntas por falha. */
function falhasSeguidas(botDesc: string[]): number {
  let n = 0;
  for (const m of botDesc) {
    const ehFalha =
      MARCAS_DE_FALHA.some((x) => m.includes(x)) ||
      m.includes(FIM_DO_ESCALAR) ||
      m.includes(JA_AVISADO);
    if (!ehFalha) break;
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
  // No menu de estados o número NÃO escolhe cultura ("1" = primeiro estado da lista).
  let lida = culturaDoTexto(texto, menuAtivo && passo !== "cafe" && passo !== "uf");
  const ufAtual = ufDoTexto(texto);
  if (passo === "cafe") {
    const tipo = tipoDeCafe(texto);
    if (tipo) lida = { cultura: tipo, cafeSemTipo: false, outro: false };
  }
  const trouxeAlgo = !!lida.cultura || !!ufAtual || lida.cafeSemTipo || lida.outro;

  // Fora de uma pergunta específica, só entra quem respondeu de fato ou pediu o cadastro.
  if (!trouxeAlgo) {
    if (
      ehNegacao(texto) &&
      passo !== "confirma" &&
      !(passo === "cultura" && NAO_PRODUZ.test(norm(texto)))
    )
      return null;
    if (AGRADECIMENTO_OU_DESPEDIDA.test(norm(texto)) && !ehAfirmacao(texto)) return null;
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
  // Resposta de uma palavra só à pergunta "qual estado?": a sigla vale mesmo sendo palavra comum ("Pé" do corretor,
  // "pa", "ce", "al"...). Visto em 22/10: o lead escreveu "Pé" duas vezes e foi para a equipe sem necessidade.
  if (!uf && passo === "uf" && !lida.cultura && tokens.length === 1) {
    const siglaSolta = ufs.find((u) => u.value.toLowerCase() === tokens[0]);
    if (siglaSolta) uf = siglaSolta.value;
  }
  if (!uf && passo === "uf" && !lida.cultura) uf = ufUnicaMuitoParecida(texto);
  // "Você quis dizer Goiás (GO)? Se for, responda *sim*": o "sim" vale como o estado sugerido (só quando era uma sugestão só)
  if (!uf && passo === "uf" && ultimaBot && ehAfirmacao(texto)) {
    const sug = ultimaBot.match(
      /Você quis dizer ([^()?]+) \(([A-Z]{2})\)\? Se for, responda \*sim\*/,
    );
    if (sug) uf = sug[2]!;
  }

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
      // Não é sim, não é "não" e não traz nada novo: pede de novo, em vez de deixar o modelo inventar uma resposta
      // (achado 2026-10-21: "Okk" fez o bot dizer "houve um erro ao criar seu cadastro", que nunca aconteceu).
      if (base.cultura && base.uf) {
        return {
          tipo: "responder",
          resposta: `Não entendi bem 😅 Pra eu criar seu cadastro grátis de 7 dias como produtor de ${base.cultura} em ${nomeDoEstado(base.uf)}, responda *sim*. Se algo estiver errado, é só me dizer o certo.`,
          precisa_humano: false,
        };
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
    // Número escolhido no menu de estados ("1" = primeiro estado da lista dessa cultura).
    if (!uf && passo === "uf" && menuAtivo && cultura) {
      const n = Number(texto.match(SO_NUMERO)?.[1] ?? 0);
      const lista = ufsMaisComuns(cultura);
      if (n >= 1 && n <= lista.length) uf = lista[n - 1]!;
      else if (n === lista.length + 1) {
        // "Outro estado": pede a sigla, ainda como re-pergunta (a próxima falha chama a equipe).
        return {
          tipo: "responder",
          resposta: `${maiuscula(cultura)}, certo! Só falta o estado. ${MARC_UF}? Escreva a sigla, por exemplo PB, BA ou SC.`,
          precisa_humano: false,
        };
      }
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

  // "Nada", "não produzo", "só curiosidade": não é um erro de digitação, é alguém que não planta (comprador, corretor,
  // estudante, quem pensa em começar). Achado de 23/10: uma lead que respondeu o lembrete foi para a equipe com "Nada".
  // Uma chance de continuar o cadastro pelo que ela quer acompanhar; se ainda assim não responder, o fluxo normal chama a equipe.
  if (
    alvo === "cultura" &&
    !trouxeAlgo &&
    NAO_PRODUZ.test(norm(texto)) &&
    !botDesc.slice(0, 8).some((m) => m.includes(MARCA_NAO_PRODUZ))
  ) {
    return {
      tipo: "responder",
      resposta: `Sem problema! ${MARCA_NAO_PRODUZ}: quem compra, corretor, cooperativa ou quem está pensando em começar. Pra eu montar o seu teste, o que você produz ou quer acompanhar? ${MARC_MENU}:\n${MENU}`,
      precisa_humano: false,
    };
  }

  // Ainda falta algo: pergunta uma coisa só, sem repetir a frase anterior.
  // Se a pessoa trouxe uma informação nova (ex: corrigiu a cultura), é progresso: não conta como falha.
  const falhas = trouxeAlgo ? 0 : falhasSeguidas(botDesc);
  // Repetir a pergunta que o bot acabou de fazer usa o texto de re-pergunta (outra frase).
  const tentativas = !trouxeAlgo && (passoDe(ultimaBot) === alvo || falhas > 0) ? 1 : 0;
  // Quem está tentando escrever o estado e erra de novo (a 2ª digitação, com sugestão parecida) ganha mais uma chance
  // antes de chamar a equipe: achado de 21/10 ("Mamosso" e depois "Gongais" pararam numa lead real).
  const limiteDeFalhas = alvo === "uf" && ufsParecidas(texto).length > 0 ? 2 : 1;
  if (falhas >= limiteDeFalhas) {
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
    return { tipo: "responder", resposta: perguntaCafe(tentativas), precisa_humano: false };
  if (alvo === "uf") {
    return {
      tipo: "responder",
      resposta: perguntaUf(cultura, tentativas, trouxeAlgo ? undefined : texto),
      precisa_humano: false,
    };
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

/**
 * Erro de digitação no estado numa pergunta de cliente cadastrado ("como ta gogoias?"). Achado real de 2026-10-21: o
 * bot não reconheceu "gogoias", assumiu o feijão da conversa anterior e respondeu "Ainda não temos preço de feijão em
 * Goiás" sem avisar que tinha adivinhado. Aqui só entra quando é bem provável que seja um estado escrito errado: mensagem
 * curta, nenhuma cultura nem estado reconhecidos, e uma palavra de 5+ letras a 1 ou 2 letras de distância do nome de um
 * estado (nunca a palavra exata, para não confundir "norte" ou "grande" com um erro). O bot só PERGUNTA, nunca adivinha.
 */
export function estadoComErroDeDigitacao(
  texto: string,
): { escrito: string; sugeridas: string[] } | null {
  const palavras = norm(texto).split(" ").filter(Boolean);
  if (palavras.length === 0 || palavras.length > 6) return null;
  if (ufDoTexto(texto)) return null;
  if (culturaDoTexto(texto, false).cultura) return null;
  // Só quando a mensagem parece uma pergunta sobre um lugar (preço, tempo, "em/no/na"); evita pegar nomes de pessoa
  // ("Werick Santos da Cruz" lembra "Espírito Santo").
  if (
    !/\b(como (ta|esta)|quanto|preco|cotacao|valor|previsao|tempo|clima|chuva|em|no|na)\b/.test(
      norm(texto),
    )
  )
    return null;
  const nomes: { uf: string; alvo: string }[] = [];
  for (const u of ufs) {
    const n = norm(u.label);
    nomes.push({ uf: u.value as string, alvo: n });
    for (const t of n.split(" ")) if (t.length >= 5) nomes.push({ uf: u.value as string, alvo: t });
  }
  nomes.push({ uf: "MG", alvo: "minas" });
  const exatas = new Set(nomes.map((n) => n.alvo));
  for (const p of palavras) {
    if (p.length < 5 || exatas.has(p) || PALAVRAS_DE_MUNICIPIOS.has(p)) continue;
    const achadas = new Map<string, number>();
    for (const { uf, alvo } of nomes) {
      const d = distanciaDeEdicao(p, alvo);
      if (d >= 1 && d <= 2 && d / Math.max(p.length, alvo.length) <= 0.3) {
        achadas.set(uf, Math.min(achadas.get(uf) ?? 99, d));
      }
    }
    if (achadas.size) {
      const sugeridas = [...achadas.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, 2)
        .map(([uf]) => uf);
      return { escrito: p, sugeridas };
    }
  }
  return null;
}

export function respostaEstadoComErro(texto: string, escrito: string, sugeridas: string[]): string {
  // Mostra a palavra como a pessoa escreveu (com a mesma grafia), não a versão normalizada.
  const original =
    texto
      .split(/\s+/)
      .map((t) => t.replace(/[^\p{L}]/gu, ""))
      .find((t) => norm(t) === escrito) ?? escrito;
  const quis = sugeridas.map((u) => `${nomeDoEstado(u)} (${u})`).join(" ou ");
  return `Não reconheci “${original}” como um estado. Você quis dizer ${quis}? Me diga o estado e a cultura (por exemplo: feijão em ${nomeDoEstado(sugeridas[0]!)}) que eu busco o preço.`;
}
