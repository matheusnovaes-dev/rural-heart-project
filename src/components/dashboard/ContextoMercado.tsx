import { useEffect, useState, type ReactNode } from "react";
import { DollarSign, Fuel, Globe, TrendingUp, Wheat } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Cambio = { data: string; cotacao_compra: number; cotacao_venda: number };
type Wasde = {
  cultura: "soja" | "milho" | "algodao";
  ano_safra: string;
  producao_mi_ton: number | null;
  exportacao_mi_ton: number | null;
};
type Diesel = { produto: string; preco_medio: number; data_final: string };
type IbgeProducao = { produto: string; producao_ton: number | null; periodo: string };
type B3Futuro = {
  produto: string;
  nome_produto: string;
  mes_ano_vencimento: string;
  preco_ajuste_atual: number;
  moeda: "BRL" | "USD";
};

const culturaLabel: Record<Wasde["cultura"], string> = {
  soja: "Soja",
  milho: "Milho",
  algodao: "Algodão",
};
const dieselLabel: Record<string, string> = { "OLEO DIESEL": "Comum", "OLEO DIESEL S10": "S10" };

// Nem toda cultura do catálogo da Conab tem contrato futuro na B3 (só 7
// commodities agro têm) — mapeamento explícito em vez de tentar bater
// substring, porque "soja" tem 2 contratos genuinamente diferentes (SJC
// referencia CME, SOY referencia o preço FOB Santos direto — vale mostrar
// os dois) e "cana de açúcar" não tem contrato próprio, só o de etanol
// (proxy declarado, não é a mesma coisa e o rótulo deixa isso claro).
const CULTURA_PARA_B3: Record<string, string[]> = {
  boi: ["BGI"],
  milho: ["CCM"],
  "café arábica": ["ICF"],
  "café conillon": ["CNL"],
  soja: ["SJC", "SOY"],
  "cana de açúcar": ["ETH"],
};

const QTD_VENCIMENTOS_POR_PRODUTO = 3;

