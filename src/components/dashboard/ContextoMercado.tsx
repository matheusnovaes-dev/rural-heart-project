import { useEffect, useState } from "react";
import { DollarSign, Globe } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

type Cambio = { data: string; cotacao_compra: number; cotacao_venda: number };
type Wasde = {
  cultura: "soja" | "milho";
  ano_safra: string;
  producao_mi_ton: number | null;
  exportacao_mi_ton: number | null;
};

const culturaLabel: Record<Wasde["cultura"], string> = { soja: "Soja", milho: "Milho" };

function formatData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatNum(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/**
 * Contexto de mercado (câmbio + estimativa de safra da USDA) — não é preço
 * de venda, é "por que o preço está assim". Some silenciosamente se ainda
 * não tiver dado (não trava a página de preços por causa disso).
 */
export function ContextoMercado() {
  const [cambio, setCambio] = useState<Cambio | null>(null);
  const [wasde, setWasde] = useState<Wasde[]>([]);
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

  if (carregando) return <Skeleton className="h-20 w-full" />;
  if (!cambio && wasde.length === 0) return null;

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
      </CardContent>
    </Card>
  );
}
