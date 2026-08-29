import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  TrendingUp,
  CloudSun,
  ArrowUp,
  ArrowDown,
  Fuel,
  DollarSign,
  Globe,
  Sprout,
} from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PlanoId = "bronze" | "prata" | "ouro";

const planoBadge: Record<PlanoId, { label: string; className: string }> = {
  bronze: { label: "Bronze", className: "bg-secondary text-muted-foreground" },
  prata: { label: "Prata", className: "bg-zinc-200 text-zinc-700" },
  ouro: { label: "Ouro", className: "bg-gold text-gold-foreground" },
};

type AbaId = "precos" | "alertas" | "clima" | "futuro";

const abas: { id: AbaId; label: string; icon: typeof LineChart; plano: PlanoId }[] = [
  { id: "precos", label: "Preços", icon: LineChart, plano: "bronze" },
  { id: "alertas", label: "Alertas & câmbio", icon: TrendingUp, plano: "bronze" },
  { id: "clima", label: "Clima & produção", icon: CloudSun, plano: "prata" },
  { id: "futuro", label: "Mercado futuro (B3)", icon: Sprout, plano: "ouro" },
];

const INTERVALO_AUTOPLAY = 3800;

export function DashboardPreview() {
  const [aba, setAba] = useState<AbaId>("precos");
  const [autoplay, setAutoplay] = useState(true);
  const retomarTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => {
      setAba((atual) => {
        const idx = abas.findIndex((a) => a.id === atual);
        return abas[(idx + 1) % abas.length]!.id;
      });
    }, INTERVALO_AUTOPLAY);
    return () => clearInterval(id);
  }, [autoplay]);

  function selecionarManual(id: AbaId) {
    setAba(id);
    setAutoplay(false);
    if (retomarTimeout.current) clearTimeout(retomarTimeout.current);
    // depois de um tempo sem interação, volta a navegar sozinho
    retomarTimeout.current = setTimeout(() => setAutoplay(true), 12000);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-primary">
          Além do WhatsApp
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Um painel que cresce junto com sua operação
        </h2>
        <p className="mt-4 text-muted-foreground">
          Preço e alerta em qualquer plano. Clima, produção regional e a curva do mercado futuro da
          B3 conforme você sobe de plano — role o mouse pra pausar e explorar no seu ritmo.
        </p>
      </Reveal>

      <Reveal delay={0.15} className="mx-auto mt-12 max-w-3xl">
        <div
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          onMouseEnter={() => setAutoplay(false)}
          onMouseLeave={() => setAutoplay(true)}
        >
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
            {/* mini sidebar, clicável de verdade e com selo do plano */}
            <div className="flex shrink-0 gap-1 border-b border-border p-2 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r sm:p-3">
              {abas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selecionarManual(item.id)}
                  className={cn(
                    "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors sm:flex-none",
                    aba === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="hidden flex-1 sm:inline">{item.label}</span>
                  <span
                    className={cn(
                      "hidden shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:inline",
                      aba === item.id ? "bg-white/20 text-white" : planoBadge[item.plano].className,
                    )}
                  >
                    {planoBadge[item.plano].label}
                  </span>
                </button>
              ))}

              <div className="mt-1 hidden items-center gap-1.5 border-t border-border px-3 pt-3 sm:flex">
                {abas.map((item) => (
                  <span
                    key={item.id}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      aba === item.id ? "bg-primary" : "bg-border",
                    )}
                  />
                ))}
              </div>
            </div>

            {/* conteúdo, muda com a aba */}
            <div className="min-h-96 flex-1 bg-background p-4 sm:p-6">
              {aba === "precos" && <PreviewPrecos />}
              {aba === "alertas" && <PreviewAlertas />}
              {aba === "clima" && <PreviewClima />}
              {aba === "futuro" && <PreviewFuturo />}
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Prévia ilustrativa do painel — dados de exemplo. Recursos com selo{" "}
          <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 font-semibold text-zinc-700">
            Prata
          </span>{" "}
          e{" "}
          <span className="rounded-full bg-gold px-1.5 py-0.5 font-semibold text-gold-foreground">
            Ouro
          </span>{" "}
          fazem parte desses planos —{" "}
          <a href="#planos" className="font-medium text-primary underline underline-offset-2">
            veja a comparação completa
          </a>
          .
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
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">Contexto de mercado</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
          <DollarSign className="size-4 shrink-0 text-primary" />
          Dólar (PTAX): <span className="font-mono font-semibold">R$ 5,20</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
          <Fuel className="size-4 shrink-0 text-primary" />
          Diesel em MT: <span className="font-mono font-semibold">R$ 6,65/L</span>
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
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground">Previsão · MT</p>
        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-700">
          Prata
        </span>
      </div>
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
        <Globe className="size-4 shrink-0 text-primary" />
        Produção de soja em MT (IBGE): <span className="font-semibold">50,6 mi t</span>
      </div>
    </div>
  );
}

function PreviewFuturo() {
  const curva = [
    { mes: "jan.", preco: "377,30" },
    { mes: "fev.", preco: "377,00" },
    { mes: "mar.", preco: "376,45" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold/50 bg-gold-soft/40 p-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground">Boi Gordo — curva futura (B3)</p>
        <span className="rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-semibold text-gold-foreground">
          Ouro
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Vender agora ou esperar? A curva mostra o que o mercado já espera pra daqui a alguns meses.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {curva.map((c) => (
          <Card key={c.mes} className="gap-1 border-gold/40 py-3">
            <CardContent className="flex flex-col items-center gap-1 px-3 text-center">
              <p className="text-xs font-semibold text-muted-foreground capitalize">{c.mes}</p>
              <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                R$ {c.preco}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-gold/40 bg-card p-3 text-sm text-foreground">
        <Sprout className="size-4 shrink-0 text-primary" />
        Também cobre Milho, Café, Soja e Etanol — 7 commodities monitoradas.
      </div>
    </div>
  );
}
