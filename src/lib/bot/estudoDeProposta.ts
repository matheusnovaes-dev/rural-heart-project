import type { SupabaseClient } from "@supabase/supabase-js";

import { culturaMencionada, normalizarCultura } from "@/config/culturas";
import { avaliarPropostas, TAXA_MENSAL_PADRAO } from "@/lib/bot/propostas/avaliar";
import { lerMidia } from "@/lib/bot/propostas/lerMidia";
import { obterReferencia } from "@/lib/bot/propostas/referencia";
import { montarEstudo } from "@/lib/bot/propostas/texto";
import type {
  LeituraDeMidia,
  MidiaRecebida,
  PropostaLida,
  ReferenciaDeMercado,
} from "@/lib/bot/propostas/tipos";
import { mensagemBloqueioAcesso, verificarAcessoWhatsapp } from "@/lib/bot/tools/acesso";
import type { ProdutorContexto } from "@/lib/bot/types";

type Resposta = {
  resposta: string;
  precisa_humano: boolean;
  cadastro_criado: boolean;
  convite_dispensado: boolean;
};

const pronta = (resposta: string, extra: Partial<Resposta> = {}): Resposta => ({
  resposta,
  precisa_humano: false,
  cadastro_criado: false,
  convite_dispensado: true,
  ...extra,
});

