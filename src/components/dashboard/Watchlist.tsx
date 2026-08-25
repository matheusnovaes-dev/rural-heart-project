import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Lock, Minus, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { supabase } from "@/lib/supabase";
import { culturas } from "@/config/culturas";
import { temAcessoOuro, useAssinatura } from "@/lib/planos";
import type { Produtor } from "@/lib/auth";

type ItemWatchlist = { id: string; cultura: string; uf: string };
type Cotacao = { atual: number | null; variacao: number | null; serie: number[] };

/**
 * Lista de acompanhamento — exclusiva do plano Ouro. Segue culturas/UFs além
 * da principal do produtor, aproveitando a base de 77 culturas × 27 UFs que o
 * ingest da Conab já cobre. É o padrão "watchlist" dos terminais de commodity.
 */
export function Watchlist({ produtor }: { produtor: Produtor }) {
  const { plano, loading: loadingPlano } = useAssinatura();
  const [itens, setItens] = useState<ItemWatchlist[] | null>(null);
  const [cotacoes, setCotacoes] = useState<Record<string, Cotacao>>({});
  const [open, setOpen] = useState(false);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("produtor_watchlist")
      .select("id, cultura, uf")
      .eq("produtor_id", produtor.id)
      .order("created_at", { ascending: true });
    setItens(data ?? []);
  }, [produtor.id]);

  useEffect(() => {
    if (temAcessoOuro(plano)) carregar();
  }, [plano, carregar]);

  useEffect(() => {
    if (!supabase || !itens) return;
    const desde = new Date();
    desde.setDate(desde.getDate() - 90);

    itens.forEach(async (item) => {
      const chave = `${item.cultura}|${item.uf}`;
      if (chave in cotacoes) return;
      const { data } = await supabase!
        .from("precos")
        .select("preco, data_referencia")
        .ilike("produto", `%${item.cultura}%`)
        .eq("uf", item.uf)
        .gte("data_referencia", desde.toISOString().slice(0, 10))
        .order("data_referencia", { ascending: true });

      const serie = (data ?? []).map((d) => d.preco);
      const atual = serie.at(-1) ?? null;
      const anterior = serie.at(-2) ?? null;
      setCotacoes((prev) => ({
        ...prev,
        [chave]: {
          atual,
          variacao:
            atual != null && anterior != null && anterior !== 0
              ? ((atual - anterior) / anterior) * 100
              : null,
          serie: serie.slice(-14),
        },
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens]);

  async function remover(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("produtor_watchlist").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover.");
      return;
    }
    toast.success("Removido da lista.");
    carregar();
  }

  if (loadingPlano) return <Skeleton className="h-40 w-full" />;

  if (!temAcessoOuro(plano)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold-foreground">
            <Lock className="size-5" />
          </span>
          <div className="space-y-1">
            <CardTitle className="font-display text-base">Lista de acompanhamento</CardTitle>
            <CardDescription className="mx-auto max-w-sm">
              Exclusivo do plano Ouro. Acompanhe o preço de outras culturas e estados além do seu,
              pra comparar região e planejar diversificação.
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-base font-semibold">
            <Star className="size-4 text-gold" />
            Lista de acompanhamento
          </CardTitle>
          <CardDescription>Outras culturas e estados que você segue.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="size-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Acompanhar cultura</DialogTitle>
            </DialogHeader>
            <FormNovoItem
              produtorId={produtor.id}
              onDone={() => {
                setOpen(false);
                carregar();
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {itens === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Nada na lista ainda"
            description="Adicione uma cultura de outro estado pra comparar com o seu preço e enxergar oportunidade fora da sua região."
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {itens.map((item) => {
              const c = cotacoes[`${item.cultura}|${item.uf}`];
              const label = culturas.find((x) => x.value === item.cultura)?.label ?? item.cultura;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {label} · {item.uf}
                    </p>
                    {c?.atual != null ? (
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        R$ {c.atual.toFixed(2).replace(".", ",")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {c ? "Sem preço publicado" : "Carregando..."}
                      </p>
                    )}
                  </div>

                  {c?.serie && c.serie.length >= 2 && (
                    <div className="hidden w-20 shrink-0 sm:block">
                      <Sparkline data={c.serie} className="h-7 w-full" />
                    </div>
                  )}

                  {c?.variacao != null && (
                    <span
                      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                        c.variacao > 0
                          ? "bg-primary/10 text-primary"
                          : c.variacao < 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.variacao > 0 ? (
                        <ArrowUp className="size-3" />
                      ) : c.variacao < 0 ? (
                        <ArrowDown className="size-3" />
                      ) : (
                        <Minus className="size-3" />
                      )}
                      <span className="font-mono tabular-nums">
                        {Math.abs(c.variacao).toFixed(1)}%
                      </span>
                    </span>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => remover(item.id)}
                    aria-label={`Remover ${label} ${item.uf}`}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FormNovoItem({ produtorId, onDone }: { produtorId: string; onDone: () => void }) {
  const [cultura, setCultura] = useState("soja");
  const [uf, setUf] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !uf) return;
    setLoading(true);
    const { error } = await supabase
      .from("produtor_watchlist")
      .insert({ produtor_id: produtorId, cultura, uf: uf.toUpperCase() });
    setLoading(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Essa combinação já está na lista."
          : "Não foi possível adicionar.",
      );
      return;
    }
    toast.success("Adicionado à lista.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label>Cultura</Label>
        <Select value={cultura} onValueChange={setCultura}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {culturas.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="w-uf">Estado (UF)</Label>
        <Input
          id="w-uf"
          required
          maxLength={2}
          placeholder="Ex: MT"
          value={uf}
          onChange={(e) => setUf(e.target.value.toUpperCase())}
        />
      </div>
      <Button type="submit" disabled={loading || !uf} className="mt-2">
        {loading ? "Salvando..." : "Adicionar"}
      </Button>
    </form>
  );
}
