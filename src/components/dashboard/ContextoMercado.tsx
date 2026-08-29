import { useEffect, useState } from "react";
import { DollarSign, Fuel, Globe, Wheat } from "lucide-react";

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

const culturaLabel: Record<Wasde["cultura"], string> = {
  soja: "Soja",
  milho: "Milho",
  algodao: "Algodão",
};
const dieselLabel: Record<string, string> = { "OLEO DIESEL": "Comum", "OLEO DIESEL S10": "S10" };

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

  if (carregando) return <Skeleton className="h-20 w-full" />;
  if (!cambio && wasde.length === 0 && diesel.length === 0 && !ibge) return null;

  const dataFinalDiesel = diesel.reduce<string | null>(
    (max, d) => (max == null || d.data_final > max ? d.data_final : max),
    null,
  );

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
        {cambio && (
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <DollarSign className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">
                Dólar (PTAX) em {formatData(cambio.data)}
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums">
                R$ {formatNum(cambio.cotacao_venda)}
              </p>
            </div>
          </div>
        )}
        {wasde.map((w) => (
          <div key={w.cultura} className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Globe className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">
                {culturaLabel[w.cultura]} Brasil {w.ano_safra} (USDA)
              </p>
              <p className="text-sm">
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
              </p>
            </div>
          </div>
        ))}
        {diesel.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Fuel className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">
                Diesel em {produtor?.uf}
                {dataFinalDiesel && ` (semana até ${formatData(dataFinalDiesel)})`}
              </p>
              <p className="text-sm">
                {diesel.map((d, i) => (
                  <span key={d.produto}>
                    {i > 0 && " · "}
                    {dieselLabel[d.produto] ?? d.produto}{" "}
                    <span className="font-semibold">R$ {formatNum(d.preco_medio)}</span>/L
                  </span>
                ))}
              </p>
            </div>
          </div>
        )}
        {ibge && (
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Wheat className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">
                Produção de {ibge.produto} em {produtor?.uf} (IBGE)
              </p>
              <p className="text-sm">
                <span className="font-semibold">
                  {Number(ibge.producao_ton).toLocaleString("pt-BR")} t
                </span>{" "}
                em{" "}
                {new Date(`${ibge.periodo}T00:00:00`).toLocaleDateString("pt-BR", {
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
