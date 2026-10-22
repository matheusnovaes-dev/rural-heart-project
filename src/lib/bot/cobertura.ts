import type { SupabaseClient } from "@supabase/supabase-js";

import { filtrarPorProduto, normalizarCultura } from "@/config/culturas";
import { culturasMencionadas } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { escolherPrecosOutrasUfs, type LinhaOutraUf } from "@/lib/referenciaMercado";
import { ehFonteMensal, mesPorExtenso } from "@/lib/precoFonte";

/**
 * "Onde tem preço de cana?" / "quais estados vocês cobrem de boi?" / "em que estados tem dado de polpa?": respondida por
 * CÓDIGO, direto do banco. Antes ia para o modelo, que às vezes listava de cabeça os maiores produtores (achado
 * 2026-10-22: "São Paulo, Goiás, Alagoas, Pernambuco e Minas Gerais" quando só havia AL, PR e SP) ou dizia "nenhum estado"
 * tendo dado. Aqui a lista é exatamente o que existe, com fonte e data de cada estado.
 */
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const JANELA_DIAS = 200; // cobre também as fontes mensais (IEA-SP tem uns 4 meses de atraso)
const MAX_UFS = 15;

// Dois formatos: (1) "onde/em quais estados ... tem preço|dado|cotação ..." (a pergunta fala de DADO) e (2) "quais estados
// vocês cobrem|acompanham ...". "Onde tem pra vender soja?" e "no estado onde tem mais" não são cobertura de dados.
const PERGUNTA_DE_COBERTURA = new RegExp(
  [
    String.raw`\b(?:onde|em que(?:m)? (?:estados?|ufs?|lugares?|regioes?)|em quais (?:estados?|ufs?|lugares?|regioes?)|quais (?:estados?|ufs?)|que (?:estados?|ufs?))\b[^?]*\b(?:tem|ha|existe|temos|voces tem)\s+(?:o\s+)?(?:preco|precos|dado|dados|cotacao|cotacoes|informacao|informacoes)\b`,
    String.raw`\b(?:quais|que|em quais|em que) (?:estados?|ufs?)\b[^?]*\b(?:cobrem|cobre|cobrimos|acompanham|acompanha|acompanhamos)\b`,
  ].join("|"),
);

