import { PiggyBank, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustosDaSafra } from "@/components/fazenda/useCustosDaSafra";
import {
  CATEGORIAS_GASTO,
  formatarQuantidade,
  formatarReais,
  numerosDoTexto,
  situacaoDosOrcamentos,
  type OrcamentoFazenda,
} from "@/lib/fazenda.shared";
import { supabase } from "@/lib/supabase";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Orçamento por categoria de gasto na safra (plano Prata e Ouro): quanto já foi usado e quanto ainda cabe. */
export function OrcamentoCard({
  produtor,
  versao,
}: {
  produtor: { id: string; uf: string | null };
  versao: number;
}) {
  const { registros, carregando: carregandoGastos } = useCustosDaSafra(produtor, versao);
  const [orcamentos, setOrcamentos] = useState<OrcamentoFazenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_GASTO[0]);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("fazenda_orcamentos")
      .select("id, categoria, valor")
      .eq("produtor_id", produtor.id);
    setOrcamentos(
      ((data ?? []) as { id: string; categoria: string; valor: number | string }[]).map((o) => ({
        id: o.id,
        categoria: o.categoria,
        valor: Number(o.valor),
      })),
    );
    setCarregando(false);
  }, [produtor.id]);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  const situacao = useMemo(
    () => situacaoDosOrcamentos(orcamentos, registros),
    [orcamentos, registros],
  );

  async function salvar() {
    if (!supabase) return;
    const n = numerosDoTexto(valor)[0] ?? null;
    if (n === null || n <= 0) {
      toast.error("Informe o valor do orçamento, por exemplo 100.000.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("fazenda_orcamentos").upsert(
      {
        produtor_id: produtor.id,
        categoria,
        valor: n,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "produtor_id,categoria" },
    );
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar. Confira se o seu plano inclui esse recurso.");
      return;
    }
    toast.success("Orçamento salvo.");
    setValor("");
    carregar();
  }

  async function remover(cat: string) {
    if (!supabase) return;
    const { error } = await supabase
      .from("fazenda_orcamentos")
      .delete()
      .eq("produtor_id", produtor.id)
      .eq("categoria", cat);
    if (error) {
      toast.error("Não foi possível remover o orçamento.");
      return;
    }
    toast.success("Orçamento removido.");
    carregar();
  }

  return (
    <Card data-testid="orcamento">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <PiggyBank className="size-4 text-muted-foreground" />
          <h2 className="font-display text-base font-semibold">Orçamento por categoria</h2>
        </div>
        {carregando || carregandoGastos ? (
          <Skeleton className="h-16 w-full" />
        ) : situacao.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Defina quanto pretende gastar em cada categoria na safra (abaixo, ou no WhatsApp:
            “orçamento de adubo 100 mil”). Eu mostro quanto já foi usado e aviso ao passar de 80% e
            de 100%.
          </p>
        ) : (
          <ul className="space-y-3">
            {situacao.map((s) => {
              const cor = s.pct > 100 ? "bg-red-500" : s.pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <li key={s.categoria} data-testid={`orcamento-${slug(s.categoria)}`}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{s.categoria}</span>
                    <span className="flex items-center gap-1 font-mono tabular-nums">
                      {formatarReais(s.gasto)} de {formatarReais(s.orcado)} (
                      {formatarQuantidade(Math.round(s.pct))}%)
                      <button
                        type="button"
                        aria-label={`Remover orçamento de ${s.categoria}`}
                        className="ml-1 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => remover(s.categoria)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${cor}`}
                      style={{ width: `${Math.min(100, Math.max(0, s.pct))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.restante >= 0
                      ? `Restam ${formatarReais(s.restante)}`
                      : `Passou ${formatarReais(-s.restante)}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Categoria
            <select
              data-testid="orcamento-categoria"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-36 flex-col gap-1 text-xs text-muted-foreground">
            Orçamento (R$)
            <Input
              data-testid="orcamento-valor"
              inputMode="decimal"
              placeholder="100.000"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") salvar();
              }}
            />
          </label>
          <Button size="sm" data-testid="orcamento-salvar" onClick={salvar} disabled={salvando}>
            Salvar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Conta só o gasto já pago na safra (1/set a 31/ago); o que está a pagar entra quando você dá
          baixa. O aviso de 80% e de 100% vem na confirmação do gasto, no WhatsApp.
        </p>
      </CardContent>
    </Card>
  );
}