/** Estudos de foto/PDF por produtor a cada 24h: a leitura custa uma chamada de visão. */
export const LIMITE_DIARIO_DE_ESTUDOS = 15;
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${Math.abs(n).toFixed(1).replace(".", ",")}%`;

/** "tenho 3.000 sacas", "são 5 mil sacas": quantidade que o produtor escreveu na legenda. */
export function quantidadeDaLegenda(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const m = texto.match(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(mil)?\s*(?:sacas?|sc\b|arrobas?)/i);
  if (!m) return null;
  let n = Number(m[1]!.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (m[2]) n *= 1000;
  return n > 0 ? Math.round(n) : null;
}

function produtoDaProposta(p: PropostaLida, padrao: string | null): string | null {
  const achado = p.produto ? culturaMencionada(p.produto) : null;
  if (achado) return achado;
  return padrao ? normalizarCultura(padrao) : null;
}

const rotuloDoProduto = (chave: string) => chave.replace(/\b\w/g, (c) => c);

type Grupo = { produto: string; propostas: PropostaLida[] };

function agrupar(propostas: PropostaLida[], padrao: string | null): Grupo[] {
  const mapa = new Map<string, PropostaLida[]>();
  for (const p of propostas) {
    const chave = produtoDaProposta(p, padrao);
    if (!chave) continue;
    mapa.set(chave, [...(mapa.get(chave) ?? []), p]);
  }
  const grupos = [...mapa.entries()].map(([produto, lista]) => ({ produto, propostas: lista }));
  const principal = padrao ? normalizarCultura(padrao) : null;
  return grupos.sort((a, b) => Number(b.produto === principal) - Number(a.produto === principal));
}

function linhaCompacta(
  produto: string,
  a: ReturnType<typeof avaliarPropostas>,
  ref: ReferenciaDeMercado,
): string {
  const melhor = a
    .filter((x) => x.precoEfetivo != null && !x.suspeita)
    .sort((x, y) => y.precoEfetivo! - x.precoEfetivo!)[0];
  if (!melhor || melhor.diferenca == null || melhor.diferencaPct == null) {
    return `• *${rotuloDoProduto(produto)}*: não consegui comparar com o mercado.`;
  }
  const dir = melhor.diferenca >= 0 ? "acima" : "abaixo";
  const aviso =
    Math.abs(melhor.diferencaPct) > 20
      ? " Diferença grande: confira o tipo do produto e a unidade."
      : "";
  return `• *${rotuloDoProduto(produto)}*: ${brl(melhor.preco ?? melhor.precoEfetivo!)} contra ${brl(ref.preco)} no mercado (${ref.rotulo}), ${brl(Math.abs(melhor.diferenca))} ${dir} (${pct(melhor.diferencaPct)}).${aviso}`;
}

/**
 * Monta o estudo completo a partir de propostas já lidas (de foto/PDF) ou
 * contadas em texto. Tudo que vira número ou frase é feito por código: o
 * modelo só lê o documento, nunca escreve a conta.
 */
export async function montarRespostaDeEstudo(args: {
  supabase: SupabaseClient;
  produtor: ProdutorContexto;
  propostas: PropostaLida[];
  origem: "midia" | "texto";
  leitura?: LeituraDeMidia | undefined;
  quantidadeInformada?: number | null | undefined;
  hoje?: Date | undefined;
}): Promise<string> {
  const { supabase, produtor, propostas, origem, leitura } = args;
  const uf = produtor.uf;
  if (!uf) {
    return "Pra comparar com o mercado eu preciso saber seu estado. Me diga em qual estado você vende e eu faço o estudo.";
  }
  const grupos = agrupar(propostas, produtor.cultura_principal).slice(0, 4);
  if (grupos.length === 0) {
    return "Li o documento, mas não consegui saber de qual produto são os preços. Me diga o produto (soja, milho, boi...) que eu faço o estudo.";
  }

  const [principal, ...outros] = grupos;
  const localEntrega = principal!.propostas.find((p) => p.local_entrega)?.local_entrega ?? null;
  const refPrincipal = await obterReferencia(supabase, {
    produto: principal!.produto,
    uf,
    localEntrega,
  });
  if (!refPrincipal.ok) {
    const lista = principal!.propostas
      .filter((p) => p.preco != null)
      .map((p) => `• ${p.comprador ?? "Proposta"}: ${brl(p.preco!)}`)
      .join("\n");
    return `Ainda não tenho preço de referência de ${rotuloDoProduto(principal!.produto)} em ${uf} pra comparar. Isto é o que li:\n${lista}\n\nSe quiser, me diga outro estado ou produto de referência.`;
  }

  const avaliadas = avaliarPropostas(principal!.propostas, refPrincipal.ref, {
    quantidadePadrao: args.quantidadeInformada ?? null,
    hoje: args.hoje,
  });
  let extras: string | undefined;
  if (outros.length > 0) {
    const linhas: string[] = [];
    for (const g of outros) {
      const ref = await obterReferencia(supabase, { produto: g.produto, uf });
      if (!ref.ok) {
        linhas.push(`• *${rotuloDoProduto(g.produto)}*: ainda não tenho referência em ${uf}.`);
        continue;
      }
      linhas.push(
        linhaCompacta(
          g.produto,
          avaliarPropostas(g.propostas, ref.ref, { hoje: args.hoje }),
          ref.ref,
        ),
      );
    }
    extras = `*Outros produtos da tabela*\n${linhas.join("\n")}`;
  }
  return montarEstudo({
    origem,
    tipoDocumento: leitura?.tipo_documento,
    confianca: leitura?.confianca,
    avaliadas,
    ref: refPrincipal.ref,
    produto: rotuloDoProduto(principal!.produto),
    uf,
    taxaMensal: TAXA_MENSAL_PADRAO,
    extras,
  });
}

const MENSAGEM_NAO_E_PROPOSTA =
  "Recebi sua imagem, mas ela não parece uma proposta de compra nem uma tabela de preços. Eu leio proposta (foto ou PDF), tabela de cooperativa ou comprador, print de conversa com oferta e bilhete com cotações. Se for outra coisa, me conta por texto o que você precisa.";
const MENSAGEM_ILEGIVEL =
  "Não consegui ler essa imagem direito. Tenta de novo com mais luz, de frente e sem cortar as bordas do papel. Se tiver o PDF, pode mandar o PDF.";
const MENSAGEM_SEM_PRECO =
  "Li o documento, mas não achei nenhum preço nele. Se o preço está em outra página ou foto, manda também. Ou me diga o valor que eu faço o estudo.";
const MENSAGEM_FALHA =
  "Tive um problema pra ler esse arquivo agora. Pode mandar de novo em instantes? Se preferir, me diga o preço e o comprador por texto que eu faço o estudo.";
const MENSAGEM_GRANDE =
  "Esse arquivo é grande demais pra eu abrir. Manda uma foto (em vez de documento) ou um PDF de até 10 MB.";
const MENSAGEM_FORMATO =
  "Esse tipo de arquivo eu ainda não consigo abrir. Pode mandar como foto ou PDF?";
const MENSAGEM_ANONIMO =
  "Recebi sua foto! Eu faço o estudo de proposta (comparo com o preço de mercado e ranqueio os compradores), mas pra isso preciso do seu cadastro: seu estado e sua cultura. Responda *quero testar* que eu crio seu teste grátis de 7 dias aqui mesmo, sem cartão, e depois é só mandar a foto de novo.";
const MENSAGEM_LIMITE = `Hoje já analisei ${LIMITE_DIARIO_DE_ESTUDOS} documentos seus, que é o limite por dia. Amanhã eu continuo. Se for urgente, me diga o preço e o comprador por texto que eu comparo na hora.`;

/** Foto ou PDF recebido no WhatsApp: lê, compara com o mercado e devolve o estudo pronto. */
export async function responderMidia(input: {
  telefone: string;
  texto: string;
  produtor: ProdutorContexto;
  midia: MidiaRecebida;
  supabase: SupabaseClient;
  apiKey: string;
  signal: AbortSignal;
}): Promise<Resposta> {
  const { telefone, texto, produtor, midia, supabase, apiKey, signal } = input;

  if (!produtor.id) return pronta(MENSAGEM_ANONIMO);

  const acesso = await verificarAcessoWhatsapp(supabase, produtor.id);
  if (!acesso.liberado) {
    return pronta(mensagemBloqueioAcesso(acesso.comLogin, acesso.motivo), {
      convite_dispensado: false,
    });
  }

  const bytes = Math.floor((midia.base64.length * 3) / 4);
  if (bytes > TAMANHO_MAXIMO_BYTES) return pronta(MENSAGEM_GRANDE);

  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("bot_conversas")
    .select("id", { count: "exact", head: true })
    .eq("telefone", telefone)
    .eq("role", "user")
    .or("conteudo.like.[Imagem enviada]%,conteudo.like.[PDF enviado%")
    .gte("created_at", desde);
  if ((count ?? 0) > LIMITE_DIARIO_DE_ESTUDOS) return pronta(MENSAGEM_LIMITE);

  const leitura = await lerMidia(apiKey, midia, signal);
  if (!leitura.ok) {
    return pronta(leitura.motivo === "mime_nao_suportado" ? MENSAGEM_FORMATO : MENSAGEM_FALHA, {
      precisa_humano: false,
    });
  }
  const l = leitura.leitura;
  if (!l.legivel) return pronta(MENSAGEM_ILEGIVEL);
  if (l.tipo_documento === "outro" || l.propostas.length === 0)
    return pronta(MENSAGEM_NAO_E_PROPOSTA);

  const comPreco = l.propostas.filter((p) => p.preco != null && p.preco > 0);
  if (comPreco.length === 0) return pronta(MENSAGEM_SEM_PRECO);

  const resposta = await montarRespostaDeEstudo({
    supabase,
    produtor,
    propostas: l.propostas.slice(0, 12),
    origem: "midia",
    leitura: l,
    quantidadeInformada: quantidadeDaLegenda(midia.legenda ?? texto),
  });
  return pronta(resposta);
}
