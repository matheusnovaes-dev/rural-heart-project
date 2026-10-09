import type { SupabaseClient } from "@supabase/supabase-js";

import { culturaMencionada } from "@/config/culturas";
import {
  buildContextoInstitucional,
  buildContextoMemoria,
  buildContextoPlanos,
  buildContextoProdutor,
  buildHistoryMessages,
  buildRegrasCadastroAnonimo,
  buildRegrasClienteSemLogin,
  SYSTEM_PROMPT,
  type HistoricoLinha,
} from "@/lib/bot/prompt";
import { executarTool, TOOLS } from "@/lib/bot/tools/index";
import { mensagemBloqueioAcesso, verificarAcessoWhatsapp } from "@/lib/bot/tools/acesso";
import { gerarLinkDeAcesso, tipoDeAcesso } from "@/lib/bot/tools/linkAcesso";
import type { ResultadoBuscarLeite } from "@/lib/bot/tools/leite";
import { buscarMemoriasProdutor } from "@/lib/bot/tools/memoria";
import { ehPedidoDeSair, RESPOSTA_SAIDA_DE_MENSAGENS } from "@/lib/recuperacaoCadastro";
import { normalizarWhatsapp } from "@/lib/telefone";
import type { ProdutorContexto } from "@/lib/bot/types";
import {
  areaProducaoNaoAutorizada,
  coletarNumerosPermitidos,
  conversaFalaDeCadastro,
  classificarPedidoDeAcesso,
  corrigirLinkDePainelParaClienteSemLogin,
  garantirDataDoPreco,
  garantirMediaDasPracas,
  garantirParidade,
  garantirReferenciaMercado,
  garantirCanalDeTexto,
  garantirMencaoPainel,
  garantirMencaoLeilao,
  garantirCotacaoLeite,
  garantirRelacaoLeiteMilho,
  medidasNaoAutorizadas,
  garantirRotaFrete,
  respostaCadastroCriado,
  respostaEntrarNoPainel,
  respostaLinkDeAcesso,
  respostaOfertaDeAcesso,
  type ResultadoLeilao,
  RESPOSTA_FALHA_AO_GERAR_LINK,
  valoresNaoAutorizados,
  type FreteCitado,
} from "@/lib/bot/guardas";

const MODEL = "gpt-4o-mini";
const MAX_TOOL_ROUNDS = 6;

// Bug real testado ao vivo contra produção (3x, reproduzido nas 3 mesmo
// depois de reforçar o prompt por instrução): "tem em nenhum outro
// estado?" é uma negativa dupla comum na fala informal — SIGNIFICA "tem
// em algum outro estado?" — mas o modelo lia como confirmação de que não
// tem, e respondia negando UFs que ele mesmo tinha acabado de citar na
// resposta anterior da mesma conversa. Instrução no prompt sozinha não
// resolveu de forma confiável; isso detecta o padrão na mensagem ATUAL e
// injeta uma nota de sistema só nesse turno, clareando a pergunta antes
// do modelo processar — mais confiável que confiar só em prompt.
const NEGATIVA_DUPLA = /tem\s+em\s+nenhum/i;

function notaDeNegativaDupla(texto: string): OpenAIMessage | null {
  if (!NEGATIVA_DUPLA.test(texto)) return null;
  return {
    role: "system",
    content:
      'Nota: a mensagem do produtor usa uma negativa dupla comum na fala informal ("tem em nenhum...?") — isso SIGNIFICA "tem em algum...?", uma pergunta normal, não uma confirmação de que não tem. Se você já citou UFs com preço nas suas respostas anteriores desta conversa, a resposta certa é confirmar essas MESMAS UFs de novo, nunca negar o que você mesmo acabou de afirmar.',
  };
}

// Bug real visto numa conversa de produção (2026-09-28): produtor disse
// "não sou produtor, sou técnico agrícola" DUAS vezes seguidas, e o bot
// repetiu a mesma pergunta de confirmação de cadastro como se nada tivesse
// sido dito — leu a mensagem como ruído em vez de uma correção. Mesmo padrão
// dos outros bugs de contexto desse modelo: instrução de prompt sozinha não é
// confiável aqui, então detecta a recusa/correção na mensagem ATUAL e injeta
// uma nota de sistema pra esse turno, antes do modelo decidir o que responder.
const RECUSA_CADASTRO = /n[aã]o\s+sou\s+(produtor|agricultor|do\s+campo)/i;

function notaDeRecusaCadastro(texto: string): OpenAIMessage | null {
  if (!RECUSA_CADASTRO.test(texto)) return null;
  return {
    role: "system",
    content:
      "Nota: o produtor acabou de dizer explicitamente que NÃO é produtor rural (ex: é técnico agrícola, agrônomo, ou outra função). NÃO repita a pergunta de confirmação de cadastro nem insista em criar conta de produtor pra ele. Reconheça o que ele disse e pergunte, de forma direta, no que você pode ajudar.",
  };
}

// Achado real testando ao vivo (2026-10-04): a instrução de prompt "varie a
// abertura" não pegou de verdade pro gatilho do anúncio — 4 tentativas
// seguidas saíram todas na mesma estrutura (cumprimento, lista de features,
// pergunta de cultura/UF), só trocando sinônimo. Mesmo padrão de sempre
// desse modelo: pedido abstrato de "varie" não é confiável, só exemplo
// concreto funciona. Aqui o CÓDIGO sorteia um formato estrutural diferente
// a cada chamada (não o modelo) — só o conteúdo dentro do formato é gerado
// pelo modelo, a escolha de estrutura é determinística.
const GATILHO_ANUNCIO = /ol[áa]!?\s*posso\s+ter\s+mais\s+informa[çc][õo]es\s+sobre\s+isso/i;

