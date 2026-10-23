import { deveAvisarEquipeDeLeadBloqueado } from "@/lib/bot/fimDoTeste";
import { buscarFaturaParaPagar, respostaComFatura } from "@/lib/bot/faturaPendente";
import {
  RESPOSTA_CHAMAR_PESSOA,
  ehConfusao,
  ehPerguntaDeCondicoes,
  jaMostrouAjudaRecente,
  respostaAoMenu,
  respostaDeCondicoes,
  respostaMenuDeAjuda,
} from "@/lib/bot/ajudaDoProdutor";
import {
  ehDuvidaDeValor,
  respondeuAQuantidade,
  respostaDuvidaDeValor,
  responderValorDaVenda,
} from "@/lib/bot/duvidaDeValor";
import type { SupabaseClient } from "@supabase/supabase-js";

import { culturaMencionada, mencionaDerivadoDeGrao, normalizarCultura } from "@/config/culturas";
import {
  buildContextoInstitucional,
  buildContextoFuncionalidades,
  ehPedidoDeNovidades,
  respostaNovidades,
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
import {
  jaAvisouDoBloqueio,
  MENSAGEM_BLOQUEIO_CURTA,
  mensagemBloqueioAcesso,
  verificarAcessoWhatsapp,
} from "@/lib/bot/tools/acesso";
import { gerarLinkDeAcesso, tipoDeAcesso } from "@/lib/bot/tools/linkAcesso";
import {
  avisoAutomaticoSeCabe,
  ehObjecaoDePoucoUso,
  RESPOSTA_POUCO_USO,
} from "@/lib/bot/avisoAutomatico";
import type { ResultadoBuscarLeite } from "@/lib/bot/tools/leite";
import { buscarMemoriasProdutor } from "@/lib/bot/tools/memoria";
import {
  afirmaTerAnotadoNoCaderno,
  desfazerUltimoRegistro,
  ehContinuacaoDeLancamento,
  ehPedidoDeDesfazerRegistro,
  ehRespostaDeVencimento,
  pareceLancamentoNoCaderno,
  pedidoDeGastoPorCategoria,
  pedidoDeGastoPorTalhao,
  periodoDoPedidoDeResumo,
  resumoDaFazenda,
} from "@/lib/bot/tools/fazenda";
import {
  acaoDoAvisoDeMargem,
  ehPedidoDeEstoque,
  ehPedidoDePrecoAlvo,
  margemAlvoDoTexto,
  textoDoEstoque,
  tratarMetaDeMargem,
} from "@/lib/bot/tools/fazendaMeta";
import {
  ehPedidoDeCusto,
  tratarAreaDeFrase,
  tratarPedidoDeCusto,
  tratarRespostaDeArea,
} from "@/lib/bot/tools/fazendaCusto";
import {
  ehPedidoDePendencias,
  textoDePendencias,
  tratarBaixa,
} from "@/lib/bot/tools/fazendaPendencias";
import { lerPendentes } from "@/lib/bot/tools/fazendaBase";
import { tratarFechamentoDeProposta } from "@/lib/bot/tools/fazendaProposta";
import { acaoDeOrcamento, tratarOrcamento } from "@/lib/bot/tools/fazendaOrcamento";
import { tratarRespostaAoRascunho } from "@/lib/bot/recibo";
import { acharFuncionario, responderFuncionario } from "@/lib/bot/funcionario";
import {
  ehPedidoDePararAvisos,
  ehPedidoDeSair,
  RESPOSTA_PAROU_AVISOS,
  RESPOSTA_SAIDA_DE_MENSAGENS,
} from "@/lib/recuperacaoCadastro";
import { resolverNome } from "@/lib/nomes";
import {
  decidirCadastro,
  estadoComErroDeDigitacao,
  PERGUNTA_CULTURA,
  respostaEstadoComErro,
} from "@/lib/bot/cadastroConversa";
import {
  escolherSugestoes,
  notaDeSugestoes,
  ofereceuAlgo,
  quantasOferecidas,
  respostaTemConvite,
  type Sugestao,
} from "@/lib/bot/sugestoes";
import {
  ehInteresseDeCooperativa,
  respostaDeCooperativa,
  ultimaFoiDeCooperativa,
} from "@/lib/bot/cooperativa";
import {
  ehPedidoDeTesteDrive,
  montarCadastroComTesteDrive,
  montarTesteDriveDoBotao,
} from "@/lib/bot/testeDrive";
import { criarContaTeste } from "@/lib/bot/tools/conta";
import {
  ehDetalheDeHorario,
  ehPedidoDeContatoHumano,
  MARCADOR_DE_CONTATO,
  respostaDePedidoDeContato,
} from "@/lib/bot/contatoHumano";
import { normalizarWhatsapp } from "@/lib/telefone";
import type { ProdutorContexto } from "@/lib/bot/types";
import {
  areaProducaoNaoAutorizada,
  coletarNumerosPermitidos,
  conversaFalaDeCadastro,
  classificarPedidoDeAcesso,
  classificarPedidoDeAssinatura,
  respostaAssinarComLoginProprio,
  respostaLinkDeAssinatura,
  corrigirLinkDePainelParaClienteSemLogin,
  garantirDataDoPreco,
  garantirMediaDasPracas,
  garantirParidade,
  garantirReferenciaMercado,
  garantirCanalDeTexto,
  garantirMencaoPainel,
  garantirMencaoLeilao,
  garantirOpcaoDeCidadeNoAlertaDeClima,
  corrigirCalendario,
  corrigirDirecaoDoAlerta,
  suavizarConselhoDeEspera,
  corrigirMediaAtribuidaACidade,
  corrigirFimDeMes,
  buildContextoDeData,
  tirarNegativaDeInsumoParaBronze,
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
  estadosNaoAutorizados,
  ufsAutorizadas,
  type FreteCitado,
} from "@/lib/bot/guardas";
import { respostaDeProduto } from "@/lib/bot/respostasDeProduto";
import { ufs } from "@/config/ufs";
import { responderCoberturaDoProduto } from "@/lib/bot/cobertura";
import { avisarCidadeSemCotacao } from "@/lib/bot/cidadeSemCotacao";
import { culturasNaoConsultadas, culturasPerguntadas } from "@/lib/bot/produtoConsultado";
import {
  conversaEraDePlanos,
  ehPedidoDeExcluirDados,
  ehPedidoDeTrocarCultura,
  ehPerguntaDeSituacaoDaConta,
  responderSituacaoDaConta,
  respostaDeTrocarCultura,
  ehPedidoDeLinkDoSite,
  ehPerguntaAgronomica,
  ehPerguntaDeChuvaEmMm,
  ehPerguntaDePagamento,
  respostaAgronomica,
  respostaDeChuvaEmMm,
  respostaDeExcluirDados,
  respostaDeLinkDoSite,
  respostaDePagamento,
  responderAcenoSolto,
  ehPedidoDeAlertaSemTipo,
  perguntaDeConfirmarAlertaDeClima,
  ehPedidoDeCancelarAlerta,
  respostaDeAlertaSemTipo,
  ehPedidoDeListarAlertas,
  ehPedidoDeOpiniaoDeInvestimento,
  ehPerguntaDePlanos,
  ehPerguntaVagaDePreco,
  respostaDeCancelarAlerta,
  respostaDeInvestimento,
  respostaDePrecoSemAssunto,
  responderCidadeDeclarada,
  responderConversaoDeUnidade,
  responderListaDeAlertas,
  responderPlanos,
} from "@/lib/bot/respostasComDados";
import { responderMidia } from "@/lib/bot/estudoDeProposta";
import {
  contextoDoEstudo,
  ehCenarioSemNumero,
  ehMudancaNoEstudo,
  ehPedidoDeExplicacao,
  explicarEstudo,
  PEDIR_UM_NUMERO,
} from "@/lib/bot/propostas/acompanhamento";
import { separarEstudoDoHistorico } from "@/lib/bot/propostas/salvo";
import { SEM_ESTUDO_RECENTE } from "@/lib/bot/tools/acompanharEstudo";

const RESPOSTA_DERIVADO_DE_GRAO =
  "Eu não acompanho o preço de farelo, óleo, casca nem torta: são derivados, a indústria vende por tonelada e não tenho uma fonte pública diária deles. Acompanho o preço do grão (soja, milho, trigo...), boi, café, leite e outras culturas. Se você tem uma proposta de farelo na mão, mande a foto e eu leio, mas sem comparar com o mercado. Quer o preço da soja em grão?";
import {
  ehPropostaDePreco,
  PERGUNTA_DO_VALOR_DA_PROPOSTA,
  temPrecoDeProposta,
} from "@/lib/bot/propostas/gatilho";
import type { MidiaRecebida } from "@/lib/bot/propostas/tipos";

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
const NEGATIVA_DUPLA = /tem\s+em\s+nenhum|\bem\s+(lugar|estado|canto|regi[aã]o)\s+nenhum/i;

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
  "Formato desta resposta: comece chamando-a pelo nome e com uma observação curta e humana sobre a rotina de quem produz (ex: 'Oi, [nome]! Quem produz sabe como o preço muda de um dia pro outro.'). Só depois explique em uma ou duas frases o que o Safralume faz. NÃO faça pergunta nenhuma: a pergunta final é acrescentada por código.",
  "Formato desta resposta: comece chamando-a pelo nome, depois seja bem direto e breve: UMA frase só explicando o essencial (preço comparado ao porto, clima e alerta automático, tudo no WhatsApp), sem listar todos os detalhes. NÃO faça pergunta nenhuma: a pergunta final é acrescentada por código.",
  "Formato desta resposta: abra chamando-a pelo nome e reconhecendo uma dificuldade comum do produtor (ex: perder tempo ligando pra saber preço, ou descobrir tarde demais que o preço mudou) ANTES de apresentar o Safralume como resposta pra isso. NÃO faça pergunta nenhuma: a pergunta final é acrescentada por código.",
  "Formato desta resposta: cumprimente pelo nome numa frase curta e resuma o que o Safralume faz em só uma frase, sem listar todas as funcionalidades. NÃO faça pergunta nenhuma: a pergunta final é acrescentada por código.",
  "Formato desta resposta: abra com uma pergunta retórica ligada ao valor do produto, chamando-a pelo nome nessa mesma pergunta (ex: algo como 'Sabe quanto sua saca vale agora, [nome], comparado ao preço do porto?'), e explique brevemente depois o que o Safralume faz. Essa pergunta retórica é a ÚNICA permitida: não pergunte cultura nem estado, a pergunta final é acrescentada por código.",
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
// 2ª rodada (2026-10-10, testando notaDePrimeiraRespostaPosCadastro): o
// mesmo gap voltou numa forma nova — o modelo respondeu "outraS culturaS e
// estadoS" (plural) e o singular aqui não casou, quase causando retry à
// toa de novo. "s?" em cada palavra cobre singular e plural.
// Achado real 2026-10-12 (print do Matheus): perguntou a cotação do dólar
// e o bot não ofereceu o gancho de alerta — a troca anterior (comparação de
// produção de soja entre estados, pergunta genuína, não convite nenhum)
// tinha a frase "outros estados" na resposta, e isso sozinho já contava
// como "gancho recém-oferecido", suprimindo o convite de verdade. Os dois
// primeiros padrões agora exigem a combinação real do convite (não uma
// palavra solta que também aparece em resposta normal, sem ser convite).

// Pra verificar se a resposta realmente mostrou as 2 funcionalidades extras
// que notaDePrimeiraRespostaPosCadastro pediu — mesmo padrão de detecção
// (regex ampla, não literal) já provado necessário hoje pro incentivo normal.

// Mesmo achado de 2026-10-12 que corrigiu culturaMaisRecenteNoHistorico:
// `historico` chega do n8n em ordem DESC (mais recente primeiro), então
// `.slice(-N)` pegava as N mensagens mais ANTIGAS da janela de 50, não as
// mais recentes — ordena por `ordem` crescente antes de fatiar.
function incentivoRecenteNoHistorico(historico: HistoricoLinha[]): boolean {
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  const recentes = ordenado.slice(-JANELA_SEM_REPETIR_INCENTIVO);
  return recentes.some((h) => h.role === "assistant" && ofereceuAlgo(h.conteudo));
}

// 1ª versão só tinha "chuva" (substantivo) — não casava "vai chover", "tá
// chovendo" etc (achado real testando ao vivo: era a causa real de um "bug
// de não-compliance do modelo" que na verdade nunca era isso, a nota nem
// chegava a ser criada). \w* nas raízes cobre as flexões de verbo também.
// 2ª rodada (bateria final de 20, mesmo dia): "Vai molhar essa semana ou
// não?" — sinônimo coloquial de chover que nenhuma raiz cobria.
const ASSUNTO_CLIMA = /\b(clima|tempo|previs[ãa]o|geada|seca|chuv\w*|chov\w*|molh\w*|umidade)\b/i;

// Achado real 2026-10-12 (print do Matheus): bug de "alerta de dólar" que
// não existia (ver respostaFugiuDeCambioParaCultura abaixo). Câmbio virou
// o 4º tipo de alerta de verdade nesse mesmo pedido — entra aqui também
// como assunto alertável, senão o gancho de "quer que eu crie um alerta
// pra isso?" nunca aparecia pra quem perguntava o dólar.
const ASSUNTO_CAMBIO = /\b(d[óo]lar|c[âa]mbio|ptax)\b/i;

function assuntoAlertavel(texto: string): boolean {
  return (
    culturaMencionada(texto) !== null || ASSUNTO_CLIMA.test(texto) || ASSUNTO_CAMBIO.test(texto)
  );
}

function pedidoDeAlertaSemCultura(texto: string): boolean {
  return /\balert\w*/i.test(texto) && culturaMencionada(texto) === null;
}

function topicoRecenteEhCambioSemCultura(historico: HistoricoLinha[]): boolean {
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  const ultimaDoAssistente = [...ordenado].reverse().find((h) => h.role === "assistant");
  if (!ultimaDoAssistente) return false;
  return (
    ASSUNTO_CAMBIO.test(ultimaDoAssistente.conteudo) &&
    culturaMencionada(ultimaDoAssistente.conteudo) === null
  );
}

function respostaFugiuDeCambioParaCultura(
  resposta: string,
  texto: string,
  historico: HistoricoLinha[],
): boolean {
  return (
    pedidoDeAlertaSemCultura(texto) &&
    topicoRecenteEhCambioSemCultura(historico) &&
    culturaMencionada(resposta) !== null
  );
}

// Achado real testando ao vivo (bateria de 10, 2026-10-12): quando o
// produtor confirma que quer um alerta de câmbio sem ter dito nenhum valor
// ("sim quero"), o modelo às vezes propõe a COTAÇÃO ATUAL do dólar como se
// fosse o limite do alerta ("Confirma: ... quando passar de R$4,99?", sendo
// 4,99 a cotação de agora) — mesmo erro já documentado no prompt pra
// qualquer alerta (nunca propor valor que o produtor não disse), só que a
// regra geral não bastou pro fluxo novo de câmbio. Mesmo padrão de sempre:
// rede de segurança por código, não só prompt.
function valorDaConfirmacaoDeCambio(resposta: string): number | null {
  if (!/confirma/i.test(resposta) || !ASSUNTO_CAMBIO.test(resposta)) return null;
  const m = /R\$\s*([\d.,]+)/.exec(resposta);
  if (!m) return null;
  const n = Number(m[1]!.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function respostaInventouValorDeCambio(
  resposta: string,
  texto: string,
  historico: HistoricoLinha[],
): boolean {
  const valor = valorDaConfirmacaoDeCambio(resposta);
  if (valor == null) return false;
  const inteiro = String(Math.trunc(valor));
  if (texto.includes(inteiro)) return false;
  return !historico.some((h) => h.role === "user" && h.conteudo.includes(inteiro));
}

// Achado real testando ao vivo (bateria de 10, 2026-10-12): pedindo resumo
// diário sem dizer o horário, o modelo repetidamente propôs "7h" (às vezes
// 0h) como se o produtor tivesse pedido — e numa tentativa propôs "25h" (que
// nem é hora válida) na própria pergunta de confirmação. Mesmo padrão dos
// outros dois: rede de segurança por código, não só prompt.
function horaDaConfirmacaoDeResumo(resposta: string): number | null {
  if (!/confirma/i.test(resposta) || !/resumo/i.test(resposta)) return null;
  const m = /\b(\d{1,2})\s*h\b/i.exec(resposta);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function respostaInventouHoraDeResumo(
  resposta: string,
  texto: string,
  historico: HistoricoLinha[],
): boolean {
  const hora = horaDaConfirmacaoDeResumo(resposta);
  if (hora == null) return false;
  if (hora < 0 || hora > 23) return true; // hora inválida nunca pode ser proposta
  const str = String(hora);
  if (texto.includes(str)) return false;
  return !historico.some((h) => h.role === "user" && h.conteudo.includes(str));
}

// Achado real testando ao vivo (ativação da mensagem proativa, 2026-10-13):
// depois de perguntar "Confirma que quer parar de receber..." e o produtor
// responder "sim, confirmo", o modelo não chama configurar_mensagem_proativa
// — só repete a mesma pergunta de confirmação de novo, em palavras
// diferentes a cada vez. Pior que os outros casos de "argumento errado":
// aqui o modelo nunca chega a emitir a function call nenhuma, e nem 2
// rodadas de correção por system message bastaram pra destravar (testado
// ao vivo: continuou repetindo na 3ª tentativa). Em vez de insistir
// esperando o modelo se corrigir sozinho, detecta o loop (a MESMA pergunta
// de confirmação apareceu como última msg do assistente E a resposta nova
// também é uma pergunta de confirmação) e executa a ferramenta direto por
// código assim que detecta — sem dar mais chance pro modelo tentar de novo.
function ehConfirmacaoDeMensagemProativa(s: string): boolean {
  return (
    /confirma/i.test(s) && /(mensagens? autom[aá]ticas?|avisos? autom[aá]ticos?|proativ)/i.test(s)
  );
}

function respostaRepetiuConfirmacaoProativaSemExecutar(
  resposta: string,
  historico: HistoricoLinha[],
): boolean {
  if (!ehConfirmacaoDeMensagemProativa(resposta)) return false;
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  const ultimaDoAssistente = [...ordenado].reverse().find((h) => h.role === "assistant")?.conteudo;
  if (!ultimaDoAssistente) return false;
  return ehConfirmacaoDeMensagemProativa(ultimaDoAssistente);
}

// Qual direção a pergunta de confirmação já feita estava propondo —
// "parar"/"desligar" (ativa=false) ou "voltar"/"reativar" (ativa=true).
// null quando não dá pra saber com segurança (nesse caso o código não
// executa nada sozinho, melhor deixar o modelo tentar de novo do que
// adivinhar errado).
function direcaoDaConfirmacaoProativa(historico: HistoricoLinha[]): boolean | null {
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  const ultimaDoAssistente = [...ordenado].reverse().find((h) => h.role === "assistant")?.conteudo;
  if (!ultimaDoAssistente || !ehConfirmacaoDeMensagemProativa(ultimaDoAssistente)) return null;
  if (/parar de receber|deslig|desativ/i.test(ultimaDoAssistente)) return false;
  if (/voltar a receber|relig|reativ/i.test(ultimaDoAssistente)) return true;
  return null;
}

// Achado real testando ao vivo (bateria adversarial 2026-10-12): pedido de
// alerta de praga/doença (ferrugem, lagarta, mofo-branco) — que não é um
// dos 4 tipos reais de alerta — faz o modelo tratar como se fosse pendente
// de criar (propõe "Confirma: alerta pra te avisar de ferrugem?" ou pede
// UF/município como se fosse seguir construindo), em vez de dizer de cara
// que esse tipo ainda não existe. O prompt já lista os 4 tipos e dá esse
// caso como exemplo explícito, e mesmo assim só acerta 1 em 5 — mesmo
// padrão de sempre, precisa de rede de segurança por código.
// 2ª rodada (mesmo dia, achado em produção DEPOIS de publicar o 1º fix):
// pra produtor SEM cadastro, a regra genérica de "aviso/alerta vem junto
// do cadastro" disparava antes de checar se o tipo existe, e a resposta
// saiu "o aviso automático de ferrugem vem junto com o cadastro grátis"
// — nem usa a palavra "alerta" (usa "aviso"), então o regex original não
// pegava. Alargado pra cobrir as duas palavras.
const PADRAO_PEDIDO_PRAGA_DOENCA = /\b(ferrugem|lagarta|mofo[- ]branco|praga|doen[cç]a)\b/i;
const PADRAO_RESPOSTA_DECLINOU =
  /ainda n[ãa]o existe|n[ãa]o tenho esse tipo|n[ãa]o consigo criar esse tipo/i;

function respostaTratouPragaComoAlertaValido(
  resposta: string,
  texto: string,
  historico: HistoricoLinha[],
): boolean {
  const assuntoEhPragaOuDoenca =
    PADRAO_PEDIDO_PRAGA_DOENCA.test(texto) ||
    historico
      .slice(-4)
      .some((h) => h.role === "user" && PADRAO_PEDIDO_PRAGA_DOENCA.test(h.conteudo));
  if (!assuntoEhPragaOuDoenca) return false;
  if (!/alertas?\b|avisos?\b/i.test(resposta)) return false;
  return !PADRAO_RESPOSTA_DECLINOU.test(resposta);
}

// Pedido do Matheus (2026-10-15): o convite deixou de ser só "alerta" (com sinal de venda e outra cultura
// sorteados): o CÓDIGO escolhe 2 caminhos diferentes e contextuais do catálogo (ver sugestoes.ts) e o
// modelo só os escreve. Achados anteriores continuam valendo: tom imperativo e o retry quando faltar o
// convite, porque o modelo copia o padrão (sem convite) das respostas anteriores.
function notaDeIncentivoAtivacao(
  produtor: ProdutorContexto,
  historico: HistoricoLinha[],
  texto: string,
): { nota: OpenAIMessage; escolhidas: Sugestao[] } | null {
  if (!produtor.id) return null;
  const cedoNaConversa = historico.length <= TURNOS_INICIO_DE_RELACAO;
  if (!cedoNaConversa && (!assuntoAlertavel(texto) || incentivoRecenteNoHistorico(historico))) {
    return null;
  }
  const escolhidas = escolherSugestoes({ produtor, historico, texto, max: 2 });
  if (escolhidas.length === 0) return null;
  return {
    nota: {
      role: "system",
      content: notaDeSugestoes(escolhidas, cedoNaConversa ? "comeco" : "momento"),
    },
    escolhidas,
  };
}

// Pedido real do Matheus (2026-10-10), direto do dado: 12 produtores com
// trial vencido tinham ZERO mensagem no bot e nunca voltaram ao painel —
// a conta era criada e a pessoa simplesmente sumia. A mensagem de
// boas-vindas ia ser reescrita pra puxar a primeira resposta de verdade
// (ver template do WhatsApp), mas o pedido vai além: quando essa primeira
// resposta vem, o bot não pode só responder a pergunta (geralmente preço)
// e parar — tem que deixar claro, logo de cara, que o plano cobre MUITO
// mais do que isso (mais de 10 funcionalidades reais: clima, alerta
// automático, sinal de venda, janela de plantio, câmbio/futuros, preço de
// insumo, ferrugem, leilão...). Esse é o momento de maior atenção que a
// pessoa vai dar ao produto — a primeira troca de verdade depois do
// cadastro — por isso o ângulo aqui é mais forte que o incentivo normal
// (que só sugere UMA coisa): mostra DUAS funcionalidades concretas de uma
// vez, pra passar a ideia de catálogo, não de "bot de preço".
// Cada combinação junta só funcionalidades reais, já confirmadas no
// código (nunca uma promessa que o produto não cumpre — foi exatamente o
// erro achado nos 2 vídeos de anúncio analisados nesta mesma sessão).

function notaDePrimeiraRespostaPosCadastro(
  produtor: ProdutorContexto,
  historico: HistoricoLinha[],
  texto: string,
): { nota: OpenAIMessage; escolhidas: Sugestao[] } | null {
  // Só faz sentido pra quem JÁ tem cadastro e esta é a primeira troca real
  // da conversa (historico vazio) — exatamente o momento em que a pessoa
  // responde a mensagem de boas-vindas pela primeira vez.
  if (!produtor.id || historico.length > 0) return null;
  // Pedido do Matheus (2026-10-15): a primeira resposta mostra TRÊS caminhos concretos e contextuais
  // (antes era um "seu plano cobre muito mais, são mais de 10 funcionalidades" genérico).
  const escolhidas = escolherSugestoes({ produtor, historico, texto, max: 3 });
  if (escolhidas.length === 0) return null;
  return {
    nota: { role: "system", content: notaDeSugestoes(escolhidas, "primeira_resposta") },
    escolhidas,
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
// 3ª rodada (bateria adversarial de 20, mesmo dia): "Eu entrego minha
// produção pra cooperativa local" (relação comercial bem real) não casava
// em nada — faltava entreg\w*/cooperativ\w*. Também não cobria praga/
// doença na lavoura como motivo de preocupação (só cobria a palavra "medo"
// solta, não a causa agrícola em si).
const SINAL_FATO_DURAVEL =
  /\b(medo|com\s+medo|receios?|preocupad[ao]|preocupa[çc][ãa]o|perdi|pretendo|penso\s+em|pensando\s+em|planejo|diversificar|vend\w*|compr\w*|forneced\w*|entreg\w*|cooperativ\w*|armazen\w*|trocar\s+de|mudar\s+de|praga|ferrugem|doenç\w*|doenc\w*)\b/i;

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
      // Fonte mensal (IEA-SP): a "data" a citar é o mês ("junho/2026"), não o dia 1 gravado no banco.
      const linha = parsed?.precos?.[0];
      const data =
        typeof linha?.periodo_referencia === "string"
          ? linha.periodo_referencia
          : linha?.data_referencia;
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
/** Todas as médias de praças devolvidas por buscar_preco neste turno (uma por produto consultado). */
function extrairMediasDasPracas(messages: OpenAIMessage[]): number[] {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  const medias: number[] = [];
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco") continue;
    try {
      const v = JSON.parse(m.content ?? "{}")?.preco_medio_regioes;
      if (typeof v === "number") medias.push(v);
    } catch {
      /* ignora */
    }
  }
  return medias;
}

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
      if (r["disponivel_no_plano"] === false) return { disponivelNoPlano: false };
      if (r["encontrado"] === true) {
        return {
          disponivelNoPlano: true,
          encontrado: true,
          totalPresenciais:
            typeof r["total_presenciais_na_regiao"] === "number"
              ? r["total_presenciais_na_regiao"]
              : 0,
          totalVirtuais:
            typeof r["total_virtuais_em_destaque"] === "number"
              ? r["total_virtuais_em_destaque"]
              : 0,
        };
      }
      return { disponivelNoPlano: true, encontrado: false };
    } catch {
      // resultado malformado não derruba a resposta — ignora.
    }
  }
  return null;
}

// buscar_preco_insumo devolveu "fora do plano" neste turno (Bronze): ver tirarNegativaDeInsumoParaBronze.
function insumoForaDoPlano(messages: OpenAIMessage[]): boolean {
  const nomePorToolCallId = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) nomePorToolCallId.set(tc.id, tc.function.name);
    }
  }
  for (const m of messages) {
    if (m.role !== "tool" || !m.tool_call_id) continue;
    if (nomePorToolCallId.get(m.tool_call_id) !== "buscar_preco_insumo") continue;
    try {
      if (
        (JSON.parse(m.content ?? "{}") as Record<string, unknown>)["disponivel_no_plano"] === false
      )
        return true;
    } catch {
      // resultado malformado não derruba a resposta.
    }
  }
  return false;
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
  "Não consegui confirmar esse dado com segurança agora, e prefiro não chutar. Pode me perguntar de outro jeito, ou me dizer a cultura e o estado que eu busco de novo na fonte?";

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

