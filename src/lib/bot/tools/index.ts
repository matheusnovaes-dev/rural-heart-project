import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProdutorContexto } from "@/lib/bot/types";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import { buscarPreco } from "@/lib/bot/tools/preco";
import { culturaMencionada, culturaMaisRecenteNoHistorico } from "@/config/culturas";
import { buscarClima } from "@/lib/bot/tools/clima";
import { buscarLeite } from "@/lib/bot/tools/leite";
import { buscarFerrugemAsiatica } from "@/lib/bot/tools/ferrugem";
import { buscarLeiloesProximos } from "@/lib/bot/tools/leiloes";
import { buscarSinalVenda } from "@/lib/bot/tools/sinalVenda";
import {
  buscarBoletimImea,
  buscarCambio,
  buscarDiesel,
  buscarFuturosB3,
  buscarPrecoInsumo,
  buscarProducaoHistoricaConab,
  buscarProducaoIbge,
  buscarProducaoWasde,
  buscarProgressoSafraConab,
} from "@/lib/bot/tools/mercado";
import { criarAlertaClima, criarAlertaLeilao, criarAlertaPreco } from "@/lib/bot/tools/alertas";
import { criarContaTeste } from "@/lib/bot/tools/conta";
import { consultarAssinatura } from "@/lib/bot/tools/assinatura";
import { consultarJanelaPlantio } from "@/lib/bot/tools/plantio";
import { atualizarLocalizacao } from "@/lib/bot/tools/localizacao";
import { calcularMargemSafra } from "@/lib/bot/tools/calculadora";
import { esquecerMemoriaProdutor, salvarMemoriaProdutor } from "@/lib/bot/tools/memoria";

export type ToolContext = {
  supabase: SupabaseClient;
  produtor: ProdutorContexto;
  telefone: string;
  historico: HistoricoLinha[];
  texto: string;
};

