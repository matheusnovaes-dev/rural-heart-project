import { pricingPlans } from "@/config/site";
import { ufs } from "@/config/ufs";
import type { HistoricoLinha } from "@/lib/bot/prompt";

// Redes de segurança determinísticas do agente (mesma filosofia do resto do
// agent.ts: o que o modelo erra de forma intermitente não se corrige só com
// instrução no prompt). Funções puras, sem I/O, pra poderem ser testadas
// isoladamente.

function paraNumeroBr(inteiro: string, decimal: string | undefined): number {
  return parseFloat(`${inteiro.replace(/\./g, "")}.${decimal ?? "0"}`);
}

type ValorCitado = { valor: number; casas: number };

function extrairValoresComPrecisao(texto: string): ValorCitado[] {
  const padrao = /R\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/g;
  return [...texto.matchAll(padrao)].map((m) => ({
    valor: paraNumeroBr(m[1]!, m[2]),
    casas: m[2]?.length ?? 0,
  }));
}

/** Valores em reais citados numa resposta ("R$140,83", "R$ 1.234,56", "R$140"). */
export function extrairValoresReais(texto: string): number[] {
  return extrairValoresComPrecisao(texto).map((v) => v.valor);
}

// Qualquer número escrito num texto livre (mensagem do produtor, campo de
// texto de uma ferramenta), nas duas convenções (1.234,56 e 1234.56), pra
// não depender de como a fonte formatou.
function extrairNumerosSoltos(texto: string): number[] {
  const achados: number[] = [];
  for (const m of texto.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const bruto = m[0];
    const ptBr = bruto.replace(/\./g, "").replace(",", ".");
    const en = bruto.replace(/,/g, "");
    for (const candidato of [ptBr, en, bruto.replace(/[.,]/g, "")]) {
      const n = Number(candidato);
      if (Number.isFinite(n)) achados.push(n);
    }
  }
  return achados;
}

function coletarNumerosDeJson(valor: unknown, saida: number[]): void {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    saida.push(valor);
  } else if (typeof valor === "string") {
    saida.push(...extrairNumerosSoltos(valor));
  } else if (Array.isArray(valor)) {
    for (const v of valor) coletarNumerosDeJson(v, saida);
  } else if (valor && typeof valor === "object") {
    for (const v of Object.values(valor)) coletarNumerosDeJson(v, saida);
  }
}

type MensagemComResultadoDeFerramenta = { role: string; content?: string | null };

/**
 * Todo número que a resposta tem direito de citar: o que as ferramentas
 * devolveram NESTE turno (inclui o frete convertido pra R$/saca, que é
 * derivado direto de frete_rt), o que o próprio produtor escreveu (mensagem
 * atual e histórico dele) e os preços de plano. Números que só apareceram
 * numa resposta ANTERIOR do assistente de propósito NÃO entram: foi
 * exatamente assim que o bot reaproveitou um preço velho e o "ajustou" pra
 * uma cidade nova, inventando um valor que nenhuma fonte tinha.
 */
export function coletarNumerosPermitidos(
  mensagens: MensagemComResultadoDeFerramenta[],
  textoProdutor: string,
  historico: HistoricoLinha[],
): number[] {
  const numeros: number[] = [];

  for (const m of mensagens) {
    if (m.role !== "tool" || !m.content) continue;
    try {
      const json = JSON.parse(m.content) as unknown;
      coletarNumerosDeJson(json, numeros);
      const freteRt = (json as { frete?: { frete_rt?: unknown } })?.frete?.frete_rt;
      if (typeof freteRt === "number" || typeof freteRt === "string") {
        const n = Number(freteRt);
        if (Number.isFinite(n)) numeros.push((n / 1000) * 60);
      }
    } catch {
      // resultado de ferramenta malformado não pode derrubar a checagem.
    }
  }

  numeros.push(...extrairNumerosSoltos(textoProdutor));
  for (const h of historico) {
    if (h.role === "user") numeros.push(...extrairNumerosSoltos(h.conteudo));
  }
  for (const p of pricingPlans) numeros.push(p.price);

  return numeros;
}

/**
 * Valores em R$ da resposta que nenhuma fonte legítima desta conversa
 * sustenta. A tolerância acompanha as casas decimais que a resposta escreveu:
 * o dólar vem da fonte como 5,1569 e o bot diz "R$5,16" (arredondado) — isso
 * é o mesmo número, não invenção — mas 132,23 no lugar de 131,23 (diferença
 * de um real inteiro, o caso real) continua barrado.
 */
export function valoresNaoAutorizados(resposta: string, permitidos: number[]): number[] {
  return extrairValoresComPrecisao(resposta)
    .filter(({ valor, casas }) => {
      const tolerancia = casas === 0 ? 0.99 : 10 ** -casas + 1e-9;
      return !permitidos.some((p) => Math.abs(p - valor) <= tolerancia);
    })
    .map((v) => v.valor);
}