// Achado real testando ao vivo (2026-10-04, 2ª rodada): mesmo com a regra
// geral "cite o nome em algum ponto" reforçada no prompt, o formato de
// pergunta retórica ainda saiu sem nome em 2 de 6 testes — a instrução
// específica do formato (que não mencionava nome) competiu com a regra
// geral solta e ganhou. Por isso cada formato agora inclui a exigência de
// nome dentro de si mesmo, não só como regra à parte.
const FORMATOS_ABERTURA_ANUNCIO = [
  "Formato desta resposta: comece com uma pergunta curiosa e breve sobre a lavoura/produção dela (ex: o que ela planta, como está a safra) ANTES de explicar o Safralume, chamando-a pelo nome nessa pergunta inicial (ex: 'Oi, [nome]! O que você planta...'). Só depois dessa pergunta inicial, explique em uma frase o que o Safralume faz.",
  "Formato desta resposta: comece chamando-a pelo nome, depois seja bem direto e breve — UMA frase só explicando o essencial (preço comparado ao porto, clima e alerta automático, tudo no WhatsApp), sem listar todos os detalhes, e já pergunte cultura e estado.",
  "Formato desta resposta: abra chamando-a pelo nome e reconhecendo uma dificuldade comum do produtor (ex: perder tempo ligando pra saber preço, ou descobrir tarde demais que o preço mudou) ANTES de apresentar o Safralume como resposta pra isso.",
  "Formato desta resposta: vá direto pra pergunta de cultura e estado logo na primeira frase, já chamando-a pelo nome nessa mesma frase (ex: 'Oi, [nome]! Me conta rapidinho: você trabalha com o quê, em qual estado?'), e resuma o que o Safralume faz em só uma frase curta, sem listar todas as funcionalidades.",
  "Formato desta resposta: abra com uma pergunta retórica ligada ao valor do produto, chamando-a pelo nome nessa mesma pergunta (ex: algo como 'Sabe quanto sua saca vale agora, [nome], comparado ao preço do porto?'), explique brevemente depois, e pergunte cultura e estado.",
];

function notaDeAberturaDeAnuncio(texto: string): OpenAIMessage | null {
  if (!GATILHO_ANUNCIO.test(texto)) return null;
  const formato =
    FORMATOS_ABERTURA_ANUNCIO[Math.floor(Math.random() * FORMATOS_ABERTURA_ANUNCIO.length)]!;
  return { role: "system", content: formato };
}

// Achado real numa conversa de produção (2026-10-08): produtor recém-cadastrado
// (Gerson) perguntou "Café", o bot respondeu o preço certinho e parou — sem
// puxar pro próximo passo. A regra geral de "não feche com oferta genérica"
// já existe no prompt fixo, mas ela só cobre a conversa "terminando"
// (agradecimento/resposta curta) — não cobre alguém ainda no início,
// respondendo sua primeira pergunta de verdade, que é o momento mais quente
// pra puxar pra um alerta automático. Mesmo motivo dos outros "nota*": isso é
// condicional ("se é cedo na conversa, faça X depois de responder") e o
// modelo não segue essa condição de forma confiável só com texto fixo no
// prompt — o código decide se é cedo (historico.length pequeno) e injeta a
// instrução só nesse turno. Só pra quem já tem cadastro (produtor.id): alerta
// não existe pra quem ainda não se cadastrou, isso já é regra em
// buildRegrasCadastroAnonimo.
const TURNOS_INICIO_DE_RELACAO = 6;

// Achado real testando ao vivo (2026-10-08, 2ª rodada): com uma única
// instrução de texto oferecendo "alerta OU outra cultura/clima", o modelo
// escolheu "alerta" nas 6 tentativas seguidas (3 numa pergunta de preço, 3
// numa de clima) — nunca ofereceu a outra opção, mesmo pro modelo tendo as
// duas disponíveis. Mesmo padrão de sempre desse modelo: "ou" dentro de uma
// instrução solta não garante variedade de verdade. Igual
// FORMATOS_ABERTURA_ANUNCIO, o CÓDIGO sorteia o ângulo (não o modelo).
const ANGULOS_INCENTIVO_ATIVACAO = [
  "Depois de responder a pergunta dele normalmente, pergunte se ele quer que você crie um alerta automático pra isso (preço ou clima, o que for o assunto da pergunta dele) — avisa sozinho quando mudar.",
  "Depois de responder a pergunta dele normalmente, pergunte se ele também quer acompanhar outra cultura ou outro estado além do principal dele, já que o Safralume cobre mais de 70 culturas.",
  "Depois de responder a pergunta dele normalmente, pergunte se ele quer saber se é um bom momento pra vender a cultura principal dele (sinal de venda) — cruza o preço dos últimos 90 dias com o mercado futuro da B3.",
];

// Pedido real do Matheus (2026-10-09): o incentivo acima só cobre quem
// ACABOU de se cadastrar (poucas trocas). Pra quem já é cliente antigo
// (a maioria das conversas reais, depois da janela inicial), o bot nunca
// oferecia nada — só respondia e parava pra sempre. Pedido explícito: "pode
// sim, mas em momentos-chave que façam sentido sem parecer enjoativo,
// não toda hora". Dois filtros pra isso, os dois por código (mesmo motivo de
// sempre — "só quando fizer sentido" sozinho no prompt não é confiável):
// (1) só quando a pergunta ATUAL é sobre algo que dá pra alertar de verdade
// (cultura específica ou clima) — não em qualquer mensagem solta; (2) só se
// não ofereceu esse mesmo tipo de convite recentemente nesta conversa, pra
// não repetir toda hora e soar insistente.
const JANELA_SEM_REPETIR_INCENTIVO = 10; // linhas de histórico, ~5 trocas

// Achado real testando ao vivo (bateria de 10, 2026-10-09): resposta real
// incluía convite genuíno ("posso criar um alerta pra acompanhar a geada ou
// monitorar outra cultura ou estado!") mas não batia em NENHUM destes 4
// padrões (eram literais demais — "alerta automático" não casa "um
// alerta", "outra cultura ou outro estado" não casa "outra cultura ou
// estado"). Isso forçava um retry desnecessário (a resposta já estava boa)
// e às vezes o retry seguinte também "falhava" na detecção — não no
// convite em si. Alargado pros radicais/formas mais curtas.
const PADROES_INCENTIVO_JA_OFERECIDO = [
  /\balertas?\b/i,
  /outra cultura|outro estado/i,
  /bom momento (pra|para) vender/i,
  /sinal de venda/i,
];

function incentivoRecenteNoHistorico(historico: HistoricoLinha[]): boolean {
  const recentes = historico.slice(-JANELA_SEM_REPETIR_INCENTIVO);
  return recentes.some(
    (h) => h.role === "assistant" && PADROES_INCENTIVO_JA_OFERECIDO.some((p) => p.test(h.conteudo)),
  );
}

// 1ª versão só tinha "chuva" (substantivo) — não casava "vai chover", "tá
// chovendo" etc (achado real testando ao vivo: era a causa real de um "bug
// de não-compliance do modelo" que na verdade nunca era isso, a nota nem
// chegava a ser criada). \w* nas raízes cobre as flexões de verbo também.
const ASSUNTO_CLIMA = /\b(clima|tempo|previs[ãa]o|geada|seca|chuv\w*|chov\w*|umidade)\b/i;

function assuntoAlertavel(texto: string): boolean {
  return culturaMencionada(texto) !== null || ASSUNTO_CLIMA.test(texto);
}

