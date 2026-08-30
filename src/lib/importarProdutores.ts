import { normalizarWhatsapp } from "@/lib/telefone";
import { culturas } from "@/config/culturas";

export type LinhaImportada = {
  linha: number;
  nome: string;
  whatsapp: string;
  cultura: string | null;
  uf: string | null;
  erro: string | null;
};

// Cola do Excel/Sheets vem separada por TAB; CSV exportado costuma vir por
// ";" (padrão pt-BR, já que "," é separador decimal) ou "," (padrão
// internacional) — em vez de exigir um formato só, detecta pelo cabeçalho.
export function detectarDelimitador(linha: string): string {
  const candidatos = ["\t", ";", ","];
  let melhor = candidatos[0]!;
  let maiorContagem = -1;
  for (const c of candidatos) {
    const contagem = linha.split(c).length;
    if (contagem > maiorContagem) {
      maiorContagem = contagem;
      melhor = c;
    }
  }
  return melhor;
}

export function normalizarTexto(v: string) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function encontrarCultura(texto: string): string | null {
  const alvo = normalizarTexto(texto);
  if (!alvo) return null;
  const match = culturas.find(
    (c) => normalizarTexto(c.value) === alvo || normalizarTexto(c.label) === alvo,
  );
  return match?.value ?? null;
}

export function parseLinhas(texto: string): LinhaImportada[] {
  // Sem .map(trim) na linha inteira: uma linha com o nome vazio começa com
  // o delimitador (ex: "\t379...\tSoja\tMG") — dar trim aqui comeria essa
  // tabulação e desalinharia todas as colunas seguintes. Só descarta linha
  // 100% em branco, sem alterar o conteúdo das que sobram.
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) return [];

  const delimitador = detectarDelimitador(linhas[0]!);
  const primeiraColunas = linhas[0]!.split(delimitador).map((c) => normalizarTexto(c));
  // Cabeçalho é opcional — se a primeira linha parecer dado de verdade (ex:
  // já começa com um nome), processa ela também em vez de descartar.
  const temCabecalho = primeiraColunas.some((c) => c.includes("nome") || c.includes("whatsapp"));
  const linhasDeDado = temCabecalho ? linhas.slice(1) : linhas;
  const offset = temCabecalho ? 2 : 1;

  return linhasDeDado.map((linha, i) => {
    const colunas = linha.split(delimitador).map((c) => c.trim().replace(/^"|"$/g, ""));
    const [nome = "", whatsapp = "", culturaTexto = "", ufTexto = ""] = colunas;
    const whatsappNormalizado = normalizarWhatsapp(whatsapp);

    let erro: string | null = null;
    if (!nome.trim()) erro = "Nome vazio";
    else if (whatsappNormalizado.length < 10 || whatsappNormalizado.length > 11) {
      erro = "WhatsApp inválido";
    }

    return {
      linha: i + offset,
      nome: nome.trim(),
      whatsapp: whatsappNormalizado,
      cultura: encontrarCultura(culturaTexto),
      uf: ufTexto.trim() ? ufTexto.trim().toUpperCase().slice(0, 2) : null,
      erro,
    };
  });
}