// "Rio Grande" é uma cidade E o começo de "Rio Grande do Sul"/"Rio Grande do
// Norte" — sem tirar o nome do estado antes, uma resposta que só diz "no Rio
// Grande do Sul" contava como se tivesse citado a cidade de origem do frete,
// e a rota completa nunca era acrescentada (achado real).
export function mencionaCidade(resposta: string, cidade: string): boolean {
  const alvo = cidade.toLowerCase();
  let texto = resposta.toLowerCase();
  for (const uf of ufs) {
    const nomeUf = uf.label.toLowerCase();
    if (nomeUf !== alvo && nomeUf.startsWith(`${alvo} `)) {
      texto = texto.split(nomeUf).join(" ");
    }
  }
  return texto.includes(alvo);
}

export type FreteCitado = { origem: string; destino: string };

/** Garante origem E destino do frete na resposta (só um dos dois lê como "frete até X" e engana). */
export function garantirRotaFrete(resposta: string, frete: FreteCitado | null): string {
  if (!frete) return resposta;
  // Só quando a resposta fala de frete: a ferramenta devolve a rota de
  // referência sempre, e emendar "rota considerada" numa resposta que não tocou
  // no assunto só confunde.
  if (!/frete/i.test(resposta)) return resposta;
  if (mencionaCidade(resposta, frete.origem) && mencionaCidade(resposta, frete.destino)) {
    return resposta;
  }
  const semPontuacaoFinal = resposta.trimEnd();
  const separador = /[.!?]$/.test(semPontuacaoFinal) ? " " : ". ";
  return `${semPontuacaoFinal}${separador}Rota de frete considerada: ${frete.origem} até ${frete.destino}.`;
}

/**
 * Confirmação de cadastro criado pelo chat, escrita por código e não pelo
 * modelo: antes o modelo prometia "você vai receber as atualizações de
 * preço automaticamente" sem existir nenhum alerta criado. Aqui só entra o
 * que é verdade — o que o cadastro dá (consulta na hora) e como pedir o
 * aviso automático (que passa a funcionar sem precisar de login).
 */
export const SITE_URL = "https://safralume.com.br";
export const LINK_CRIAR_ACESSO = `${SITE_URL}/login`;

export function respostaCadastroCriado(params: {
  nome: string;
  uf: string;
  cultura: string;
}): string {
  const primeiroNome = params.nome.trim().split(/\s+/)[0] || "";
  const saudacao = primeiroNome ? `Pronto, ${primeiroNome}!` : "Pronto!";
  const ufPorExtenso = ufs.find((u) => u.value === params.uf.toUpperCase())?.label ?? params.uf;
  const cultura = params.cultura.toLowerCase();
  return `${saudacao} Seu cadastro grátis de 7 dias como produtor de ${cultura} em ${ufPorExtenso} está criado. Aqui no WhatsApp você consulta preço, clima e tendência do mercado quando quiser, é só perguntar. Pra receber aviso automático quando o preço bater um valor, me diz a cultura e a partir de quanto você quer ser avisado que eu crio o alerta. Se quiser também um painel no site, é só me pedir aqui que eu te mando um link de acesso.`;
}

/**
 * Quando a própria resposta já trata de cadastro — ou a conversa já estava
 * no meio dele (a última mensagem do assistente era sobre cadastro e o
 * produtor só respondeu com um "eu quero"/UF/cultura) — o convite padrão do
 * n8n ("crie um cadastro grátis: link") é redundante e confunde.
 */
export function conversaFalaDeCadastro(
  resposta: string,
  historico: HistoricoLinha[] = [],
): boolean {
  if (/cadastr/i.test(resposta)) return true;
  const ultimaDoAssistente = [...historico]
    .sort((a, b) => a.ordem - b.ordem)
    .reverse()
    .find((h) => h.role === "assistant")?.conteudo;
  return !!ultimaDoAssistente && /cadastr/i.test(ultimaDoAssistente);
}

/**
 * Quem se cadastrou pelo WhatsApp não tem login no site, então qualquer
 * link de /dashboard (suporte, cancelamento, assinatura) cai numa tela de
 * login que ele não consegue passar. O prompt já manda evitar isso, mas o
 * modelo não respeita essa condição de forma confiável (visto ao vivo:
 * mandou "abra um chamado em /dashboard/suporte" e "cancele em
 * /dashboard/assinatura" pra cliente sem login). Aqui, por código, troca
 * essa resposta por uma que é verdade pra esse cliente e chama um humano
 * (precisa_humano=true avisa a equipe na hora, e a resposta vem por aqui).
 * Devolve null quando não há o que corrigir.
 */