function notaDeIncentivoAtivacao(
  produtor: ProdutorContexto,
  historico: HistoricoLinha[],
  texto: string,
): OpenAIMessage | null {
  if (!produtor.id) return null;
  const cedoNaConversa = historico.length <= TURNOS_INICIO_DE_RELACAO;
  if (!cedoNaConversa && (!assuntoAlertavel(texto) || incentivoRecenteNoHistorico(historico))) {
    return null;
  }
  const angulo =
    ANGULOS_INCENTIVO_ATIVACAO[Math.floor(Math.random() * ANGULOS_INCENTIVO_ATIVACAO.length)]!;
  const contexto = cedoNaConversa
    ? "esse produtor já tem cadastro e ainda está no início da conversa com você (poucas trocas até agora)"
    : "esse produtor já é cliente e acabou de perguntar algo que dá pra transformar em alerta automático — um momento-chave real, não só uma pergunta qualquer";
  // Achado real testando ao vivo (2026-10-09): com a permissão "não force se
  // a resposta já tiver ficado longa", o modelo usou essa desculpa pra pular
  // o convite em 8 de 8 tentativas (4 de preço com frete/paridade, 4 de
  // previsão de 5 dias) — exatamente as respostas mais detalhadas do
  // produto, que são a maioria das respostas reais. Removida essa desculpa,
  // mas isso sozinho NÃO resolveu: numa conversa já longa (histórico de
  // cliente antigo, não mais o início), o modelo seguiu pulando 8 de 8 vezes
  // de novo, mesmo sem a desculpa — provável "contágio" do padrão das
  // respostas anteriores do próprio histórico (nenhuma delas tinha convite,
  // o modelo repetiu esse padrão). A mesma nota funcionava bem no início da
  // conversa (3 de 3), só falhava com histórico longo. Por isso agora o
  // texto é mais imperativo ("OBRIGATÓRIO", não "é um momento-chave pra") e
  // explicitamente desautoriza copiar o padrão das respostas anteriores.
  const imperativo = cedoNaConversa
    ? `Nota: ${contexto} — é um momento-chave pra incentivar o uso de verdade do Safralume, não só responder e parar.`
    : `Nota OBRIGATÓRIA pra esta resposta: ${contexto}. Mesmo que suas respostas anteriores nesta mesma conversa não tenham incluído nenhum convite, ESTA precisa incluir — não copie o padrão das respostas de antes, esta pergunta é o momento-chave, aquelas não eram.`;
  return {
    role: "system",
    content: `${imperativo} ${angulo} Isso não é a mesma coisa que a oferta de ajuda genérica proibida ("se precisar de algo, é só falar") — é um convite específico e acionável. O tamanho da resposta (mesmo com vários dados/dias/valores) NÃO é motivo pra pular isso — o convite é só uma frase curta a mais no final, independente de quão detalhada a resposta já ficou. Só pule se o pedido dele já foi exatamente sobre o que essa pergunta sugere (ex: já era sobre criar alerta).`,
  };
}

// Bug real visto numa conversa de produção (2026-09-26): a mensagem de
// abertura do anúncio recebeu uma resposta de desabafo pessoal (doença na
// família, dificuldade financeira, solidão) sem nenhuma relação com o
// produto, e o bot respondeu com empatia MAS emendou o link de teste grátis
// na mesma mensagem — um convite de venda em cima de alguém relatando que
// não tem dinheiro é o tipo de print que machuca a marca. Detecta sinal de
// aflição pessoal sem menção a nada agrícola/produto na mensagem atual e
// suprime qualquer oferta/link nesse turno especificamente.
const SINAL_DE_AFLICAO_PESSOAL =
  /\b(doente|sozinh[ao]|sem\s+dinheiro|n[ãa]o\s+tenho\s+dinheiro|passando\s+necessidade|desempregad[ao]|faleceu|morreu|perdi\s+(meu|minha))\b/i;
const MENCIONA_ASSUNTO_AGRICOLA_OU_PRODUTO =
  /\b(soja|milho|boi|gado|caf[eé]|algod[ãa]o|trigo|arroz|feij[ãa]o|cana|pre[cç]o|clima|previs[ãa]o|alerta|cadastr\w*|plano|assinatura|painel|safra|lavoura|colheita)\w*/i;

function notaDeAflicaoPessoal(texto: string): OpenAIMessage | null {
  if (!SINAL_DE_AFLICAO_PESSOAL.test(texto) || MENCIONA_ASSUNTO_AGRICOLA_OU_PRODUTO.test(texto)) {
    return null;
  }
  return {
    role: "system",
    content:
      "Nota: essa mensagem do produtor fala de uma dificuldade pessoal (saúde, financeira, emocional) sem relação com o Safralume. Responda com empatia, curto, e NÃO ofereça cadastro, teste grátis, plano, link nem qualquer CTA comercial nessa resposta — seria fora de hora. Marque precisa_humano=true, porque isso não é algo que você resolve.",
  };
}

// Achado real testando ao vivo (2026-10-09): o produtor contou uma
// preocupação clara e durável ("medo de perder a safra pra seca") e o
// modelo NUNCA chamou salvar_memoria_produtor, mesmo a ferramenta tendo
// descrição detalhada de quando usar — mesmo padrão de sempre desse
// modelo, não age sozinho numa ação secundária só por ela estar
// disponível. Detecta sinal de fato pessoal/durável (preocupação, plano
// futuro, relação comercial) JUNTO com assunto agrícola/produto (evita
// disparar em mensagem sem nada a ver, tipo só "medo" solto) e nudge só
// nesse turno — mesmo mecanismo das outras notas.
// 2ª rodada (mesmo dia): 1ª versão só tinha "vendo pro/pra" (presente) e não
// casava "vou vender pro Zé Carlos" (futuro) — mesmo tipo de lacuna de
// flexão verbal já visto em ASSUNTO_CLIMA. Trocado pros radicais vend\w*/
// compr\w*/forneced\w* pra cobrir qualquer tempo verbal.
const SINAL_FATO_DURAVEL =
  /\b(medo|com\s+medo|receios?|preocupad[ao]|preocupa[çc][ãa]o|perdi|pretendo|penso\s+em|pensando\s+em|planejo|diversificar|vend\w*|compr\w*|forneced\w*|armazen\w*|trocar\s+de|mudar\s+de)\b/i;

