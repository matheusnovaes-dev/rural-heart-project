import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProdutorContexto } from "@/lib/bot/types";
import { buscarPreco } from "@/lib/bot/tools/preco";
import { buscarClima } from "@/lib/bot/tools/clima";
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

export type ToolContext = {
  supabase: SupabaseClient;
  produtor: ProdutorContexto;
  telefone: string;
};

/** Schema `tools` da OpenAI — descrições e argumentos de cada fonte de dado real disponível pro agente. */
export const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_preco",
      description:
        "Busca o preço bruto mais recente de uma cultura numa UF (dados oficiais, Conab) e o frete de referência até o destino padrão, já calculando o preço líquido (frete descontado) quando disponível. Se não achar preço nessa UF, retorna as UFs onde essa cultura tem preço nos últimos 90 dias. Só chame com produto/uf null se REALMENTE não tiver como saber (nem pergunta, nem histórico, nem padrão do produtor) — nesse caso ela devolve um erro indicando o que falta, pra você perguntar ao produtor em vez de chutar.",
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
              "true para o produto principal da pergunta (calcula preço líquido); false para um segundo produto numa pergunta comparando duas culturas (só preço bruto).",
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
] as const;

export async function executarTool(
  nome: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  switch (nome) {
    case "buscar_preco":
      return buscarPreco(ctx.supabase, args as Parameters<typeof buscarPreco>[1], {
        lat: ctx.produtor.lat,
        lon: ctx.produtor.lon,
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
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}
