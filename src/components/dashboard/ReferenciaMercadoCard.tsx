import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ehBoi, normalizarCultura } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { supabase } from "@/lib/supabase";
import { buscarReferenciaMercado, type ReferenciaMercado } from "@/lib/referenciaMercado";
import type { Produtor } from "@/lib/auth";

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const nomeDaUf = (uf: string) => ufs.find((u) => u.value === uf)?.label ?? uf;

/**
 * Painel de referência quando o estado do produtor não tem preço recente da
 * cultura dele (ou não tem nenhum), e sempre pro boi (que tem mercado futuro
 * nacional): preço da mesma cultura em outros estados, com fonte e data, e o
 * futuro do boi na B3. Ver lib/referenciaMercado.ts.
 */
export function ReferenciaMercadoCard({
  produtor,
  ultimaData,
}: {
  produtor: Produtor;
  /** Data mais recente que o estado tem da cultura (null se não tem nada); undefined enquanto carrega. */
  ultimaData: string | null | undefined;
}) {
  const cultura = produtor.cultura_principal;
  const uf = produtor.uf;
  const [ref, setRef] = useState<ReferenciaMercado | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase || !cultura || !uf || ultimaData === undefined) return;
    let ativo = true;
    buscarReferenciaMercado(supabase, {
      cultura,
      uf,
      ultimaDataUf: ultimaData,
      sempre: ehBoi(cultura),
    })
      .then((r) => ativo && setRef(r))
      .catch(() => ativo && setRef(null));
    return () => {
      ativo = false;
    };
  }, [cultura, uf, ultimaData]);

  if (!cultura || !uf || ref === null) return null;
  const nomeCultura = ehBoi(cultura) ? "boi gordo" : normalizarCultura(cultura);
  // A primeira frase da referência é o aviso sobre o estado (desatualizado ou sem dado).
  const aviso =
    ref && /^(O último dado|Ainda não temos)/.test(ref.frase)
      ? ref.frase.split(". ")[0] + "."
      : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base capitalize">
          <BarChart3 className="size-4 text-primary" />
          {nomeCultura}: referências de mercado
        </CardTitle>
        <CardDescription>
          {aviso ?? "Preços recentes em outros estados e o mercado futuro, pra você comparar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ref === undefined ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {ref.outras_ufs.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-foreground">
                  Em outros estados
                  {ref.outras_ufs[0]!.unidade === "15 kg" ? " (arroba de 15 kg)" : ""}
                </p>
                <ul className="flex flex-col gap-1">
                  {ref.outras_ufs.map((o) => (
                    <li key={o.uf} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-foreground">
                        {nomeDaUf(o.uf)}{" "}
                        <span className="text-xs text-muted-foreground">
                          · {o.fonte}, {dataBr(o.data_referencia)}
                        </span>
                      </span>
                      <span className="font-mono font-semibold tabular-nums">{brl(o.preco)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ref.futuro_b3.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-foreground">
                  Mercado futuro do boi gordo (B3, R$ por arroba)
                </p>
                <ul className="flex flex-col gap-1">
                  {ref.futuro_b3.map((f) => (
                    <li
                      key={f.vencimento}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="text-foreground">
                        Vencimento {MESES[Number(f.vencimento.slice(5, 7)) - 1]}/
                        {f.vencimento.slice(2, 4)}
                      </span>
                      <span className="font-mono font-semibold tabular-nums">{brl(f.preco)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajuste do pregão de {dataBr(ref.futuro_b3[0]!.data_pregao)}. É expectativa do
                  mercado, não o preço de hoje.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