export function corrigirLinkDePainelParaClienteSemLogin(
  resposta: string,
  textoProdutor: string,
  // Cobrança/reembolso: a resposta certa é sempre o repasse pra equipe, mesmo
  // que o modelo tenha errado de outro jeito (ex: "se cadastre no site").
  forcar = false,
): { resposta: string; precisa_humano: boolean } | null {
  const querCancelar = /cancel/i.test(textoProdutor);
  if (!forcar && !/safralume\.com\.br\/dashboard/i.test(resposta)) return null;
  return {
    resposta: querCancelar
      ? "Seu teste grátis não tem cobrança nem cartão cadastrado, então não tem nada pra cancelar. Já avisei a equipe do seu pedido e a resposta vem por aqui mesmo no WhatsApp."
      : "Já passei seu caso pra nossa equipe. A resposta vem por aqui mesmo no WhatsApp.",
    precisa_humano: true,
  };
}

/** Perguntas de quem é cadastrado só pelo WhatsApp sobre o painel/site, login ou senha. */
const PADRAO_PERGUNTA_PAINEL =
  /\b(painel|dashboard|senha|login|logar)\b|conta no site|(entrar|acessar|acesso)\b.{0,25}\b(site|painel)\b/i;

export function perguntaSobrePainel(textoProdutor: string): boolean {
  return PADRAO_PERGUNTA_PAINEL.test(textoProdutor);
}

/**
 * Pra quem já tem login: o modelo chegou a dizer "faça login com seu
 * WhatsApp" (o login é por e-mail e senha, nunca por WhatsApp). Texto fixo.
 */
export function respostaEntrarNoPainel(): string {
  return `Pra entrar no painel, acesse ${LINK_CRIAR_ACESSO} com o e-mail e a senha que você cadastrou. Se esqueceu a senha, use o "Esqueci minha senha" na mesma tela.`;
}

// ---------------------------------------------------------------------------
// Acesso ao painel por link no WhatsApp
// ---------------------------------------------------------------------------

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const PADROES_PEDIDO_DIRETO_DE_ACESSO = [
  /\b(manda|mande|envia|envie|passa|passe|gera|gere|quero|preciso)\b.{0,30}\b(link|acesso)\b/,
  /\blink\s+de\s+acesso\b/,
  /\bquero\b.{0,20}\b(acessar|entrar)\b.{0,25}\b(painel|site|dashboard|conta)\b/,
  /\b(esqueci|perdi)\b.{0,25}\b(acesso|senha|login)\b/,
  /\bnao\s+consigo\s+(entrar|acessar|logar)\b/,
  /\bacessar\s+(o\s+|meu\s+)?painel\b/,
];

const RESPOSTA_SIM =
  /^\s*(sim|s|pode|pode sim|quero|quero sim|manda|mande|claro|ok|isso|por favor|pf)\b/;

/** Trecho fixo da oferta — a confirmação "sim" só vale se a última mensagem do bot foi essa oferta. */
const MARCA_DA_OFERTA_DE_ACESSO = "te mande agora um link de acesso";

export function respostaOfertaDeAcesso(): string {
  return `O painel é opcional: lá você vê preço e clima da sua região, gerencia alertas e lembretes e acompanha seu plano. Quer que eu ${MARCA_DA_OFERTA_DE_ACESSO}? É só responder "sim".`;
}

/**
 * O que o produtor está pedindo sobre acesso ao painel:
 * - "gerar": pediu o link/acesso de forma direta, ou confirmou a oferta;
 * - "oferecer": só perguntou sobre painel/login/senha (explica e oferece);
 * - null: não é sobre isso (segue o fluxo normal).
 * Cancelamento e cobrança nunca entram aqui.
 */
export function classificarPedidoDeAcesso(
  textoProdutor: string,
  historico: HistoricoLinha[],
): "gerar" | "oferecer" | null {
  const t = semAcento(textoProdutor);
  if (/cancel/.test(t)) return null;

  if (PADROES_PEDIDO_DIRETO_DE_ACESSO.some((p) => p.test(t))) return "gerar";

  const ultimaDoAssistente = [...historico]
    .sort((a, b) => a.ordem - b.ordem)
    .reverse()
    .find((h) => h.role === "assistant")?.conteudo;
  if (
    ultimaDoAssistente &&
    ultimaDoAssistente.includes(MARCA_DA_OFERTA_DE_ACESSO) &&
    RESPOSTA_SIM.test(t)
  ) {
    return "gerar";
  }

  if (perguntaSobrePainel(textoProdutor)) return "oferecer";
  return null;
}

export function respostaLinkDeAcesso(link: string): string {
  return `Aqui está seu link de acesso ao painel: ${link}\n\nEle vale por pouco tempo e só funciona uma vez. Depois de entrar, crie seu e-mail e senha pra voltar quando quiser.`;
}