// Achado real auditando conversas (2026-10-12): produtor pediu áudio 12
// vezes seguidas, de formas diferentes ("manda áudio", "só falo pelo
// áudio", "escrito eu não enxergo não meu irmão" — sinal de possível
// dificuldade de leitura/visão), e o bot só repetiu "não consigo enviar
// áudio" em palavras diferentes, nunca escalou pra humano. A pessoa foi
// embora sem resolver nada. Igual ao padrão de cobrança acima: detecta
// quando o produtor insiste num pedido que o bot genuinamente não
// consegue atender (hoje só cobre áudio, que é uma limitação real e
// permanente, não um bug) depois de já ter sido recusado — na 3ª
// insistência (2 recusas já no histórico recente), para de repetir a
// mesma explicação e escala de vez, com uma resposta pronta por código
// (não deixa o modelo decidir, porque é exatamente isso que já falhou
// 12 vezes seguidas).
const PADRAO_PEDIDO_AUDIO =
  /manda\w*\s+(um\s+)?[áa]udio|s[óo]\s+fal[oe]\s+(por|pelo)\s+[áa]udio|n[ãa]o\s+(sei|consigo)\s+ler|escrito\s+(eu\s+)?n[ãa]o\s+(enxergo|sei)/i;
const PADRAO_RECUSA_AUDIO =
  /n[ãa]o\s+consigo\s+(enviar|mandar)\s+[áa]udio|s[óo]\s+posso\s+responder\s+por\s+texto|n[ãa]o\s+tenho\s+como\s+mandar\s+[áa]udio/i;

