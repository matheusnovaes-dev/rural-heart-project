import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CloudRain, CloudSun, Lock, MapPin, Thermometer } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { UpgradeButton } from "@/components/dashboard/UpgradeButton";
import { TrocarCulturaDialog } from "@/components/dashboard/TrocarCulturaDialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { temAcessoPrata, useAssinatura } from "@/lib/planos";
import { buscarPrevisao, type Previsao } from "@/lib/clima";

export const Route = createFileRoute("/dashboard/_layout/clima")({
  component: ClimaPage,
});

function ClimaPage() {
  const { plano, assinaturaId, asaasSubscriptionId, loading: loadingPlano } = useAssinatura();

  if (loadingPlano) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!temAcessoPrata(plano)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Lock className="size-5" />
          </span>
          <CardTitle className="text-lg">Tendências climáticas</CardTitle>
          <CardDescription className="max-w-sm">
            Disponível a partir do plano Prata. Faça upgrade pra ver a previsão de chuva e
            temperatura das próximas 5 dias na sua região.
          </CardDescription>
          <UpgradeButton
            planoAlvo="prata"
            assinaturaId={assinaturaId}
            asaasSubscriptionId={asaasSubscriptionId}
            className="mt-1 bg-cta text-cta-foreground hover:bg-cta/90"
          />
        </CardContent>
      </Card>
    );
  }

  return <ClimaConteudo />;
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
  const [ufs, setUfs] = useState<string[]>([]);
  const [previsoes, setPrevisoes] = useState<Record<string, Previsao | null>>({});

  useEffect(() => {
    async function resolveUfs() {
      if (produtor?.uf) {
        setUfs([produtor.uf]);
        return;
      }
      if (supabase && cooperativa) {
        const { data } = await supabase
          .from("produtores")
          .select("uf")
          .eq("cooperativa_id", cooperativa.id)
          .not("uf", "is", null);
        const unicas = [...new Set((data ?? []).map((p) => p.uf as string))].sort();
        setUfs(unicas);
      }
    }
    resolveUfs();
  }, [produtor, cooperativa]);

  useEffect(() => {
    ufs.forEach((uf) => {
      if (uf in previsoes) return;
      buscarPrevisao(uf).then((previsao) => {
        setPrevisoes((prev) => ({ ...prev, [uf]: previsao }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ufs]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={CloudSun}
        title="Tendências climáticas"
        description="Previsão de chuva e temperatura pros próximos 5 dias, por estado."
      />

      {ufs.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            {cooperativa ? (
              <EmptyState
                icon={MapPin}
                title="Nenhum estado pra acompanhar"
                description="A previsão sai do estado dos produtores cadastrados. Cadastre um produtor com estado preenchido pra ver o clima da região aqui."
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

          return (
            <Card key={uf} className="gap-3">
              <CardHeader className="flex items-center justify-between gap-2">
                <CardTitle className="font-display text-lg font-semibold">{uf}</CardTitle>
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
