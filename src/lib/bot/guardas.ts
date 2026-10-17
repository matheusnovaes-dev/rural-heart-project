import { primeiroNome as primeiroNomeLimpo } from "@/lib/nomes";
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

// Achado real testando ao vivo (2026-10-12): buscar_producao_historica_conab
// devolve area_plantada_mil_ha/producao_mil_t em MILHARES (ex: 9158.8), e o
// modelo corretamente escreve o número cheio na resposta ("9.158.800
// toneladas") — sem a palavra "mil" do lado, porque já fez a conta. Essa
// função só guardava o valor cru do JSON (9158.8), então a resposta certa
// (9158800) nunca batia com nenhum "permitido" e caía no bloqueio de "valor
// não confiável". Chave terminando em "_mil_ha"/"_mil_t" também autoriza o
// valor × 1000.
function coletarNumerosDeJson(valor: unknown, saida: number[], chave?: string): void {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    saida.push(valor);
    // Valor negativo (ex: diferencial de base -3,49) é escrito como "-R$3,49" ou "R$3,49 abaixo":
    // o extrator lê o módulo, então o módulo também é fonte legítima.
    if (valor < 0) saida.push(-valor);
    if (chave && /_mil_(ha|t)$/.test(chave)) saida.push(valor * 1000);
  } else if (typeof valor === "string") {
    saida.push(...extrairNumerosSoltos(valor));
  } else if (Array.isArray(valor)) {
    for (const v of valor) coletarNumerosDeJson(v, saida, chave);
  } else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) coletarNumerosDeJson(v, saida, k);
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

export type ResultadoLeilao =
  | { disponivelNoPlano: false }
  | { disponivelNoPlano: true; encontrado: false }
  | { disponivelNoPlano: true; encontrado: true; totalPresenciais: number; totalVirtuais: number };

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

