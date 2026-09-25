import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProdutorContexto } from "@/lib/bot/types";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import { buscarPreco } from "@/lib/bot/tools/preco";
import { buscarClima } from "@/lib/bot/tools/clima";
import { buscarLeite } from "@/lib/bot/tools/leite";
import { buscarSinalVenda } from "@/lib/bot/tools/sinalVenda";
import {
  buscarBoletimImea,
  buscarCambio,
  buscarDiesel,
  buscarFuturosB3,
  buscarProducaoIbge,
  buscarProducaoWasde,
} from "@/lib/bot/tools/mercado";
import { criarAlertaClima, criarAlertaPreco } from "@/lib/bot/tools/alertas";
import { criarContaTeste } from "@/lib/bot/tools/conta";
import { consultarAssinatura } from "@/lib/bot/tools/assinatura";
import { consultarJanelaPlantio } from "@/lib/bot/tools/plantio";
import { atualizarLocalizacao } from "@/lib/bot/tools/localizacao";
import { calcularMargemSafra } from "@/lib/bot/tools/calculadora";

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
] as const;

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
      return buscarPreco(
        ctx.supabase,
        { ...a, incluir_frete: a.incluir_frete || falaDeFrete },
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
    case "buscar_sinal_venda":
      return buscarSinalVenda(ctx.supabase, args as Parameters<typeof buscarSinalVenda>[1]);
    case "buscar_cambio":
      return buscarCambio(ctx.supabase);
    case "buscar_diesel":
      return buscarDiesel(ctx.supabase, args as Parameters<typeof buscarDiesel>[1]);
    case "buscar_producao_ibge":
      return buscarProducaoIbge(ctx.supabase, args as Parameters<typeof buscarProducaoIbge>[1]);
    case "buscar_futuros_b3":
      return buscarFuturosB3(ctx.supabase, args as Parameters<typeof buscarFuturosB3>[1]);
    case "buscar_producao_usda_wasde":
      return buscarProducaoWasde(ctx.supabase, args as Parameters<typeof buscarProducaoWasde>[1]);
    case "buscar_boletim_imea":
      return buscarBoletimImea(ctx.supabase, args as Parameters<typeof buscarBoletimImea>[1]);
    case "criar_alerta_preco":
      return criarAlertaPreco(ctx.supabase, args as Parameters<typeof criarAlertaPreco>[1], ctx);
    case "criar_alerta_clima":
      return criarAlertaClima(ctx.supabase, args as Parameters<typeof criarAlertaClima>[1], ctx);
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
      });
    case "consultar_assinatura":
      return consultarAssinatura(ctx.supabase, ctx);
    case "consultar_janela_plantio":
      return consultarJanelaPlantio(
        ctx.supabase,
        args as Parameters<typeof consultarJanelaPlantio>[1],
      );
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}