/** O produto da pergunta de cobertura ("de cana", "de boi", "de polpa"), ou null se não for esse tipo de pergunta. */
export function lerPerguntaDeCobertura(texto: string): string | null {
  const t = semAcento(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Derivado que o catálogo não tem ("polpa de cana", "melaço de cana", "semente de soja"): o modelo trocava pelo produto
  // principal e respondia sobre cana/soja (achado 2026-10-22). "polpa de buriti" existe no catálogo e segue o fluxo normal.
  const original = texto.toLowerCase().replace(/[?!.,]/g, " ");
  const derivado = original.match(
    /\b(polpa|mela[çc]o|vinha[çc]a|caldo|palha|silagem|sementes?|mudas?)\s+(?:de|do|da)\s+([a-zà-ú]{3,}(?:\s+de\s+[a-zà-ú]{3,})?)/,
  );
  if (
    derivado &&
    /\b(preco|precos|quanto|cotacao|valor|tem|ta|esta|custa)\b/.test(t) &&
    !/\b(comprador|compradores|compra|vender|vendo|venda)\b/.test(t)
  ) {
    const frase = `${derivado[1]} de ${derivado[2]}`;
    const noCatalogo = culturasMencionadas(frase).some((c) =>
      semAcento(c).startsWith(semAcento(derivado[1]!)),
    );
    if (!noCatalogo) return frase;
  }
  // "tem dado de polpa?" com produto FORA do catálogo: sem ferramenta o modelo respondia de cabeça pela conversa anterior
  // ("polpa de cana" depois de falar de cana). Produto do catálogo ("tem preço de soja?") segue o fluxo normal de preço.
  const foraDoCatalogo = t.match(
    /\b(?:tem|ha|existe|voces tem)\s+(?:dado|dados|preco|precos|cotacao|cotacoes|informacao|informacoes)\s+(?:de|do|da|dos|das|sobre)\s+([a-z]{3,}(?:\s+de\s+[a-z]{3,})?)\s*$/,
  );
  if (foraDoCatalogo && culturasMencionadas(t).length === 0) return foraDoCatalogo[1]!;
  if (!PERGUNTA_DE_COBERTURA.test(t)) return null;
  const culturas = culturasMencionadas(t);
  if (culturas.length === 1 && PERGUNTA_DE_COBERTURA.test(t)) return culturas[0]!;
  if (culturas.length > 1) return null; // duas culturas: deixa o fluxo normal conduzir
  // produto fora do catálogo ("polpa", "mel"): a palavra depois de "de/do/da" ("onde tem dado de polpa")
  const m = t.match(/\b(?:de|do|da|dos|das|sobre)\s+([a-z]{3,}(?:\s+de\s+[a-z]{3,})?)\s*$/);
  const alvo = m?.[1];
  if (!alvo || /^(?:preco|dado|dados|cotacao|voces|todos|estados?)$/.test(alvo)) return null;
  return alvo;
}

const brl = (n: number) => `R$${n.toFixed(2).replace(".", ",")}`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const nomeUf = (uf: string) => ufs.find((u) => u.value === uf)?.label ?? uf;

export function montarRespostaDeCobertura(params: {
  produto: string;
  ufDoProdutor: string | null;
  linhas: LinhaOutraUf[];
  hojeIso: string;
}): string {
  const { produto, ufDoProdutor, linhas, hojeIso } = params;
  // sem o corte de 5 estados da referência de mercado: aqui a lista é a cobertura inteira
  const porUf = escolherPrecosOutrasUfs(linhas, "", hojeIso, JANELA_DIAS, 30)
    .sort((a, b) => nomeUf(a.uf).localeCompare(nomeUf(b.uf)))
    .slice(0, MAX_UFS);
  const nome = produto;
  if (porUf.length === 0) {
    return `Hoje não temos preço de ${nome} em nenhum estado. Posso te avisar se isso mudar, ou buscar outra cultura.`;
  }
  const unidade = (u: string | null) =>
    u
      ? ` por ${/^sc\.?\s*60\s*kg$/i.test(u.trim()) ? "60 kg" : u === "15 kg" ? "arroba (15 kg)" : /^t\s+\w+/i.test(u) ? "t" : u}`
      : "";
  const item = (o: (typeof porUf)[number]) => {
    const quando = ehFonteMensal(o.fonte)
      ? `média de ${mesPorExtenso(o.data_referencia)}`
      : dataBr(o.data_referencia);
    return `${nomeUf(o.uf)}: ${brl(o.preco)}${unidade(o.unidade)} (${o.fonte}, ${quando})`;
  };
  const temNoDele = ufDoProdutor ? porUf.some((o) => o.uf === ufDoProdutor) : false;
  const abertura =
    ufDoProdutor && !temNoDele
      ? `Em ${nomeUf(ufDoProdutor)} ainda não temos preço de ${nome}. Temos em ${porUf.length} ${porUf.length === 1 ? "estado" : "estados"}:`
      : `Temos preço de ${nome} em ${porUf.length} ${porUf.length === 1 ? "estado" : "estados"}:`;
  return `${abertura}\n${porUf.map((o) => `• ${item(o)}`).join("\n")}\n\nÉ o dado mais recente de cada um. Quer o de algum desses estados em detalhe? É só pedir, ex: "${nome} em ${nomeUf(porUf[0]!.uf)}".`;
}

export async function responderCoberturaDoProduto(
  supabase: SupabaseClient,
  texto: string,
  ufDoProdutor: string | null,
): Promise<{ resposta: string; precisa_humano: boolean; convite_dispensado: boolean } | null> {
  const produto = lerPerguntaDeCobertura(texto);
  if (!produto) return null;
  const desde = new Date(Date.now() - JANELA_DIAS * 86_400_000).toISOString().slice(0, 10);
  const { data } = await filtrarPorProduto(
    supabase
      .from("precos")
      .select("uf, preco, data_referencia, fonte, unidade, regiao, produto")
      .gte("data_referencia", desde)
      .order("data_referencia", { ascending: false })
      .limit(1500),
    produto,
  ).returns<LinhaOutraUf[]>();
  const hojeIso = new Date().toISOString().slice(0, 10);
  return {
    resposta: montarRespostaDeCobertura({
      produto: normalizarCultura(produto),
      ufDoProdutor,
      linhas: data ?? [],
      hojeIso,
    }),
    precisa_humano: false,
    convite_dispensado: true,
  };
}
