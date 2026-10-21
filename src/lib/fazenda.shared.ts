import { normalizarCultura } from "@/config/culturas";

/**
 * Caderno da fazenda: tipos, categorias, leitura de números escritos à mão e contas do resumo.
 * Fica fora do bot e do painel porque os dois usam exatamente as mesmas regras (o que é gasto,
 * como se soma, o que é "este mês"). Sem dependência de servidor, para rodar também no navegador.
 */

export const TIPOS_REGISTRO = ["gasto", "venda", "plantio", "colheita", "nota", "estoque"] as const;
export type TipoRegistro = (typeof TIPOS_REGISTRO)[number];

export const ROTULO_TIPO: Record<TipoRegistro, string> = {
  gasto: "Gasto",
  venda: "Venda",
  plantio: "Plantio",
  colheita: "Colheita",
  nota: "Anotação",
  estoque: "Estoque",
};

/** realizado = já aconteceu; pendente = a pagar ou a receber (tem vencimento); rascunho = nota lida da foto, esperando o "sim". */
export type Situacao = "realizado" | "pendente" | "rascunho";

export type RegistroFazenda = {
  id: string;
  tipo: TipoRegistro;
  /** AAAA-MM-DD */
  ocorrido_em: string;
  valor: number | null;
  descricao: string;
  categoria: string | null;
  cultura: string | null;
  talhao: string | null;
  quantidade: number | null;
  unidade: string | null;
  preco_unitario: number | null;
  origem: "whatsapp" | "painel" | "funcionario";
  criado_em: string;
  situacao: Situacao;
  /** AAAA-MM-DD, só em pendente */
  vence_em: string | null;
  lembrete_id: string | null;
  /** dia em que foi pago ou recebido */
  realizado_em: string | null;
  /** nome do funcionário que lançou (origem funcionario) */
  lancado_por: string | null;
};

/** Colunas lidas do banco (a mesma lista no bot e no painel). */
export const COLUNAS_REGISTRO =
  "id, tipo, ocorrido_em, valor, descricao, categoria, cultura, talhao, quantidade, unidade, preco_unitario, origem, criado_em, situacao, vence_em, lembrete_id, realizado_em, lancado_por";

/** Categorias de gasto (a lista que o painel oferece e que o bot escolhe sozinho pelo texto). */
export const CATEGORIAS_GASTO = [
  "Adubo e corretivos",
  "Sementes e mudas",
  "Defensivos",
  "Combustível",
  "Mão de obra",
  "Máquinas e manutenção",
  "Frete e transporte",
  "Energia e água",
  "Arrendamento",
  "Animais e sanidade",
  "Impostos e taxas",
  "Outros",
] as const;

const SEM_ACENTO = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const REGRAS_CATEGORIA: [RegExp, (typeof CATEGORIAS_GASTO)[number]][] = [
  [
    /\b(adub\w*|fertiliz\w*|calcario|calagem|gesso|ureia|npk|fosfat\w*|potassio|cloreto de potassio)\b/,
    "Adubo e corretivos",
  ],
  [/\b(semente\w*|muda\w*|plantio de muda)\b/, "Sementes e mudas"],
  [
    /\b(defensiv\w*|veneno|herbicid\w*|fungicid\w*|inseticid\w*|agrotoxic\w*|dessec\w*|glifosato|aplicacao)\b/,
    "Defensivos",
  ],
  [/\b(diesel|combustivel|gasolina|oleo diesel|abastec\w*)\b/, "Combustível"],
  [
    /\b(mao de obra|diaria\w*|salario\w*|funcionario\w*|empregad\w*|pedreiro|peao|vaqueiro|tratorista|13o|ferias|inss|fgts)\b/,
    "Mão de obra",
  ],
  [
    /\b(manutencao|conserto|reparo|peca\w*|pneu\w*|trator\w*|colheitadeira|pulverizador|implemento\w*|oficina|mecanico)\b/,
    "Máquinas e manutenção",
  ],
  [/\b(frete|transporte|caminhao|carreto)\b/, "Frete e transporte"],
  [/\b(energia|luz|conta de luz|irrigacao|agua|poco)\b/, "Energia e água"],
  [/\b(arrendamento|arrendei|aluguel de terra|aluguel da terra)\b/, "Arrendamento"],
  [
    /\b(racao|sal mineral|vacina\w*|vermifug\w*|veterinari\w*|medicamento\w*|remedio\w* do gado|suplemento|silagem|gado|bezerro\w*)\b/,
    "Animais e sanidade",
  ],
  [/\b(imposto\w*|itr|funrural|taxa\w*|seguro|licenca|financiamento|juros)\b/, "Impostos e taxas"],
];

