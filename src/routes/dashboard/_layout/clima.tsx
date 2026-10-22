import { ConfirmarAcao } from "@/components/dashboard/ConfirmarAcao";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CloudRain, Loader2, MapPin, Plus, Thermometer, X } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { hojeNoBrasil, indiceDoDia, rotuloDoDia, type Previsao } from "@/lib/clima";
import {
  buscarMunicipioServidor,
  buscarPrevisaoPorCoordenadasServidor,
  buscarPrevisaoServidor,
} from "@/lib/clima.server";
import { ufs as todasUfsBrasil } from "@/config/ufs";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/_layout/clima")({
  component: ClimaConteudo,
});

type Local = {
  chave: string;
  uf: string;
  municipio: string | null;
  lat: number | null;
  lon: number | null;
};

type LocalExtra = Local & { id: string };

function chaveDoLocal(uf: string, municipio: string | null) {
  return municipio ? `${uf}:${municipio}` : uf;
}

function labelDoLocal(local: Local) {
  return local.municipio ? `${local.municipio} · ${local.uf}` : local.uf;
}

// Chuva alta é a leitura que mais importa pro produtor (risco de colheita
// parada, estrada ruim pro escoamento) — três faixas simples em vez de só
// mostrar o número cru.
function faixaChuva(pct: number): { tone: "chuva-alta" | "chuva-media" | "chuva-baixa" } {
  if (pct >= 60) return { tone: "chuva-alta" };
  if (pct >= 30) return { tone: "chuva-media" };
  return { tone: "chuva-baixa" };
}