function formatPrecoB3(v: number, moeda: string) {
  const casas = moeda === "USD" && v < 100 ? 4 : 2;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatMesAno(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

function formatData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatNum(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/**
 * Contexto de mercado (câmbio, estimativa de safra da USDA, diesel e
 * produção regional do IBGE) — não é preço de venda, é "por que o preço
 * está assim" e "quanto custa operar". Some silenciosamente se ainda não
 * tiver dado (não trava a página de preços por causa disso). Diesel e IBGE
 * dependem do produtor ter UF cadastrado; IBGE também depende da cultura
 * selecionada na página bater com o nome usado pelo IBGE (nem toda cultura
 * do catálogo da Conab é uma lavoura que o IBGE cobre — pecuária, por
 * exemplo, fica de fora por design, não é bug).
 */
export function ContextoMercado({ cultura }: { cultura?: string }) {
  const { produtor } = useAuth();
  const [cambio, setCambio] = useState<Cambio | null>(null);
  const [wasde, setWasde] = useState<Wasde[]>([]);
  const [diesel, setDiesel] = useState<Diesel[]>([]);
  const [ibge, setIbge] = useState<IbgeProducao | null>(null);
  const [b3, setB3] = useState<B3Futuro[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase
        .from("cambio")
        .select("data, cotacao_compra, cotacao_venda")
        .order("data", { ascending: false })
        .limit(1),
      supabase
        .from("wasde_brasil")
        .select("cultura, ano_safra, producao_mi_ton, exportacao_mi_ton")
        .order("relatorio_mes", { ascending: false })
        .limit(10),
    ]).then(([cambioRes, wasdeRes]) => {
      setCambio(cambioRes.data?.[0] ?? null);
      // pega só a linha mais recente de cada cultura (o limit 10 acima é
      // margem de segurança, não confia em distinct do lado do banco)
      const porCultura = new Map<string, Wasde>();
      for (const row of wasdeRes.data ?? []) {
        if (!porCultura.has(row.cultura)) porCultura.set(row.cultura, row);
      }
      setWasde([...porCultura.values()]);
      setCarregando(false);
    });
  }, []);

  useEffect(() => {
    if (!supabase || !produtor?.uf) return;
    supabase
      .from("diesel_precos")
      .select("produto, preco_medio, data_final")
      .eq("uf", produtor.uf)
      .order("data_final", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const porProduto = new Map<string, Diesel>();
        for (const row of data ?? []) {
          if (!porProduto.has(row.produto)) porProduto.set(row.produto, row);
        }
        setDiesel([...porProduto.values()]);
      });
  }, [produtor?.uf]);

  useEffect(() => {
    if (!supabase || !produtor?.uf || !cultura) {
      setIbge(null);
      return;
    }
    supabase
      .from("ibge_producao")
      .select("produto, producao_ton, periodo")
      .eq("uf", produtor.uf)
      .ilike("produto", `%${cultura}%`)
      .order("periodo", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const rows = (data ?? []).filter((r) => r.producao_ton != null);
        rows.sort(
          (a, b) => b.periodo.localeCompare(a.periodo) || b.producao_ton! - a.producao_ton!,
        );
        setIbge(rows[0] ?? null);
      });
  }, [produtor?.uf, cultura]);

  useEffect(() => {
    const codigos = cultura ? CULTURA_PARA_B3[cultura] : undefined;
    if (!supabase || !codigos || codigos.length === 0) {
      setB3([]);
      return;
    }
    const inicioMesAtual = new Date();
    inicioMesAtual.setDate(1);
    supabase
      .from("b3_futuros")
      .select("produto, nome_produto, mes_ano_vencimento, preco_ajuste_atual, moeda, data_pregao")
      .in("produto", codigos)
      .gte("mes_ano_vencimento", inicioMesAtual.toISOString().slice(0, 10))
      .order("data_pregao", { ascending: false })
      .order("mes_ano_vencimento", { ascending: true })
      .limit(60)
      .then(({ data }) => {
        const rows = data ?? [];
        // o pregão mais recente é o primeiro (order data_pregao desc) —
        // descarta qualquer pregão anterior que ainda esteja no resultado,
        // pra nunca misturar preço de ajuste de dias diferentes.
        const pregaoMaisRecente = rows[0]?.data_pregao;
        const doDiaCerto = rows.filter((r) => r.data_pregao === pregaoMaisRecente);
        const porProduto = new Map<string, B3Futuro[]>();
        for (const row of doDiaCerto) {
          const lista = porProduto.get(row.produto) ?? [];
          if (lista.length < QTD_VENCIMENTOS_POR_PRODUTO) lista.push(row);
          porProduto.set(row.produto, lista);
        }
        setB3([...porProduto.values()].flat());
      });
  }, [cultura]);

  if (carregando) return <Skeleton className="h-20 w-full" />;
  if (!cambio && wasde.length === 0 && diesel.length === 0 && !ibge && b3.length === 0) return null;

  const dataFinalDiesel = diesel.reduce<string | null>(
    (max, d) => (max == null || d.data_final > max ? d.data_final : max),
    null,
  );

  // cada item é um bloco independente — vira uma "matéria" da faixa de
  // ticker abaixo, na ordem em que os dados existirem naquele momento.
  const itens: { chave: string; icone: typeof DollarSign; label: string; valor: ReactNode }[] = [];

  if (cambio) {
    itens.push({
      chave: "cambio",
      icone: DollarSign,
      label: `Dólar (PTAX) em ${formatData(cambio.data)}`,
      valor: (
        <span className="font-mono font-semibold tabular-nums">
          R$ {formatNum(cambio.cotacao_venda)}
        </span>
      ),
    });
  }

  for (const w of wasde) {
    itens.push({
      chave: `wasde-${w.cultura}`,
      icone: Globe,
      label: `${culturaLabel[w.cultura]} Brasil ${w.ano_safra} (USDA)`,
      valor: (
        <>
          {w.producao_mi_ton != null && (
            <>
              <span className="font-semibold">{w.producao_mi_ton} mi t</span> produzidas
            </>
          )}
          {w.exportacao_mi_ton != null && (
            <>
              {" · "}
              <span className="font-semibold">{w.exportacao_mi_ton} mi t</span> exportadas
            </>
          )}
        </>
      ),
    });
  }

  if (diesel.length > 0) {
    itens.push({
      chave: "diesel",
      icone: Fuel,
      label: `Diesel em ${produtor?.uf}${dataFinalDiesel ? ` (semana até ${formatData(dataFinalDiesel)})` : ""}`,
      valor: (
        <>
          {diesel.map((d, i) => (
            <span key={d.produto}>
              {i > 0 && " · "}
              {dieselLabel[d.produto] ?? d.produto}{" "}
              <span className="font-semibold">R$ {formatNum(d.preco_medio)}</span>/L
            </span>
          ))}
        </>
      ),
    });
  }

  for (const [produto, futuros] of Object.entries(
    b3.reduce<Record<string, B3Futuro[]>>((acc, f) => {
      (acc[f.produto] ??= []).push(f);
      return acc;
    }, {}),
  )) {
    itens.push({
      chave: `b3-${produto}`,
      icone: TrendingUp,
      label: `${futuros[0]?.nome_produto} — futuro (B3)`,
      valor: (
        <>
          {futuros.map((f, i) => (
            <span key={f.mes_ano_vencimento}>
              {i > 0 && " · "}
              {formatMesAno(f.mes_ano_vencimento)}{" "}
              <span className="font-semibold">
                {f.moeda === "USD" ? "US$" : "R$"} {formatPrecoB3(f.preco_ajuste_atual, f.moeda)}
              </span>
            </span>
          ))}
        </>
      ),
    });
  }

  if (ibge) {
    itens.push({
      chave: "ibge",
      icone: Wheat,
      label: `Produção de ${ibge.produto} em ${produtor?.uf} (IBGE)`,
      valor: (
        <>
          <span className="font-semibold">
            {Number(ibge.producao_ton).toLocaleString("pt-BR")} t
          </span>{" "}
          em{" "}
          {new Date(`${ibge.periodo}T00:00:00`).toLocaleDateString("pt-BR", {
            month: "2-digit",
            year: "numeric",
          })}
        </>
      ),
    });
  }

  function Bloco({ item, sufixo }: { item: (typeof itens)[number]; sufixo: string }) {
    return (
      <div key={`${item.chave}-${sufixo}`} className="flex shrink-0 items-center gap-2 pr-8">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <item.icone className="size-4" />
        </span>
        <div className="whitespace-nowrap">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="text-sm">{item.valor}</p>
        </div>
      </div>
    );
  }

  // menos de ~4 itens não enche a faixa (a duplicata ficaria visível como
  // "salto"), então nesse caso mostra parado, sem rolagem.
  const rolar = itens.length >= 4;

  return (
    <Card className="gap-3 overflow-hidden py-4">
      <CardContent className="group px-0">
        {rolar ? (
          <div className="overflow-hidden px-4">
            <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
              {itens.map((item) => (
                <Bloco key={`${item.chave}-a`} item={item} sufixo="a" />
              ))}
              {itens.map((item) => (
                <Bloco key={`${item.chave}-b`} item={item} sufixo="b" />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            {itens.map((item) => (
              <Bloco key={item.chave} item={item} sufixo="unico" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