function notaDeMemoriaPotencial(produtor: ProdutorContexto, texto: string): OpenAIMessage | null {
  if (!produtor.id) return null;
  if (!SINAL_FATO_DURAVEL.test(texto) || !MENCIONA_ASSUNTO_AGRICOLA_OU_PRODUTO.test(texto)) {
    return null;
  }
  return {
    role: "system",
    content:
      "Nota: essa mensagem parece conter um fato pessoal/durável sobre o produtor (preocupação real, contexto da fazenda, relação comercial, ou plano futuro) que pode valer guardar pra conversas futuras. Responda a pergunta dele normalmente primeiro; se o fato for genuíno (não invente nem deduza), chame salvar_memoria_produtor depois de responder. Se, lendo com calma, não for um fato durável de verdade, ignore esta nota.",
  };
}

const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "resposta_bot",
    strict: true,
    schema: {
      type: "object",
      properties: {
        resposta: {
          type: "string",
          description: "Resposta final em português, sem markdown, até 500 caracteres.",
        },
        precisa_humano: { type: "boolean" },
      },
      required: ["resposta", "precisa_humano"],
      additionalProperties: false,
    },
  },
};

export type RespostaAgente = {
  resposta: string;
  precisa_humano: boolean;
  cadastro_criado: boolean;
  // true quando a própria resposta já trata de cadastro (oferta, confirmação,
  // pedido de UF/cultura pro cadastro) — o n8n não emenda o convite padrão
  // "crie um cadastro grátis" nesse caso, que ficava redundante e confuso.
  convite_dispensado: boolean;
};

// Rede de segurança determinística: o prompt já proíbe fechar a resposta
// com uma oferta de ajuda genérica ("se precisar de algo, é só avisar"),
// mas testando ao vivo isso ainda escapa em ~1/3 das respostas mesmo depois
// de várias rodadas de reforço no texto do prompt — é um hábito do modelo
// que instrução sozinha não elimina de forma confiável. Em vez de insistir
// só no prompt, remove a frase de fechamento aqui, garantido por código.
// Achado real revisando conversa de produção (2026-10-04): a frase proibida
// escapava quando NÃO era a última do texto (ex: "Até mais! Se precisar de
// algo, é só chamar. Boa sorte na lavoura!") — os padrões antigos só
// cortavam no fim da string (`$`), então uma frase genérica no MEIO passava
// batido. Trocado pra `g` (sem âncora de fim), removendo a frase onde quer
// que ela apareça, não só no fechamento.
// 2ª rodada (2026-10-05, revisando mais conversa real): achei MAIS 2
// variações que escapavam mesmo com o fix acima — "Se mudar de ideia ou
// precisar de algo, é só avisar!" (não começa com "se precisar", começa com
// "se mudar de ideia") e "...estou aqui pra isso" (verbo de fechamento fora
// da lista). Ampliado os dois lados do padrão — é a 2ª rodada de escape
// achada nesse guard especificamente, sinal de que a lista de variações
// nunca é definitiva; revisar de novo se aparecer um 3º caso.
const PADRAO_FECHAMENTO_SE_PRECISAR =
  /(?<=^|[.!?]\s)(?:se precisar|caso precise|precisando|se mudar de ideia)[^.!?]*?\b(?:avis\w*|\bfala\b|\bfalar\b|\bfale\b|pergunt\w*|cham\w*|acess\w*|confer\w*|conf(?:ira|ere)|check\w*|clic\w*|olh\w*|estou\s+aqui|t[oó]\s+aqui|aqui\s+pr[aá])[^.!?]*[.!?]/gi;
const PADRAO_FECHAMENTO_DISPOSICAO =
  /(?<=^|[.!?]\s)(?:qualquer\s+d[uú]vida[^.!?]*)?(?:fico|estou)\s+[aà]\s+disposi[cç][aã]o[^.!?]*[.!?]/gi;

function removerFechamentoGenerico(resposta: string): string {
  const semSePrecisar = resposta.replace(PADRAO_FECHAMENTO_SE_PRECISAR, "").trim();
  const candidato = semSePrecisar || resposta;
  const semDisposicao = candidato.replace(PADRAO_FECHAMENTO_DISPOSICAO, "").trim();
  const limpo = (semDisposicao || resposta).replace(/\s{2,}/g, " ");
  // Se a resposta inteira era só a frase de fechamento, melhor manter o
  // texto original do que devolver uma mensagem vazia pro produtor.
  return limpo || resposta;
}

// Rota de frete: o prompt já pede origem E destino numa frase curta quando
// vem frete de referência, mas testando ao vivo o modelo cita só uma das duas (ou
// nenhuma). A checagem em si mora em guardas.ts (garantirRotaFrete) — aqui só
// extrai a rota REAL que a ferramenta buscar_preco devolveu.
function extrairUltimoFreteCitado(messages: OpenAIMessage[]): FreteCitado | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  let ultimo: FreteCitado | null = null;
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const parsed = JSON.parse(m.content ?? "{}");
      const frete = parsed?.frete;
      if (frete?.municipio_origem && frete?.municipio_destino) {
        ultimo = { origem: frete.municipio_origem, destino: frete.municipio_destino };
      }
    } catch {
      // resultado de tool malformado não pode derrubar a resposta — ignora.
    }
  }
  return ultimo;
}

// Data do preço que buscar_preco devolveu, só quando a resposta é sobre UMA
// consulta de preço (achado real: o bot citou o preço da maçã sem nenhuma
// data, apesar do dado ter mais de um mês — o prompt já pede "sempre inclua
// a data de referência", mas isso escapou; aqui garante por código).
function extrairDataDoPreco(messages: OpenAIMessage[]): string | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const datas: (string | null)[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const parsed = JSON.parse(m.content ?? "{}");
      const data = parsed?.precos?.[0]?.data_referencia;
      datas.push(typeof data === "string" ? data : null);
    } catch {
      datas.push(null);
    }
  }
  return datas.length === 1 ? datas[0]! : null;
}

// Mesma rede de segurança determinística de novo: o prompt já proíbe
// explicitamente lista com "-"/"*"/"1." no início da linha e "**negrito**"
// (o WhatsApp mostra os caracteres literalmente, quebrado) — mas testando
// com perguntas sobre planos/preço isso escapou de duas formas diferentes
// (lista com traço numa resposta, numeração "1."/"2."/"3." em outra). Em
// vez de insistir só no prompt, converte pra prosa corrida separada por
// "·", igual a instrução já pede como alternativa.
const PADRAO_LINHA_DE_LISTA = /^\s*(?:[-*]|\d+[.)])\s+/;

