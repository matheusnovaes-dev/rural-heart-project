import type { SupabaseClient } from "@supabase/supabase-js";

import { culturaMencionada, normalizarCultura } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import {
  avaliarPropostas,
  idadeDoDocumentoEmDias,
  lerDataDoDocumento,
  TAXA_MENSAL_PADRAO,
} from "@/lib/bot/propostas/avaliar";
import { lerMidia } from "@/lib/bot/propostas/lerMidia";
import { obterReferencia } from "@/lib/bot/propostas/referencia";
import { mensagemDeLimite, verificarLimiteDeEstudos } from "@/lib/bot/propostas/limite";
import { referenciaDoEstudo } from "@/lib/bot/propostas/acompanhamento";
import { salvarEstudo } from "@/lib/bot/propostas/salvo";
import { buscarFrete } from "@/lib/paridade";
import { montarEstudo } from "@/lib/bot/propostas/texto";
import type {
  EstudoSalvo,
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

/**
 * Trava de custo, igual para todos os planos: leituras de foto/PDF (cada uma é uma chamada
 * de visão) por número a cada 24h, contando as que não deram estudo. O limite por plano,
 * que é o que muda o que o produtor recebe, fica em propostas/limite.ts.
 */
export const LIMITE_DE_LEITURAS_POR_DIA = 30;
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${Math.abs(n).toFixed(1).replace(".", ",")}%`;

/** "tenho 3.000 sacas", "são 5 mil sacas": quantidade que o produtor escreveu na legenda. */
/** UF escrita no local de entrega do documento: "Rondonópolis (MT)", "Sorriso - MT". */
export function ufDoLocal(local: string | null | undefined): string | null {
  if (!local) return null;
  const m = local.match(/(?:\(|[-,/]\s*)([A-Za-z]{2})(?:\)|\s*$)/);
  const uf = m?.[1]?.toUpperCase();
  return uf && ufs.some((u) => u.value === uf) ? uf : null;
}

export function quantidadeDaLegenda(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const m = texto.match(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(mil)?\s*(?:sacas?|sc\b|arrobas?)/i);
  if (!m) return null;
  let n = Number(m[1]!.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (m[2]) n *= 1000;
  return n > 0 ? Math.round(n) : null;
}

function ufValida(uf: string | null | undefined): string | null {
  const u = uf?.trim().toUpperCase();
  return u && ufs.some((x) => x.value === u) ? u : null;
}

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Derivado ou insumo não é a cultura: "farelo de soja", "óleo de soja", "casca de soja" têm
 * outro preço (por tonelada, da indústria) e nunca devem ser comparados com a saca do grão.
 */
const DERIVADO_RE =
  /\b(farelo|oleo|torta|casca|bagaco|silagem|racao|semente|sementes|muda|mudas|adubo|fertilizante|calcario|ureia|herbicida|fungicida|inseticida|defensivo|sal mineral)\b/;
export const ehProdutoDerivado = (produto: string | null | undefined): boolean =>
  !!produto && DERIVADO_RE.test(semAcento(produto));

function descreverPreco(p: PropostaLida): string {
  const un =
    p.unidade_do_preco === "nao_informada" || p.unidade_do_preco === "outra"
      ? ""
      : ` por ${p.unidade_do_preco}`;
  const prazo =
    p.prazo_pagamento_dias == null
      ? ""
      : p.prazo_pagamento_dias === 0
        ? " à vista"
        : ` em ${p.prazo_pagamento_dias} dias`;
  return `${brl(p.preco ?? 0)}${un}${prazo}`;
}

function linhasDeDerivados(derivadas: PropostaLida[]): string {
  const nomes = [...new Set(derivadas.map((p) => (p.produto ?? "produto").trim()))];
  const lista = derivadas
    .filter((p) => p.preco != null && p.preco > 0)
    .map((p) => `  - ${p.produto ?? "item"}: ${descreverPreco(p)}`)
    .join("\n");
  return `• *${nomes.join(", ")}*: é outro produto (não é o grão), então não tenho preço de referência pra comparar. Li:\n${lista}`;
}

function textoDeDerivados(derivadas: PropostaLida[], leitura?: LeituraDeMidia): string {
  const data = leitura?.data_documento ? ` (documento de ${leitura.data_documento})` : "";
  return `Li o documento${data}, mas os preços são de ${[...new Set(derivadas.map((p) => (p.produto ?? "produto").trim()))].join(", ")}, que são outro produto (não o grão), e eu não tenho preço de referência pra comparar.\n${derivadas
    .filter((p) => p.preco != null && p.preco > 0)
    .map((p) => `• ${p.produto ?? "item"}: ${descreverPreco(p)}`)
    .join(
      "\n",
    )}\n\nSe quiser comparar a cultura (soja, milho, boi...), me diga o produto e o preço.`;
}

/** Documento antigo demais para comparar com o mercado de hoje: lista o que leu e não dá veredito. */
export const LIMITE_DE_IDADE_DO_DOCUMENTO_DIAS = 45;

export function textoDeDocumentoAntigo(l: LeituraDeMidia, dias: number): string {
  const d = lerDataDoDocumento(l.data_documento)!;
  const quando = d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const tempo =
    dias >= 365
      ? `${Math.floor(dias / 365)} ${Math.floor(dias / 365) === 1 ? "ano" : "anos"} atrás`
      : `${Math.round(dias / 30)} meses atrás`;
  const o = l.tipo_documento === "proposta_de_compra" ? "Essa proposta" : "Essa tabela";
  const linhas = l.propostas
    .filter((p) => p.preco != null && p.preco > 0)
    .slice(0, 10)
    .map((p) => `• ${(p.produto ?? p.comprador ?? "Item").trim()}: ${descreverPreco(p)}`)
    .join("\n");
  return `🗓️ *Documento de ${quando}*\n\n${o} é de ${quando}, ${tempo}. Não comparo com o preço de hoje, porque não faria sentido: o mercado mudou muito desde então.\n\n*O que está escrito nela*\n${linhas}\n\nSe você tem uma versão atual, manda a foto ou o PDF que eu faço o estudo na hora. Ou me diga o preço de hoje que você está vendo.`;
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
  // Se o documento nomeia algum produto que reconhecemos, linha com produto escrito e desconhecido
  // fica de fora: herdar a cultura do cadastro misturaria (ex.: "Integração" de suíno entrando como soja).
  const algumReconhecido = propostas.some((p) => p.produto && culturaMencionada(p.produto));
  for (const p of propostas) {
    const reconhecido = p.produto ? culturaMencionada(p.produto) : null;
    if (!reconhecido && p.produto && algumReconhecido) continue;
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

export type ResultadoDaConstrucao =
  { ok: true; estudo: EstudoSalvo } | { ok: false; mensagem: string };

/**
 * Monta o estudo a partir de propostas já lidas (de foto/PDF) ou contadas em
 * texto: escolhe o produto e o estado, busca a referência de mercado e guarda
 * tudo num EstudoSalvo. O modelo só lê o documento, nunca escreve a conta.
 */
export async function construirEstudo(args: {
  supabase: SupabaseClient;
  produtor: ProdutorContexto;
  propostas: PropostaLida[];
  origem: "midia" | "texto";
  leitura?: LeituraDeMidia | undefined;
  quantidadeInformada?: number | null | undefined;
  hoje?: Date | undefined;
}): Promise<ResultadoDaConstrucao> {
  const { supabase, produtor, propostas, origem, leitura } = args;
  // O estado do cadastro, a menos que o próprio documento diga onde é a entrega ("Rondonópolis (MT)").
  const ufDoTexto = ufValida(leitura?.uf_do_documento);
  const ufDoDocumento =
    propostas.map((p) => ufDoLocal(p.local_entrega)).find(Boolean) ?? ufDoTexto ?? null;
  const uf = ufDoDocumento ?? produtor.uf;
  if (!uf) {
    return {
      ok: false,
      mensagem:
        "Pra comparar com o mercado eu preciso saber seu estado. Me diga em qual estado você vende e eu faço o estudo.",
    };
  }
  const avisoUf =
    ufDoDocumento && produtor.uf && ufDoDocumento !== produtor.uf
      ? `Usei ${ufDoDocumento} como referência, porque é o estado que aparece no documento (seu cadastro é ${produtor.uf}).`
      : undefined;
  const idade = idadeDoDocumentoEmDias(leitura?.data_documento, args.hoje ?? new Date());
  const avisoIdade =
    idade != null && idade >= 8
      ? `O documento é de ${lerDataDoDocumento(leitura!.data_documento)!.toLocaleDateString("pt-BR", { timeZone: "UTC" })} (${idade} dias atrás): o mercado pode ter mudado desde então.`
      : undefined;
  const derivadas = propostas.filter((p) => ehProdutoDerivado(p.produto));
  const grupos = agrupar(
    propostas.filter((p) => !ehProdutoDerivado(p.produto)),
    produtor.cultura_principal,
  ).slice(0, 4);
  if (grupos.length === 0 && derivadas.length > 0) {
    return { ok: false, mensagem: textoDeDerivados(derivadas, leitura) };
  }
  if (grupos.length === 0) {
    return {
      ok: false,
      mensagem:
        "Li o documento, mas não consegui saber de qual produto são os preços. Me diga o produto (soja, milho, boi...) que eu faço o estudo.",
    };
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
    return {
      ok: false,
      mensagem: `Ainda não tenho preço de referência de ${rotuloDoProduto(principal!.produto)} em ${uf} pra comparar. Isto é o que li:\n${lista}\n\nSe quiser, me diga outro estado ou produto de referência.`,
    };
  }

  // Proposta entregue (CIF): o frete é do produtor e a conta não o desconta. A tabela de frete
  // (Sifreca) mede da origem até o PORTO, não até o armazém do comprador; por isso só entra como
  // ordem de grandeza, e só com a localização do produtor (sem ela a rota escolhida seria qualquer uma).
  let avisoFrete: string | undefined;
  if (
    principal!.propostas.some((p) => p.frete === "cif_entregue") &&
    produtor.lat != null &&
    produtor.lon != null &&
    produtor.uf
  ) {
    try {
      const f = await buscarFrete(supabase, {
        cultura: principal!.produto,
        uf: produtor.uf,
        lat: produtor.lat,
        lon: produtor.lon,
        ...(args.hoje ? { hoje: args.hoje } : {}),
      });
      if (f) {
        avisoFrete = `Para ter noção do frete: de ${f.rota.municipio_origem} até ${f.rota.municipio_destino} a referência é cerca de ${brl(f.frete_por_saca)} por saca (tabela Sifreca, até o porto). Até o armazém do comprador pode ser menos ou mais; pergunte o valor exato.`;
      }
    } catch {
      avisoFrete = undefined;
    }
  }

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
  if (derivadas.length > 0) {
    extras = [extras, linhasDeDerivados(derivadas)].filter(Boolean).join("\n");
  }

  return {
    ok: true,
    estudo: {
      v: 1,
      criadoEm: (args.hoje ?? new Date()).toISOString(),
      origem,
      tipoDocumento: leitura?.tipo_documento,
      confianca: leitura?.confianca,
      produto: principal!.produto,
      uf,
      avisoUf: [avisoUf, avisoIdade, avisoFrete].filter(Boolean).join(" ") || undefined,
      ref: refPrincipal.ref,
      propostas: principal!.propostas,
      taxaMensal: TAXA_MENSAL_PADRAO,
      quantidadeInformada: args.quantidadeInformada ?? null,
      extras,
    },
  };
}

/** Texto do estudo (novo ou refeito) a partir do estudo guardado. */
export function renderizarEstudo(
  e: EstudoSalvo,
  opts: { mudancas?: string[] | undefined; hoje?: Date | undefined } = {},
): string {
  const ref = referenciaDoEstudo(e);
  const avaliadas = avaliarPropostas(e.propostas, ref, {
    taxaMensal: e.taxaMensal,
    quantidadePadrao: e.quantidadeInformada,
    hoje: opts.hoje,
  });
  return montarEstudo({
    origem: e.origem,
    tipoDocumento: e.tipoDocumento,
    confianca: e.confianca,
    avaliadas,
    ref,
    produto: rotuloDoProduto(e.produto),
    uf: e.uf,
    taxaMensal: e.taxaMensal,
    extras: e.extras,
    avisoUf: e.avisoUf,
    refeito: opts.mudancas ? { mudancas: opts.mudancas } : undefined,
  });
}

/**
 * Estudo completo em texto. Com `telefone`, guarda o estudo na conversa para o
 * produtor poder questionar a conta e pedir para refazer com outro valor.
 */
export async function montarRespostaDeEstudo(args: {
  supabase: SupabaseClient;
  produtor: ProdutorContexto;
  propostas: PropostaLida[];
  origem: "midia" | "texto";
  leitura?: LeituraDeMidia | undefined;
  quantidadeInformada?: number | null | undefined;
  hoje?: Date | undefined;
  telefone?: string | undefined;
}): Promise<string> {
  const r = await construirEstudo(args);
  if (!r.ok) return r.mensagem;
  if (args.telefone) await salvarEstudo(args.supabase, args.telefone, r.estudo);
  return renderizarEstudo(r.estudo, { hoje: args.hoje });
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
const MENSAGEM_LIMITE_DE_LEITURAS = `Hoje já abri ${LIMITE_DE_LEITURAS_POR_DIA} arquivos seus, que é o limite por dia. Amanhã eu continuo.`;

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

  // A trava por plano: Bronze 3 estudos por dia, Prata e Ouro 15. Só estudos entregues contam.
  const situacao = await verificarLimiteDeEstudos(supabase, { telefone, produtorId: produtor.id });
  if (!situacao.permitido) return pronta(mensagemDeLimite(situacao));

  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("bot_conversas")
    .select("id", { count: "exact", head: true })
    .eq("telefone", telefone)
    .eq("role", "user")
    .or("conteudo.like.[Imagem enviada]%,conteudo.like.[PDF enviado%")
    .gte("created_at", desde);
  if ((count ?? 0) > LIMITE_DE_LEITURAS_POR_DIA) return pronta(MENSAGEM_LIMITE_DE_LEITURAS);

  const leitura = await lerMidia(apiKey, midia, signal);
  if (!leitura.ok) {
    return pronta(leitura.motivo === "mime_nao_suportado" ? MENSAGEM_FORMATO : MENSAGEM_FALHA, {
      precisa_humano: false,
    });
  }
  const l = leitura.leitura;
  if (!l.legivel) return pronta(MENSAGEM_ILEGIVEL);
  const idade = idadeDoDocumentoEmDias(l.data_documento, new Date());
  if (idade != null && idade > LIMITE_DE_IDADE_DO_DOCUMENTO_DIAS && l.propostas.length > 0) {
    return pronta(textoDeDocumentoAntigo(l, idade));
  }
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
    telefone,
  });
  return pronta(resposta);
}
