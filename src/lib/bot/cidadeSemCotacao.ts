import { ufs } from "@/config/ufs";
import { buscarMunicipio } from "@/lib/clima";

/**
 * Pergunta de preço com uma cidade que não é praça de cotação ("quanto tá a saca em Sinop"): a ferramenta de preço
 * trabalha por estado, então o modelo respondia com a praça de outro lugar (Sorriso) sem dizer que Sinop não tem
 * cotação própria (auditoria de 2026-10-16). Aqui a cidade citada é validada de verdade (geocodificação dentro da UF,
 * nome idêntico) e, se não aparece na resposta, entra uma frase dizendo o que o produtor está vendo.
 */
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const CANDIDATA =
  /(?<![\p{L}\p{N}])(?:em|na|no|pra|para|aqui em|l[aá] em|perto de)\s+([\p{L}][\p{L}'’-]*(?:\s+(?:d[aoe]s?\s+)?[\p{L}][\p{L}'’-]*){0,3})/giu;

const NAO_E_CIDADE = new Set(
  [
    "hoje",
    "agora",
    "reais",
    "real",
    "saca",
    "sacas",
    "kg",
    "semana",
    "mes",
    "dia",
    "ano",
    "geral",
    "media",
    "mercado",
    "casa",
    "estoque",
    "grao",
    "graos",
    "pluma",
    "arroba",
    "arrobas",
    "tonelada",
    "toneladas",
    "porto",
    "bolsa",
    "soja",
    "milho",
    "boi",
    "cafe",
    "trigo",
    "arroz",
    "feijao",
    "algodao",
    "leite",
    "cana",
    ...ufs.flatMap((u) => [semAcento(u.label), u.value.toLowerCase()]),
  ].map(semAcento),
);

const PREFIXO_DE_LUGAR = /^(?:regi[aã]o|cidade|munic[ií]pio|pra[cç]a|zona)\s+(?:d[aeo]s?\s+)?/iu;
const NOMES_DE_ESTADO = ufs.map((u) => semAcento(u.label));

export function candidatasDeCidade(texto: string): string[] {
  const achadas: string[] = [];
  for (const m of texto.matchAll(CANDIDATA)) {
    let bruto = m[1]!.trim().replace(PREFIXO_DE_LUGAR, "");
    const b = semAcento(bruto);
    // "em Mato Grosso", "em Goiás": é estado, não cidade
    if (NOMES_DE_ESTADO.some((n) => b === n || b.startsWith(`${n} `))) continue;
    // corta no primeiro nome que não é cidade ("Sorriso hoje" -> "Sorriso")
    const palavras = bruto.split(/\s+/);
    const corte = palavras.findIndex((p, i) => i > 0 && NAO_E_CIDADE.has(semAcento(p)));
    bruto = (corte === -1 ? palavras : palavras.slice(0, corte)).join(" ");
    if (!bruto || NAO_E_CIDADE.has(semAcento(bruto))) continue;
    achadas.push(bruto);
  }
  return achadas;
}

export async function avisarCidadeSemCotacao(
  resposta: string,
  texto: string,
  opcoes: { uf: string | null; chamouPreco: boolean },
): Promise<string> {
  if (!opcoes.chamouPreco || !opcoes.uf || !/R\$/.test(resposta)) return resposta;
  const nomeUf = ufs.find((u) => u.value === opcoes.uf!.toUpperCase())?.label;
  if (!nomeUf) return resposta;
  const respostaSem = semAcento(resposta);
  for (const candidata of candidatasDeCidade(texto).slice(0, 2)) {
    if (respostaSem.includes(semAcento(candidata))) continue;
    const achada = await buscarMunicipio(candidata, nomeUf);
    if (!achada || semAcento(achada.nome) !== semAcento(candidata)) continue;
    return `${resposta.trim()} Obs: não tenho cotação específica de ${achada.nome}; os preços acima são das praças que acompanho em ${nomeUf}.`;
  }
  return resposta;
}
