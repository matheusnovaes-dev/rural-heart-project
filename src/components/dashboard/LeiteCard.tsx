import { useEffect, useMemo, useState } from "react";
import { Milk } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import {
  buscarCotacaoLeite,
  buscarLinhasLeite,
  precoAtualMilho,
  relacaoLeiteMilho,
  resumirLeite,
  type CotacaoLeite,
  type ResumoLeite,
} from "@/lib/leite";
import type { Produtor } from "@/lib/auth";

type Dados = {
  resumo: ResumoLeite | null;
  cotacao: CotacaoLeite | null;
  milho: { preco: number; data_referencia: string } | null;
};

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const num = (n: number, casas = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function lerPreco(texto: string): number | null {
  const n = Number(texto.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0.5 && n <= 10 ? n : null;
}

/**
 * Leite no painel: não existe cotação pública diária por estado, então mostra a
 * média anual do IBGE (rotulada como tal), a última cotação quando a UF tem
 * fonte, e a relação leite/milho, que o produtor recalcula com o preço dele.
 */
export function LeiteCard({ produtor }: { produtor: Produtor }) {
  const uf = produtor.uf;
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);
  const [meuPreco, setMeuPreco] = useState("");

  useEffect(() => {
    if (!supabase || !uf) return;
    let ativo = true;
    Promise.all([
      buscarLinhasLeite(supabase, uf),
      buscarCotacaoLeite(supabase, uf),
      precoAtualMilho(supabase, uf),
    ])
      .then(([linhas, cotacao, milho]) => {
        if (!ativo) return;
        setDados({ resumo: resumirLeite(linhas), cotacao, milho });
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [uf]);

  const meuPrecoNumero = lerPreco(meuPreco);
  const relacao = useMemo(() => {
    if (!dados?.milho) return null;
    const base = meuPrecoNumero ?? dados.cotacao?.preco ?? dados.resumo?.preco_medio_litro ?? null;
    return base == null ? null : relacaoLeiteMilho(base, dados.milho.preco);
  }, [dados, meuPrecoNumero]);
  const origemRelacao = meuPrecoNumero
    ? "com o preço que você informou"
    : dados?.cotacao
      ? `com a cotação de ${dados.cotacao.referencia}, ${dados.cotacao.fonte_nome}`
      : dados?.resumo
        ? `com a média do IBGE de ${dados.resumo.ano}`
        : "";

  if (!uf) return null;

  return (
    <Card className="border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="border-b border-border/70 px-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Milk className="size-4" />
          </span>
          Leite em {uf}
        </CardTitle>
        <CardDescription>
          Não existe cotação pública diária de leite por estado. Aqui vão as referências oficiais
          disponíveis.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-4">
        {erro ? (
          <p className="text-sm text-muted-foreground">
            Não consegui carregar os dados de leite agora.
          </p>
        ) : !dados ? (
          <Skeleton className="h-24 w-full" />
        ) : !dados.resumo && !dados.cotacao ? (
          <p className="text-sm text-muted-foreground">Ainda não temos dados de leite para {uf}.</p>
        ) : (
          <>
            {dados.cotacao && (
              <div>
                <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {brl(dados.cotacao.preco)}
                  <span className="text-sm font-normal text-muted-foreground"> / litro</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {dados.cotacao.mensal
                    ? `Leite entregue em ${dados.cotacao.referencia}${dados.cotacao.projecao ? " (valor projetado)" : ""}`
                    : `Última cotação, semana até ${dados.cotacao.referencia}`}{" "}
                  · fonte: {dados.cotacao.fonte_nome}
                </p>
              </div>
            )}

            {dados.resumo && (
              <div>
                <p className="text-sm font-medium text-foreground">
                  Média paga ao produtor em {dados.resumo.ano}:{" "}
                  <span className="font-mono tabular-nums">
                    {brl(dados.resumo.preco_medio_litro)}
                  </span>{" "}
                  por litro
                </p>
                <p className="text-xs text-muted-foreground">
                  {dados.resumo.variacao_pct != null && dados.resumo.ano_anterior != null && (
                    <>
                      {dados.resumo.variacao_pct >= 0 ? "+" : ""}
                      {num(dados.resumo.variacao_pct)}% sobre {dados.resumo.ano_anterior} ·{" "}
                    </>
                  )}
                  {dados.resumo.producao_milhoes_litros != null && (
                    <>{num(dados.resumo.producao_milhoes_litros)} milhões de litros produzidos · </>
                  )}
                  {dados.resumo.litros_por_vaca_dia != null && (
                    <>{num(dados.resumo.litros_por_vaca_dia)} litros por vaca por dia · </>
                  )}
                  fonte: IBGE (dado anual, não é a cotação de hoje)
                </p>
              </div>
            )}

            {dados.milho && (
              <div className="rounded-md border border-border bg-secondary/30 p-3">
                <p className="text-sm font-medium text-foreground">Relação leite e milho</p>
                {relacao ? (
                  <p className="mt-1 text-sm text-foreground">
                    Uma saca de milho ({brl(relacao.preco_saca_milho)},{" "}
                    {dataBr(dados.milho.data_referencia)}) equivale a{" "}
                    <span className="font-mono font-semibold tabular-nums">
                      {num(relacao.litros_por_saca)} litros
                    </span>{" "}
                    de leite. Cada litro compra {num(relacao.kg_milho_por_litro)} kg de milho{" "}
                    <span className="text-muted-foreground">({origemRelacao}).</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sem preço de referência pra calcular.
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Label
                    htmlFor="leite-meu-preco"
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    Quanto você recebe por litro?
                  </Label>
                  <Input
                    id="leite-meu-preco"
                    inputMode="decimal"
                    placeholder="Ex: 2,80"
                    value={meuPreco}
                    onChange={(e) => setMeuPreco(e.target.value)}
                    className="h-8 w-24"
                    aria-invalid={meuPreco.trim() !== "" && meuPrecoNumero == null}
                  />
                </div>
                {meuPreco.trim() !== "" && meuPrecoNumero == null && (
                  <p className="mt-1 text-xs text-destructive">
                    Digite um valor entre 0,50 e 10,00.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