function dataBr(isoDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/**
 * Garante que a resposta cita a data do preço (o prompt já pede isso, mas
 * testando ao vivo o bot citou um preço de maçã com um mês de atraso sem
 * mencionar a data nenhuma vez — quem lê acha que é de hoje).
 */
export function garantirDataDoPreco(resposta: string, dataReferencia: string | null): string {
  if (!dataReferencia) return resposta;
  const dd = dataBr(dataReferencia);
  if (!dd) return resposta;
  const [dia, mes] = dd.split("/");
  // Aceita com ou sem o ano (a resposta às vezes escreve só "28/08" quando é
  // óbvio que é o ano corrente) — o que importa é dia e mês baterem.
  if (resposta.includes(`${dia}/${mes}`)) return resposta;
  const semPontuacaoFinal = resposta.trimEnd();
  const separador = /[.!?]$/.test(semPontuacaoFinal) ? " " : ". ";
  return `${semPontuacaoFinal}${separador}Dado de ${dd}.`;
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
  const primeiroNome = primeiroNomeLimpo(params.nome) ?? "";
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
  // Link só de upgrade/teaser do plano Prata (ex: "dá pra conhecer em .../dashboard/assinatura"):
  // não é pedido de suporte nem de cancelamento, então não escala pra humano. Troca o link por
  // uma saída que existe pra esse cliente (pedir o acesso ao painel aqui no WhatsApp).
  // Visto ao vivo em 2026-10-15: "tem leilão de gado essa semana?" de um Bronze virava "passei
  // seu caso pra nossa equipe" porque o teaser de leilão citava esse link.
  const soUpgrade =
    !forcar &&
    !querCancelar &&
    !/cancel|reembols|cobran|chamado|suporte/i.test(resposta) &&
    !/safralume\.com\.br\/dashboard\/(?!assinatura)/i.test(resposta);
  if (soUpgrade) {
    const saida = "pelo painel (é só me pedir aqui que eu mando seu acesso)";
    return {
      resposta: resposta
        .replace(
          /\b(em|no site|pelo site)\s+(https?:\/\/)?safralume\.com\.br\/dashboard\/assinatura/gi,
          saida,
        )
        .replace(
          /(https?:\/\/)?safralume\.com\.br\/dashboard\/assinatura/gi,
          "o painel (é só me pedir aqui que eu mando seu acesso)",
        ),
      precisa_humano: false,
    };
  }
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
  /\bquero\b.{0,15}\b(o\s+|meu\s+)?painel\b/,
  /\bme\s+(manda|envia|passa)\b.{0,15}\bpainel\b/,
  /\bquero\b.{0,20}\b(acessar|entrar)\b.{0,25}\b(painel|site|dashboard|conta)\b/,
  /\b(esqueci|perdi)\b.{0,25}\b(acesso|senha|login)\b/,
  /\bnao\s+consigo\s+(entrar|acessar|logar)\b/,
  /\bacessar\s+(o\s+|meu\s+)?painel\b/,
];

// A mensagem inteira tem que ser a confirmação: "Quero ver meu preço agora" (botão do modelo de
// boas-vindas) começa com "quero" mas é outro pedido e virava link de acesso (achado 2026-10-15).
const RESPOSTA_SIM =
  /^\s*(sim|s|ss|pode|pode sim|pode ser|quero|quero sim|eu quero|manda|mande|me manda|claro|ok|okay|isso|por favor|pf|uhum|aham|bora|vamos|beleza|blz|com certeza|positivo)[\s!.?,]*$/;

/** Trecho fixo da oferta — a confirmação "sim" só vale se a última mensagem do bot foi essa oferta. */
const MARCA_DA_OFERTA_DE_ACESSO = "te mande agora um link de acesso";
// Achado real 2026-10-15 (teste do Matheus): a mensagem de "cadastro criado" também oferece o painel
// ("Se quiser também um painel no site, é só me pedir aqui...") e o "Quero" que veio em seguida foi
// lido pelo modelo como pedido de ajuda humana. A oferta feita nessa mensagem vale como oferta de
// acesso, igual à de cima.
const MARCA_DA_OFERTA_NO_CADASTRO = "um painel no site, é só me pedir";

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
    (ultimaDoAssistente.includes(MARCA_DA_OFERTA_DE_ACESSO) ||
      ultimaDoAssistente.includes(MARCA_DA_OFERTA_NO_CADASTRO)) &&
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

// ---------------------------------------------------------------------------
// Área/produção: hectares e toneladas sem fonte (IBGE, série histórica)
// ---------------------------------------------------------------------------

/**
 * Área plantada/colhida (hectares) ou produção (toneladas) citada sem vir de
 * nenhuma ferramenta desse turno. Achado real testando buscar_producao_ibge:
 * o modelo inventou "5,1 milhões de hectares" pra soja em MG/2023 — um valor
 * que não existe em lugar nenhum do banco (confirmado via SQL) — enquanto
 * todos os valores em R$ da mesma resposta estavam certos, então o guarda de
 * R$ não pega esse tipo de invenção. coletarNumerosPermitidos já inclui os
 * números reais que QUALQUER ferramenta devolveu nesse turno (caminha o JSON
 * inteiro), então basta achar o que a resposta cita em hectare/tonelada e
 * comparar contra essa mesma lista — sem coleta nova.
 *
 * Diferente de medidasNaoAutorizadas (kg/litros): área/produção do IBGE é
 * tipicamente na casa dos milhões (ex: 5.100.000 ha), e é natural a resposta
 * escrever isso como "5,1 milhões de hectares" — sem aplicar o multiplicador
 * ao comparar, TODA citação legítima nesse formato bateria errado contra o
 * valor bruto (5,1 ≠ 5.100.000) e seria barrada por engano. Por isso aqui o
 * "milhões"/"mil" reescala o valor E a tolerância antes de comparar.
 */
export function areaProducaoNaoAutorizada(resposta: string, permitidos: number[]): number[] {
  const padrao =
    /(\d+(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d+)?)\s*(milhões\s+de\s+|mil\s+)?(?:hectares?|toneladas?|kg\s*\/\s*ha)\b/gi;
  const invalidas: number[] = [];
  for (const m of resposta.matchAll(padrao)) {
    const bruto = m[1]!;
    const qualificador = m[2]?.trim().toLowerCase();
    const multiplicador = qualificador?.startsWith("milh")
      ? 1_000_000
      : qualificador?.startsWith("mil")
        ? 1_000
        : 1;
    const base = Number(bruto.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    if (!Number.isFinite(base)) continue;
    const valor = base * multiplicador;
    const casas = bruto.includes(",") ? bruto.split(",")[1]!.length : 0;
    const tolerancia = (casas === 0 ? 0.5 + 1e-9 : 0.5 * 10 ** -casas + 1e-9) * multiplicador;
    if (!permitidos.some((p) => Math.abs(p - valor) <= tolerancia)) invalidas.push(valor);
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

/**
 * Referência de mercado (estado sem dado recente): a resposta tem que trazer ao
 * menos um dos valores da referência (outro estado ou B3). Sem isso o modelo
 * respondia só "não tenho dado recente" e o produtor ficava sem nada. A frase
 * pronta entra no fim.
 */
export function garantirReferenciaMercado(
  resposta: string,
  referencia: { valores: number[]; frase: string } | null,
): string {
  if (!referencia || referencia.valores.length === 0) return resposta;
  const citados = extrairValoresReais(resposta);
  const citou = referencia.valores.some((v) => citados.some((c) => Math.abs(c - v) <= 0.0101));
  if (citou) return resposta;
  const semPontuacaoFinal = resposta.trimEnd();
  const separador = /[.!?]$/.test(semPontuacaoFinal) ? " " : ". ";
  return `${semPontuacaoFinal}${separador}${referencia.frase}`;
}

// ---------------------------------------------------------------------------
// Canal que o bot não tem (áudio, foto, vídeo, ligação)
// ---------------------------------------------------------------------------

// Achado real 2026-09-22: uma produtora disse que não sabe ler e pediu áudio;
// o bot respondeu "vou me atentar a não enviar mais texto" — uma promessa
// impossível, já que texto é o único canal que ele tem, e a resposta seguinte
// dele já quebrou essa promessa (era texto de novo). O prompt já pede pra não
// prometer isso, mas é o tipo de regra que o modelo ignora de vez em quando —
// esta é a rede de segurança determinística.
const PADRAO_PROMESSA_IMPOSSIVEL =
  /\bn[ãa]o\b(?:\s+\S+){0,4}\s+(mandar|enviar)\b[^.!?]{0,40}\btexto\b|\bvou (parar|deixar) de (mandar|enviar)\b[^.!?]{0,40}\btexto\b/i;

export const RESPOSTA_SO_TEXTO =
  "Só consigo responder por texto aqui, não tenho como mandar áudio. Mas posso continuar te ajudando por escrito, sem problema.";

/**
 * Troca a resposta inteira quando ela promete parar de mandar texto (a única
 * coisa que o bot sabe fazer). Substitui tudo, não só a frase, porque uma
 * promessa que ele não pode cumprir é pior do que uma resposta mais curta.
 */
export function garantirCanalDeTexto(resposta: string): string {
  return PADRAO_PROMESSA_IMPOSSIVEL.test(resposta) ? RESPOSTA_SO_TEXTO : resposta;
}

const FRASE_PAINEL =
  "Pra ver a lista completa, é só abrir o painel: https://safralume.com.br/dashboard";

/**
 * Insumo/ferrugem/progresso de safra com mais detalhe do que coube na
 * resposta (lista grande de marcas, muitos municípios, vários estados) —
 * acrescenta o convite pro painel só quando genuinamente tem mais coisa pra
 * ver E o produtor já tem login (sem isso ele cairia numa tela de login à
 * toa). Testado ao vivo: a instrução de prompt sozinha não é seguida de
 * forma confiável, por isso a garantia por código.
 */
export function garantirMencaoPainel(
  resposta: string,
  temDetalheExtra: boolean,
  temContaNoPainel: boolean,
): string {
  if (!temDetalheExtra || !temContaNoPainel) return resposta;
  if (/painel|dashboard/i.test(resposta)) return resposta;
  return `${resposta} ${FRASE_PAINEL}`;
}

const FRASE_TEASER_LEILAO =
  "A propósito: o Safralume também acompanha a agenda de leilão de gado no Brasil inteiro (presencial e virtual) — isso é do plano Prata, é só me pedir aqui que eu te explico.";

/**
 * Cross-sell de leilão em cima de pergunta de preço de boi: Bronze recebe um
 * teaser (sem número nenhum), Prata+ recebe a contagem real — calculada
 * aqui, nunca pelo modelo (mesmo motivo do garantirMencaoPainel: "sempre
 * mencionar X" e "contagem exata" não são confiáveis só com prompt). Só age
 * quando buscar_leiloes_proximos foi chamado nesse turno (resultado !=
 * null); fora isso não mexe na resposta.
 */
export function garantirMencaoLeilao(resposta: string, resultado: ResultadoLeilao | null): string {
  if (!resultado) return resposta;
  if (!resultado.disponivelNoPlano) {
    // Bronze não consulta a agenda, então "não achei leilão essa semana" seria falso. O modelo
    // insiste em dizer isso mesmo com a regra no prompt (visto ao vivo em 2026-10-15), por isso
    // a frase sai por código.
    const limpa = resposta
      .replace(
        /(^|\s)Não (?:achei|encontrei|consegui encontrar|há|tem|tenho|existe)[^.!?\n]*leil(?:[ãa]o|[õo]es)[^.!?\n]*[.!?]\s*/gi,
        "$1",
      )
      .trim();
    if (/prata/i.test(limpa) && /leil[ãa]o/i.test(limpa)) return limpa;
    return `${limpa} ${FRASE_TEASER_LEILAO}`;
  }
  if (!resultado.encontrado) return resposta;
  if (/leil[ãa]o/i.test(resposta) && /\d/.test(resposta)) return resposta;
  const { totalPresenciais, totalVirtuais } = resultado;
  const partes: string[] = [];
  if (totalPresenciais > 0) {
    partes.push(`${totalPresenciais} leilão(ões) presencial(is) agendado(s) na sua região`);
  }
  if (totalVirtuais > 0) {
    partes.push(`${totalVirtuais} leilão(ões) virtual(is) em destaque essa semana`);
  }
  if (partes.length === 0) return resposta;
  return `${resposta} Tem ${partes.join(" e ")}.`;
}

/**
 * "UF" é jargão: quem produz não sabe o que é e responde errado ou desiste (o
 * Matheus pediu pra tirar, 2026-10-13: "a pessoa pode não entender o que é UF").
 * O prompt já manda falar "estado", mas o modelo escapa às vezes ("Pode me
 * informar a UF?"). Troca por código, só nas construções com artigo, que são
 * seguras de reescrever; sigla de estado ("GO", "MT") não é tocada.
 */
export function trocarJargaoUf(resposta: string): string {
  const cap = (original: string, novo: string) =>
    original[0] === original[0]!.toUpperCase() && original[0] !== original[0]!.toLowerCase()
      ? novo[0]!.toUpperCase() + novo.slice(1)
      : novo;
  const prepArtigo: Record<string, string> = {
    a: "o",
    da: "do",
    na: "no",
    pela: "pelo",
    pra: "pro",
  };
  const possessivo: Record<string, string> = {
    sua: "seu",
    essa: "esse",
    esta: "este",
    nossa: "nosso",
  };
  const demonstrativo: Record<string, string> = { dessa: "desse", desta: "deste" };
  return (
    resposta
      // "qual (a) UF" -> "qual estado"
      .replace(/\bqual\s+(?:a\s+)?UF\b/gi, (m) => cap(m, "qual estado"))
      // "(a|da|na|pela|pra) sua|essa|esta|nossa UF" -> "o|do|no|pelo|pro seu|esse|este|nosso estado"
      .replace(
        /\b(?:(a|da|na|pela|pra)\s+)?(sua|essa|esta|nossa)\s+UF\b/gi,
        (m, prep: string | undefined, pos: string) => {
          const frente = prep ? `${prepArtigo[prep.toLowerCase()]} ` : "";
          return cap(m, `${frente}${possessivo[pos.toLowerCase()]} estado`);
        },
      )
      // "dessa|desta UF" -> "desse|deste estado"
      .replace(/\b(dessa|desta)\s+UF\b/gi, (m, dem: string) =>
        cap(m, `${demonstrativo[dem.toLowerCase()]} estado`),
      )
      // "(a|da|na|pela|pra) UF" -> "o|do|no|pelo|pro estado"
      .replace(/\b(a|da|na|pela|pra)\s+UF\b/gi, (m, prep: string) =>
        cap(m, `${prepArtigo[prep.toLowerCase()]} estado`),
      )
      // plural com determinante feminino concorda com "estados" (masculino)
      .replace(
        /\b(todas\s+as|todas|várias|outras|algumas|poucas|muitas|as|essas|estas|das|nas|pelas)\s+UFs\b/gi,
        (m, det: string) => {
          const mapa: Record<string, string> = {
            "todas as": "todos os",
            todas: "todos",
            várias: "vários",
            outras: "outros",
            algumas: "alguns",
            poucas: "poucos",
            muitas: "muitos",
            as: "os",
            essas: "esses",
            estas: "estes",
            das: "dos",
            nas: "nos",
            pelas: "pelos",
          };
          return cap(m, `${mapa[det.toLowerCase().replace(/\s+/g, " ")]} estados`);
        },
      )
      .replace(/\bUFs\b/g, "estados")
  );
}

/**
 * A pergunta de confirmação do cadastro é fixa no prompt ("...produtor de
 * soja no GO?") e traz a sigla. Quem não sabe o que é UF entende "Goiás" na
 * hora, então troca a sigla pelo nome por extenso ("... em Goiás?"). Só mexe
 * nessa frase; qualquer outra sigla no texto fica como está.
 */
export function confirmacaoComEstadoPorExtenso(resposta: string): string {
  return resposta.replace(
    /(Confirma:[^?]*?produtor de [^?]*?)\s+(?:no|na|em)\s+([A-Z]{2})\s*\?/,
    (m, antes: string, sigla: string) => {
      const nome = ufs.find((u) => u.value === sigla)?.label;
      return nome ? `${antes} em ${nome}?` : m;
    },
  );
}

/**
 * Mensagem de confirmação ("Confirma: ...?") fica SÓ com a pergunta de
 * confirmação. Em teste com o modelo real (2026-10-13) o incentivo de ativação
 * emendou um segundo pedido na mesma mensagem ("Confirma: alerta de chuva forte?
 * E, aproveitando, você quer saber se é bom vender?"): com duas perguntas, um
 * "sim" pode ser lido como resposta à errada e disparar algo que ele não pediu.
 */
export function manterSoAConfirmacao(resposta: string): string {
  if (!/^\s*Confirma\b/i.test(resposta)) return resposta;
  const fim = resposta.indexOf("?");
  if (fim === -1 || fim >= resposta.trimEnd().length - 1) return resposta;
  return resposta.slice(0, fim + 1).trim();
}

/**
 * Sem travessão ("—"/"–") nas respostas: o Matheus pediu pra tirar da copy porque
 * denuncia texto de IA (2026-10-12), e em 14% das respostas reais ainda aparecia
 * (200 respostas dos últimos 14 dias). Troca por vírgula só quando há espaço dos
 * dois lados, que é o uso de pontuação; "R$ 139 – 146" sem espaço não é tocado.
 */
export function tirarTravessoes(resposta: string): string {
  return resposta.replace(/\s+[\u2014\u2013]\s+/g, ", ");
}

// ---------------------------------------------------------------------------
// Assinar / pagar pelo WhatsApp (sem labirinto de login)
// ---------------------------------------------------------------------------

const PADROES_PEDIDO_DE_ASSINATURA = [
  /\b(quero|vou|gostaria de|preciso|posso|como|onde|queria)\b.{0,30}\b(assinar|pagar|contratar|renovar|reativar)\b/,
  /\b(assinar|contratar)\b.{0,15}\b(plano|bronze|prata|ouro|agora|ja)\b/,
  /\blink\b.{0,15}\b(pagamento|pagar|assinatura|assinar|fatura|boleto|pix)\b/,
  /\b(pagar|pagamento)\b.{0,20}\b(fatura|plano|assinatura|mensalidade)\b/,
  /\bquero\s+(o\s+)?plano\s+(bronze|prata|ouro)\b/,
  /\b(como|onde|aonde)\b.{0,12}\b(pago|paga|pagar|assino|assina|assinar|contrato)\b/,
  /^\s*(assinar|quero assinar|quero pagar|pagar)[\s!.?]*$/,
];

/**
 * O produtor quer assinar/pagar. Achado 2026-10-13: hoje não há nenhum cliente
 * pagante real, e o caminho era um labirinto (mensagem manda abrir /assinar, que
 * exige login que quase ninguém tem; só então "peça o link"). Aqui vira um passo:
 * "quero assinar" -> link de uso único que já abre a tela de escolher o plano e pagar.
 * Cancelamento nunca entra.
 */
export function classificarPedidoDeAssinatura(textoProdutor: string): boolean {
  const t = semAcento(textoProdutor);
  if (/cancel/.test(t)) return false;
  // "como pago menos imposto na venda?" é outro assunto: pergunta de dinheiro da
  // lavoura não pode virar link de pagamento do Safralume.
  if (/\b(imposto|taxa|juros|funrural|frete|desconto|lucro|financiamento|emprestimo)\b/.test(t))
    return false;
  return PADROES_PEDIDO_DE_ASSINATURA.some((p) => p.test(t));
}

export function respostaLinkDeAssinatura(link: string): string {
  const planos = pricingPlans.map((p) => `${p.name} R$ ${p.price}`).join(", ");
  return `Aqui está seu link pra escolher o plano e pagar (Pix, cartão ou boleto): ${link}\n\nEle vale por pouco tempo e só funciona uma vez. Planos por mês: ${planos}.`;
}

export function respostaAssinarComLoginProprio(): string {
  return `Pra escolher o plano e pagar (Pix, cartão ou boleto), entre em ${SITE_URL}/assinar com o e-mail e a senha que você cadastrou. Se esqueceu a senha, use o "Esqueci minha senha" na mesma tela.`;
}

/**
 * Preço de defensivo e fertilizante é do Prata. Para o Bronze a ferramenta nem consulta, mas o modelo
 * escreve "não consegui encontrar o preço da ureia", o que sugere falta de dado quando é só plano
 * (visto ao vivo em 2026-10-15). Tira essa negativa e garante que a frase diga que é do Prata.
 */
export function tirarNegativaDeInsumoParaBronze(
  resposta: string,
  insumoForaDoPlano: boolean,
): string {
  // Também em qualquer resposta: o bot não tem como "registrar sugestão" (visto ao vivo em 2026-10-15,
  // "se quiser, posso registrar essa sugestão" para glifosato no Bronze). Promessa que não dá pra cumprir.
  resposta = resposta
    .replace(
      /(^|\s)(?:Se quiser, )?posso (?:registrar|anotar|guardar)\b[^.!?\n]*\bsugest[ãa]o\b[^.!?\n]*[.!?]\s*/gi,
      "$1",
    )
    .trim();
  if (!insumoForaDoPlano) return resposta;
  const limpa = resposta
    .replace(
      /(^|\s)Não (?:consegui encontrar|achei|encontrei|encontro|há|tem|tenho)[^.!?\n]*(?:pre[çc]o|ureia|insumo|fertilizante|defensivo|produto)[^.!?\n]*[.!?]\s*/gi,
      "$1",
    )
    .trim();
  if (/prata/i.test(limpa)) return limpa;
  return `Preço de defensivo e fertilizante é do plano Prata, é só me pedir aqui que eu te explico. ${limpa}`.trim();
}

/**
 * Alerta de clima pode ser por cidade ou pelo estado todo (previsão da capital). O prompt manda deixar isso
 * claro na pergunta de confirmação, mas o modelo pulou a frase (visto ao vivo em 2026-10-16), então ela é
 * acrescentada por código: só quando a resposta é a pergunta "Confirma: alerta de chuva/geada/seca/vento"
 * e não cita cidade (formato "Nome/UF") nem a capital.
 */
export function garantirOpcaoDeCidadeNoAlertaDeClima(resposta: string): string {
  if (!/Confirma:\s*alerta de (?:chuva|geada|seca|vento)/i.test(resposta)) return resposta;
  if (/\p{L}\/[A-Z]{2}\b/u.test(resposta) || /capital/i.test(resposta)) return resposta;
  return `${resposta.trim()} (Vale o estado todo, com a previsão da capital. Prefere a previsão de uma cidade? É só me dizer qual.)`;
}