function removerMarkdownProibido(resposta: string): string {
  const semNegrito = resposta.replace(/\*\*(.+?)\*\*/g, "$1");
  const linhas = semNegrito.split("\n");
  if (!linhas.some((l) => PADRAO_LINHA_DE_LISTA.test(l))) {
    return removerTracoDeListaInline(semNegrito);
  }
  return removerTracoDeListaInline(
    linhas
      .map((l) => l.replace(PADRAO_LINHA_DE_LISTA, "").trim())
      .filter((l) => l.length > 0)
      .join(" · "),
  );
}

// Achado real testando ao vivo (2026-10-08, pergunta de clima com vários
// dias): o modelo às vezes monta uma "lista disfarçada" numa frase só, sem
// nenhuma quebra de linha — ex: "...semana: - 08/10: ... · 09/10: ..." — só
// o primeiro item leva "-" (os seguintes já usam "·" corretamente). Como não
// tem "\n" nenhum, PADRAO_LINHA_DE_LISTA (que divide por linha) nunca
// detecta isso. ": - " é um padrão raro o bastante em português natural
// (dois-pontos quase nunca são seguidos de travessão) pra remover com
// segurança, sem precisar de outro separador no lugar — o resto da frase já
// usa "·" entre os itens seguintes.
const PADRAO_TRACO_APOS_DOIS_PONTOS = /:\s+-\s+/g;

function removerTracoDeListaInline(resposta: string): string {
  return resposta.replace(PADRAO_TRACO_APOS_DOIS_PONTOS, ": ");
}

// Média das praças que buscar_preco devolveu, só quando a resposta é sobre UMA
// consulta de preço (com duas culturas, não dá pra saber a qual a frase
// acrescentada se refere).
function extrairMediaDasPracas(messages: OpenAIMessage[]): number | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const medias: (number | null)[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const parsed = JSON.parse(m.content ?? "{}");
      medias.push(
        typeof parsed?.preco_medio_regioes === "number" ? parsed.preco_medio_regioes : null,
      );
    } catch {
      medias.push(null);
    }
  }
  return medias.length === 1 ? medias[0]! : null;
}

// Insumo/ferrugem/progresso de safra trouxeram MAIS detalhe do que cabe
// numa resposta de WhatsApp (lista grande de marcas, muitos municípios com
// foco, vários estados com dado real) — achado real testando: a instrução
// no prompt pra mencionar o painel nesses casos não é seguida de forma
// confiável (4/4 tentativas ao vivo ignoraram), mesmo padrão de outras
// guardas desta sessão. Varre os resultados de ferramenta DESTE turno.
function temDetalheExtraParaPainel(messages: OpenAIMessage[]): boolean {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    const nome = nomePorToolCallId.get(m.tool_call_id);
    if (!nome) continue;
    let r: unknown;
    try {
      r = JSON.parse(m.content ?? "{}");
    } catch {
      continue;
    }
    if (nome === "buscar_preco_insumo" && r && typeof r === "object") {
      const faixas = (r as { faixas_de_preco?: unknown }).faixas_de_preco;
      if (
        Array.isArray(faixas) &&
        faixas.some(
          (f) =>
            typeof f?.quantidade_produtos === "number" &&
            f.quantidade_produtos >
              (Array.isArray(f?.produtos_exemplo) ? f.produtos_exemplo.length : 0),
        )
      ) {
        return true;
      }
    }
    if (nome === "buscar_ferrugem_asiatica" && r && typeof r === "object") {
      const municipios = (r as { municipios_com_ocorrencia_confirmada?: unknown })
        .municipios_com_ocorrencia_confirmada;
      if (Array.isArray(municipios) && municipios.length > 3) return true;
    }
    if (nome === "buscar_progresso_safra_conab" && r && typeof r === "object") {
      const daUf = (r as { da_uf?: unknown }).da_uf;
      const nacional = (r as { nacional?: unknown }).nacional;
      const comDado =
        (Array.isArray(daUf) ? daUf.filter((l) => l?.percentual > 0).length : 0) +
        (Array.isArray(nacional) ? nacional.filter((l) => l?.percentual > 0).length : 0);
      if (comDado > 1) return true;
    }
  }
  return false;
}

// Rede de segurança determinística pro cross-sell de leilão: o prompt já
// pede pra mencionar "X leilões" (Prata+) ou o teaser (Bronze) sempre que o
// produtor pergunta preço de boi, mas contagem exata e "sempre mencionar" são
// exatamente os dois tipos de instrução que esse modelo não segue de forma
// confiável sozinho (mesmo padrão do bug de percentual e do guard do
// painel) — por isso a contagem real vem do código, nunca do texto do
// modelo. Varre o resultado de buscar_leiloes_proximos DESTE turno, se
// chamado.
function extrairResultadoLeilao(messages: OpenAIMessage[]): ResultadoLeilao | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_leiloes_proximos") continue;
    try {
      const r = JSON.parse(m.content ?? "{}") as Record<string, unknown>;
      if (r.disponivel_no_plano === false) return { disponivelNoPlano: false };
      if (r.encontrado === true) {
        return {
          disponivelNoPlano: true,
          encontrado: true,
          totalPresenciais:
            typeof r.total_presenciais_na_regiao === "number" ? r.total_presenciais_na_regiao : 0,
          totalVirtuais:
            typeof r.total_virtuais_em_destaque === "number" ? r.total_virtuais_em_destaque : 0,
        };
      }
      return { disponivelNoPlano: true, encontrado: false };
    } catch {
      // resultado malformado não derruba a resposta — ignora.
    }
  }
  return null;
}

// Referência de mercado que buscar_preco trouxe (estado sem dado recente), só
// quando a resposta é sobre UMA consulta de preço.
function extrairReferenciaMercado(
  messages: OpenAIMessage[],
): { valores: number[]; frase: string } | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const achadas: ({ valores: number[]; frase: string } | null)[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const r = JSON.parse(m.content ?? "{}")?.referencia_mercado;
      achadas.push(
        r && Array.isArray(r.valores) && typeof r.frase === "string"
          ? { valores: r.valores as number[], frase: r.frase }
          : null,
      );
    } catch {
      achadas.push(null);
    }
  }
  return achadas.length === 1 ? achadas[0]! : null;
}

// Paridade de porto que buscar_preco calculou, só quando a resposta é sobre UMA
// consulta de preço (a frase pronta é escrita por código; ver lib/paridade.ts).
function extrairParidade(messages: OpenAIMessage[]): { valor: number; frase: string } | null {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const achadas: ({ valor: number; frase: string } | null)[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const f = JSON.parse(m.content ?? "{}")?.frete_e_paridade;
      achadas.push(
        f?.tipo === "paridade" && typeof f.paridade === "number" && typeof f.frase === "string"
          ? { valor: f.paridade, frase: f.frase }
          : null,
      );
    } catch {
      achadas.push(null);
    }
  }
  return achadas.length === 1 ? achadas[0]! : null;
}