function produtorInsisteEmPedidoSemSolucao(texto: string, historico: HistoricoLinha[]): boolean {
  if (!PADRAO_PEDIDO_AUDIO.test(texto)) return false;
  const recusasRecentes = historico
    .slice(-10)
    .filter((h) => h.role === "assistant" && PADRAO_RECUSA_AUDIO.test(h.conteudo)).length;
  return recusasRecentes >= 2;
}

const RESPOSTA_ESCALAR_PEDIDO_SEM_SOLUCAO =
  "Percebi que isso é importante pra você e eu não tenho como resolver por aqui (só converso por texto mesmo, sem jeito de mudar). Vou chamar alguém da nossa equipe pra te ajudar direito, só um instante.";

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

// Achado real em produção (2026-10-12, print do Matheus): produtor novo
// (cadastro de 2 dias) perguntou sobre chuva, o bot caiu direto no
// FALLBACK_DURO ("não consegui pensar numa resposta"), e ele nunca mais
// mandou mensagem nenhuma — perdido, sem nenhuma segunda chance. Reproduzi
// a mesma pergunta 10/10 vezes com sucesso, então não era bug de lógica —
// era uma falha passageira (429/5xx da OpenAI, bem comum em qualquer
// integração) que não tinha NENHUM retry: um único erro transitório já
// derrubava a resposta inteira pro produtor. "Isso não pode ocorrer" —
// agora tenta de novo (2x, com um respiro curto) antes de desistir, só
// pra erro que faz sentido tentar de novo (429/5xx/falha de rede) — erro
// de requisição malformada (4xx que não é 429) não repete, falharia igual.
const STATUS_TRANSITORIOS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_TENTATIVAS_OPENAI = 3;

async function chamarOpenAI(
  apiKey: string,
  messages: OpenAIMessage[],
  opts: { comTools: boolean; signal: AbortSignal; forcarTool?: string | undefined },
) {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    response_format: RESPONSE_FORMAT,
    temperature: 0.5,
  };
  if (opts.comTools) {
    body["tools"] = TOOLS;
    body["tool_choice"] = opts.forcarTool
      ? { type: "function", function: { name: opts.forcarTool } }
      : "auto";
    body["parallel_tool_calls"] = !opts.forcarTool;
  }

  // Achado real testando o retry antes de publicar: o throw pro status não
  // transitório (ex: 400) caía DENTRO do mesmo try/catch que trata falha de
  // rede — o catch pegava esse throw também e tentava de novo do mesmo
  // jeito, tornando a trava "só repete erro transitório" inútil na prática
  // (um 400 real repetiria 3x à toa). Por isso o fetch fica isolado no seu
  // próprio try/catch (só falha de rede entra ali); a decisão por status
  // HTTP acontece DEPOIS, fora de qualquer catch, pra um throw por status
  // não transitório sair direto do loop, sem ser recapturado.
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_OPENAI; tentativa++) {
    if (tentativa > 0) {
      await new Promise((resolve) => setTimeout(resolve, 600 * tentativa));
    }
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (err) {
      // AbortError (timeout do próprio agente) não deve tentar de novo —
      // já estourou o orçamento de tempo da resposta inteira.
      if (err instanceof Error && err.name === "AbortError") throw err;
      if (tentativa < MAX_TENTATIVAS_OPENAI - 1) {
        ultimoErro = err;
        continue;
      }
      throw err;
    }
    if (res.ok) return res.json();
    const texto = await res.text();
    if (STATUS_TRANSITORIOS.has(res.status) && tentativa < MAX_TENTATIVAS_OPENAI - 1) {
      ultimoErro = new Error(`OpenAI respondeu ${res.status}: ${texto}`);
      continue;
    }
    throw new Error(`OpenAI respondeu ${res.status}: ${texto}`);
  }
  throw ultimoErro;
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
    // Já abriu uma cobrança na Asaas e não pagou: manda o link dela (um toque até o Pix), sem login/CPF de novo.
    const fatura = await buscarFaturaParaPagar(supabase, produtorId);
    if (fatura) return { ...base, resposta: respostaComFatura(fatura), precisa_humano: false };
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