/** Categoria de gasto adivinhada pelo texto ("adubo no talhão 3" -> Adubo e corretivos). */
export function categoriaDeTexto(texto: string): (typeof CATEGORIAS_GASTO)[number] {
  const t = SEM_ACENTO(texto);
  for (const [re, cat] of REGRAS_CATEGORIA) if (re.test(t)) return cat;
  return "Outros";
}

/** Aceita a categoria que o modelo mandou só se for uma das nossas; senão adivinha pelo texto. */
export function categoriaValida(categoria: string | null | undefined, descricao: string): string {
  const achada = CATEGORIAS_GASTO.find((c) => c === categoria);
  // "Outros" do modelo não vale mais que a palavra-chave ("comprei um trator" é máquina)
  if (achada && achada !== "Outros") return achada;
  const pelaPalavra = categoriaDeTexto(`${categoria ?? ""} ${descricao}`);
  return pelaPalavra === "Outros" && achada ? achada : pelaPalavra;
}

// ---------------------------------------------------------------------------------------------
// Números escritos à mão
// ---------------------------------------------------------------------------------------------

function paraNumero(bruto: string): number | null {
  let s = bruto;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
  else if (/^\d+\.\d{3}$/.test(s)) s = s.replace(".", "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Todos os números que a pessoa escreveu, já em valor (12 mil -> 12000, 1,5 mil -> 1500,
 * R$ 12.000,50 -> 12000.5, 3 mil e 500 -> 3500). Serve para conferir, por código, que o valor que o
 * modelo mandou gravar está de fato na mensagem (modelo erra "12 mil" vira 12 e esse erro entraria no
 * caderno do produtor para sempre).
 */
export function numerosDoTexto(texto: string): number[] {
  const t = SEM_ACENTO(texto).replace(/r\$\s*/g, "");
  const achados = new Set<number>();
  // "1 milhão e 800 mil" (e "2 milhões e 300 mil"): o que a regra geral abaixo leria como 1.000.000 e 800.000 separados
  for (const m of t.matchAll(
    /(\d{1,3}(?:[.,]\d+)?)\s*(?:milhao|milhoes)\s*e\s*(\d{1,3})\s*mil\b/g,
  )) {
    const n = Number(m[1]!.replace(",", ".")) * 1_000_000 + Number(m[2]) * 1000;
    if (Number.isFinite(n)) achados.add(Math.round(n * 100) / 100);
  }
  const re =
    /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?:\s*(mil|k|milhoes|milhao)\b(?:\s+e\s+(meio|\d{1,3})\b)?)?/g;
  for (const m of t.matchAll(re)) {
    const base = paraNumero(m[1]!);
    if (base === null) continue;
    const mult = m[2] === "mil" || m[2] === "k" ? 1000 : m[2] ? 1_000_000 : 1;
    let n = base * mult;
    if (m[3] && mult > 1) n += m[3] === "meio" ? mult / 2 : Number(m[3]);
    achados.add(Math.round(n * 100) / 100);
  }
  // Número por extenso: quem manda áudio recebe a transcrição do Whisper, que às vezes escreve "doze mil" em vez de 12 mil
  for (const n of numerosPorExtenso(t)) achados.add(n);
  return [...achados];
}

const EXT_UNIDADES: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
};

