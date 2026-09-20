import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  CloudSun,
  MessageCircle,
  Minus,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth, type Produtor } from "@/lib/auth";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { TrocarCulturaDialog } from "@/components/dashboard/TrocarCulturaDialog";
import { CooperativaInsights } from "@/components/dashboard/CooperativaInsights";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { AtualizadoEm } from "@/components/dashboard/AtualizadoEm";
import { StatCard } from "@/components/dashboard/StatCard";
import { Watchlist } from "@/components/dashboard/Watchlist";
import { CompletarAcessoCard } from "@/components/dashboard/CompletarAcessoCard";
import { BoletimSemanal } from "@/components/dashboard/BoletimSemanal";
import { LeiteCard } from "@/components/dashboard/LeiteCard";
import { ReferenciaMercadoCard } from "@/components/dashboard/ReferenciaMercadoCard";
import { DIAS_DADO_DESATUALIZADO } from "@/lib/referenciaMercado";
import { diasEntre } from "@/lib/precoFonte";
import { Skeleton } from "@/components/ui/skeleton";
import type { Previsao } from "@/lib/clima";
import { buscarPrevisaoPorCoordenadasServidor, buscarPrevisaoServidor } from "@/lib/clima.server";
import { buscarFrete, type ResultadoFrete } from "@/lib/paridade";
import { buscarPrecosDaUf } from "@/lib/precos";
import { mediaDePracas } from "@/lib/precoFonte";
import { buildWhatsAppLink } from "@/config/site";
import { verificarConversaWhatsapp } from "@/lib/notificacoes.server";