const toneClasses = {
  "chuva-alta": "bg-destructive/10 text-red-800 border-destructive/20",
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

/** Cinco colunas: barra de chuva (cheia = 100%), faixa de temperatura posicionada na escala da semana e os números. */
function PrevisaoVisual({ previsao }: { previsao: Previsao }) {
  const maxs = previsao.tempMax.slice(0, previsao.dias.length);
  const mins = previsao.tempMin.slice(0, previsao.dias.length);
  const alto = Math.max(...maxs);
  const baixo = Math.min(...mins);
  const escala = Math.max(1, alto - baixo);
  const hoje = hojeNoBrasil();
  // destaque no dia de hoje; se a fonte não traz hoje (o CPTEC começa em amanhã), no primeiro dia da lista
  const destaque = Math.max(0, indiceDoDia(previsao, "hoje", hoje));
  return (
    <div className="grid grid-cols-5 gap-2">
      {previsao.dias.map((dia, i) => {
        const pct = Math.round(previsao.chuvaPct[i] ?? 0);
        const forte = pct >= 60;
        const media = pct >= 30;
        const tmax = previsao.tempMax[i] ?? 0;
        const tmin = previsao.tempMin[i] ?? 0;
        return (
          <div
            key={dia}
            className={`flex flex-col items-center gap-2.5 rounded-2xl border px-1.5 py-3 text-center ${
              i === destaque
                ? "border-primary/25 bg-gradient-to-b from-primary/[0.07] to-transparent"
                : "border-border/60 bg-card"
            }`}
          >
            <span className="text-xs font-semibold">{rotuloDoDia(dia, hoje).curto}</span>
            <div
              className="relative h-24 w-5 overflow-hidden rounded-full bg-secondary"
              role="img"
              aria-label={`${pct}% de chance de chuva`}
            >
              <div
                className={`barra-y absolute inset-x-0 bottom-0 rounded-full ${
                  forte
                    ? "bg-gradient-to-t from-red-500 to-orange-400"
                    : media
                      ? "bg-gradient-to-t from-amber-500 to-yellow-300"
                      : "bg-gradient-to-t from-sky-500 to-sky-300"
                }`}
                style={{ height: `${Math.max(4, pct)}%`, ["--atraso" as string]: `${i * 0.08}s` }}
              />
            </div>
            <span className="flex items-center gap-1 font-mono text-sm font-semibold tabular-nums">
              <CloudRain className="size-3 opacity-70" aria-hidden="true" />
              {pct}%
            </span>
            <div className="relative h-16 w-1.5 rounded-full bg-secondary" aria-hidden="true">
              <div
                className="absolute inset-x-0 rounded-full bg-gradient-to-t from-sky-400 via-emerald-400 to-amber-400"
                style={{
                  bottom: `${((tmin - baixo) / escala) * 100}%`,
                  height: `${Math.max(8, ((tmax - tmin) / escala) * 100)}%`,
                }}
              />
            </div>
            <span className="flex flex-col items-center font-mono text-xs leading-tight tabular-nums">
              <span className="text-sm font-semibold">{Math.round(tmax)}°</span>
              <span className="text-muted-foreground">{Math.round(tmin)}°</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ClimaConteudo() {
  const { produtor, cooperativa } = useAuth();
  const [locaisPrimarios, setLocaisPrimarios] = useState<Local[]>([]);
  const [locaisExtras, setLocaisExtras] = useState<LocalExtra[]>([]);
  const [previsoes, setPrevisoes] = useState<Record<string, Previsao | null>>({});
  const [open, setOpen] = useState(false);

  async function carregarExtras() {
    if (!supabase) return;
    const query = supabase.from("clima_watchlist").select("id, uf, municipio, lat, lon");
    const { data } = await (cooperativa
      ? query.eq("cooperativa_id", cooperativa.id)
      : query.eq("produtor_id", produtor!.id));
    setLocaisExtras(
      (data ?? []).map((r) => ({
        id: r.id,
        uf: r.uf,
        municipio: r.municipio,
        lat: r.lat,
        lon: r.lon,
        chave: chaveDoLocal(r.uf, r.municipio),
      })),
    );
  }

  useEffect(() => {
    async function resolveLocaisPrimarios() {
      if (produtor?.uf) {
        setLocaisPrimarios([
          {
            uf: produtor.uf,
            municipio: produtor.municipio,
            lat: produtor.lat,
            lon: produtor.lon,
            chave: chaveDoLocal(produtor.uf, produtor.municipio),
          },
        ]);
        return;
      }
      if (supabase && cooperativa) {
        const { data } = await supabase
          .from("produtores")
          .select("uf")
          .eq("cooperativa_id", cooperativa.id)
          .not("uf", "is", null);
        const unicas = [...new Set((data ?? []).map((p) => p.uf as string))].sort();
        setLocaisPrimarios(
          unicas.map((uf) => ({ uf, municipio: null, lat: null, lon: null, chave: uf })),
        );
      }
    }
    resolveLocaisPrimarios();
    if (produtor || cooperativa) carregarExtras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor, cooperativa]);

  const chavesPrimarias = new Set(locaisPrimarios.map((l) => l.chave));
  const locais = [...locaisPrimarios, ...locaisExtras.filter((l) => !chavesPrimarias.has(l.chave))];

  useEffect(() => {
    locais.forEach((local) => {
      if (local.chave in previsoes) return;
      const busca =
        local.lat != null && local.lon != null
          ? buscarPrevisaoPorCoordenadasServidor({ data: { lat: local.lat, lon: local.lon } })
          : buscarPrevisaoServidor({ data: { uf: local.uf } });
      busca.then((previsao) => {
        setPrevisoes((prev) => ({ ...prev, [local.chave]: previsao }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locais]);

  async function removerExtra(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("clima_watchlist").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover.");
      return;
    }
    carregarExtras();
  }

  const dialogAdicionarLocal = (produtor || cooperativa) && (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          Acompanhar outro local
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acompanhar outro local</DialogTitle>
        </DialogHeader>
        <AdicionarLocalForm
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
        icon={IconesSafralume["clima-sol"]}
        iconePersonalizado
        title="Tendências climáticas"
        description="Previsão de chuva e temperatura pros próximos dias, por estado ou cidade."
        action={dialogAdicionarLocal}
      />

      {locais.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            {cooperativa ? (
              <EmptyState
                icon={MapPin}
                title="Nenhum local pra acompanhar"
                description="A previsão sai do estado dos produtores cadastrados. Cadastre um produtor com estado preenchido, ou acompanhe outro local direto pelo botão acima."
              />
            ) : (
              <EmptyState
                icon={MapPin}
                title="Você ainda não informou seu estado"
                description="A previsão sai do seu estado (UF), ou da sua cidade se você informar uma. Preencha pra ver o clima da sua região aqui."
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

      <div className={`grid gap-4 ${locais.length > 1 ? "lg:grid-cols-2" : ""}`}>
        <AnimatePresence initial={false}>
          {locais.map((local, index) => {
            const previsao = previsoes[local.chave];
            const insight = previsao ? insightDoUf(previsao) : null;
            const extra = locaisExtras.find(
              (l) => l.chave === local.chave && !chavesPrimarias.has(l.chave),
            );

            return (
              <motion.div
                key={local.chave}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
              >
                <Card className="gap-3">
                  <CardHeader className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
                      {labelDoLocal(local)}
                      {extra && (
                        <ConfirmarAcao
                          titulo={`Parar de acompanhar ${labelDoLocal(local)}?`}
                          descricao="Esse local sai da sua lista de clima. Você pode adicionar de novo quando quiser."
                          aoConfirmar={() => removerExtra(extra.id)}
                          gatilho={
                            <button
                              type="button"
                              aria-label={`Parar de acompanhar ${labelDoLocal(local)}`}
                              className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-opacity hover:text-destructive hover:opacity-100 pointer-coarse:size-11"
                            >
                              <X className="size-3.5" />
                            </button>
                          }
                        />
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
                      <p className="py-2 text-sm text-muted-foreground">
                        Previsão indisponível agora.
                      </p>
                    ) : (
                      <>
                        {insight && (
                          <p className="flex items-start gap-1.5 text-sm text-foreground">
                            {insight.tone !== "chuva-baixa" && (
                              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-cta-foreground" />
                            )}
                            {insight.texto}
                          </p>
                        )}
                        <PrevisaoVisual previsao={previsao} />
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AdicionarLocalForm({
  produtorId,
  cooperativaId,
  onDone,
}: {
  produtorId: string | null;
  cooperativaId: string | null;
  onDone: () => void;
}) {
  const [uf, setUf] = useState<string>(todasUfsBrasil[0]!.value);
  const [municipio, setMunicipio] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !uf) return;
    setLoading(true);

    let municipioFinal: string | null = null;
    let lat: number | null = null;
    let lon: number | null = null;
    if (municipio.trim()) {
      const nomeCompletoUf = todasUfsBrasil.find((u) => u.value === uf)?.label;
      const encontrado = nomeCompletoUf
        ? await buscarMunicipioServidor({ data: { nome: municipio.trim(), nomeCompletoUf } })
        : null;
      if (!encontrado) {
        toast.error(`Não encontrei "${municipio}" em ${uf}. Confira o nome e tente de novo.`);
        setLoading(false);
        return;
      }
      municipioFinal = encontrado.nome;
      lat = encontrado.lat;
      lon = encontrado.lon;
    }

    const { error } = await supabase.from("clima_watchlist").insert({
      produtor_id: produtorId,
      cooperativa_id: cooperativaId,
      uf,
      municipio: municipioFinal,
      lat,
      lon,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Esse local já está sendo acompanhado."
          : "Não foi possível adicionar.",
      );
      return;
    }
    toast.success("Local adicionado.");
    onDone();
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
            {todasUfsBrasil.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label} ({u.value})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="local-municipio">Cidade (opcional)</Label>
        <Input
          autoComplete="off"
          id="local-municipio"
          placeholder="Deixe em branco pra acompanhar o estado inteiro…"
          value={municipio}
          onChange={(e) => setMunicipio(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Acompanhar"}
      </Button>
    </form>
  );
}
