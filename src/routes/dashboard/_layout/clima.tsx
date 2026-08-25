import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CloudRain, Lock, Loader2, Thermometer } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { temAcessoPrata, useAssinatura } from "@/lib/planos";

export const Route = createFileRoute("/dashboard/_layout/clima")({
  component: ClimaPage,
});

// Coordenadas da capital de cada UF — suficiente pra uma tendência regional,
// sem precisar geocodificar a cidade exata de cada produtor.
const capitalPorUf: Record<string, [number, number]> = {
  AC: [-9.97, -67.81],
  AL: [-9.65, -35.72],
  AP: [0.04, -51.05],
  AM: [-3.1, -60.02],
  BA: [-12.97, -38.51],
  CE: [-3.72, -38.54],
  DF: [-15.78, -47.93],
  ES: [-20.32, -40.34],
  GO: [-16.68, -49.25],
  MA: [-2.53, -44.3],
  MT: [-15.6, -56.1],
  MS: [-20.44, -54.65],
  MG: [-19.92, -43.94],
  PA: [-1.46, -48.5],
  PB: [-7.12, -34.88],
  PR: [-25.43, -49.27],
  PE: [-8.05, -34.9],
  PI: [-5.09, -42.8],
  RJ: [-22.91, -43.17],
  RN: [-5.79, -35.21],
  RS: [-30.03, -51.23],
  RO: [-8.76, -63.9],
  RR: [2.82, -60.67],
  SC: [-27.6, -48.55],
  SP: [-23.55, -46.63],
  SE: [-10.91, -37.07],
  TO: [-10.25, -48.32],
};

type Previsao = {
  dias: string[];
  chuvaPct: number[];
  tempMax: number[];
  tempMin: number[];
};

async function buscarPrevisao(uf: string): Promise<Previsao | null> {
  const coords = capitalPorUf[uf];
  if (!coords) return null;
  const [lat, lon] = coords;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return {
    dias: json.daily.time,
    chuvaPct: json.daily.precipitation_probability_max,
    tempMax: json.daily.temperature_2m_max,
    tempMin: json.daily.temperature_2m_min,
  };
}

function ClimaPage() {
  const { plano, loading: loadingPlano } = useAssinatura();

  if (loadingPlano) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
        </CardContent>
      </Card>
    );
  }

  return <ClimaConteudo />;
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
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Tendências climáticas
        </h1>
        <p className="text-sm text-muted-foreground">
          Previsão de chuva e temperatura pros próximos 5 dias, por estado.
        </p>
      </div>

      {ufs.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cadastre a UF do produtor pra ver a previsão da região.
        </p>
      )}

      {ufs.map((uf) => {
        const previsao = previsoes[uf];
        return (
          <Card key={uf}>
            <CardHeader>
              <CardTitle className="text-base">{uf}</CardTitle>
            </CardHeader>
            <CardContent>
              {previsao === undefined ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : previsao === null ? (
                <p className="text-sm text-muted-foreground">Previsão indisponível agora.</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {previsao.dias.map((dia, i) => (
                    <div
                      key={dia}
                      className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-2 text-center"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", {
                          weekday: "short",
                        })}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-primary">
                        <CloudRain className="size-3" />
                        {Math.round(previsao.chuvaPct[i] ?? 0)}%
                      </span>
                      <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-foreground">
                        <Thermometer className="size-3" />
                        {Math.round(previsao.tempMax[i] ?? 0)}°/
                        {Math.round(previsao.tempMin[i] ?? 0)}°
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
