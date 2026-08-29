import { useState } from "react";
import { LineChart, TrendingUp, CloudSun, ArrowUp, ArrowDown, Fuel, Sprout } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AbaId = "precos" | "alertas" | "clima";

const abas: { id: AbaId; label: string; icon: typeof LineChart }[] = [
  { id: "precos", label: "Preços", icon: LineChart },
  { id: "alertas", label: "Alertas", icon: TrendingUp },
  { id: "clima", label: "Clima", icon: CloudSun },
];

export function DashboardPreview() {
  const [aba, setAba] = useState<AbaId>("precos");

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-primary">
          Além do WhatsApp
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Um painel pra quem quer ver o quadro inteiro
        </h2>
        <p className="mt-4 text-muted-foreground">
          Clique nas abas abaixo e navegue por uma prévia do painel — gráfico de preço por estado,
          alertas automáticos e previsão do tempo, tudo no mesmo lugar.
        </p>
      </Reveal>

      <Reveal delay={0.15} className="mx-auto mt-12 max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {/* barra de navegador, só decorativa */}
          <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-destructive/60" />
            <span className="size-2.5 rounded-full bg-primary/40" />
            <span className="size-2.5 rounded-full bg-primary/60" />
            <span className="ml-3 rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
              app.safralume.com.br/dashboard
            </span>
          </div>

          <div className="flex flex-col sm:flex-row">
            {/* mini sidebar, clicável de verdade */}
            <div className="flex shrink-0 gap-1 border-b border-border p-2 sm:w-40 sm:flex-col sm:border-b-0 sm:border-r sm:p-3">
              {abas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAba(item.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:justify-start",
                    aba === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </div>

            {/* conteúdo, muda com a aba */}
            <div className="min-h-80 flex-1 bg-background p-4 sm:p-6">
              {aba === "precos" && <PreviewPrecos />}
              {aba === "alertas" && <PreviewAlertas />}
              {aba === "clima" && <PreviewClima />}
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Prévia ilustrativa do painel — dados de exemplo
        </p>
      </Reveal>
    </section>
  );
}

function PreviewPrecos() {
  const ufs = [
    { uf: "GO", preco: "127,00", variacao: 0.8, cor: "var(--chart-1)" },
    { uf: "MT", preco: "129,80", variacao: 3.4, cor: "var(--chart-2)" },
    { uf: "PR", preco: "130,80", variacao: -1.2, cor: "var(--chart-3)" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Soja · últimos 6 meses</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {ufs.map((item) => (
          <Card key={item.uf} className="gap-1.5 py-3">
            <CardContent className="px-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: item.cor }} />
                SOJA · {item.uf}
              </div>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
                <span className="mr-0.5 align-top text-xs font-sans text-muted-foreground">R$</span>
                {item.preco}
              </p>
              <span
                className={cn(
                  "mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  item.variacao > 0
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {item.variacao > 0 ? (
                  <ArrowUp className="size-2.5" />
                ) : (
                  <ArrowDown className="size-2.5" />
                )}
                {Math.abs(item.variacao)}% sem.
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PreviewAlertas() {
  const alertas = [
    { texto: "Soja · MT acima de R$ 130,00", status: "Ativo, aguardando" },
    { texto: "Milho · GO abaixo de R$ 60,00", status: "Disparado em 12/08" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Alertas de preço</p>
      <div className="flex flex-col gap-2">
        {alertas.map((a) => (
          <div
            key={a.texto}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-2 text-sm text-foreground">
              <TrendingUp className="size-4 shrink-0 text-primary" />
              {a.texto}
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {a.status}
            </Badge>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Fuel className="size-4 shrink-0 text-primary" />
            Diesel em MT (semana até 22/08)
          </div>
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            R$ 6,65/L
          </span>
        </div>
      </div>
    </div>
  );
}

function PreviewClima() {
  const dias = [
    { dia: "hoje", chuva: 24, tempMin: 28, tempMax: 38 },
    { dia: "amanhã", chuva: 10, tempMin: 28, tempMax: 39 },
    { dia: "seg.", chuva: 2, tempMin: 28, tempMax: 40 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Previsão · MT</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {dias.map((d) => (
          <Card key={d.dia} className="gap-1.5 py-3">
            <CardContent className="flex flex-col items-center gap-1 px-3 text-center">
              <p className="text-xs font-semibold text-muted-foreground capitalize">{d.dia}</p>
              <CloudSun className="size-6 text-primary" />
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {d.tempMin}°–{d.tempMax}°C
              </p>
              <p className="text-xs text-muted-foreground">{d.chuva}% de chuva</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
        <Sprout className="size-4 shrink-0 text-primary" />
        Alerta de geada configurado — avisa automaticamente só quando fizer sentido.
      </div>
    </div>
  );
}