// Resultado de buscar_leite, só quando a resposta é sobre UMA consulta de leite
// (as frases prontas são escritas por código; ver tools/leite.ts).
type ResultadoLeiteDoTurno = {
  chamou: boolean;
  fraseRelacao: string | null;
  cotacao: { preco: number; frase: string } | null;
};

function extrairResultadoLeite(messages: OpenAIMessage[]): ResultadoLeiteDoTurno {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const resultados: Partial<ResultadoBuscarLeite>[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_leite") continue;
    try {
      resultados.push(JSON.parse(m.content ?? "{}"));
    } catch {
      resultados.push({});
    }
  }
  if (resultados.length !== 1)
    return { chamou: resultados.length > 0, fraseRelacao: null, cotacao: null };
  const r = resultados[0]!;
  const frase = r.relacao_milho?.frase_relacao;
  const c = r.cotacao_recente;
  return {
    chamou: true,
    fraseRelacao: typeof frase === "string" ? frase : null,
    cotacao:
      c && typeof c.preco === "number" && typeof c.frase_cotacao === "string"
        ? { preco: c.preco, frase: c.frase_cotacao }
        : null,
  };
}

const FALLBACK_DURO: RespostaAgente = {
  resposta: "Desculpa, não consegui pensar numa resposta agora. Pode tentar de novo em instantes?",
  precisa_humano: true,
  cadastro_criado: false,
  convite_dispensado: false,
};

// Última linha de defesa contra número inventado (ver guardas.ts): se mesmo
// depois de uma chance de se corrigir a resposta ainda cita um valor em R$
// que nenhuma fonte sustenta, é melhor dizer a verdade do que mandar um
// preço falso pra um produtor tomar decisão em cima dele.
const RESPOSTA_SEM_VALOR_CONFIAVEL =
  "Não consegui confirmar esse valor com segurança agora. Me diz a cultura e o estado que eu busco de novo direto na fonte.";

// Mesma rede de segurança determinística de cima, agora pra escalada de
// cobrança/reembolso — o prompt já pede pra escalar (precisa_humano=true)
// qualquer pergunta sobre cobrança, erro de pagamento ou reembolso, mas
// testando ao vivo isso às vezes não escala (ex: "fui cobrado errado, quero
// reembolso" virou precisa_humano=false, respondendo só "cancele pelo
// painel"). Diferente da frase de fechamento (só estética), aqui o risco de
// deixar passar é dinheiro de verdade não indo pra revisão humana — por
// isso força true quando a mensagem do produtor bate com esse padrão,
// independente do que o modelo decidiu.
const PADRAO_COBRANCA_SENSIVEL =
  /cobr(an[çc]a|ado|aram|ei)|reembolso|estorno|fatura|dinheiro de volta|pagamento errado|cart[aã]o.*errado|valor errado/i;

function precisaEscalarPorCobranca(textoProdutor: string): boolean {
  return PADRAO_COBRANCA_SENSIVEL.test(textoProdutor);
}

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