export const Route = createFileRoute("/dashboard/_layout/")({
  head: () => ({
    meta: [
      { title: "Visão geral | Safralume" },
      {
        name: "description",
        content: "Resumo executivo de preços, mercado, clima e atividades da sua operação rural.",
      },
      { property: "og:title", content: "Visão geral | Safralume" },
      {
        property: "og:description",
        content: "Resumo executivo de preços, mercado, clima e atividades da sua operação rural.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DashboardHome,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function todayLabel() {
  const label = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function DashboardHome() {
  const { produtor, cooperativa } = useAuth();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <AssinaturaBanner produtorId={produtor?.id} cooperativaId={cooperativa?.id} />
      {produtor ? (
        <ProdutorHome produtor={produtor} />
      ) : cooperativa ? (
        <CooperativaHome cooperativaId={cooperativa.id} cooperativaNome={cooperativa.nome} />
      ) : null}
    </div>
  );
}

type Assinatura = {
  plano: "bronze" | "prata" | "ouro";
  status: "trial" | "ativa" | "inadimplente" | "cancelada";
  trial_expira_em: string;
};

const planoLabel: Record<Assinatura["plano"], string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
};

function AssinaturaBanner({
  produtorId,
  cooperativaId,
}: {
  produtorId: string | undefined;
  cooperativaId: string | undefined;
}) {
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);

  useEffect(() => {
    if (!supabase || (!produtorId && !cooperativaId)) return;
    let query = supabase.from("assinaturas").select("plano, status, trial_expira_em");
    query = produtorId
      ? query.eq("produtor_id", produtorId)
      : query.eq("cooperativa_id", cooperativaId);
    query.maybeSingle().then(({ data }) => setAssinatura(data));
  }, [produtorId, cooperativaId]);

  if (!assinatura || assinatura.status === "ativa") return null;

  if (assinatura.status === "inadimplente") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
        Pagamento do plano {planoLabel[assinatura.plano]} não foi confirmado. Confira a fatura em{" "}
        <Link to="/dashboard/assinatura" className="underline">
          Assinatura
        </Link>{" "}
        pra não perder o acesso.
      </div>
    );
  }

  if (assinatura.status === "cancelada") {
    return (
      <div className="rounded-lg border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground">
        Sua assinatura do plano {planoLabel[assinatura.plano]} foi cancelada.
      </div>
    );
  }

  const diasRestantes = Math.max(
    0,
    Math.ceil((new Date(assinatura.trial_expira_em).getTime() - Date.now()) / 86_400_000),
  );
  // Perto do fim do trial o aviso precisa chamar mais atenção — mesmo
  // esquema de cor do banner de inadimplência, não só o tom neutro de
  // "informação" que ele tinha antes.
  const urgente = diasRestantes <= 2;

  return (
    <div
      className={`rounded-lg border px-4 py-2.5 text-sm ${
        urgente
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-primary/30 bg-primary/5 text-foreground"
      }`}
    >
      Teste grátis do plano <span className="font-semibold">{planoLabel[assinatura.plano]}</span>:{" "}
      {diasRestantes === 0
        ? "expira hoje"
        : `${diasRestantes} dia${diasRestantes === 1 ? "" : "s"} restante${diasRestantes === 1 ? "" : "s"}`}
      .{" "}
      <Link to="/assinar" className="underline">
        Confirmar plano e assinar agora
      </Link>
    </div>
  );
}

type PrecoHistorico = { preco: number; data_referencia: string; updated_at: string | null };
type PrecoRegional = { regiao: string; preco: number; data_referencia: string; fonte?: string };

function dataCurta(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function ProdutorHome({ produtor }: { produtor: Produtor }) {
  // Antes isso era só um "dispensado pra sempre" no localStorage — um clique
  // errado (ou o "X" por curiosidade) escondia o convite pro WhatsApp de
  // vez, mesmo pra quem nunca chegou a mandar mensagem nenhuma pro bot, que
  // é o produto de verdade (o painel é secundário). Agora só esconde de
  // forma permanente quando existe uma conversa de verdade registrada; um
  // dispensar manual só vale pra sessão atual, sem persistir.
  const [bannerWhatsappVisivel, setBannerWhatsappVisivel] = useState(true);
  const [jaConversouNoWhatsapp, setJaConversouNoWhatsapp] = useState(false);
  const [serie, setSerie] = useState<PrecoHistorico[] | null>(null);
  const [precosRegionais, setPrecosRegionais] = useState<PrecoRegional[]>([]);
  const [motivoRegional, setMotivoRegional] = useState<"sem_estado" | "estado_defasado" | null>(
    null,
  );
  const [lembretes, setLembretes] = useState<{ id: string; titulo: string; enviar_em: string }[]>(
    [],
  );
  const [previsao, setPrevisao] = useState<Previsao | null | undefined>(undefined);
  const [frete, setFrete] = useState<ResultadoFrete | null | undefined>(undefined);

  const { session } = useAuth();
  useEffect(() => {
    if (!session) return;
    verificarConversaWhatsapp({ data: { accessToken: session.access_token } }).then(
      ({ jaConversou }) => setJaConversouNoWhatsapp(jaConversou),
    );
  }, [session]);

  function dispensarBannerWhatsapp() {
    setBannerWhatsappVisivel(false);
  }

  useEffect(() => {
    if (!supabase) return;

    if (produtor.cultura_principal && produtor.uf) {
      // Fonte escolhida pela mais recente (ver escolherFontePreco): a série do
      // estado quando está em dia, ou as praças do dia mais recente quando a
      // do estado está defasada (Conab de MT ficou parada 4 semanas enquanto a
      // BBM publicava todo dia) ou não existe.
      buscarPrecosDaUf(supabase, produtor.cultura_principal, produtor.uf).then((r) => {
        setSerie(r.serieEstado);
        setPrecosRegionais(r.regionais);
        setMotivoRegional(r.motivoRegional);
      });

      // Frete de referência e, em PR/SP/MS/MG (soja), a paridade de porto: o
      // preço da região já vem descontado do frete, então o frete NÃO é
      // subtraído dele, só comparado com o porto (ver lib/paridade.ts). Sem
      // rota até porto na base (RS, TO...), mostra só o preço.
      buscarFrete(supabase, {
        cultura: produtor.cultura_principal,
        uf: produtor.uf,
        lat: produtor.lat,
        lon: produtor.lon,
      })
        .then(setFrete)
        .catch(() => setFrete(null));
    } else {
      setSerie([]);
      setPrecosRegionais([]);
      setFrete(null);
    }

    supabase
      .from("lembretes")
      .select("id, titulo, enviar_em")
      .eq("produtor_id", produtor.id)
      .eq("status", "pendente")
      .order("enviar_em", { ascending: true })
      .limit(5)
      .then(({ data }) => setLembretes(data ?? []));
  }, [produtor]);

  useEffect(() => {
    if (!produtor.uf) {
      setPrevisao(null);
      return;
    }
    const busca =
      produtor.lat != null && produtor.lon != null
        ? buscarPrevisaoPorCoordenadasServidor({ data: { lat: produtor.lat, lon: produtor.lon } })
        : buscarPrevisaoServidor({ data: { uf: produtor.uf } });
    busca.then(setPrevisao);
  }, [produtor.uf, produtor.lat, produtor.lon]);

  const atual = serie?.at(-1) ?? null;
  const anterior = serie?.at(-2) ?? null;
  const variacao =
    atual && anterior && anterior.preco !== 0
      ? ((atual.preco - anterior.preco) / anterior.preco) * 100
      : null;
  const mediaRegional =
    precosRegionais.length > 0 ? mediaDePracas(precosRegionais.map((r) => r.preco)) : null;
  const precoExibido = atual?.preco ?? null;
  // Data mais recente que o estado tem da cultura (série do estado ou praças);
  // undefined enquanto carrega, null se não tem nada.
  const ultimaDataDoEstado =
    serie === null
      ? undefined
      : (atual?.data_referencia ?? precosRegionais[0]?.data_referencia ?? null);
  const regionalDesatualizado =
    precosRegionais[0] != null &&
    diasEntre(precosRegionais[0].data_referencia, new Date().toISOString().slice(0, 10)) >
      DIAS_DADO_DESATUALIZADO;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Visão geral</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-foreground text-balance sm:text-3xl">
          {greeting()}, {produtor.nome.split(" ")[0]}
          </h1>
        </div>
        <p className="mt-2 text-sm font-medium text-muted-foreground sm:mt-0">{todayLabel()}</p>
      </div>

      <CompletarAcessoCard />

      {bannerWhatsappVisivel && !jaConversouNoWhatsapp && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-card p-4 shadow-sm">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MessageCircle className="size-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Fica de olho no seu WhatsApp</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A gente te chama por lá em instantes, se apresentando e explicando seu plano. Se não
              chegar, você também pode chamar primeiro.
            </p>
            <a
              href={buildWhatsAppLink(`Olá! Sou ${produtor.nome} e já me cadastrei no Safralume.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Chamar agora
              <ArrowRight className="size-3" />
            </a>
          </div>
          <button
            type="button"
            onClick={dispensarBannerWhatsapp}
            aria-label="Dispensar"
            className="-mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,.75fr)] lg:items-start">
        {/* Coluna principal: preço herói + insights */}
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="overflow-hidden border-primary bg-primary text-primary-foreground shadow-none">
            <CardHeader className="border-b border-primary-foreground/15 px-5 pb-4 sm:px-6">
              <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium opacity-90">
                <span className="flex items-center gap-2">
                  <TrendingUp className="size-4" />
                  Seu preço hoje
                </span>
                {atual?.updated_at && (
                  <AtualizadoEm iso={atual.updated_at} className="opacity-75" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
              {serie === null || frete === undefined ? (
                <Skeleton className="h-14 w-56 bg-primary-foreground/15" />
              ) : atual && precoExibido != null ? (
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="flex items-end gap-2">
                      <p className="font-mono text-4xl font-semibold tabular-nums sm:text-5xl">
                        <span className="mr-1 align-top text-xl font-sans font-semibold opacity-70">
                          R$
                        </span>
                        {precoExibido.toFixed(2).replace(".", ",")}
                      </p>
                      {variacao != null && Math.abs(variacao) >= 0.05 && (
                        <span
                          className={`mb-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            variacao > 0
                              ? "bg-primary-foreground/15"
                              : "bg-destructive/25 text-primary-foreground"
                          }`}
                        >
                          {variacao > 0 ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )}
                          <span className="font-mono tabular-nums">
                            {Math.abs(variacao).toFixed(1)}%
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm opacity-80">
                      <span className="capitalize">
                        {produtor.cultura_principal} · {produtor.uf}
                      </span>
                      <TrocarCulturaDialog produtor={produtor} />
                    </div>
                    <p className="mt-1 text-xs opacity-70">
                      Preço na sua região: é o que você recebe, com o frete até o porto já incluído.
                    </p>
                    <p className="mt-1 max-w-md text-xs opacity-80">
                      {frete
                        ? frete.frase
                        : "Ainda não temos rota de frete de referência pra essa cultura na sua região."}
                    </p>
                  </div>
                  {serie.length >= 2 && (
                    <div className="w-full max-w-56">
                      <Sparkline
                        data={serie.slice(-14).map((s) => s.preco)}
                        color="currentColor"
                        className="h-12 w-full"
                      />
                    </div>
                  )}
                </div>
              ) : precosRegionais.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm opacity-80">
                    {regionalDesatualizado
                      ? `O último preço por região em ${produtor.uf} é de ${dataCurta(precosRegionais[0]!.data_referencia)} e está desatualizado (veja as referências abaixo):`
                      : motivoRegional === "estado_defasado"
                        ? `O preço do estado (${produtor.uf}) está desatualizado. Estes são os preços mais recentes por região, de ${dataCurta(precosRegionais[0]!.data_referencia)}:`
                        : `${produtor.uf} não tem um preço único pro estado, só por região:`}
                  </p>
                  <div className="flex flex-col gap-1">
                    {precosRegionais.map((r) => (
                      <div
                        key={r.regiao}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="opacity-90">{r.regiao}</span>
                        <span className="font-mono font-semibold tabular-nums">
                          R${r.preco.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    ))}
                  </div>
                  {mediaRegional != null && (
                    <p className="mt-1 text-xs opacity-80">
                      Média das regiões: R${mediaRegional.toFixed(2).replace(".", ",")}
                      {precosRegionais[0]?.fonte && <> · fonte: {precosRegionais[0].fonte}</>}
                    </p>
                  )}
                  {frete && <p className="max-w-md text-xs opacity-80">{frete.frase}</p>}
                  <div className="mt-1 flex items-center gap-1.5 text-sm opacity-80">
                    <span className="capitalize">
                      {produtor.cultura_principal} · {produtor.uf}
                    </span>
                    <TrocarCulturaDialog produtor={produtor} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm opacity-80">
                  <span>
                    {/leite/i.test(produtor.cultura_principal ?? "")
                      ? `Leite não tem cotação pública diária em ${produtor.uf ?? "sua região"}. Veja as referências abaixo.`
                      : `Ainda não temos preço pra ${produtor.cultura_principal ?? "sua cultura"} em ${produtor.uf ?? "sua região"}. Veja as referências de outros estados logo abaixo.`}
                  </span>
                  <TrocarCulturaDialog produtor={produtor} />
                </div>
              )}
              <Link
                to="/dashboard/alertas"
                className="inline-block text-sm font-medium text-primary-foreground underline underline-offset-2 opacity-90 hover:opacity-100"
              >
                Avisar quando o preço mudar
              </Link>
            </CardContent>
          </Card>

          {/leite/i.test(produtor.cultura_principal ?? "") && <LeiteCard produtor={produtor} />}

          <ReferenciaMercadoCard produtor={produtor} ultimaData={ultimaDataDoEstado} />

          <InsightsPanel produtor={produtor} />

          <Watchlist produtor={produtor} />

          <BoletimSemanal produtor={produtor} />
        </div>

        {/* Coluna lateral: clima + lembretes */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-24">
          <Card className="gap-3 border-border/80 shadow-none">
            <CardHeader className="border-b border-border/70 px-4 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CloudSun className="size-4" />
                Clima em {produtor.municipio ?? produtor.uf ?? "sua região"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              {previsao === undefined ? (
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : previsao === null ? (
                <p className="text-sm text-muted-foreground">Previsão indisponível.</p>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {previsao.dias.slice(0, 5).map((dia, i) => {
                    const pct = previsao.chuvaPct[i] ?? 0;
                    return (
                      <div
                        key={dia}
                         className={`flex min-w-0 flex-col items-center gap-0.5 rounded-md border p-1.5 text-center ${
                          pct >= 60
                            ? "border-destructive/20 bg-destructive/10 text-destructive"
                            : "border-transparent bg-secondary text-muted-foreground"
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase">
                          {i === 0
                            ? "hoje"
                            : new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", {
                                weekday: "short",
                              })}
                        </span>
                        <span className="font-mono text-xs font-semibold tabular-nums">{pct}%</span>
                        <span className="font-mono text-[10px] tabular-nums">
                          {Math.round(previsao.tempMax[i] ?? 0)}°
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link
                to="/dashboard/clima"
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Ver previsão completa
              </Link>
            </CardContent>
          </Card>

          <Card className="gap-3 border-border/80 shadow-none">
            <CardHeader className="border-b border-border/70 px-4 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Bell className="size-4" />
                Seus lembretes
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-4">
              {lembretes.length === 0 && (
                <p className="py-2 text-sm text-muted-foreground">
                  Nenhum lembrete agendado. Crie um pra não esquecer uma tarefa da lavoura.
                </p>
              )}
              {lembretes.map((l) => (
                <div
                  key={l.id}
                   className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm transition-colors hover:bg-accent/50"
                >
                  <span className="truncate font-medium text-foreground">{l.titulo}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(l.enviar_em).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
              <Link
                to="/dashboard/lembretes"
                className="mt-1 text-sm font-medium text-primary hover:underline"
              >
                Ver todos / criar novo
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

type TickerEntry = { label: string; atual: number; variacao: number | null };

function PriceTicker({ entries }: { entries: TickerEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <span className="flex items-center gap-1.5 pl-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        Soja agora
      </span>
      {entries.map((e) => (
        <span
          key={e.label}
          className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium"
        >
          <span className="font-semibold text-foreground">{e.label}</span>
          <span className="font-mono tabular-nums text-foreground">
            R${" "}
            {e.atual.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          {e.variacao != null && (
            <span
              className={`flex items-center gap-0.5 font-mono tabular-nums ${
                e.variacao > 0
                  ? "text-primary"
                  : e.variacao < 0
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {e.variacao > 0 ? (
                <ArrowUp className="size-3" />
              ) : e.variacao < 0 ? (
                <ArrowDown className="size-3" />
              ) : (
                <Minus className="size-3" />
              )}
              {Math.abs(e.variacao).toFixed(1)}%
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function CooperativaHome({
  cooperativaId,
  cooperativaNome,
}: {
  cooperativaId: string;
  cooperativaNome: string;
}) {
  const [stats, setStats] = useState({ produtores: 0, lembretes: 0 });
  const [precoRows, setPrecoRows] = useState<
    { uf: string; regiao: string; preco: number; data_referencia: string }[]
  >([]);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase
        .from("produtores")
        .select("id", { count: "exact", head: true })
        .eq("cooperativa_id", cooperativaId),
      supabase
        .from("lembretes")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente"),
    ]).then(([produtoresRes, lembretesRes]) => {
      setStats({
        produtores: produtoresRes.count ?? 0,
        lembretes: lembretesRes.count ?? 0,
      });
    });

    // Sem filtro de regiao de propósito: fontes como BBM/IEA-SP só publicam
    // soja por praça em alguns estados (MG, SP...), sem número único do
    // estado — excluir isso do ticker fazia esses estados sumirem em
    // silêncio. Limite maior que antes porque agora cobre mais séries
    // (estado + região) na mesma janela.
    supabase
      .from("precos")
      .select("uf, regiao, preco, data_referencia")
      .ilike("produto", "%soja%")
      .order("data_referencia", { ascending: false })
      .limit(200)
      .then(({ data }) => setPrecoRows(data ?? []));
  }, [cooperativaId]);

  const ticker = useMemo<TickerEntry[]>(() => {
    const porSerie = new Map<
      string,
      { label: string; pontos: { preco: number; data_referencia: string }[] }
    >();
    for (const r of precoRows) {
      const label = r.regiao ? `${r.uf} · ${r.regiao}` : r.uf;
      const entry = porSerie.get(label) ?? { label, pontos: [] };
      entry.pontos.push(r);
      porSerie.set(label, entry);
    }
    return [...porSerie.values()]
      .map(({ label, pontos }) => {
        const sorted = pontos.sort((a, b) => b.data_referencia.localeCompare(a.data_referencia));
        const atual = sorted[0]?.preco;
        const anterior = sorted[1]?.preco;
        const variacao =
          atual != null && anterior != null && anterior !== 0
            ? ((atual - anterior) / anterior) * 100
            : null;
        return atual != null ? { label, atual, variacao } : null;
      })
      .filter((e): e is TickerEntry => e != null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [precoRows]);

  const cards = [
    {
      label: "Produtores cadastrados",
      value: stats.produtores,
      hint: "Na sua cooperativa",
      icon: Users,
      to: "/dashboard/produtores",
    },
    {
      label: "Lembretes pendentes",
      value: stats.lembretes,
      hint: "Aguardando envio",
      icon: Bell,
      to: "/dashboard/lembretes",
    },
  ];

  const maiorVariacao = ticker
    .filter((e) => e.variacao != null)
    .sort((a, b) => Math.abs(b.variacao!) - Math.abs(a.variacao!))
    .at(0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Resumo executivo</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-foreground text-balance sm:text-3xl">
            {greeting()}, {cooperativaNome}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{todayLabel()}</p>
        </div>
        <PriceTicker entries={ticker} />
      </div>

      {maiorVariacao && Math.abs(maiorVariacao.variacao!) >= 1 && (
        <div className="flex items-center gap-2 rounded-md border border-gold/35 bg-gold-soft/40 px-4 py-3 text-sm text-foreground">
          {maiorVariacao.variacao! > 0 ? (
            <ArrowUp className="size-4 shrink-0 text-primary" />
          ) : (
            <ArrowDown className="size-4 shrink-0 text-destructive" />
          )}
          <span>
            Maior variação da semana: soja em <strong>{maiorVariacao.label}</strong>{" "}
            {maiorVariacao.variacao! > 0 ? "subiu" : "caiu"}{" "}
            <span className="font-mono font-semibold tabular-nums">
              {Math.abs(maiorVariacao.variacao!).toFixed(1)}%
            </span>
            .
          </span>
        </div>
      )}

      <CooperativaInsights cooperativaId={cooperativaId} />

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            icon={c.icon}
            label={c.label}
            value={c.value}
            hint={c.hint}
            to={c.to}
          />
        ))}
      </div>
    </div>
  );
}