/** "doze mil e quinhentos" -> 12500, "cento e trinta e cinco" -> 135, "um milhao e oitocentos mil" -> 1800000. Texto já sem acento. */
function numerosPorExtenso(t: string): number[] {
  // dígitos viram "#": "12 mil" já é lido pela regra numérica, o "mil" solto depois de um dígito não pode virar 1000
  const palavras = t.replace(/\d[\d.,]*/g, " # ").split(/[^a-z#]+/).filter(Boolean);
  const saida: number[] = [];
  let i = 0;
  const ehNum = (w: string | undefined) =>
    w !== undefined && (w in EXT_UNIDADES || w === "mil" || w === "milhao" || w === "milhoes");
  while (i < palavras.length) {
    const ant = palavras[i - 1];
    const w0 = palavras[i];
    if (!ehNum(w0) || (ant === "#" && (w0 === "mil" || w0 === "milhao" || w0 === "milhoes")) || (ant === "por" && w0 === "cento")) {
      i++;
      continue;
    }
    let total = 0;
    let atual = 0;
    let ultimoMult = 0;
    let usadas = 0;
    let soArtigo = true;
    while (i < palavras.length) {
      const w = palavras[i]!;
      if (w === "e" && usadas > 0 && (ehNum(palavras[i + 1]) || (ultimoMult && palavras[i + 1] === "meio"))) {
        i++;
        continue;
      }
      if (w === "meio" && ultimoMult) {
        total += ultimoMult / 2;
        ultimoMult = 0;
        usadas++;
        i++;
        continue;
      }
      if (!ehNum(w)) break;
      if (w in EXT_UNIDADES) {
        atual += EXT_UNIDADES[w]!;
        if (w !== "um" && w !== "uma") soArtigo = false;
        ultimoMult = 0;
      } else {
        const mult = w === "mil" ? 1000 : 1_000_000;
        total += (atual || 1) * mult;
        atual = 0;
        ultimoMult = mult;
        soArtigo = false;
      }
      usadas++;
      i++;
    }
    const n = total + atual;
    // "um"/"uma" sozinho quase sempre é artigo ("um gasto"), não valor
    if (!soArtigo && n > 0) saida.push(Math.round(n * 100) / 100);
  }
  return saida;
}

export function valorConfere(valor: number, numeros: number[]): boolean {
  return numeros.some((n) => Math.abs(n - valor) <= Math.max(0.01, Math.abs(valor) * 0.002));
}

// ---------------------------------------------------------------------------------------------
// Datas e dinheiro
// ---------------------------------------------------------------------------------------------

/** AAAA-MM-DD de hoje em Brasília. */
export function hojeBrasilia(agora: Date = new Date()): string {
  const brt = new Date(agora.getTime() - 3 * 3600_000);
  return brt.toISOString().slice(0, 10);
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function dataLonga(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type PeriodoCaderno = "mes" | "mes_passado" | "safra" | "ano" | "tudo";

export function intervaloDoPeriodo(
  periodo: PeriodoCaderno,
  hoje: string = hojeBrasilia(),
): { desde: string; ate: string; rotulo: string } {
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (periodo) {
    case "mes":
      return { desde: `${a}-${pad(m)}-01`, ate: hoje, rotulo: `${MESES[m - 1]}/${a}` };
    case "mes_passado": {
      const ma = m === 1 ? a - 1 : a;
      const mm = m === 1 ? 12 : m - 1;
      const ultimo = somarDias(`${a}-${pad(m)}-01`, -1);
      return { desde: `${ma}-${pad(mm)}-01`, ate: ultimo, rotulo: `${MESES[mm - 1]}/${ma}` };
    }
    case "safra": {
      // Safra brasileira: de 1º de setembro a 31 de agosto.
      const ini = m >= 9 ? a : a - 1;
      return {
        desde: `${ini}-09-01`,
        ate: hoje,
        rotulo: `safra ${ini}/${String(ini + 1).slice(2)}`,
      };
    }
    case "ano":
      return { desde: `${a}-01-01`, ate: hoje, rotulo: String(a) };
    default:
      return { desde: "2000-01-01", ate: hoje, rotulo: "tudo que foi lançado" };
  }
}

export function formatarReais(n: number): string {
  // negativo com o sinal na frente do R$ ("−R$ 187.000"), não "R$ -187.000"
  if (n < -0.004) return `−${formatarReais(-n)}`;
  const inteiro = Math.abs(n - Math.round(n)) < 0.005;
  return `R$ ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatarQuantidade(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------------------------

export type ResumoCaderno = {
  gastos: number;
  vendas: number;
  /** vendas menos gastos, só do que foi lançado */
  resultado: number;
  nGastos: number;
  nVendas: number;
  porCategoria: { categoria: string; total: number; n: number }[];
  porCultura: {
    cultura: string;
    gasto: number;
    venda: number;
    quantidadeVendida: number;
    unidadeVenda: string | null;
    precoMedioVenda: number | null;
  }[];
  plantios: RegistroFazenda[];
  colheitas: RegistroFazenda[];
  /** sacas (ou outra unidade) colhidas por cultura, somando os lançamentos de colheita */
  colhidoPorCultura: { cultura: string; quantidade: number; unidade: string | null }[];
  porTalhao: {
    chave: string;
    talhao: string;
    gasto: number;
    nGastos: number;
    culturas: string[];
  }[];
  nNotas: number;
  /** mais recentes primeiro */
  ultimos: RegistroFazenda[];
};

const ehRealizado = (r: RegistroFazenda) => (r.situacao ?? "realizado") === "realizado";

/** "Talhão 3", "talhao 3" e "TALHÃO  3" são o mesmo talhão. */
export function talhaoChave(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[º°.]/g, "")
    .replace(/\bn\s*(\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const porRecencia = (a: RegistroFazenda, b: RegistroFazenda) =>
  b.ocorrido_em.localeCompare(a.ocorrido_em) || b.criado_em.localeCompare(a.criado_em);

export function resumir(registrosBrutos: RegistroFazenda[]): ResumoCaderno {
  // pendente (a pagar, a receber) e rascunho (nota esperando o "sim") não entram em nenhuma conta
  const registros = registrosBrutos.filter(ehRealizado);
  const ordenados = [...registros].sort(porRecencia);
  const tal = new Map<
    string,
    { talhao: string; gasto: number; nGastos: number; culturas: Set<string> }
  >();
  const colhido = new Map<string, { quantidade: number; unidade: string | null }>();
  let gastos = 0;
  let vendas = 0;
  let nGastos = 0;
  let nVendas = 0;
  const cat = new Map<string, { total: number; n: number }>();
  const cult = new Map<
    string,
    { gasto: number; venda: number; qtd: number; valorComQtd: number; unidade: string | null }
  >();
  for (const r of ordenados) {
    if (r.tipo === "gasto" && r.valor !== null && r.talhao) {
      const k = talhaoChave(r.talhao);
      const t = tal.get(k) ?? {
        talhao: r.talhao,
        gasto: 0,
        nGastos: 0,
        culturas: new Set<string>(),
      };
      t.gasto += r.valor;
      t.nGastos++;
      if (r.cultura) t.culturas.add(r.cultura);
      tal.set(k, t);
    }
    if (r.tipo === "colheita" && r.quantidade && r.cultura) {
      const k = r.cultura.toLowerCase();
      const c = colhido.get(k) ?? { quantidade: 0, unidade: r.unidade };
      c.quantidade += r.quantidade;
      colhido.set(k, c);
    }
    const chave = r.cultura ?? "Geral";
    const c = cult.get(chave) ?? { gasto: 0, venda: 0, qtd: 0, valorComQtd: 0, unidade: null };
    if (r.tipo === "gasto" && r.valor !== null) {
      gastos += r.valor;
      nGastos++;
      const k = r.categoria ?? "Outros";
      const x = cat.get(k) ?? { total: 0, n: 0 };
      x.total += r.valor;
      x.n++;
      cat.set(k, x);
      c.gasto += r.valor;
    } else if (r.tipo === "venda" && r.valor !== null) {
      vendas += r.valor;
      nVendas++;
      c.venda += r.valor;
      if (r.quantidade) {
        c.qtd += r.quantidade;
        c.valorComQtd += r.valor;
        c.unidade ??= r.unidade;
      }
    }
    cult.set(chave, c);
  }
  return {
    gastos,
    vendas,
    resultado: vendas - gastos,
    nGastos,
    nVendas,
    porCategoria: [...cat.entries()]
      .map(([categoria, v]) => ({ categoria, ...v }))
      .sort((a, b) => b.total - a.total),
    porCultura: [...cult.entries()]
      .filter(([, v]) => v.gasto > 0 || v.venda > 0)
      .map(([cultura, v]) => ({
        cultura,
        gasto: v.gasto,
        venda: v.venda,
        quantidadeVendida: v.qtd,
        unidadeVenda: v.unidade,
        precoMedioVenda: v.qtd > 0 ? v.valorComQtd / v.qtd : null,
      }))
      .sort((a, b) => b.gasto + b.venda - (a.gasto + a.venda)),
    plantios: ordenados.filter((r) => r.tipo === "plantio"),
    colheitas: ordenados.filter((r) => r.tipo === "colheita"),
    colhidoPorCultura: [...colhido.entries()].map(([cultura, v]) => ({ cultura, ...v })),
    porTalhao: [...tal.entries()]
      .map(([chave, v]) => ({
        chave,
        talhao: v.talhao,
        gasto: v.gasto,
        nGastos: v.nGastos,
        culturas: [...v.culturas],
      }))
      .sort((a, b) => b.gasto - a.gasto),
    nNotas: ordenados.filter((r) => r.tipo === "nota").length,
    ultimos: ordenados.slice(0, 5),
  };
}

/** Linha curta de um lançamento, igual no WhatsApp e no painel. */
export function descreverRegistro(r: RegistroFazenda): string {
  const onde = r.talhao ? `, ${r.talhao}` : "";
  const de = r.cultura ? ` de ${r.cultura.toLowerCase()}` : "";
  const qtd =
    r.quantidade !== null && r.unidade ? `${formatarQuantidade(r.quantidade)} ${r.unidade}` : null;
  switch (r.tipo) {
    case "gasto":
      return `${dataCurta(r.ocorrido_em)}  Gasto de ${formatarReais(r.valor ?? 0)}: ${r.descricao}${onde}`;
    case "venda": {
      const preco = r.preco_unitario ? ` a ${formatarReais(r.preco_unitario)}` : "";
      return `${dataCurta(r.ocorrido_em)}  Venda${de}: ${formatarReais(r.valor ?? 0)}${
        qtd ? ` (${qtd}${preco})` : ""
      }`;
    }
    case "plantio":
      return `${dataCurta(r.ocorrido_em)}  Plantio${de}${qtd ? `, ${qtd}` : ""}${onde}`;
    case "colheita":
      return `${dataCurta(r.ocorrido_em)}  Colheita${de}${qtd ? `, ${qtd}` : ""}${onde}`;
    case "estoque":
      return `${dataCurta(r.ocorrido_em)}  Estoque${de}${qtd ? `: ${qtd}` : ""}`;
    default:
      return `${dataCurta(r.ocorrido_em)}  ${r.descricao}`;
  }
}

// ---------------------------------------------------------------------------------------------
// A pagar e a receber
// ---------------------------------------------------------------------------------------------

export type Pendencia = {
  registro: RegistroFazenda;
  tipo: "a_pagar" | "a_receber";
  vencimento: string;
  /** dias até vencer (negativo = vencido) */
  dias: number;
};

export function diasEntre(deIso: string, ateIso: string): number {
  return Math.round(
    (Date.parse(`${ateIso}T12:00:00Z`) - Date.parse(`${deIso}T12:00:00Z`)) / 86_400_000,
  );
}

export type ResumoPendencias = {
  aPagar: Pendencia[];
  aReceber: Pendencia[];
  totalAPagar: number;
  totalAReceber: number;
  vencidas: number;
};

/** Lançamentos pendentes separados em a pagar (gasto) e a receber (venda), mais próximos primeiro. */
export function resumirPendencias(
  registros: RegistroFazenda[],
  hoje: string = hojeBrasilia(),
): ResumoPendencias {
  const todas: Pendencia[] = registros
    .filter(
      (r) =>
        r.situacao === "pendente" && r.valor !== null && (r.tipo === "gasto" || r.tipo === "venda"),
    )
    .map((r) => {
      const vencimento = r.vence_em ?? r.ocorrido_em;
      return {
        registro: r,
        tipo: r.tipo === "gasto" ? ("a_pagar" as const) : ("a_receber" as const),
        vencimento,
        dias: diasEntre(hoje, vencimento),
      };
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const aPagar = todas.filter((p) => p.tipo === "a_pagar");
  const aReceber = todas.filter((p) => p.tipo === "a_receber");
  const soma = (l: Pendencia[]) => l.reduce((s, p) => s + (p.registro.valor ?? 0), 0);
  return {
    aPagar,
    aReceber,
    totalAPagar: soma(aPagar),
    totalAReceber: soma(aReceber),
    vencidas: todas.filter((p) => p.dias < 0).length,
  };
}

export function fraseDeVencimento(dias: number, vencimento: string): string {
  if (dias < 0)
    return `venceu há ${-dias} ${-dias === 1 ? "dia" : "dias"} (${dataCurta(vencimento)})`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias (${dataCurta(vencimento)})`;
}

// ---------------------------------------------------------------------------------------------
// Custo por saca e margem
// ---------------------------------------------------------------------------------------------

/** Peso da saca usado para converter produtividade da Conab (kg por hectare) em sacas por hectare. */
export function kgPorSaca(cultura: string): number {
  const c = cultura
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /arroz/.test(c) ? 50 : 60;
}

export type EntradaCusto = {
  /** gastos lançados dessa cultura (e os sem cultura que couberem a ela) no período */
  gastos: number;
  area_ha: number;
  /** sacas por hectare que o produtor informou */
  produtividade_sc_ha: number | null;
  /** sacas por hectare da média do estado (Conab), quando ele não informou */
  produtividadeConab: number | null;
  /** sacas já colhidas e lançadas */
  sacasColhidas: number | null;
  precoHoje: number | null;
};

export type ResultadoCusto = {
  gastos: number;
  custoPorHa: number;
  sacas: number | null;
  sacasOrigem: "colhido" | "informada" | "conab" | null;
  /** sacas colhidas e lançadas até agora quando a colheita parece parcial (a conta usou a estimativa) */
  colheitaParcial: number | null;
  custoPorSaca: number | null;
  margemPorSaca: number | null;
  margemPct: number | null;
  /** margem por saca vezes as sacas da base (estimativa do resultado da safra) */
  resultadoEstimado: number | null;
};

const arred = (n: number) => Math.round(n * 100) / 100;

export function calcularCustoEMargem(e: EntradaCusto): ResultadoCusto {
  const custoPorHa = e.area_ha > 0 ? e.gastos / e.area_ha : 0;
  let sacas: number | null = null;
  let sacasOrigem: ResultadoCusto["sacasOrigem"] = null;
  // Estimativa pela área: a produtividade que o produtor informou ou, sem ela, a média da Conab do estado.
  const estimativa =
    e.produtividade_sc_ha && e.produtividade_sc_ha > 0
      ? { sacas: e.area_ha * e.produtividade_sc_ha, origem: "informada" as const }
      : e.produtividadeConab && e.produtividadeConab > 0
        ? { sacas: e.area_ha * e.produtividadeConab, origem: "conab" as const }
        : null;
  const colhidas = e.sacasColhidas && e.sacasColhidas > 0 ? e.sacasColhidas : null;
  let colheitaParcial: number | null = null;
  // O colhido e lançado vale quando a colheita já está perto do fim (80% ou mais da estimativa). Colheita pela metade
  // dividiria o gasto da safra inteira por metade das sacas e inflaria o custo por saca.
  if (colhidas !== null && (!estimativa || colhidas >= estimativa.sacas * 0.8)) {
    sacas = colhidas;
    sacasOrigem = "colhido";
  } else if (estimativa) {
    sacas = estimativa.sacas;
    sacasOrigem = estimativa.origem;
    if (colhidas !== null) colheitaParcial = colhidas;
  }
  const custoPorSaca = sacas && sacas > 0 && e.gastos > 0 ? e.gastos / sacas : null;
  const margemPorSaca =
    custoPorSaca !== null && e.precoHoje !== null ? e.precoHoje - custoPorSaca : null;
  const margemPct =
    margemPorSaca !== null && e.precoHoje && e.precoHoje > 0
      ? (margemPorSaca / e.precoHoje) * 100
      : null;
  return {
    gastos: arred(e.gastos),
    custoPorHa: arred(custoPorHa),
    sacas: sacas === null ? null : Math.round(sacas),
    sacasOrigem,
    colheitaParcial,
    custoPorSaca: custoPorSaca === null ? null : arred(custoPorSaca),
    margemPorSaca: margemPorSaca === null ? null : arred(margemPorSaca),
    margemPct: margemPct === null ? null : Math.round(margemPct * 10) / 10,
    resultadoEstimado:
      margemPorSaca !== null && sacas !== null ? Math.round(margemPorSaca * sacas) : null,
  };
}

/** Mesma cultura, ignorando acento, caixa e apelidos ("carne bovina" é boi). */
export function mesmaCultura(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const n = (x: string) =>
    normalizarCultura(x)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return n(a) === n(b);
}

/**
 * Gastos que contam para o custo de uma cultura: os lançados com a cultura e, quando ela é a única com área
 * cadastrada, também os lançados sem cultura (que de outro jeito ficariam sem dono). O mesmo cálculo no bot e no painel.
 */
export function somarGastosDaCultura(
  registros: RegistroFazenda[],
  cultura: string,
  totalDeCulturasComArea: number,
): { daCultura: number; semCulturaIncluidos: number; semCulturaFora: number } {
  const gastos = registros.filter(
    (r) => r.tipo === "gasto" && r.valor !== null && (r.situacao ?? "realizado") === "realizado",
  );
  const daCultura = gastos
    .filter((r) => mesmaCultura(r.cultura, cultura))
    .reduce((t, r) => t + (r.valor ?? 0), 0);
  const semCultura = gastos.filter((r) => !r.cultura).reduce((t, r) => t + (r.valor ?? 0), 0);
  const incluir = totalDeCulturasComArea === 1;
  return {
    daCultura,
    semCulturaIncluidos: incluir ? semCultura : 0,
    semCulturaFora: incluir ? 0 : semCultura,
  };
}

// ---------------------------------------------------------------------------------------------
// Estoque, preço-alvo e margem (plano Prata)
// ---------------------------------------------------------------------------------------------

export type EstoqueDaCultura = {
  cultura: string;
  /** sacas guardadas agora: contagem mais recente, mais colheitas e menos vendas depois dela */
  sacas: number;
  /** de onde vem a base: contagem lançada, ou só colheitas e vendas da safra */
  base: "contagem" | "colheita";
  baseData: string | null;
  colhidas: number;
  vendidas: number;
  /** sacas já vendidas mas ainda a receber (contam como vendidas) */
  aReceber: number;
};

/**
 * Estoque de uma cultura em sacas. Parte da contagem mais recente ("tenho 5.000 sacas no armazém"), soma as
 * colheitas lançadas depois e tira as vendas depois (as vendas a receber também saem do estoque: a saca já foi
 * vendida). Sem contagem, usa as colheitas e as vendas da safra inteira.
 */
export function calcularEstoque(
  registros: RegistroFazenda[],
  cultura: string,
): EstoqueDaCultura | null {
  const daCultura = registros.filter(
    (r) =>
      (r.situacao ?? "realizado") !== "rascunho" &&
      mesmaCultura(r.cultura, cultura) &&
      r.quantidade !== null &&
      /saca/i.test(r.unidade ?? ""),
  );
  const contagens = daCultura
    .filter((r) => r.tipo === "estoque")
    .sort(
      (a, b) =>
        b.ocorrido_em.localeCompare(a.ocorrido_em) || b.criado_em.localeCompare(a.criado_em),
    );
  const contagem = contagens[0];
  // depois da contagem: dia seguinte ou, no mesmo dia, lançado depois dela
  const depois = (r: RegistroFazenda) =>
    !contagem ||
    r.ocorrido_em > contagem.ocorrido_em ||
    (r.ocorrido_em === contagem.ocorrido_em && r.criado_em > contagem.criado_em);
  const colheitas = daCultura.filter((r) => r.tipo === "colheita" && depois(r));
  const vendas = daCultura.filter((r) => r.tipo === "venda" && depois(r));
  if (!contagem && colheitas.length === 0 && vendas.length === 0) return null;
  const soma = (l: RegistroFazenda[]) => l.reduce((t, r) => t + (r.quantidade ?? 0), 0);
  const colhidas = soma(colheitas);
  const vendidas = soma(vendas);
  const aReceber = soma(vendas.filter((r) => r.situacao === "pendente"));
  const baseSacas = contagem ? (contagem.quantidade ?? 0) : 0;
  return {
    cultura,
    sacas: Math.max(0, Math.round((baseSacas + colhidas - vendidas) * 100) / 100),
    base: contagem ? "contagem" : "colheita",
    baseData: contagem ? contagem.ocorrido_em : null,
    colhidas,
    vendidas,
    aReceber,
  };
}

/** Preço da saca em que a margem sobre o preço chega a `metaPct` (margem = (preço - custo) / preço). */
export function precoAlvoDaMargem(custoPorSaca: number, metaPct: number): number | null {
  if (!(custoPorSaca > 0) || !(metaPct > 0) || metaPct >= 95) return null;
  return Math.round((custoPorSaca / (1 - metaPct / 100)) * 100) / 100;
}

export function margemPctNoPreco(custoPorSaca: number, preco: number): number | null {
  if (!(preco > 0) || !(custoPorSaca >= 0)) return null;
  return Math.round(((preco - custoPorSaca) / preco) * 1000) / 10;
}