/** Schema `tools` da OpenAI — descrições e argumentos de cada fonte de dado real disponível pro agente. */
export const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_preco",
      description:
        "Busca o preço mais recente de uma cultura numa UF (dados oficiais: Conab, órgãos estaduais, BBM). Esse preço é o que o produtor recebe na região e JÁ vem descontado do frete até o porto: nunca desconte frete dele. Com incluir_frete=true, devolve também frete_e_paridade: a paridade de porto (preço no porto menos o frete até lá, comparada com a média das praças do interior) onde dá pra afirmar, ou só um frete de referência. Se não achar preço nessa UF, retorna as UFs onde essa cultura tem preço nos últimos 90 dias. Só chame com produto/uf null se REALMENTE não tiver como saber (nem pergunta, nem histórico, nem padrão do produtor) — nesse caso ela devolve um erro indicando o que falta, pra você perguntar ao produtor em vez de chutar.",
      parameters: {
        type: "object",
        properties: {
          produto: {
            type: ["string", "null"],
            description:
              "Palavra-chave maiúscula do produto: SOJA, MILHO, BOI, CAFÉ ARÁBICA, CAFÉ CONILLON (atenção: conillon com dois L), ALGODÃO, TRIGO, ARROZ, FEIJÃO, CANA DE AÇÚCAR. null se genuinamente não souber qual.",
          },
          uf: {
            type: ["string", "null"],
            description:
              "Sigla de 2 letras, só se vier explicitamente da pergunta atual, do histórico da conversa ou do padrão cadastrado do produtor. Cuidado pra não confundir Paraná(PR)/Paraíba(PB)/Pará(PA) entre si quando algum desses for mencionado. Se nenhuma dessas 3 fontes disser qual UF, o valor É null — mesmo que você saiba onde essa cultura costuma ser mais plantada no Brasil, isso NÃO conta como saber a UF do produtor, então não use esse conhecimento geral pra preencher este campo.",
          },
          incluir_frete: {
            type: "boolean",
            description:
              "true para o produto principal da pergunta (traz frete de referência e paridade de porto); false para um segundo produto numa pergunta comparando duas culturas (só o preço).",
          },
        },
        required: ["produto", "uf", "incluir_frete"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_leite",
      description:
        "Dados de LEITE numa UF: preço médio por litro pago ao produtor no ano (IBGE, anual e defasado, NÃO é cotação de hoje), variação contra o ano anterior, produção, vacas ordenhadas e litros por vaca/dia; a última cotação observada quando a UF tem fonte (Conab no AC, EPAGRI em SC); e a relação leite/milho (quantos litros de leite pagam uma saca de milho e quantos kg de milho um litro compra), já calculada. Use pra QUALQUER pergunta sobre leite, preço do leite, relação leite/ração, leite x milho. Não use buscar_preco pra leite.",
      parameters: {
        type: "object",
        properties: {
          uf: {
            type: ["string", "null"],
            description:
              "Sigla de 2 letras, da pergunta atual, do histórico ou do cadastro do produtor. null se nenhuma dessas fontes disser.",
          },
          preco_litro_produtor: {
            type: ["number", "null"],
            description:
              "Preço em R$/litro que o PRODUTOR disse que recebe (ex: 'recebo 2,80 no litro' → 2.8). É o dado mais atual e usado na relação leite/milho. null se ele não disse.",
          },
        },
        required: ["uf", "preco_litro_produtor"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_clima",
      description:
        "Previsão do tempo de 5 dias (chuva %, temp mín/máx por dia) para uma cidade específica se informada e encontrada, senão a coordenada cadastrada do produtor, senão a capital da UF.",
      parameters: {
        type: "object",
        properties: {
          uf: { type: "string" },
          cidade: {
            type: ["string", "null"],
            description:
              "Nome da cidade mencionada explicitamente na pergunta, se houver. Pode vir de transcrição de áudio — ignore erros de pontuação.",
          },
        },
        required: ["uf", "cidade"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_sinal_venda",
      description:
        "Cruza a posição do preço atual na faixa dos últimos 90 dias, a curva de futuros da B3 e o risco de clima pra indicar tendência (bom momento pra vender, esperar, ou neutro) — não é recomendação de investimento.",
      parameters: {
        type: "object",
        properties: { produto: { type: "string" }, uf: { type: "string" } },
        required: ["produto", "uf"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_cambio",
      description: "Cotação do dólar (PTAX) mais recente — contexto de mercado.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_diesel",
      description:
        "Preço médio do diesel (comum e S10) por litro numa UF (ANP) — contexto de custo de frete/operação.",
      parameters: {
        type: "object",
        properties: { uf: { type: "string" } },
        required: ["uf"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_producao_ibge",
      description:
        "Área plantada/colhida e produção (toneladas) do IBGE/LSPA pra uma cultura numa UF — contexto de oferta regional.",
      parameters: {
        type: "object",
        properties: { produto: { type: "string" }, uf: { type: "string" } },
        required: ["produto", "uf"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_producao_historica_conab",
      description:
        "Área plantada, produção e produtividade TOTAL da safra atual e da anterior (série histórica da Conab, só grãos: algodão, amendoim, arroz, aveia, canola, centeio, cevada, feijão, gergelim, girassol, mamona, milho, soja, sorgo, trigo, triticale) pra uma UF — dá pra comparar se a área plantada da safra atual cresceu ou caiu em relação à anterior. NÃO é quanto já foi plantado/colhido ATÉ AGORA nesta semana (isso é buscar_progresso_safra_conab) — nunca confunda os dois.",
      parameters: {
        type: "object",
        properties: { produto: { type: "string" }, uf: { type: "string" } },
        required: ["produto", "uf"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_progresso_safra_conab",
      description:
        'Percentual de área já SEMEADA ou COLHIDA na semana mais recente (boletim semanal da Conab), pra uma UF — é o dado de "quanto já foi plantado esse ano" que o produtor pergunta durante a época de plantio/colheita. Só cobre a cultura enquanto ela está na janela de plantio ou colheita (fora dessa época, retorna indisponível). Culturas com 2 safras no ano (milho, feijão) trazem as duas linhas separadas.',
      parameters: {
        type: "object",
        properties: { produto: { type: "string" }, uf: { type: "string" } },
        required: ["produto", "uf"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_ferrugem_asiatica",
      description:
        "Ocorrência de ferrugem asiática da soja por município, na UF do produtor, na safra mais recente com dado (Consórcio Antiferrugem, rede oficial de monitoramento). Chame quando o produtor perguntar sobre ferrugem, risco de doença na soja, ou pedir pra saber se já teve foco confirmado na região dele. Só cobre ferrugem asiática, nenhuma outra praga/doença — se perguntarem sobre outra praga, diga honestamente que ainda não tem esse dado. 'municipios_com_ocorrencia_confirmada' são focos reais confirmados; 'municipios_com_esporos_no_ar' é alerta precoce (esporo detectado no ar, antes de sintoma visível na lavoura) — trate como nível de risco diferente (mais grave) do que confirmação. Se a lista vier vazia mas 'encontrado' for true, diga que não há foco confirmado na UF nessa safra até agora, nunca invente um município.",
      parameters: {
        type: "object",
        properties: { uf: { type: "string" } },
        required: ["uf"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_leiloes_proximos",
      description:
        'Agenda de leilões de gado (majoritariamente de genética/reprodutores — touros, fêmeas registradas), fonte ArrobaPlay. Chame quando o produtor perguntar sobre leilão, remate, comprar/vender touro ou reprodutor, ou "tem leilão essa semana?". O retorno vem em dois grupos: "presenciais_na_regiao" (leilão de verdade na UF do produtor, com local real de fazenda) e "virtuais_em_destaque" (transmissão online, nacional — o local que a ferramenta ignora de propósito nesses é só o estúdio da leiloeira, não de onde vêm os lotes, por isso não filtra por UF). Apresente os presenciais da região primeiro quando existirem; só mencione os virtuais como destaque geral, nunca diga que são "na região" dele. Se "encontrado" for false, diga honestamente que não achou leilão agendado no momento, nunca invente data/local.',
      parameters: {
        type: "object",
        properties: { uf: { type: ["string", "null"] } },
        required: ["uf"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_preco_insumo",
      description:
        'Preço de defensivo agrícola (agrotóxico: herbicida, fungicida, inseticida, acaricida, adjuvante, regulador de crescimento) ou fertilizante (químico, orgânico, inoculante), da Conab. O dado é POR PRODUTO COMERCIAL (marca/formulação), não uma categoria única — passe o nome específico que o produtor citou (ex: "glifosato", "MAP", "ureia", "2,4-D") em termo; se ele perguntar de forma genérica sem citar produto (ex: "e o fertilizante, tá subindo?"), passe a categoria (ex: "fertilizante", "herbicida") em termo mesmo assim, a busca cai pra categoria sozinha. Sempre retorna uma FAIXA de preço (mínimo-máximo entre os produtos encontrados), nunca um valor único — não invente um preço "médio" que a ferramenta não deu.',
      parameters: {
        type: "object",
        properties: { termo: { type: "string" }, uf: { type: "string" } },
        required: ["termo", "uf"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_futuros_b3",
      description:
        "Preços de ajuste dos contratos futuros mais próximos na B3 (quando a cultura tem contrato: boi, milho, café arábica, café conillon, soja, cana-de-açúcar via etanol) — expectativa do mercado.",
      parameters: {
        type: "object",
        properties: { produto: { type: "string" } },
        required: ["produto"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_producao_usda_wasde",
      description:
        "Estimativas mensais da USDA (produção/exportação/estoque em milhões de toneladas) pro Brasil — soja, milho ou algodão.",
      parameters: {
        type: "object",
        properties: { cultura: { type: "string", enum: ["soja", "milho", "algodao"] } },
        required: ["cultura"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_boletim_imea",
      description:
        "Últimos boletins do Imea (Mato Grosso) pra uma cadeia produtiva — manchete, resumo, link.",
      parameters: {
        type: "object",
        properties: { cadeia: { type: "string" } },
        required: ["cadeia"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_alerta_preco",
      description:
        "Cria um alerta de preço: avisa por WhatsApp automaticamente quando o preço de uma cultura numa UF cruzar um valor. SÓ chame esta função depois de o produtor confirmar claramente cultura, UF, valor e direção — nunca crie um alerta que ele não pediu de forma inequívoca.",
      parameters: {
        type: "object",
        properties: {
          cultura: { type: "string" },
          uf: { type: "string" },
          limite: { type: "number", description: "Valor em R$ por saca de 60kg." },
          direcao: { type: "string", enum: ["acima", "abaixo"] },
        },
        required: ["cultura", "uf", "limite", "direcao"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_alerta_clima",
      description:
        "Cria um alerta de clima: avisa quando uma condição for prevista numa UF, acima/abaixo de um limite. SÓ chame depois do produtor confirmar condição, UF e limite (ou aceitar o padrão sugerido).",
      parameters: {
        type: "object",
        properties: {
          uf: { type: "string" },
          condicao: {
            type: "string",
            enum: ["chuva_forte", "geada", "seca_prolongada", "vento_forte"],
          },
          limite: {
            type: "number",
            description:
              "% de probabilidade (chuva_forte/seca_prolongada), °C de mínima (geada), ou km/h de rajada (vento_forte). Se o produtor não informar, use o padrão: chuva_forte=70, geada=3, seca_prolongada=20, vento_forte=40.",
          },
        },
        required: ["uf", "condicao", "limite"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_alerta_leilao",
      description:
        'Cria um alerta de leilão de gado: avisa por WhatsApp quando um novo leilão entrar na agenda. Exclusivo plano Prata+. SÓ chame depois do produtor confirmar claramente UF (quando quiser presencial) e/ou tipo (presencial, virtual ou qualquer) — se ele só quer ser avisado de leilão em geral sem especificar, use tipo_preferido="qualquer" e uf=null.',
      parameters: {
        type: "object",
        properties: {
          uf: {
            type: ["string", "null"],
            description:
              "UF pra filtrar leilão presencial. null se for só virtual ou qualquer tipo.",
          },
          tipo_preferido: { type: "string", enum: ["presencial", "virtual", "qualquer"] },
        },
        required: ["uf", "tipo_preferido"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_conta_teste",
      description:
        "Cria um cadastro de teste grátis (7 dias, plano Bronze, sem cartão) direto nesta conversa do WhatsApp, sem precisar ir pro site — só pra quem AINDA NÃO tem conta (conta_no_painel=não). Depois de criada, o produtor já é atendido como assinante Bronze normalmente. SÓ chame depois do produtor confirmar claramente que quer criar a conta, já com estado e cultura principal informados.",
      parameters: {
        type: "object",
        properties: {
          uf: { type: "string", description: "Sigla de 2 letras do estado do produtor." },
          cultura_principal: {
            type: "string",
            description:
              "Cultura principal do produtor — mesma palavra-chave maiúscula usada em buscar_preco (SOJA, MILHO, BOI, etc).",
          },
        },
        required: ["uf", "cultura_principal"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_localizacao",
      description:
        "Guarda no cadastro a CIDADE do produtor (e a UF dela) quando ele disser onde fica — ex: 'minha cidade é Vacaria RS', 'sou de Sorriso, MT'. Isso faz o frete das próximas respostas usar a rota cadastrada mais próxima dele. Só funciona pra quem já tem cadastro (conta_no_painel/cadastro_feito=sim). Chame SÓ quando ele informar a cidade dele explicitamente, nunca pra uma cidade que ele só mencionou de passagem (ex: perguntando o clima de outro lugar).",
      parameters: {
        type: "object",
        properties: {
          municipio: { type: "string", description: "Nome da cidade como o produtor escreveu." },
          uf: { type: "string", description: "Sigla de 2 letras da UF dessa cidade." },
        },
        required: ["municipio", "uf"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_janela_plantio",
      description:
        "Consulta a janela de plantio oficial (ZARC/MAPA — Zoneamento Agrícola de Risco Climático) pra SOJA, MILHO, ALGODÃO, ARROZ ou FEIJÃO num município: diz se plantar agora (ou nas próximas semanas) está dentro da janela recomendada e com que risco climático oficial (%). NÃO cobre café, cana-de-açúcar (são perenes, não têm janela de plantio anual) nem boi. Precisa do nome do MUNICÍPIO (não só a UF) — se não tiver, pergunte antes de chamar. NUNCA estime produtividade (sacas/hectare) ou data de colheita a partir disso — a ferramenta só classifica risco climático da janela, não prevê safra.",
      parameters: {
        type: "object",
        properties: {
          produto: {
            type: "string",
            description:
              "SOJA, MILHO, ALGODÃO, ARROZ ou FEIJÃO — mesma palavra-chave de buscar_preco.",
          },
          uf: { type: "string" },
          municipio: {
            type: ["string", "null"],
            description:
              "Nome do município. Use o cadastrado do produtor se ele não mencionar outro.",
          },
        },
        required: ["produto", "uf", "municipio"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calcular_margem_safra",
      description:
        "Calcula quanto a produção do produtor vale hoje e a margem estimada: sacas × preço real da região, menos o custo de produção que ele informar. SÓ chame depois que ele disser a QUANTIDADE de sacas (nunca estime isso) — custo por saca é opcional, sem ele calcula só o valor bruto, sem margem. Se a cultura não tiver preço na UF pedida, o retorno traz outras_ufs_disponiveis (preço real e recente em outros estados) — nesse caso pergunte qual estado ele quer usar como referência e chame de novo passando uf_referencia com a sigla escolhida.",
      parameters: {
        type: "object",
        properties: {
          produto: {
            type: "string",
            description: "Mesma palavra-chave maiúscula de buscar_preco (SOJA, MILHO, BOI, etc).",
          },
          uf: {
            type: ["string", "null"],
            description: "Sigla de 2 letras. null se genuinamente não souber.",
          },
          sacas: {
            type: ["number", "null"],
            description:
              "Quantidade de sacas de 60kg que o produtor disse ter. null se ele não disse — nesse caso pergunte, nunca chame com um número chutado.",
          },
          custo_saca: {
            type: ["number", "null"],
            description:
              "Custo de produção em R$ por saca, só se o produtor informou. null se ele não disse (a ferramenta calcula só o valor bruto, sem margem).",
          },
          uf_referencia: {
            type: ["string", "null"],
            description:
              "Preencha só numa segunda chamada, depois que a primeira resposta trouxe outras_ufs_disponiveis e o produtor escolheu uma UF entre elas.",
          },
        },
        required: ["produto", "uf", "sacas", "custo_saca", "uf_referencia"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_assinatura",
      description:
        "Consulta o plano, status (trial/ativa/inadimplente/cancelada) e data de vencimento do trial da assinatura REAL do produtor. SEMPRE chame isto quando ele perguntar qual é o plano dele, se está ativo, quando o trial vence, ou quantos alertas/funcionários ele pode ter — nunca responda essas perguntas de cabeça ou supondo, mesmo que pareça óbvio pelo contexto da conversa.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_memoria_produtor",
      description:
        "Guarda um fato DURÁVEL sobre esse produtor, que vai importar em conversas FUTURAS (não só nesta) — ex: uma preocupação real que ele contou (medo de perder a safra, dificuldade financeira), contexto da fazenda (pra quem ele vende, onde fica, como armazena), ou um plano futuro (pensando em diversificar cultura, trocar de fornecedor). NUNCA chame isto pra dado efêmero que já tem fonte própria (preço, clima, cotação de hoje) — só fato pessoal/relacional que não tá em nenhuma tabela. Chame no máximo uma vez por conversa, só quando o produtor contar algo assim de forma clara (não invente nem deduza).",
      parameters: {
        type: "object",
        properties: {
          fato: {
            type: "string",
            description:
              "Frase curta e objetiva descrevendo o fato, em 3ª pessoa (ex: 'tem medo de perder parte da safra pra seca'). Não copie a frase literal do produtor, resuma o fato.",
          },
          categoria: {
            type: "string",
            enum: ["preocupacao", "contexto_fazenda", "relacao_comercial", "plano_futuro"],
          },
        },
        required: ["fato", "categoria"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "esquecer_memoria_produtor",
      description:
        "Apaga TODOS os fatos guardados sobre esse produtor (ver salvar_memoria_produtor). Chame SOMENTE quando ele pedir explicitamente pra esquecer/apagar o que o Safralume sabe sobre ele — nunca por conta própria. Depois de chamar, confirme pra ele que foi apagado, nunca prometa isso sem ter chamado a ferramenta.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
] as const;

// Achado real em produção (2026-10-04): "Como tá o mercado da soja?" ->
// "Quanto dá o preço?" (sem citar cultura) -> o modelo chamou buscar_preco
// com MILHO (voltou pro cadastro do produtor) em vez de continuar com SOJA,
// já estabelecida na conversa. Mesmo bug que já tinha sido visto na
// calculadora — a trava só existia lá e em buscar_preco, não nas outras 4
// ferramentas que também recebem "produto"/"cultura" (sinal de venda, IBGE,
// progresso de safra, futuros B3, WASDE), igualmente vulneráveis ao mesmo
// padrão. Se a mensagem ATUAL não menciona cultura nenhuma, ignora o que o
// modelo mandou e usa a cultura mais recente do histórico.
// 2ª rodada (2026-10-09, achado real de novo — conversa do próprio Matheus,
// soja/MG): "Como tá a soja?" -> "Qual foi a última exportação, deu quanto?"
// -> buscar_producao_ibge voltou MILHO, mesmo com a trava de histórico já
// ativa. Causa: quando NEM a pergunta atual NEM o histórico têm cultura (ex:
// histórico ainda não chegou no contexto desta chamada), o último fallback
// caía pro que o modelo mandou — que não tem nenhuma garantia de ser o
// cultura_principal real do cadastro, mesmo o prompt já instruindo isso
// como 3º critério. Cultura do cadastro é um dado real, determinístico,
// não precisa confiar no modelo lembrar de usá-lo: agora é o código que
// aplica esse 3º critério, não só o texto do prompt.
function resolverCultura(ctx: ToolContext, produtoDoModelo: string): string {
  if (culturaMencionada(ctx.texto)) return produtoDoModelo;
  return (
    culturaMaisRecenteNoHistorico(ctx.historico) ??
    ctx.produtor.cultura_principal ??
    produtoDoModelo
  );
}

export async function executarTool(
  nome: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  switch (nome) {
    case "buscar_preco": {
      const a = args as Parameters<typeof buscarPreco>[1];
      // Pergunta que fala de frete/porto/paridade/líquido sempre traz o frete,
      // mesmo se o modelo pediu incluir_frete=false (visto ao vivo: respondeu
      // "não tenho frete" pra "quanto é o frete até o porto?").
      const falaDeFrete = /frete|porto|parid|l[ií]quid|sobra|descont/i.test(ctx.texto);
      const produtoFinal = a.produto ? resolverCultura(ctx, a.produto) : a.produto;
      return buscarPreco(
        ctx.supabase,
        { ...a, produto: produtoFinal, incluir_frete: a.incluir_frete || falaDeFrete },
        { lat: ctx.produtor.lat, lon: ctx.produtor.lon, pediuFrete: falaDeFrete },
      );
    }
    case "buscar_leite":
      return buscarLeite(ctx.supabase, args as Parameters<typeof buscarLeite>[1], {
        atual: ctx.texto,
        anteriores: ctx.historico
          .filter((h) => h.role === "user")
          .map((h) => h.conteudo)
          .join("\n"),
      });
    case "buscar_clima":
      return buscarClima(args as Parameters<typeof buscarClima>[0], { produtor: ctx.produtor });
    case "buscar_sinal_venda": {
      const a = args as Parameters<typeof buscarSinalVenda>[1];
      return buscarSinalVenda(ctx.supabase, { ...a, produto: resolverCultura(ctx, a.produto) });
    }
    case "buscar_cambio":
      return buscarCambio(ctx.supabase);
    case "buscar_diesel":
      return buscarDiesel(ctx.supabase, args as Parameters<typeof buscarDiesel>[1]);
    case "buscar_producao_ibge": {
      const a = args as Parameters<typeof buscarProducaoIbge>[1];
      return buscarProducaoIbge(ctx.supabase, { ...a, produto: resolverCultura(ctx, a.produto) });
    }
    case "buscar_producao_historica_conab": {
      const a = args as Parameters<typeof buscarProducaoHistoricaConab>[1];
      // Ficou de fora da leva original (commit "Estende a trava de
      // cultura-por-contexto pra mais 4 ferramentas") mesmo recebendo o
      // mesmo "produto"+"uf" que buscar_progresso_safra_conab, sua ferramenta
      // irmã logo abaixo — mesma vulnerabilidade, nunca tinha sido exercitada
      // ao vivo até agora.
      return buscarProducaoHistoricaConab(ctx.supabase, {
        ...a,
        produto: resolverCultura(ctx, a.produto),
      });
    }
    case "buscar_progresso_safra_conab": {
      const a = args as Parameters<typeof buscarProgressoSafraConab>[1];
      return buscarProgressoSafraConab(ctx.supabase, {
        ...a,
        produto: resolverCultura(ctx, a.produto),
      });
    }
    case "buscar_ferrugem_asiatica":
      return buscarFerrugemAsiatica(
        ctx.supabase,
        args as Parameters<typeof buscarFerrugemAsiatica>[1],
      );
    case "buscar_leiloes_proximos":
      return buscarLeiloesProximos(
        ctx.supabase,
        args as Parameters<typeof buscarLeiloesProximos>[1],
        ctx.produtor.id,
      );
    case "buscar_preco_insumo":
      return buscarPrecoInsumo(
        ctx.supabase,
        args as Parameters<typeof buscarPrecoInsumo>[1],
        ctx.produtor.id,
      );
    case "buscar_futuros_b3": {
      const a = args as Parameters<typeof buscarFuturosB3>[1];
      return buscarFuturosB3(ctx.supabase, { ...a, produto: resolverCultura(ctx, a.produto) });
    }
    case "buscar_producao_usda_wasde": {
      const a = args as Parameters<typeof buscarProducaoWasde>[1];
      // Enum fechado (só soja/milho/algodao) — só troca se a cultura do
      // histórico for uma dessas 3, nunca força um valor fora do enum.
      const CULTURAS_WASDE = new Set(["soja", "milho", "algodao"]);
      const resolvida = resolverCultura(ctx, a.cultura);
      return buscarProducaoWasde(ctx.supabase, {
        ...a,
        cultura: (CULTURAS_WASDE.has(resolvida) ? resolvida : a.cultura) as typeof a.cultura,
      });
    }
    case "buscar_boletim_imea":
      return buscarBoletimImea(ctx.supabase, args as Parameters<typeof buscarBoletimImea>[1]);
    case "criar_alerta_preco":
      return criarAlertaPreco(ctx.supabase, args as Parameters<typeof criarAlertaPreco>[1], ctx);
    case "criar_alerta_clima":
      return criarAlertaClima(ctx.supabase, args as Parameters<typeof criarAlertaClima>[1], ctx);
    case "criar_alerta_leilao":
      return criarAlertaLeilao(ctx.supabase, args as Parameters<typeof criarAlertaLeilao>[1], ctx);
    case "criar_conta_teste":
      return criarContaTeste(ctx.supabase, args as Parameters<typeof criarContaTeste>[1], ctx);
    case "atualizar_localizacao":
      return atualizarLocalizacao(
        ctx.supabase,
        args as Parameters<typeof atualizarLocalizacao>[1],
        ctx,
      );
    case "calcular_margem_safra":
      return calcularMargemSafra(ctx.supabase, args as Parameters<typeof calcularMargemSafra>[1], {
        lat: ctx.produtor.lat,
        lon: ctx.produtor.lon,
        textoAtual: ctx.texto,
        culturaPadrao: ctx.produtor.cultura_principal,
        historico: ctx.historico,
      });
    case "consultar_assinatura":
      return consultarAssinatura(ctx.supabase, ctx);
    case "salvar_memoria_produtor":
      return salvarMemoriaProdutor(
        ctx.supabase,
        args as Parameters<typeof salvarMemoriaProdutor>[1],
        ctx.produtor.id,
      );
    case "esquecer_memoria_produtor":
      return esquecerMemoriaProdutor(ctx.supabase, ctx.produtor.id);
    case "consultar_janela_plantio":
      return consultarJanelaPlantio(
        ctx.supabase,
        args as Parameters<typeof consultarJanelaPlantio>[1],
      );
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}