export async function responderPedidoDeAssinatura(
  supabase: SupabaseClient,
  produtorId: string,
): Promise<RespostaAgente | null> {
  const base = { cadastro_criado: false, convite_dispensado: true };
  try {
    const tipo = await tipoDeAcesso(supabase, produtorId);
    if (tipo === "sem_cadastro") return null;
    if (tipo === "propria") {
      return { ...base, resposta: respostaAssinarComLoginProprio(), precisa_humano: false };
    }
    const r = await gerarLinkDeAcesso(supabase, produtorId, "assinar");
    if (r.sucesso) {
      return { ...base, resposta: respostaLinkDeAssinatura(r.link), precisa_humano: false };
    }
    if (r.motivo === "tem_login_proprio") {
      return { ...base, resposta: respostaAssinarComLoginProprio(), precisa_humano: false };
    }
    return { ...base, resposta: RESPOSTA_FALHA_AO_GERAR_LINK, precisa_humano: true };
  } catch (err) {
    console.error("Erro ao gerar link de assinatura:", err);
    return { ...base, resposta: RESPOSTA_FALHA_AO_GERAR_LINK, precisa_humano: true };
  }
}

async function runAgentBase(input: {
  telefone: string;
  texto: string;
  historico: HistoricoLinha[];
  produtor: ProdutorContexto;
  supabase: SupabaseClient;
  apiKey: string;
  signal: AbortSignal;
  /** Foto ou PDF que o n8n baixou do WhatsApp: vira estudo de proposta, sem passar pelo modelo conversacional. */
  midia?: MidiaRecebida | undefined;
  /** Nome do perfil do WhatsApp (vem do n8n): usado para cumprimentar e para completar cadastro sem nome. */
  nomeContato?: string | null | undefined;
}): Promise<RespostaAgente> {
  const { telefone, texto, supabase, apiKey, signal } = input;
  // Nome para a conversa: o do cadastro quando é de pessoa; senão o do perfil do WhatsApp, limpo de
  // emoji ("😍LEIDE E JANDER🥰" vira "Leide E Jander"). Cadastro sem nome útil ("Produtor") recebe o
  // nome do perfil, para a cobrança e as saudações deixarem de dizer "Produtor". Nunca sobrescreve
  // um nome que a própria pessoa digitou.
  const nomeResolvido = resolverNome(input.produtor.nome, input.nomeContato ?? null);
  const produtor = { ...input.produtor, nome: nomeResolvido.nome };
  if (nomeResolvido.gravar && produtor.id) {
    await supabase
      .from("produtores")
      .update({ nome: nomeResolvido.nome })
      .eq("id", produtor.id)
      .then(
        () => undefined,
        () => undefined,
      );
  }
  // O estudo de proposta guardado na conversa sai do histórico antes de tudo: o resto do
  // agente (e o modelo) só enxerga a conversa de verdade; o estudo vira contexto à parte.
  const { historico, estudo: estudoRecente } = separarEstudoDoHistorico(input.historico);

  // Número de funcionário cadastrado pelo dono (plano Prata): anota gasto, plantio e colheita na fazenda do dono, com
  // regras próprias (ver funcionario.ts). Só entra aqui quem NÃO é produtor cadastrado.
  if (!produtor.id) {
    const funcionario = await acharFuncionario(supabase, telefone);
    if (funcionario) {
      return responderFuncionario({
        supabase,
        apiKey,
        signal,
        telefone,
        texto,
        historico,
        funcionario,
        temMidia: !!input.midia,
      });
    }
  }

  // Foto/PDF vem ANTES de qualquer regra de texto: a legenda ("segue a foto da
  // proposta") não pode cair nas respostas prontas de "você lê foto?". A leitura
  // e o estudo são feitos por código (ver estudoDeProposta.ts).
  if (input.midia) {
    return responderMidia({
      telefone,
      texto,
      produtor,
      midia: input.midia,
      supabase,
      apiKey,
      signal,
    });
  }

  // Botão "Ver as novidades" do comunicado: resposta pronta por código, igual pra
  // todo mundo e sem gastar chamada ao modelo.
  if (ehPedidoDeNovidades(texto)) {
    return {
      resposta: respostaNovidades(),
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

  // Perguntas sobre o próprio produto (novidades, o que faz, áudio, foto, nota
  // fiscal) por código: o modelo errava justamente estas (ver respostasDeProduto.ts).
  const deProduto = respostaDeProduto(texto);
  if (deProduto) {
    return {
      resposta: deProduto.resposta,
      precisa_humano: deProduto.precisa_humano,
      cadastro_criado: false,
      convite_dispensado: false,
    };
  }

  // "Não quero mais esses avisos" (rodapé do template de novidades): vale para qualquer pessoa, cliente ou não. Para o
  // cliente desliga a mensagem proativa e entra na lista de opt-out de marketing (novidades, reengajamento, reativação);
  // os alertas e lembretes que ele mesmo configurou seguem (são utilidade, não marketing). Decidido por código.
  if (ehPedidoDePararAvisos(texto)) {
    const numero = normalizarWhatsapp(telefone);
    const { error: erroOptout } = await supabase
      .from("whatsapp_optout")
      .upsert({ whatsapp: numero, origem: "bot" }, { onConflict: "whatsapp" });
    if (produtor.id) {
      await supabase
        .from("produtores")
        .update({ mensagem_proativa_ativa: false })
        .eq("id", produtor.id);
    }
    if (erroOptout) console.error("Erro ao registrar opt-out (parar avisos):", erroOptout);
    return {
      resposta: erroOptout
        ? "Recebi seu pedido pra parar de receber esses avisos. Vou pedir pra nossa equipe confirmar isso pra você."
        : RESPOSTA_PAROU_AVISOS,
      precisa_humano: !!erroOptout,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

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

  // Pedido de ligação / de falar com uma pessoa: SEMPRE avisa a equipe, mesmo com o teste vencido
  // (é cliente quente). Decidido por código: o modelo não marcava precisa_humano (achado 2026-10-14).
  const respostasRecentes = [...historico]
    .filter((h) => h.role === "assistant")
    .sort((a, b) => b.ordem - a.ordem)
    .slice(0, 8);
  const aguardandoHorario = !!respostasRecentes[0]?.conteudo.includes(MARCADOR_DE_CONTATO);
  if (ehPedidoDeContatoHumano(texto) || (aguardandoHorario && ehDetalheDeHorario(texto))) {
    const avisosAnteriores = respostasRecentes.filter((h) =>
      h.conteudo.includes(MARCADOR_DE_CONTATO),
    ).length;
    const r = respostaDePedidoDeContato(produtor.nome, avisosAnteriores);
    return {
      resposta: r.resposta,
      precisa_humano: r.precisa_humano,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

  // Pedidos que o modelo errava na auditoria de 2026-10-16 e que têm resposta certa por código (ver
  // respostasComDados.ts): cidade do produtor, listar/cancelar alertas, planos, conversão de unidade e
  // opinião de investimento.
  {
    const pronta = (
      r: { resposta: string; precisa_humano: boolean; convite_dispensado: boolean } | null,
    ) =>
      r
        ? {
            resposta: r.resposta,
            precisa_humano: r.precisa_humano,
            cadastro_criado: false,
            convite_dispensado: r.convite_dispensado,
          }
        : null;
    const porCodigo =
      pronta(await responderCidadeDeclarada(supabase, texto, produtor)) ??
      pronta(await responderCoberturaDoProduto(supabase, texto, produtor.uf)) ??
      (produtor.id && ehPedidoDeListarAlertas(texto)
        ? pronta(await responderListaDeAlertas(supabase, produtor))
        : null) ??
      (ehPedidoDeCancelarAlerta(texto) ? pronta(respostaDeCancelarAlerta(produtor)) : null) ??
      pronta(perguntaDeConfirmarAlertaDeClima(texto, produtor, historico)) ??
      (produtor.id && ehPedidoDeAlertaSemTipo(texto, historico)
        ? pronta(respostaDeAlertaSemTipo())
        : null) ??
      (ehPerguntaDePlanos(texto) || (ehPerguntaVagaDePreco(texto) && conversaEraDePlanos(historico))
        ? pronta(await responderPlanos(supabase, produtor))
        : null) ??
      (ehPerguntaVagaDePreco(texto) ? pronta(respostaDePrecoSemAssunto()) : null) ??
      pronta(responderConversaoDeUnidade(texto)) ??
      (ehPedidoDeOpiniaoDeInvestimento(texto) ? pronta(respostaDeInvestimento()) : null) ??
      (ehPedidoDeExcluirDados(texto) ? pronta(respostaDeExcluirDados()) : null) ??
      (ehPerguntaDePagamento(texto) ? pronta(respostaDePagamento()) : null) ??
      (ehPedidoDeLinkDoSite(texto) ? pronta(respostaDeLinkDoSite(produtor)) : null) ??
      (ehPerguntaDeChuvaEmMm(texto) ? pronta(respostaDeChuvaEmMm()) : null) ??
      (ehPerguntaAgronomica(texto) ? pronta(respostaAgronomica()) : null) ??
      (produtor.id && ehPerguntaDeSituacaoDaConta(texto)
        ? pronta(await responderSituacaoDaConta(supabase, produtor))
        : null) ??
      (produtor.id && ehPedidoDeTrocarCultura(texto) ? pronta(respostaDeTrocarCultura()) : null) ??
      (produtor.id ? pronta(responderAcenoSolto(texto, historico)) : null);
    if (porCodigo) return porCodigo;
  }

  // Quem representa uma cooperativa ou corretora: o cadastro dela é pelo site (painel da equipe),
  // nunca vira "produtor" por aqui. Vale em qualquer ponto da conversa, antes do cadastro por código.
  if (ehInteresseDeCooperativa(texto)) {
    const r = respostaDeCooperativa(ultimaFoiDeCooperativa(historico));
    return {
      resposta: r.resposta,
      precisa_humano: r.precisa_humano,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

  // "E se eu não gostar? Vai me cobrar? Posso cancelar?" de quem ainda não é cliente: resposta pronta (só fatos
  // documentados) e convite para começar. Antes o modelo respondia com preço de cultura.
  if (!produtor.id && ehPerguntaDeCondicoes(texto)) {
    return {
      resposta: respostaDeCondicoes(true),
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

  // Cadastro pelo WhatsApp conduzido por código (uma pergunta por vez, menu numerado, "sim" aceito,
  // sem repetir a mesma pergunta). Achado 2026-10-15: dois leads do anúncio ficaram presos num
  // ciclo de "Sim" porque o modelo repetia a pergunta de cultura e estado.
  if (!produtor.id) {
    const decisao = decidirCadastro({ texto, historico });
    if (decisao?.tipo === "responder") {
      return {
        resposta: decisao.resposta,
        precisa_humano: decisao.precisa_humano,
        cadastro_criado: false,
        convite_dispensado: true,
      };
    }
    if (decisao?.tipo === "criar") {
      const r = await criarContaTeste(
        supabase,
        { uf: decisao.uf, cultura_principal: decisao.cultura },
        {
          telefone,
          texto,
          produtor: { nome: produtor.nome, user_id: null },
          historico,
          culturaVemDoProdutor: true,
        },
      );
      if (r.sucesso) {
        // Test drive de cara: dado real de hoje da cultura/estado dele (preço, porto, sinal de venda,
        // clima). Sem nenhum dado real, cai na confirmação simples de sempre.
        const comTesteDrive = await montarCadastroComTesteDrive(supabase, {
          nome: produtor.nome,
          uf: decisao.uf,
          cultura: decisao.cultura,
        }).catch(() => null);
        return {
          resposta:
            comTesteDrive ??
            respostaCadastroCriado({
              nome: produtor.nome,
              uf: decisao.uf,
              cultura: decisao.cultura,
            }),
          precisa_humano: false,
          cadastro_criado: true,
          convite_dispensado: true,
        };
      }
      if (r.motivo === "ja_tem_conta") {
        return {
          resposta:
            "Esse WhatsApp já tem cadastro aqui. Pode pedir o que quiser por aqui, por exemplo o preço da sua cultura hoje.",
          precisa_humano: false,
          cadastro_criado: false,
          convite_dispensado: true,
        };
      }
      return {
        resposta:
          "Tive um problema pra criar seu cadastro agora. Já avisei a nossa equipe e alguém te ajuda aqui no WhatsApp em instantes.",
        precisa_humano: true,
        cadastro_criado: false,
        convite_dispensado: true,
      };
    }
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
  // "Quero assinar/pagar" vem antes do pedido de acesso e do paywall: quem está
  // com o teste vencido precisa do link de pagamento num passo só.
  if (produtor.id && classificarPedidoDeAssinatura(texto)) {
    const respostaAssinatura = await responderPedidoDeAssinatura(supabase, produtor.id);
    if (respostaAssinatura) return respostaAssinatura;
  }

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
      const bloqueio = mensagemBloqueioAcesso(acesso.comLogin, acesso.motivo);
      return {
        resposta: jaAvisouDoBloqueio(historico, bloqueio) ? MENSAGEM_BLOQUEIO_CURTA : bloqueio,
        // Acesso cortado mas continua escrevendo: lead quente, avisa o Matheus (1x por dia por pessoa).
        precisa_humano: deveAvisarEquipeDeLeadBloqueado(historico),
        cadastro_criado: false,
        convite_dispensado: false,
      };
    }
  }

  // Estado escrito errado ("como ta gogoias?") por cliente cadastrado: o bot explica que não reconheceu e pergunta
  // "você quis dizer?" em vez de assumir cultura e estado (achado de 2026-10-21; ver cadastroConversa.ts).
  if (produtor.id) {
    const erroDeEstado = estadoComErroDeDigitacao(texto);
    if (erroDeEstado) {
      return {
        resposta: respostaEstadoComErro(texto, erroDeEstado.escrito, erroDeEstado.sugeridas),
        precisa_humano: false,
        cadastro_criado: false,
        convite_dispensado: true,
      };
    }
  }

  // Objeção "não uso todo dia" de cliente cadastrado: resposta fixa (ver avisoAutomatico.ts).
  // Quem pede para CANCELAR ("quero cancelar, não uso muito") segue o fluxo de cancelamento: a resposta fixa não traz o
  // caminho para cancelar e ninguém pode ficar sem ele.
  if (produtor.id && ehObjecaoDePoucoUso(texto) && !/cancel/i.test(texto)) {
    return {
      resposta: RESPOSTA_POUCO_USO,
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

  // Ajuda para quem está perdido, por código (ver ajudaDoProdutor.ts): resposta ao menu 1-5, condições do teste e do
  // cancelamento, dúvida de valor ("como vou ter lucro") e confusão ("não entendi nada"). Se a pessoa já viu a ajuda e
  // segue perdida, chama alguém da equipe em vez de repetir.
  if (produtor.id) {
    const botDesc = [...historico]
      .filter((h) => h.role === "assistant")
      .sort((a, b) => b.ordem - a.ordem)
      .map((h) => h.conteudo);
    const culturaDele = produtor.cultura_principal
      ? normalizarCultura(produtor.cultura_principal)
      : null;
    const pronta = (resposta: string, precisaHumano = false): RespostaAgente => ({
      resposta,
      precisa_humano: precisaHumano,
      cadastro_criado: false,
      convite_dispensado: true,
    });
    const aoMenu = respostaAoMenu(texto, botDesc[0], culturaDele);
    if (aoMenu?.tipo === "responder") return pronta(aoMenu.resposta);
    if (aoMenu?.tipo === "reescrever") return runAgentBase({ ...input, texto: aoMenu.texto });
    if (ehPerguntaDeCondicoes(texto)) return pronta(respostaDeCondicoes());
    const duvidaDeValor = ehDuvidaDeValor(texto);
    if (duvidaDeValor || ehConfusao(texto)) {
      if (jaMostrouAjudaRecente(botDesc)) return pronta(RESPOSTA_CHAMAR_PESSOA, true);
      return duvidaDeValor
        ? pronta(respostaDuvidaDeValor(culturaDele), true)
        : pronta(respostaMenuDeAjuda(culturaDele));
    }
  }

  // A pessoa respondeu "quantas sacas pretende vender?" (pergunta da resposta de valor): conta por código, com o preço do banco.
  if (produtor.id) {
    const ultimaDoBot = [...historico]
      .sort((a, b) => b.ordem - a.ordem)
      .find((h) => h.role === "assistant")?.conteudo;
    if (respondeuAQuantidade(texto, ultimaDoBot)) {
      const valor = await responderValorDaVenda(supabase, produtor, texto).catch(() => null);
      if (valor) {
        return {
          resposta: valor,
          precisa_humano: false,
          cadastro_criado: false,
          convite_dispensado: true,
        };
      }
    }
  }

  // Caderno da fazenda: tudo que tem resposta certa por código é respondido ANTES do modelo, com os números do
  // banco (resumo, desfazer, a pagar e a receber, baixa de "recebi/paguei", custo por saca, área, talhão, resposta
  // à nota lida da foto e fechamento de proposta). Lançar gasto, venda ou plantio passa pelo modelo, que só
  // preenche os campos (ver tools/fazenda.ts).
  if (produtor.id) {
    const pronta = (resposta: string): RespostaAgente => ({
      resposta,
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    });
    // 1) resposta ao rascunho de nota lida por foto ("sim", "não", "o valor é 12.000")
    const doRascunho = await tratarRespostaAoRascunho(supabase, produtor, texto, telefone);
    if (doRascunho) return pronta(doRascunho);
    // 2) "fechei com o comprador B" depois de um estudo de proposta
    const fechamento = await tratarFechamentoDeProposta(
      supabase,
      produtor,
      texto,
      historico,
      estudoRecente,
      telefone,
    );
    if (fechamento) return pronta(fechamento);
    // 3) resposta à pergunta "Quantos hectares de soja você planta?"
    const daArea = await tratarRespostaDeArea(supabase, produtor, texto, historico);
    if (daArea) return pronta(daArea);
    // 4) "recebi" / "paguei" dá baixa no que estava a receber / a pagar
    const baixa = await tratarBaixa(supabase, produtor, texto, historico);
    if (baixa) return pronta(baixa);
    // 5) pedidos de leitura
    if (ehPedidoDePendencias(texto)) {
      return pronta(textoDePendencias(await lerPendentes(supabase, produtor.id)));
    }
    if (ehPedidoDeEstoque(texto)) {
      return pronta(await textoDoEstoque(supabase, produtor));
    }
    if (
      margemAlvoDoTexto(texto) !== null ||
      acaoDoAvisoDeMargem(texto) ||
      ehPedidoDePrecoAlvo(texto)
    ) {
      const m = await tratarMetaDeMargem(supabase, produtor, texto);
      if (m) return pronta(m);
    }
    if (acaoDeOrcamento(texto)) {
      const o = await tratarOrcamento(supabase, produtor, texto);
      if (o) return pronta(o);
    }
    if (ehPedidoDeCusto(texto)) {
      const c = await tratarPedidoDeCusto(supabase, produtor, texto);
      if (c) return pronta(c);
    }
    const daFrase = await tratarAreaDeFrase(supabase, produtor, texto);
    if (daFrase) return pronta(daFrase);
    const gastoPorTalhao = pedidoDeGastoPorTalhao(texto);
    const gastoPorCategoria = gastoPorTalhao ? null : pedidoDeGastoPorCategoria(texto);
    const periodoDoResumo =
      gastoPorTalhao || gastoPorCategoria ? null : periodoDoPedidoDeResumo(texto);
    if (gastoPorTalhao) {
      const r = await resumoDaFazenda(
        supabase,
        { periodo: gastoPorTalhao.periodo, talhao: gastoPorTalhao.talhao },
        produtor,
      );
      if ("texto" in r) return pronta(r.texto);
    } else if (gastoPorCategoria) {
      const r = await resumoDaFazenda(
        supabase,
        {
          periodo: gastoPorCategoria.periodo,
          categoria: gastoPorCategoria.categoria ?? gastoPorCategoria.busca,
        },
        produtor,
      );
      if ("texto" in r) return pronta(r.texto);
    } else if (periodoDoResumo) {
      const r = await resumoDaFazenda(supabase, { periodo: periodoDoResumo }, produtor);
      if ("texto" in r) return pronta(r.texto);
    } else if (ehPedidoDeDesfazerRegistro(texto, historico)) {
      const r = await desfazerUltimoRegistro(supabase, produtor);
      return pronta(r.texto);
    }
  }

  // Botão "Quero ver meu preço agora" do modelo de boas-vindas do cadastro pelo site: test drive por
  // código (preço, porto, sinal de venda e clima de hoje) em vez de deixar o modelo improvisar.
  if (produtor.id && ehPedidoDeTesteDrive(texto)) {
    return {
      resposta: await montarTesteDriveDoBotao(supabase, {
        nome: produtor.nome,
        uf: produtor.uf,
        cultura_principal: produtor.cultura_principal,
      }),
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

  // Produtor insistindo num pedido que o bot genuinamente não resolve (hoje
  // só áudio) depois de já ter sido recusado: para de repetir a mesma
  // explicação e escala pra humano de vez, com resposta pronta por código —
  // ver respostaTratouPragaComoAlertaValido e os outros guards pro mesmo
  // raciocínio (não dá pra confiar no modelo pra variar/escalar sozinho
  // depois de já ter "tentado" 12 vezes, achado real auditando conversas).
  if (produtorInsisteEmPedidoSemSolucao(texto, historico)) {
    return {
      resposta: RESPOSTA_ESCALAR_PEDIDO_SEM_SOLUCAO,
      precisa_humano: true,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }

  // Depois de um estudo, o produtor questiona e muda valores: explicar a conta é por código
  // (sem modelo) e mudar valor passa pela ferramenta que refaz o estudo guardado.
  if (estudoRecente && ehPedidoDeExplicacao(texto, estudoRecente)) {
    return {
      resposta: explicarEstudo(estudoRecente, texto),
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }
  // O estudo já saiu da memória (passou de 6 horas ou é de antes do recurso): diz isso com clareza
  // em vez de deixar o modelo improvisar uma conta em cima de um texto que não vê por inteiro.
  if (!estudoRecente) {
    const ultimasDoBot = [...historico]
      .filter((h) => h.role === "assistant")
      .sort((a, b) => b.ordem - a.ordem)
      .slice(0, 3);
    const estudoVisivel = ultimasDoBot.some((h) =>
      /^(📄 \*Estudo|🔁 \*Estudo|🔎 \*Como calculei)/.test(h.conteudo),
    );
    if (estudoVisivel && (ehPedidoDeExplicacao(texto) || ehMudancaNoEstudo(texto))) {
      return {
        resposta: SEM_ESTUDO_RECENTE,
        precisa_humano: false,
        cadastro_criado: false,
        convite_dispensado: true,
      };
    }
  }
  if (estudoRecente && ehCenarioSemNumero(texto)) {
    return {
      resposta: PEDIR_UM_NUMERO,
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }
  // Derivado (farelo, óleo, casca, torta) sem número de proposta: não temos esse preço, e o
  // modelo respondia com o da soja em grão rotulado como farelo. Resposta por código.
  if (mencionaDerivadoDeGrao(texto) && !temPrecoDeProposta(texto)) {
    return {
      resposta: RESPOSTA_DERIVADO_DE_GRAO,
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }
  const outraCultura = culturaMencionada(texto);
  const forcarRefazerEstudo =
    !!estudoRecente &&
    ehMudancaNoEstudo(texto) &&
    !(outraCultura && outraCultura !== normalizarCultura(estudoRecente.produto));

  // Proposta de preço contada em texto: decidida por código (ver propostas/gatilho.ts).
  // Sem valor, pergunta o valor sem passar pelo modelo (ele chegava a elogiar a
  // proposta sem saber o preço); com valor, a ferramenta de estudo é obrigatória.
  const ultimaDoBot = [...historico]
    .filter((h) => h.role === "assistant")
    .sort((a, b) => b.ordem - a.ordem)[0];
  const botPerguntouOValor =
    !!ultimaDoBot && ultimaDoBot.conteudo.includes("preciso do valor que o comprador ofereceu");
  const falouDeProposta = ehPropostaDePreco(texto);
  if (falouDeProposta && !temPrecoDeProposta(texto) && !estudoRecente) {
    return {
      resposta: PERGUNTA_DO_VALOR_DA_PROPOSTA,
      precisa_humano: false,
      cadastro_criado: false,
      convite_dispensado: true,
    };
  }
  const forcarEstudoDeProposta =
    (falouDeProposta && temPrecoDeProposta(texto)) ||
    (botPerguntouOValor && temPrecoDeProposta(texto));

  const notaNegativaDupla = notaDeNegativaDupla(texto);
  const contextoDoEstudoRecente = estudoRecente ? contextoDoEstudo(estudoRecente) : null;
  const notaRecusaCadastro = notaDeRecusaCadastro(texto);
  const notaAflicaoPessoal = notaDeAflicaoPessoal(texto);
  const notaAberturaDeAnuncio = notaDeAberturaDeAnuncio(texto);
  const primeiraResposta = notaDePrimeiraRespostaPosCadastro(produtor, historico, texto);
  const notaPrimeiraResposta = primeiraResposta?.nota ?? null;
  const sugestoesPrimeira = primeiraResposta?.escolhidas ?? [];
  // Quando é a primeira resposta pós-cadastro, a nota acima já cobre "mostre
  // valor" com mais força (2 funcionalidades, não 1) — não empilha com o
  // incentivo normal na mesma mensagem, senão vira uma lista grande demais
  // logo na primeira troca.
  // Lançamento no caderno da fazenda também não leva o convite "olha o que mais eu faço" na mesma mensagem: a
  // resposta é só a confirmação do que foi anotado (sem isso saía preço de soja colado na confirmação).
  const ehLancamentoDoCaderno =
    !!produtor.id &&
    (pareceLancamentoNoCaderno(texto) ||
      ehContinuacaoDeLancamento(texto, historico) ||
      ehRespostaDeVencimento(texto, historico));
  const incentivoEscolhido =
    notaPrimeiraResposta || ehLancamentoDoCaderno
      ? null
      : notaDeIncentivoAtivacao(produtor, historico, texto);
  const notaIncentivoAtivacao = incentivoEscolhido?.nota ?? null;
  const sugestoesEscolhidas = incentivoEscolhido?.escolhidas ?? [];
  const notaMemoriaPotencial = notaDeMemoriaPotencial(produtor, texto);
  // Caderno da fazenda: sem esta nota o modelo tratava "plantei milho dia 15" como pergunta de mercado e
  // respondia com preço (achado do teste de 2026-10-21). A decisão de que é um lançamento é por código.
  const notaCaderno: OpenAIMessage | null = ehLancamentoDoCaderno
    ? {
        role: "system",
        content:
          "Nota: essa mensagem é o produtor LANÇANDO no caderno da fazenda algo que JÁ aconteceu (gasto, venda, plantio ou colheita), ou respondendo o valor que você perguntou. Chame registrar_na_fazenda agora com o que ele disse e responda só com a confirmação da ferramenta. Se for gasto ou venda e NÃO tiver o valor, não chame: pergunte apenas 'Quanto foi?'. Se for dinheiro a pagar ou a receber, use tipo venda (a receber) ou gasto (a pagar), NUNCA nota; se NÃO tiver a data de vencimento, não chame: pergunte apenas 'Pra quando vence?'. Não responda com preço de mercado nem com outros assuntos.",
      }
    : null;
  // Memória entre conversas (não confundir com `historico`, que é só desta
  // conversa) — ver tools/memoria.ts. Só existe pra quem já tem cadastro.
  const memorias = produtor.id ? await buscarMemoriasProdutor(supabase, produtor.id) : [];
  const contextoMemoria = buildContextoMemoria(memorias);
  const messages: OpenAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContextoProdutor(produtor) },
    { role: "system", content: buildContextoDeData() },
    ...(contextoMemoria ? [{ role: "system" as const, content: contextoMemoria }] : []),
    ...(produtor.id ? [] : [{ role: "system" as const, content: buildRegrasCadastroAnonimo() }]),
    ...(produtor.id && !produtor.user_id
      ? [{ role: "system" as const, content: buildRegrasClienteSemLogin() }]
      : []),
    { role: "system", content: buildContextoPlanos() },
    { role: "system", content: buildContextoInstitucional() },
    { role: "system", content: buildContextoFuncionalidades() },
    ...(contextoDoEstudoRecente
      ? [{ role: "system" as const, content: contextoDoEstudoRecente }]
      : []),
    ...buildHistoryMessages(historico),
    ...(notaNegativaDupla ? [notaNegativaDupla] : []),
    ...(notaRecusaCadastro ? [notaRecusaCadastro] : []),
    ...(notaAflicaoPessoal ? [notaAflicaoPessoal] : []),
    ...(notaAberturaDeAnuncio ? [notaAberturaDeAnuncio] : []),
    ...(notaPrimeiraResposta ? [notaPrimeiraResposta] : []),
    ...(notaIncentivoAtivacao ? [notaIncentivoAtivacao] : []),
    ...(notaMemoriaPotencial ? [notaMemoriaPotencial] : []),
    ...(notaCaderno ? [notaCaderno] : []),
    { role: "user", content: texto },
  ];

  const ctx = { supabase, produtor, telefone, historico, texto, estudoSalvo: estudoRecente };
  // Sinaliza pro n8n que a conta acabou de ser criada NESTA mensagem, pra ele
  // não emendar o convite de cadastro (que só faz sentido pra quem ainda não
  // tem conta) logo depois de "seu cadastro foi criado com sucesso" — sem
  // isso o convite aparecia de forma redundante/confusa após um cadastro OK.
  let cadastroCriado = false;
  let contaCriada: { uf: string; cultura: string } | null = null;
  let tentativasCorrigirValor = 0;
  // O modelo às vezes escreve "Anotei no caderno" sem chamar a ferramenta (visto ao vivo: ~metade das vezes em 'gastei dois mil de diesel').
  // Em vez de desistir, tenta de novo uma vez, obrigando a chamada de registrar_na_fazenda.
  let refezRegistro = false;
  let forcarRegistroNaProximaRodada = false;
  let tentativasForcarIncentivo = 0;
  let tentativasForcarPrimeiraResposta = 0;
  let tentativasCorrigirAlertaCambio = 0;
  let tentativasCorrigirValorCambio = 0;
  let tentativasCorrigirHoraResumo = 0;
  let tentativasCorrigirAlertaPraga = 0;
  let tentativasCorrigirProdutoDoPreco = 0;

  // Fecha a resposta: aplica as redes de segurança de texto, troca a resposta
  // do modelo pela confirmação escrita por código quando o cadastro acabou
  // de ser criado, e barra valor em R$ que nenhuma fonte desta conversa
  // sustenta. Devolve null quando a resposta precisa de mais uma rodada
  // (pedido de correção de valor inventado).
  const fechar = async (
    parsed: { resposta: string; precisa_humano: boolean },
    conteudoBruto: string | null | undefined,
    podeCorrigir: boolean,
  ): Promise<RespostaAgente | null> => {
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

    // "Anotei no caderno" sem nenhum lançamento gravado nesta rodada: promessa vazia. Troca pela instrução de como lançar.
    if (afirmaTerAnotadoNoCaderno(parsed.resposta)) {
      const nomePorId = new Map<string, string>();
      for (const m of messages) {
        if (m.role === "assistant" && m.tool_calls) {
          for (const tc of m.tool_calls) nomePorId.set(tc.id, tc.function.name);
        }
      }
      const gravou = messages.some(
        (m) =>
          m.role === "tool" &&
          !!m.tool_call_id &&
          nomePorId.get(m.tool_call_id) === "registrar_na_fazenda" &&
          /"sucesso":true/.test(m.content ?? ""),
      );
      if (!gravou && podeCorrigir && !refezRegistro && ehLancamentoDoCaderno) {
        refezRegistro = true;
        forcarRegistroNaProximaRodada = true;
        messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
        messages.push({
          role: "system",
          content:
            "Você escreveu que anotou, mas NÃO chamou registrar_na_fazenda: nada foi gravado. Chame a ferramenta agora, só com o que a MENSAGEM ATUAL do produtor diz (valor, descrição e data dela), sem reaproveitar lançamentos de mensagens anteriores.",
        });
        return null;
      }
      if (!gravou) {
        return {
          resposta:
            'Ainda não consegui anotar isso no caderno. Me diga o que foi e quanto, por exemplo: "gastei 3 mil de diesel" ou "vendi 200 sacas a 135".',
          precisa_humano: false,
          cadastro_criado: false,
          convite_dispensado: true,
        };
      }
    }

    const numerosPermitidos = coletarNumerosPermitidos(messages, texto, historico);
    const leite = extrairResultadoLeite(messages);
    const respostaBase = suavizarConselhoDeEspera(
      corrigirDirecaoDoAlerta(
        corrigirFimDeMes(
          corrigirCalendario(
            garantirOpcaoDeCidadeNoAlertaDeClima(
              tirarNegativaDeInsumoParaBronze(
                garantirMencaoLeilao(
                  garantirMencaoPainel(
                    garantirCanalDeTexto(
                      garantirCotacaoLeite(
                        garantirRelacaoLeiteMilho(
                          garantirMediaDasPracas(
                            garantirReferenciaMercado(
                              garantirParidade(
                                garantirRotaFrete(
                                  garantirDataDoPreco(
                                    removerMarkdownProibido(
                                      removerFechamentoGenerico(parsed.resposta),
                                    ),
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
                ),
                insumoForaDoPlano(messages),
              ),
            ),
          ),
        ),
        texto,
      ),
      texto,
    );

    const chamadasDePreco = messages.flatMap((m) =>
      m.role === "assistant" && m.tool_calls
        ? m.tool_calls.filter((tc) => tc.function.name === "buscar_preco")
        : [],
    );
    let ufDoPreco: string | null = produtor.uf;
    for (const tc of chamadasDePreco) {
      try {
        const u = JSON.parse(tc.function.arguments)?.uf;
        if (typeof u === "string" && u) ufDoPreco = u;
      } catch {
        /* argumento ilegível: fica com a UF do cadastro */
      }
    }
    const nomeUfDoPreco =
      ufs.find((u) => u.value === (ufDoPreco ?? "").toUpperCase())?.label ?? null;
    const resposta = await avisarCidadeSemCotacao(
      extrairMediasDasPracas(messages).reduce(
        (txt, media) => corrigirMediaAtribuidaACidade(txt, media, nomeUfDoPreco),
        respostaBase,
      ),
      texto,
      {
        uf: ufDoPreco,
        chamouPreco: chamadasDePreco.length > 0,
      },
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
    const estadosInvalidos = estadosNaoAutorizados(
      resposta,
      ufsAutorizadas(messages, texto, historico, produtor.uf),
    );
    if (
      naoAutorizados.length > 0 ||
      medidasInvalidas.length > 0 ||
      areaInvalida.length > 0 ||
      estadosInvalidos.length > 0
    ) {
      if (process.env["BOT_DEBUG_TOOLS"])
        console.error(
          "[valor-nao-autorizado]",
          naoAutorizados,
          medidasInvalidas,
          areaInvalida,
          estadosInvalidos,
          resposta.slice(0, 400),
        );
      // duas chances de se corrigir (a bateria de 2026-10-16 teve 2 respostas de 97 que caíram no recuo seguro)
      if (podeCorrigir && tentativasCorrigirValor < 2) {
        tentativasCorrigirValor++;
        const lista = [
          ...naoAutorizados.map((v) => `R$${v.toFixed(2).replace(".", ",")}`),
          ...medidasInvalidas.map((v) => String(v).replace(".", ",")),
          ...areaInvalida.map((v) => String(v).replace(".", ",")),
          ...estadosInvalidos,
        ].join(", ");
        messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
        messages.push({
          role: "system",
          content: `Correção obrigatória: sua resposta anterior citou ${lista}, que NÃO veio de nenhuma ferramenta consultada agora nem do que o produtor escreveu — é valor inventado ou copiado/ajustado de uma resposta anterior. Chame a ferramenta necessária de novo agora (ex: buscar_preco com a cultura e a UF do contexto) e responda usando SOMENTE os valores que ela retornar, sem reaproveitar nem ajustar números de mensagens anteriores. Se nenhuma ferramenta dá esse valor, não cite valor nenhum. Se o que foi citado é um ESTADO: quando a pergunta é onde existe dado de um produto, cite SOMENTE os estados de ufs_com_dado ou de referencia_mercado.outras_ufs que a ferramenta devolveu; nunca liste estados de memória (os maiores produtores).`,
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
      !respostaTemConvite(resposta, sugestoesEscolhidas)
    ) {
      tentativasForcarIncentivo++;
      messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
      messages.push({
        role: "system",
        content:
          "Sua resposta anterior não incluiu o convite obrigatório que a nota pediu (dois caminhos diferentes que o produtor pode pedir agora). Reescreva a MESMA resposta, mantendo os dados que você já deu, mas acrescente no final uma frase curta oferecendo esses dois caminhos, nas palavras da nota. Dessa vez não pode faltar.",
      });
      return null;
    }

    // Mesma rede de segurança, agora pra primeira resposta pós-cadastro —
    // é o momento mais importante de todos (ver notaDePrimeiraRespostaPosCadastro),
    // não dá pra deixar na mão do modelo seguir ou não sem checar.
    const MAX_TENTATIVAS_FORCAR_PRIMEIRA_RESPOSTA = 2;
    if (
      notaPrimeiraResposta &&
      podeCorrigir &&
      tentativasForcarPrimeiraResposta < MAX_TENTATIVAS_FORCAR_PRIMEIRA_RESPOSTA &&
      quantasOferecidas(resposta, sugestoesPrimeira) < Math.min(2, sugestoesPrimeira.length)
    ) {
      tentativasForcarPrimeiraResposta++;
      messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
      messages.push({
        role: "system",
        content:
          "Sua resposta anterior não mostrou as duas funcionalidades extras que a nota pediu (além da pergunta que ele fez). Reescreva a MESMA resposta, mantendo o dado real que você já deu, mas acrescente de 1 a 2 frases curtas citando especificamente as duas funcionalidades da nota — dessa vez não pode faltar.",
      });
      return null;
    }

    const MAX_TENTATIVAS_CORRIGIR_ALERTA_CAMBIO = 2;
    if (
      podeCorrigir &&
      tentativasCorrigirAlertaCambio < MAX_TENTATIVAS_CORRIGIR_ALERTA_CAMBIO &&
      respostaFugiuDeCambioParaCultura(resposta, texto, historico)
    ) {
      tentativasCorrigirAlertaCambio++;
      messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
      messages.push({
        role: "system",
        content:
          "Erro: o produtor pediu um alerta logo depois de perguntar sobre câmbio/dólar, e sua resposta propôs ou perguntou sobre uma cultura — isso está errado, ele não mencionou cultura nenhuma. O alerta que ele quer é de câmbio (criar_alerta_cambio), não de preço de cultura. Responda de novo perguntando/confirmando o alerta de câmbio, sem citar nenhuma cultura.",
      });
      return null;
    }

    const MAX_TENTATIVAS_CORRIGIR_VALOR_CAMBIO = 2;
    if (
      podeCorrigir &&
      tentativasCorrigirValorCambio < MAX_TENTATIVAS_CORRIGIR_VALOR_CAMBIO &&
      respostaInventouValorDeCambio(resposta, texto, historico)
    ) {
      tentativasCorrigirValorCambio++;
      messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
      messages.push({
        role: "system",
        content:
          "Erro: sua pergunta de confirmação do alerta de câmbio propôs um valor (a cotação atual do dólar) que o produtor nunca disse — ele só confirmou que quer o alerta, não deu nenhum número. Responda de novo perguntando direto 'A partir de qual valor?', sem propor nenhum número, nem a cotação de hoje.",
      });
      return null;
    }

    const MAX_TENTATIVAS_CORRIGIR_HORA_RESUMO = 2;
    if (
      podeCorrigir &&
      tentativasCorrigirHoraResumo < MAX_TENTATIVAS_CORRIGIR_HORA_RESUMO &&
      respostaInventouHoraDeResumo(resposta, texto, historico)
    ) {
      tentativasCorrigirHoraResumo++;
      messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
      messages.push({
        role: "system",
        content:
          "Erro: sua pergunta de confirmação do resumo diário propôs um horário que o produtor nunca disse (ou que nem é válido). Responda de novo perguntando direto 'Que horário você prefere?', sem propor nenhum horário.",
      });
      return null;
    }

    const MAX_TENTATIVAS_CORRIGIR_PRODUTO_DO_PRECO = 2;
    if (
      podeCorrigir &&
      tentativasCorrigirProdutoDoPreco < MAX_TENTATIVAS_CORRIGIR_PRODUTO_DO_PRECO
    ) {
      const consultados = messages.flatMap((m) =>
        m.role === "assistant" && m.tool_calls
          ? m.tool_calls
              .filter((tc) => tc.function.name === "buscar_preco")
              .map((tc) => {
                try {
                  return String(JSON.parse(tc.function.arguments)?.produto ?? "");
                } catch {
                  return "";
                }
              })
          : [],
      );
      const faltam = culturasNaoConsultadas(culturasPerguntadas(texto), consultados);
      if (consultados.length > 0 && faltam.length > 0 && /R\$/.test(resposta)) {
        tentativasCorrigirProdutoDoPreco++;
        messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
        messages.push({
          role: "system",
          content: `Erro: o produtor perguntou o preço de ${faltam.join(", ").toUpperCase()} (mesmo que tenha escrito com erro de digitação), mas buscar_preco só foi chamada com produto=${consultados.join(", ")}. O número que você escreveu é de OUTRA cultura. Chame buscar_preco de novo com o produto certo (e a UF dele) e responda só com esse resultado.`,
        });
        return null;
      }
    }

    const MAX_TENTATIVAS_CORRIGIR_ALERTA_PRAGA = 2;
    if (
      podeCorrigir &&
      tentativasCorrigirAlertaPraga < MAX_TENTATIVAS_CORRIGIR_ALERTA_PRAGA &&
      respostaTratouPragaComoAlertaValido(resposta, texto, historico)
    ) {
      tentativasCorrigirAlertaPraga++;
      messages.push({ role: "assistant", content: conteudoBruto ?? parsed.resposta });
      messages.push({
        role: "system",
        content:
          "Erro: o produtor pediu alerta de praga/doença (ferrugem, lagarta, mofo-branco etc), e isso NÃO é um dos 4 tipos reais de alerta (preço, câmbio, clima, leilão) — clima é só chuva forte/geada/seca prolongada/vento forte, nunca praga ou doença. Não peça UF nem mais detalhes como se fosse seguir criando. Responda de novo dizendo com uma frase curta que esse tipo de alerta ainda não existe hoje, sem propor nenhum dos 4 tipos reais no lugar a menos que ele peça.",
      });
      return null;
    }

    // Cliente cadastrado só pelo WhatsApp (sem login no site): nenhum link
    // de /dashboard serve pra ele — ver guardas.ts.
    const semLogin = !produtor.user_id;
    const correcaoPainel = semLogin
      ? corrigirLinkDePainelParaClienteSemLogin(resposta, texto, precisaEscalarPorCobranca(texto))
      : null;
    if (correcaoPainel) {
      return { ...correcaoPainel, cadastro_criado: cadastroCriado, convite_dispensado: true };
    }

    // Conta técnica (criada pelo formulário da landing, e-mail lead-...@safralume.app, senha que
    // ninguém sabe): tem user_id, então a guarda acima não vale, mas /dashboard também cai numa
    // tela de login que ela não passa. Visto ao vivo em 2026-10-20: "pôde mandar link" virou
    // https://safralume.com.br/dashboard e "Cancelar" virou .../dashboard/assinatura. Troca por
    // um link de acesso de uso único. Quem tem login próprio continua com a resposta do modelo.
    if (!semLogin && produtor.id && /safralume\.com\.br\/dashboard/i.test(resposta)) {
      try {
        if ((await tipoDeAcesso(supabase, produtor.id)) === "tecnica") {
          const r = await gerarLinkDeAcesso(supabase, produtor.id);
          if (r.sucesso) {
            const dica = /cancel/i.test(texto)
              ? "\n\nLá dentro, em Assinatura, você encontra o botão de cancelar. Se o motivo for pouco uso, dá para pausar a cobrança ali mesmo, sem perder o acesso."
              : "";
            return {
              resposta: respostaLinkDeAcesso(r.link) + dica,
              precisa_humano: false,
              cadastro_criado: cadastroCriado,
              convite_dispensado: true,
            };
          }
        }
      } catch (err) {
        console.error("Erro ao trocar link de painel por link de acesso:", err);
      }
    }

    const avisoAutomatico = await avisoAutomaticoSeCabe(supabase, produtor.id, resposta, historico);
    return {
      resposta: avisoAutomatico ? `${resposta}\n\n${avisoAutomatico}` : resposta,
      precisa_humano:
        parsed.precisa_humano || precisaEscalarPorCobranca(texto) || !!notaAflicaoPessoal,
      cadastro_criado: cadastroCriado,
      convite_dispensado: cadastroCriado || conversaFalaDeCadastro(resposta, historico),
    };
  };

  try {
    for (let rodada = 0; rodada < MAX_TOOL_ROUNDS; rodada++) {
      const json = await chamarOpenAI(apiKey, messages, {
        comTools: true,
        signal,
        forcarTool: forcarRegistroNaProximaRodada
          ? ((forcarRegistroNaProximaRodada = false), "registrar_na_fazenda")
          : rodada === 0
            ? forcarRefazerEstudo
              ? "refazer_estudo"
              : forcarEstudoDeProposta
                ? "comparar_propostas"
                : undefined
            : undefined,
      });
      const escolha = json.choices?.[0];
      const mensagem = escolha?.message;

      // Com tool_choice forçado a API devolve finish_reason "stop" mesmo com a chamada; vale a presença das chamadas.
      if (mensagem?.tool_calls?.length) {
        messages.push({
          role: "assistant",
          content: mensagem.content ?? null,
          tool_calls: mensagem.tool_calls,
        });

        // O modelo às vezes manda a MESMA chamada duas vezes no mesmo lote (visto ao vivo: "tenho que pagar 5 mil de
        // arrendamento" gravou duas vezes). Chamadas idênticas do mesmo lote rodam uma só vez e dividem o resultado.
        const emAndamento = new Map<string, Promise<unknown>>();
        const fantasmas = lancamentosFantasmaDoLote(mensagem.tool_calls as ToolCall[], texto);
        const resultados = await Promise.all(
          (mensagem.tool_calls as ToolCall[]).map(async (tc) => {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              args = {};
            }
            if (fantasmas.has(tc.id)) {
              return {
                tool_call_id: tc.id,
                content: JSON.stringify({
                  sucesso: false,
                  motivo: "repetiu_valor_anterior",
                  ignorar: true,
                }),
              };
            }
            const chave = `${tc.function.name}|${JSON.stringify(args)}`;
            let execucao = emAndamento.get(chave);
            if (!execucao) {
              execucao = executarTool(tc.function.name, args, ctx);
              emAndamento.set(chave, execucao);
            }
            const resultado = await execucao;
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
        // Estudo de proposta: o texto sai pronto da ferramenta (conta feita por
        // código) e é enviado como está, sem o modelo reescrever nenhum número.
        for (const r of resultados) {
          let pronta: string | null = null;
          try {
            const o = JSON.parse(r.content) as { encontrado?: boolean; resposta_pronta?: unknown };
            if (o.encontrado === true && typeof o.resposta_pronta === "string")
              pronta = o.resposta_pronta;
          } catch {
            pronta = null;
          }
          if (pronta) {
            return {
              resposta: pronta,
              precisa_humano: false,
              cadastro_criado: cadastroCriado,
              convite_dispensado: true,
            };
          }
        }
        // Caderno da fazenda: a confirmação do lançamento sai pronta da ferramenta (valores gravados de
        // verdade), sem o modelo reescrever número. Se só parte dos lançamentos gravou, o modelo
        // responde, mas é obrigado a confirmar apenas os que gravaram.
        {
          const nomePorId = new Map<string, string>(
            (mensagem.tool_calls as ToolCall[]).map((tc) => [tc.id, tc.function.name]),
          );
          const doCaderno = resultados.filter(
            (r) => nomePorId.get(r.tool_call_id) === "registrar_na_fazenda",
          );
          if (doCaderno.length > 0) {
            const lidosTodos = doCaderno.map((r) => {
              try {
                return JSON.parse(r.content) as {
                  sucesso?: boolean;
                  confirmacao?: string;
                  ignorar?: boolean;
                };
              } catch {
                return {} as { sucesso?: boolean; confirmacao?: string; ignorar?: boolean };
              }
            });
            // chamadas que o código descartou em silêncio (valor repetido de mensagem anterior) não contam nem são confirmadas
            const lidos = lidosTodos.filter((o) => o.ignorar !== true);
            const descartadas = lidosTodos.length - lidos.length;
            const gravados = lidos.filter(
              (o) => o.sucesso === true && typeof o.confirmacao === "string",
            );
            if (
              lidos.length > 0 &&
              gravados.length === lidos.length &&
              (doCaderno.length === resultados.length ||
                lidos.length === resultados.length - descartadas ||
                ehLancamentoDoCaderno)
            ) {
              return {
                resposta: [...new Set(gravados.map((o) => o.confirmacao))].join("\n"),
                precisa_humano: false,
                cadastro_criado: cadastroCriado,
                convite_dispensado: true,
              };
            }
            if (gravados.length > 0 && gravados.length < lidos.length) {
              messages.push({
                role: "system",
                content:
                  "Só alguns lançamentos do caderno foram gravados. Confirme APENAS os que vieram com sucesso=true (use o texto de 'confirmacao' deles) e, para os que falharam, explique o motivo em uma frase e peça o que falta. Nunca diga que anotou o que falhou.",
              });
            }
          }
          for (const r of resultados) {
            if (
              nomePorId.get(r.tool_call_id) !== "resumo_da_fazenda" &&
              nomePorId.get(r.tool_call_id) !== "desfazer_ultimo_registro_fazenda"
            )
              continue;
            try {
              const o = JSON.parse(r.content) as { texto?: string; sucesso?: boolean };
              if (typeof o.texto === "string" && resultados.length === 1) {
                return {
                  resposta: o.texto,
                  precisa_humano: false,
                  cadastro_criado: cadastroCriado,
                  convite_dispensado: true,
                };
              }
            } catch {
              /* resultado ilegível: o modelo segue */
            }
          }
        }
        // Achado real testando ao vivo (bateria adversarial 2026-10-12): ao
        // receber "precisa_confirmar_primeiro" (alertas, cadastro, resumo
        // diário — qualquer ferramenta que exige a pergunta de confirmação
        // antes), o modelo às vezes só chama a MESMA ferramenta de novo com
        // os mesmos argumentos em vez de perguntar em texto — gastava até
        // MAX_TOOL_ROUNDS chamadas repetidas (custo e latência) antes de se
        // corrigir sozinho. Em vez de esperar isso se resolver por conta,
        // força a correção direto na próxima rodada.
        if (resultados.some((r) => /"motivo":"precisa_confirmar_primeiro"/.test(r.content))) {
          messages.push({
            role: "system",
            content:
              "A ferramenta não executou porque ainda falta a pergunta de confirmação. NÃO chame essa ferramenta de novo agora — responda em TEXTO perguntando/confirmando com o produtor antes.",
          });
        }
        continue;
      }

      if (mensagem?.content) {
        const parsed = JSON.parse(mensagem.content) as {
          resposta: string;
          precisa_humano: boolean;
        };

        if (respostaRepetiuConfirmacaoProativaSemExecutar(parsed.resposta, historico)) {
          const ativa = direcaoDaConfirmacaoProativa(historico);
          if (ativa != null) {
            const resultado = (await executarTool(
              "configurar_mensagem_proativa",
              { ativa },
              ctx,
            )) as { sucesso?: boolean };
            // Só afirma sucesso se a ferramenta realmente confirmou — senão
            // (sem_cadastro/erro_ao_salvar) cai pro fluxo normal, não inventa
            // confirmação que não aconteceu de verdade.
            if (resultado?.sucesso === true) {
              return {
                resposta: ativa
                  ? "Prontinho, voltei a te mandar os avisos automáticos de preço, clima e câmbio."
                  : "Prontinho, não vou mais te mandar os avisos automáticos de preço, clima e câmbio. Se quiser voltar a receber, é só me pedir.",
                precisa_humano: false,
                cadastro_criado: cadastroCriado,
                convite_dispensado: true,
              };
            }
          }
        }

        const fechada = await fechar(parsed, mensagem.content, true);
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
      const fechada = await fechar(parsed, conteudo, false);
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

/**
 * Abertura para quem chegou do anúncio ("Olá! Posso ter mais informações sobre isso?") e ainda não
 * tem cadastro: o modelo explica o Safralume e o CÓDIGO faz a única pergunta, com opções numeradas.
 * Antes o modelo perguntava "cultura e estado" e o n8n ainda emendava "responda quero testar":
 * duas perguntas na mesma mensagem, e metade das pessoas respondia "Sim" à errada.
 */
const PERGUNTA_QUE_PEDE_DADO =
  /cultura|estado|planta|trabalha|produz|lavoura|quer (receber|que eu|testar)|responda|quero testar|cadastro|teste gr[aá]tis|o que voc[eê]/i;

export function limparAberturaDeAnuncio(resposta: string): string {
  const frases = resposta
    .replace(/\*quero testar\*/gi, "quero testar")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);
  const mantidas: string[] = [];
  frases.forEach((frase, i) => {
    const ehPergunta = frase.endsWith("?");
    // Só a primeira frase pode ser pergunta (retórica) e mesmo assim não pode pedir dado nem oferecer.
    if (ehPergunta && (i > 0 || PERGUNTA_QUE_PEDE_DADO.test(frase))) return;
    if (/responda|quero testar|cadastro gr[aá]tis|teste gr[aá]tis/i.test(frase)) return;
    mantidas.push(frase);
  });
  const corpo = mantidas.join(" ").trim() || "Oi! Eu sou o assistente de mercado do Safralume.";
  return `${corpo}\n\nTeste grátis de 7 dias, sem cartão. ${PERGUNTA_CULTURA}`;
}

/**
 * Lançamentos do caderno que o modelo mandou no mesmo lote com o MESMO valor e quantidade mas descrições diferentes
 * (visto ao vivo: "gastei dois mil de diesel" gravou também "adubo 2.000", copiado do contexto). Fica só o que tem a ver com o
 * que o produtor escreveu: o que a descrição aparece na mensagem; se nenhum aparecer, o primeiro. Quem disse duas coisas
 * de mesmo valor ("2 mil de diesel e 2 mil de adubo") tem as duas descrições na mensagem e mantém os dois.
 */
export function lancamentosFantasmaDoLote(chamadas: ToolCall[], texto: string): Set<string> {
  const norm = (x: string) =>
    x
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const palavrasDaMensagem = new Set(
    norm(texto)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3),
  );
  const grupos = new Map<string, { id: string; descricao: string }[]>();
  for (const tc of chamadas) {
    if (tc.function.name !== "registrar_na_fazenda") continue;
    let a: Record<string, unknown> = {};
    try {
      a = JSON.parse(tc.function.arguments || "{}");
    } catch {
      continue;
    }
    if (a["vence_em"]) continue;
    const chave = `${a["tipo"]}|${a["valor"] ?? ""}|${a["quantidade"] ?? ""}`;
    if (a["valor"] == null && a["quantidade"] == null) continue;
    const g = grupos.get(chave) ?? [];
    g.push({ id: tc.id, descricao: String(a["descricao"] ?? "") });
    grupos.set(chave, g);
  }
  const descartar = new Set<string>();
  for (const g of grupos.values()) {
    if (g.length < 2) continue;
    if (new Set(g.map((x) => norm(x.descricao))).size < 2) continue; // idênticas: o outro tratamento cuida
    const tem = (d: string) =>
      norm(d)
        .split(/[^a-z0-9]+/)
        .some((w) => w.length >= 3 && palavrasDaMensagem.has(w));
    const mantidos = g.filter((x) => tem(x.descricao));
    const ficam = new Set((mantidos.length > 0 ? mantidos : [g[0]!]).map((x) => x.id));
    for (const x of g) if (!ficam.has(x.id)) descartar.add(x.id);
  }
  return descartar;
}

export async function runAgent(input: Parameters<typeof runAgentBase>[0]): Promise<RespostaAgente> {
  const resposta = await runAgentBase(input);
  if (!input.produtor.id && !input.midia && GATILHO_ANUNCIO.test(input.texto)) {
    return {
      ...resposta,
      resposta: limparAberturaDeAnuncio(resposta.resposta),
      convite_dispensado: true,
    };
  }
  return resposta;
}