export const RESPOSTA_FALHA_AO_GERAR_LINK =
  "Não consegui gerar seu link de acesso agora. Já avisei a equipe e a gente resolve por aqui mesmo no WhatsApp.";

/**
 * Quando o preço veio por praça, o número de referência é a MÉDIA das praças
 * do interior — e o produtor só entende se a resposta disser qual é a média.
 * O prompt pede isso, mas o modelo cita só as praças cerca de metade das
 * vezes. Acrescenta a frase quando a média não aparece.
 */
export function garantirMediaDasPracas(resposta: string, media: number | null): string {
  if (media == null) return resposta;
  const jaCitou = extrairValoresReais(resposta).some((v) => Math.abs(v - media) < 0.011);
  if (jaCitou) return resposta;
  const semPontuacaoFinal = resposta.trimEnd();
  const separador = /[.!?]$/.test(semPontuacaoFinal) ? " " : ". ";
  return `${semPontuacaoFinal}${separador}Média das praças: R$${media.toFixed(2).replace(".", ",")}.`;
}

// ---------------------------------------------------------------------------
// Leite: números em kg/litros
// ---------------------------------------------------------------------------

// "60 kg" é o tamanho da saca e "1 litro" a unidade: aparecem sem vir de ferramenta.
const MEDIDAS_SEMPRE_PERMITIDAS = [1, 60];

/**
 * Quantidades em kg ou litros que a resposta cita e nenhuma ferramenta
 * sustenta. O guarda de valores em R$ não vê essas: na relação leite/milho o
 * modelo escreveu "cada litro compra 0,038 kg de milho" (conta própria, errada
 * por duas ordens de grandeza) com todos os R$ certos. A tolerância acompanha
 * as casas escritas ("26 litros" cobre 26,4; "26,4" só cobre 26,4).
 */
export function medidasNaoAutorizadas(resposta: string, permitidos: number[]): number[] {
  const validos = [...permitidos, ...MEDIDAS_SEMPRE_PERMITIDAS];
  const padrao =
    /(\d+(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d+)?)\s*(?:milhões\s+de\s+|mil\s+)?(?:kg|quilos?|litros?)\b/gi;
  const invalidas: number[] = [];
  for (const m of resposta.matchAll(padrao)) {
    const bruto = m[1]!;
    const valor = Number(bruto.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    if (!Number.isFinite(valor)) continue;
    const casas = bruto.includes(",") ? bruto.split(",")[1]!.length : 0;
    const tolerancia = casas === 0 ? 0.5 + 1e-9 : 0.5 * 10 ** -casas + 1e-9;
    if (!validos.some((p) => Math.abs(p - valor) <= tolerancia)) invalidas.push(valor);
  }
  return invalidas;
}

/**
 * Relação leite/milho: se a resposta cita alguma quantidade em kg/litros que
 * a ferramenta não trouxe, troca a resposta inteira pela frase pronta escrita
 * por código (buscar_leite → frase_relacao). Sem frase pronta, devolve a
 * resposta como veio.
 */
export function garantirRelacaoLeiteMilho(
  resposta: string,
  frase: string | null,
  permitidos: number[],
): string {
  if (!frase) return resposta;
  return medidasNaoAutorizadas(resposta, permitidos).length > 0 ? frase : resposta;
}

/**
 * Leite: a resposta tem que trazer a cotação recente que a ferramenta achou.
 * O modelo às vezes abre só com a média de 2024 (ou erra o nome da fonte); se o
 * preço da cotação não aparece, a frase pronta entra na frente.
 */
export function garantirCotacaoLeite(
  resposta: string,
  cotacao: { preco: number; frase: string } | null,
): string {
  if (!cotacao) return resposta;
  const citou = extrairValoresReais(resposta).some((v) => Math.abs(v - cotacao.preco) <= 0.0101);
  return citou ? resposta : `${cotacao.frase} ${resposta}`;
}

/**
 * Paridade de porto: quando a ferramenta calculou (tipo "paridade"), a resposta
 * tem que trazer o valor da paridade. O modelo às vezes cita só o preço; nesse
 * caso a frase pronta (porto, frete, paridade, comparação) entra no fim.
 */
export function garantirParidade(
  resposta: string,
  paridade: { valor: number; frase: string } | null,
): string {
  if (!paridade) return resposta;
  const citou = extrairValoresReais(resposta).some((v) => Math.abs(v - paridade.valor) <= 0.0101);
  if (citou) return resposta;
  const semPontuacaoFinal = resposta.trimEnd();
  const separador = /[.!?]$/.test(semPontuacaoFinal) ? " " : ". ";
  return `${semPontuacaoFinal}${separador}${paridade.frase}`;
}