async function chamarOpenAI(
  apiKey: string,
  messages: OpenAIMessage[],
  opts: { comTools: boolean; signal: AbortSignal },
) {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    response_format: RESPONSE_FORMAT,
    temperature: 0.5,
  };
  if (opts.comTools) {
    body["tools"] = TOOLS;
    body["tool_choice"] = "auto";
    body["parallel_tool_calls"] = true;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`OpenAI respondeu ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function responderPedidoDeAcesso(
  supabase: SupabaseClient,
  produtorId: string,
  pedido: "gerar" | "oferecer",
): Promise<RespostaAgente | null> {
  const base = { cadastro_criado: false, convite_dispensado: true };
  try {
    const tipo = await tipoDeAcesso(supabase, produtorId);
    if (tipo === "sem_cadastro") return null;
    if (tipo === "propria") {
      return { ...base, resposta: respostaEntrarNoPainel(), precisa_humano: false };
    }
    if (pedido === "oferecer") {
      return { ...base, resposta: respostaOfertaDeAcesso(), precisa_humano: false };
    }
    const r = await gerarLinkDeAcesso(supabase, produtorId);
    if (r.sucesso) {
      return { ...base, resposta: respostaLinkDeAcesso(r.link), precisa_humano: false };
    }
    if (r.motivo === "tem_login_proprio") {
      return { ...base, resposta: respostaEntrarNoPainel(), precisa_humano: false };
    }
    return { ...base, resposta: RESPOSTA_FALHA_AO_GERAR_LINK, precisa_humano: true };
  } catch (err) {
    console.error("Erro ao gerar link de acesso:", err);
    return { ...base, resposta: RESPOSTA_FALHA_AO_GERAR_LINK, precisa_humano: true };
  }
}

export async function runAgent(input: {
  telefone: string;
  texto: string;
  historico: HistoricoLinha[];
  produtor: ProdutorContexto;
  supabase: SupabaseClient;
  apiKey: string;
  signal: AbortSignal;
}): Promise<RespostaAgente> {
  const { telefone, texto, historico, produtor, supabase, apiKey, signal } = input;

  // Quem ainda não é cliente e responde SAIR à mensagem de recuperação sai da
  // lista de mensagens proativas. Decidido por código (é compromisso legal com
  // o usuário, não pode depender do modelo). Cliente cadastrado não entra: pra
  // ele "sair" pode significar outra coisa (painel, plano).
  if (!produtor.id && ehPedidoDeSair(texto)) {
    const { error } = await supabase
      .from("whatsapp_optout")
      .upsert(
        { whatsapp: normalizarWhatsapp(telefone), origem: "bot" },
        { onConflict: "whatsapp" },
      );
    if (error) {
      console.error("Erro ao registrar opt-out:", error);
      return {
        resposta:
          "Recebi seu pedido pra parar de receber mensagens. Vou pedir pra nossa equipe confirmar isso pra você.",
        precisa_humano: true,
        cadastro_criado: false,
        convite_dispensado: true,
      };
    }
    return {
      resposta: RESPOSTA_SAIDA_DE_MENSAGENS,
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

  // Paywall determinístico: quem já tem conta mas o trial venceu (ou a
  // assinatura não está ativa) não pode continuar recebendo dado real pelo
  // bot de graça pra sempre — isso NUNCA pode ficar a cargo do modelo (mesmo
  // risco de qualquer outra ação sensível: o modelo não é confiável pra
  // recusar sozinho de forma consistente). Quem ainda não tem conta
  // (produtor.id null, fluxo anônimo) não passa por essa checagem.
  // Pedido de acesso ao painel (link de uso único no WhatsApp) vem ANTES do
  // paywall: quem está com o teste vencido e não lembra como entrar precisa
  // justamente do painel pra assinar. Tudo aqui é decidido por código, sem o
  // modelo — é acesso à conta de alguém, não pode depender de improviso.
  if (produtor.id) {
    const pedido = classificarPedidoDeAcesso(texto, historico);
    if (pedido) {
      const respostaAcesso = await responderPedidoDeAcesso(supabase, produtor.id, pedido);
      if (respostaAcesso) return respostaAcesso;
    }
  }

  if (produtor.id) {
    const acesso = await verificarAcessoWhatsapp(supabase, produtor.id);
    if (!acesso.liberado) {
      return {
        resposta: mensagemBloqueioAcesso(acesso.comLogin, acesso.motivo),
        precisa_humano: false,
        cadastro_criado: false,
        convite_dispensado: false,
      };
    }
  }

  const notaNegativaDupla = notaDeNegativaDupla(texto);
  const notaRecusaCadastro = notaDeRecusaCadastro(texto);
  const notaAflicaoPessoal = notaDeAflicaoPessoal(texto);
  const notaAberturaDeAnuncio = notaDeAberturaDeAnuncio(texto);
  const notaIncentivoAtivacao = notaDeIncentivoAtivacao(produtor, historico, texto);
  const notaMemoriaPotencial = notaDeMemoriaPotencial(produtor, texto);
  // Memória entre conversas (não confundir com `historico`, que é só desta
  // conversa) — ver tools/memoria.ts. Só existe pra quem já tem cadastro.
  const memorias = produtor.id ? await buscarMemoriasProdutor(supabase, produtor.id) : [];
  const contextoMemoria = buildContextoMemoria(memorias);
  const messages: OpenAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContextoProdutor(produtor) },
    ...(contextoMemoria ? [{ role: "system" as const, content: contextoMemoria }] : []),
    ...(produtor.id ? [] : [{ role: "system" as const, content: buildRegrasCadastroAnonimo() }]),
    ...(produtor.id && !produtor.user_id
      ? [{ role: "system" as const, content: buildRegrasClienteSemLogin() }]
      : []),
    { role: "system", content: buildContextoPlanos() },
    { role: "system", content: buildContextoInstitucional() },
    ...buildHistoryMessages(historico),
    ...(notaNegativaDupla ? [notaNegativaDupla] : []),
    ...(notaRecusaCadastro ? [notaRecusaCadastro] : []),
    ...(notaAflicaoPessoal ? [notaAflicaoPessoal] : []),
    ...(notaAberturaDeAnuncio ? [notaAberturaDeAnuncio] : []),
    ...(notaIncentivoAtivacao ? [notaIncentivoAtivacao] : []),
    ...(notaMemoriaPotencial ? [notaMemoriaPotencial] : []),
    { role: "user", content: texto },
  ];

  const ctx = { supabase, produtor, telefone, historico, texto };
  // Sinaliza pro n8n que a conta acabou de ser criada NESTA mensagem, pra ele
  // não emendar o convite de cadastro (que só faz sentido pra quem ainda não
  // tem conta) logo depois de "seu cadastro foi criado com sucesso" — sem
  // isso o convite aparecia de forma redundante/confusa após um cadastro OK.
  let cadastroCriado = false;
  let contaCriada: { uf: string; cultura: string } | null = null;
  let jaTentouCorrigirValor = false;
  let tentativasForcarIncentivo = 0;

  // Fecha a resposta: aplica as redes de segurança de texto, troca a resposta
  // do modelo pela confirmação escrita por código quando o cadastro acabou
  // de ser criado, e barra valor em R$ que nenhuma fonte desta conversa
  // sustenta. Devolve null quando a resposta precisa de mais uma rodada
  // (pedido de correção de valor inventado).
  const fechar = (
    parsed: { resposta: string; precisa_humano: boolean },
    conteudoBruto: string | null | undefined,
    podeCorrigir: boolean,
  ): RespostaAgente | null => {
    if (cadastroCriado && contaCriada) {
      return {
        resposta: respostaCadastroCriado({
          nome: produtor.nome,
          uf: contaCriada.uf,
          cultura: contaCriada.cultura,
        }),
        precisa_humano: false,
        cadastro_criado: true,
        convite_dispensado: true,
      };
    }

    const numerosPermitidos = coletarNumerosPermitidos(messages, texto, historico);
    const leite = extrairResultadoLeite(messages);
    const resposta = garantirMencaoLeilao(
      garantirMencaoPainel(
        garantirCanalDeTexto(
          garantirCotacaoLeite(
            garantirRelacaoLeiteMilho(
              garantirMediaDasPracas(
                garantirReferenciaMercado(
                  garantirParidade(
                    garantirRotaFrete(
                      garantirDataDoPreco(
                        removerMarkdownProibido(removerFechamentoGenerico(parsed.resposta)),
                        extrairDataDoPreco(messages),
                      ),
                      extrairUltimoFreteCitado(messages),
                    ),
                    extrairParidade(messages),
                  ),
                  extrairReferenciaMercado(messages),
                ),
                extrairMediaDasPracas(messages),
              ),
              leite.fraseRelacao,
              numerosPermitidos,
            ),
            leite.cotacao,
          ),
        ),
        temDetalheExtraParaPainel(messages),
        !!produtor.user_id,
      ),
      extrairResultadoLeilao(messages),
    );

    const naoAutorizados = valoresNaoAutorizados(resposta, numerosPermitidos);
    // Quantidades em kg/litros sem fonte (leite): sem frase pronta pra trocar,
    // segue o mesmo caminho do valor em R$ inventado (uma correção, depois recusa).
    // Só na conversa de leite: em outras culturas "15 kg" (arroba), "50 kg" etc.
    // são medidas legítimas que nenhuma ferramenta precisa devolver.
    const conversaDeLeite =
      /leite/i.test(texto) ||
      /leite/i.test(produtor.cultura_principal ?? "") ||
      leite.chamou ||
      messages.some(
        (m) =>
          m.role === "assistant" && m.tool_calls?.some((tc) => tc.function.name === "buscar_leite"),
      );
    const medidasInvalidas = conversaDeLeite
      ? medidasNaoAutorizadas(resposta, numerosPermitidos)
      : [];
    // Hectares/toneladas sem fonte valem em QUALQUER conversa (não só leite)
    // — achado real testando buscar_producao_ibge, ver comentário da função.
    const areaInvalida = areaProducaoNaoAutorizada(resposta, numerosPermitidos);
    if (naoAutorizados.length > 0 || medidasInvalidas.length > 0 || areaInvalida.length > 0) {
      if (podeCorrigir && !jaTentouCorrigirValor) {
        jaTentouCorrigirValor = true;
        const lista = [
          ...naoAutorizados.map((v) => `R$${v.toFixed(2).replace(".", ",")}`),
          ...medidasInvalidas.map((v) => String(v).replace(".", ",")),
          ...areaInvalida.map((v) => String(v).replace(".", ",")),
        ].join(", ");
        messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
        messages.push({
          role: "system",
          content: `Correção obrigatória: sua resposta anterior citou ${lista}, que NÃO veio de nenhuma ferramenta consultada agora nem do que o produtor escreveu — é valor inventado ou copiado/ajustado de uma resposta anterior. Chame a ferramenta necessária de novo agora (ex: buscar_preco com a cultura e a UF do contexto) e responda usando SOMENTE os valores que ela retornar, sem reaproveitar nem ajustar números de mensagens anteriores. Se nenhuma ferramenta dá esse valor, não cite valor nenhum.`,
        });
        return null;
      }
      return {
        resposta: RESPOSTA_SEM_VALOR_CONFIAVEL,
        precisa_humano: false,
        cadastro_criado: cadastroCriado,
        convite_dispensado: cadastroCriado,
      };
    }

    // Rede de segurança determinística pro incentivo de ativação: mesmo com
    // a nota ficando mais imperativa ("OBRIGATÓRIO"), achado real testando
    // ao vivo (2026-10-09) é que isso sozinho não é suficiente numa conversa
    // já longa — 0 de 4 tentativas incluíram o convite mesmo com a versão
    // mais forte do texto (a versão pro início da conversa funciona, 3 de 3;
    // só a extensão pra cliente antigo falhava). Em vez de insistir só em
    // reforçar o prompt, verifica se a resposta realmente tem um convite
    // reconhecível e, se não tiver, pede uma rodada extra pra reescrever —
    // mesmo padrão já usado aqui pro valor inventado.
    // 2ª rodada (mesmo dia, bateria de 10 variações): 1 tentativa de retry
    // recuperava ~80% dos casos (4 de 5 runs do mesmo caso "boi gordo sem
    // preço em MG"), mas o 1 de 5 que falhava nas duas rodadas (original +
    // retry) ficava sem convite de vez — não tinha mais chance. Subiu de 1
    // pra 2 retries (3 tentativas no total); com MAX_TOOL_ROUNDS=6 e uso
    // típico de 1-2 rodadas de tool antes disso, sobra folga de sobra.
    const MAX_TENTATIVAS_FORCAR_INCENTIVO = 2;
    if (
      notaIncentivoAtivacao &&
      podeCorrigir &&
      tentativasForcarIncentivo < MAX_TENTATIVAS_FORCAR_INCENTIVO &&
      !PADROES_INCENTIVO_JA_OFERECIDO.some((p) => p.test(resposta))
    ) {
      tentativasForcarIncentivo++;
      messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
      messages.push({
        role: "system",
        content:
          "Sua resposta anterior não incluiu o convite obrigatório que a nota pediu (alerta automático, outra cultura/estado, ou sinal de venda). Reescreva a MESMA resposta, mantendo os dados que você já deu, mas acrescente no final uma frase curta com esse convite — dessa vez não pode faltar.",
      });
      return null;
    }

    // Cliente cadastrado só pelo WhatsApp (sem login no site): nenhum link
    // de /dashboard serve pra ele — ver guardas.ts.
    const semLogin = produtor.id && !produtor.user_id;
    const correcaoPainel = semLogin
      ? corrigirLinkDePainelParaClienteSemLogin(resposta, texto, precisaEscalarPorCobranca(texto))
      : null;
    if (correcaoPainel) {
      return { ...correcaoPainel, cadastro_criado: cadastroCriado, convite_dispensado: true };
    }

    return {
      resposta,
      precisa_humano:
        parsed.precisa_humano || precisaEscalarPorCobranca(texto) || !!notaAflicaoPessoal,
      cadastro_criado: cadastroCriado,
      convite_dispensado: cadastroCriado || conversaFalaDeCadastro(resposta, historico),
    };
  };

  try {
    for (let rodada = 0; rodada < MAX_TOOL_ROUNDS; rodada++) {
      const json = await chamarOpenAI(apiKey, messages, { comTools: true, signal });
      const escolha = json.choices?.[0];
      const mensagem = escolha?.message;

      if (escolha?.finish_reason === "tool_calls" && mensagem?.tool_calls?.length) {
        messages.push({
          role: "assistant",
          content: mensagem.content ?? null,
          tool_calls: mensagem.tool_calls,
        });

        const resultados = await Promise.all(
          (mensagem.tool_calls as ToolCall[]).map(async (tc) => {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              args = {};
            }
            const resultado = await executarTool(tc.function.name, args, ctx);
            if (
              tc.function.name === "criar_conta_teste" &&
              (resultado as { sucesso?: boolean })?.sucesso === true
            ) {
              cadastroCriado = true;
              const r = resultado as { uf?: string; cultura_principal?: string };
              contaCriada = {
                uf: r.uf ?? String(args["uf"] ?? ""),
                cultura: r.cultura_principal ?? String(args["cultura_principal"] ?? ""),
              };
            }
            return { tool_call_id: tc.id, content: JSON.stringify(resultado) };
          }),
        );

        for (const r of resultados) {
          messages.push({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
        }
        continue;
      }

      if (mensagem?.content) {
        const parsed = JSON.parse(mensagem.content) as {
          resposta: string;
          precisa_humano: boolean;
        };
        const fechada = fechar(parsed, mensagem.content, true);
        if (fechada) return fechada;
        continue;
      }

      break;
    }

    // Rodadas esgotadas ainda pedindo tool — força uma resposta final com o
    // que já foi buscado, sem oferecer mais nenhuma tool pra chamar.
    const json = await chamarOpenAI(apiKey, messages, { comTools: false, signal });
    const conteudo = json.choices?.[0]?.message?.content;
    if (conteudo) {
      const parsed = JSON.parse(conteudo) as { resposta: string; precisa_humano: boolean };
      const fechada = fechar(parsed, conteudo, false);
      if (fechada) return fechada;
    }

    return FALLBACK_DURO;
  } catch (err) {
    // Antes engolia o erro em silêncio: uma rajada de 429 da OpenAI (limite de
    // tokens por minuto) virava "não consegui pensar numa resposta" sem nenhum
    // rastro nos logs de quem investiga.
    console.error("Erro no agente do bot:", err);
    return FALLBACK_DURO;
  }
}
