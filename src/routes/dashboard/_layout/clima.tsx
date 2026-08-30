import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CloudRain, CloudSun, Loader2, MapPin, Plus, Thermometer, X } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TrocarCulturaDialog } from "@/components/dashboard/TrocarCulturaDialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { buscarPrevisao, type Previsao } from "@/lib/clima";
import { ufs as todasUfsBrasil } from "@/config/ufs";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/_layout/clima")({
  component: ClimaConteudo,
});

// Chuva alta é a leitura que mais importa pro produtor (risco de colheita
// parada, estrada ruim pro escoamento) — três faixas simples em vez de só
// mostrar o número cru.
function faixaChuva(pct: number): { tone: "chuva-alta" | "chuva-media" | "chuva-baixa" } {
  if (pct >= 60) return { tone: "chuva-alta" };
  if (pct >= 30) return { tone: "chuva-media" };
  return { tone: "chuva-baixa" };
}

const toneClasses = {
  "chuva-alta": "bg-destructive/10 text-destructive border-destructive/20",
  "chuva-media": "bg-cta/10 text-cta-foreground border-cta/20",
  "chuva-baixa": "bg-secondary text-muted-foreground border-transparent",
};

function insightDoUf(previsao: Previsao) {
  const maxChuva = Math.max(...previsao.chuvaPct);
  const indiceMax = previsao.chuvaPct.indexOf(maxChuva);
  const diaLabel = new Date(`${previsao.dias[indiceMax]}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
  });

  if (maxChuva >= 60) {
    return {
      texto: `Risco de chuva forte ${diaLabel} (${Math.round(maxChuva)}%): pode atrapalhar colheita e escoamento.`,
      tone: "chuva-alta" as const,
    };
  }
  if (maxChuva >= 30) {
    return {
      texto: `Chance moderada de chuva ${diaLabel} (${Math.round(maxChuva)}%).`,
      tone: "chuva-media" as const,
    };
  }
  return { texto: "Semana com baixo risco de chuva.", tone: "chuva-baixa" as const };
}

function ClimaConteudo() {
  const { produtor, cooperativa } = useAuth();
  const [ufsPrimarias, setUfsPrimarias] = useState<string[]>([]);
  const [ufsExtras, setUfsExtras] = useState<string[]>([]);
  const [previsoes, setPrevisoes] = useState<Record<string, Previsao | null>>({});
  const [open, setOpen] = useState(false);

  async function carregarExtras() {
    if (!supabase) return;
    const query = supabase.from("clima_watchlist").select("id, uf");
    const { data } = await (cooperativa
      ? query.eq("cooperativa_id", cooperativa.id)
      : query.eq("produtor_id", produtor!.id));
    setUfsExtras((data ?? []).map((r) => r.uf));
  }

  useEffect(() => {
    async function resolveUfsPrimarias() {
      if (produtor?.uf) {
        setUfsPrimarias([produtor.uf]);
        return;
      }
      if (supabase && cooperativa) {
        const { data } = await supabase
          .from("produtores")
          .select("uf")
          .eq("cooperativa_id", cooperativa.id)
          .not("uf", "is", null);
        const unicas = [...new Set((data ?? []).map((p) => p.uf as string))].sort();
        setUfsPrimarias(unicas);
      }
    }
    resolveUfsPrimarias();
    if (produtor || cooperativa) carregarExtras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor, cooperativa]);

  const ufs = [...ufsPrimarias, ...ufsExtras.filter((u) => !ufsPrimarias.includes(u))];

  useEffect(() => {
    ufs.forEach((uf) => {
      if (uf in previsoes) return;
      buscarPrevisao(uf).then((previsao) => {
        setPrevisoes((prev) => ({ ...prev, [uf]: previsao }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ufs]);

  async function removerExtra(uf: string) {
    if (!supabase) return;
    const query = supabase.from("clima_watchlist").delete().eq("uf", uf);
    const { error } = await (cooperativa
      ? query.eq("cooperativa_id", cooperativa.id)
      : query.eq("produtor_id", produtor!.id));
    if (error) {
      toast.error("Não foi possível remover o estado.");
      return;
    }
    carregarExtras();
  }

  const dialogAdicionarUf = (produtor || cooperativa) && (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          Acompanhar outro estado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acompanhar outro estado</DialogTitle>
        </DialogHeader>
        <AdicionarUfForm
          ufsJaAcompanhados={ufs}
          produtorId={cooperativa ? null : (produtor?.id ?? null)}
          cooperativaId={cooperativa?.id ?? null}
          onDone={() => {
            setOpen(false);
            carregarExtras();
          }}
        />
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={CloudSun}
        title="Tendências climáticas"
        description="Previsão de chuva e temperatura pros próximos 5 dias, por estado."
        action={dialogAdicionarUf}
      />

      {ufs.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            {cooperativa ? (
              <EmptyState
                icon={MapPin}
                title="Nenhum estado pra acompanhar"
                description="A previsão sai do estado dos produtores cadastrados. Cadastre um produtor com estado preenchido, ou acompanhe outro estado direto pelo botão acima."
              />
            ) : (
              <EmptyState
                icon={MapPin}
                title="Você ainda não informou seu estado"
                description="A previsão sai do seu estado (UF). Preencha pra ver o clima da sua região aqui."
                action={
                  produtor && (
                    <TrocarCulturaDialog
                      produtor={produtor}
                      trigger={<Button size="sm">Definir meu estado</Button>}
                    />
                  )
                }
              />
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {ufs.map((uf) => {
          const previsao = previsoes[uf];
          const insight = previsao ? insightDoUf(previsao) : null;
          const ehExtra = !ufsPrimarias.includes(uf);

          return (
            <Card key={uf} className="gap-3">
              <CardHeader className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
                  {uf}
                  {ehExtra && (
                    <button
                      type="button"
                      onClick={() => removerExtra(uf)}
                      aria-label={`Parar de acompanhar ${uf}`}
                      className="text-muted-foreground opacity-60 transition-opacity hover:text-destructive hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </CardTitle>
                {insight && (
                  <Badge variant="outline" className={`border ${toneClasses[insight.tone]}`}>
                    {insight.tone === "chuva-alta"
                      ? "Chuva forte"
                      : insight.tone === "chuva-media"
                        ? "Chuva moderada"
                        : "Tempo seco"}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {previsao === undefined ? (
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-18 w-full" />
                    ))}
                  </div>
                ) : previsao === null ? (
                  <p className="py-2 text-sm text-muted-foreground">Previsão indisponível agora.</p>
                ) : (
                  <>
                    {insight && (
                      <p className="text-sm text-foreground">
                        {insight.tone === "chuva-baixa" ? "" : "⚠️ "}
                        {insight.texto}
                      </p>
                    )}
                    <div className="grid grid-cols-5 gap-1.5">
                      {previsao.dias.map((dia, i) => {
                        const pct = previsao.chuvaPct[i] ?? 0;
                        const { tone } = faixaChuva(pct);
                        return (
                          <div
                            key={dia}
                            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center ${
                              i === 0 ? "ring-1 ring-primary/40" : ""
                            } ${toneClasses[tone]}`}
                          >
                            <span className="text-[10px] font-semibold tracking-wide uppercase">
                              {i === 0
                                ? "hoje"
                                : new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", {
                                    weekday: "short",
                                  })}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-sm font-semibold tabular-nums">
                              <CloudRain className="size-3" />
                              {Math.round(pct)}%
                            </span>
                            <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
                              <Thermometer className="size-3" />
                              {Math.round(previsao.tempMax[i] ?? 0)}°/
                              {Math.round(previsao.tempMin[i] ?? 0)}°
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AdicionarUfForm({
  ufsJaAcompanhados,
  produtorId,
  cooperativaId,
  onDone,
}: {
  ufsJaAcompanhados: string[];
  produtorId: string | null;
  cooperativaId: string | null;
  onDone: () => void;
}) {
  const disponiveis = todasUfsBrasil.filter((u) => !ufsJaAcompanhados.includes(u.value));
  const [uf, setUf] = useState(disponiveis[0]?.value ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !uf) return;
    setLoading(true);
    const { error } = await supabase
      .from("clima_watchlist")
      .insert({ produtor_id: produtorId, cooperativa_id: cooperativaId, uf });
    setLoading(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Esse estado já está sendo acompanhado."
          : "Não foi possível adicionar.",
      );
      return;
    }
    toast.success("Estado adicionado.");
    onDone();
  }

  if (disponiveis.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Todos os estados já estão sendo acompanhados.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label>Estado</Label>
        <Select value={uf} onValueChange={setUf}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {disponiveis.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label} ({u.value})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Acompanhar"}
      </Button>
    </form>
  );
}
