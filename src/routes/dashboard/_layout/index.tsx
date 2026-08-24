import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Bell, ListChecks, Minus, TrendingUp, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth, type Produtor } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/_layout/")({
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
    <div className="flex flex-col gap-4">
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
        Pagamento do plano {planoLabel[assinatura.plano]} não foi confirmado — verifique seu cartão
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

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
      Teste grátis do plano <span className="font-semibold">{planoLabel[assinatura.plano]}</span> —{" "}
      {diasRestantes === 0
        ? "expira hoje"
        : `${diasRestantes} dia${diasRestantes === 1 ? "" : "s"} restante${diasRestantes === 1 ? "" : "s"}`}
      .
    </div>
  );
}

function ProdutorHome({ produtor }: { produtor: Produtor }) {
  const [preco, setPreco] = useState<{ preco: number; data_referencia: string } | null>(null);
  const [lembretes, setLembretes] = useState<{ id: string; titulo: string; enviar_em: string }[]>(
    [],
  );

  useEffect(() => {
    if (!supabase) return;

    if (produtor.cultura_principal && produtor.uf) {
      supabase
        .from("precos")
        .select("preco, data_referencia")
        .ilike("produto", `%${produtor.cultura_principal}%`)
        .eq("uf", produtor.uf)
        .order("data_referencia", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setPreco(data));
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

  return (
    <div className="flex flex-col gap-4">
      <p className="font-display text-xl font-semibold tracking-tight text-foreground">
        {greeting()}, {produtor.nome.split(" ")[0]}
      </p>

      <Card className="border-primary/30 bg-primary text-primary-foreground">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium opacity-90">
            <TrendingUp className="size-4" />
            Seu preço hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {preco ? (
            <>
              <p className="font-mono text-4xl font-bold tabular-nums">
                R$ {preco.preco.toFixed(2).replace(".", ",")}
              </p>
              <p className="mt-1 text-sm opacity-80">
                {produtor.cultura_principal} · {produtor.uf} · atualizado em{" "}
                {new Date(preco.data_referencia).toLocaleDateString("pt-BR")}
              </p>
            </>
          ) : (
            <p className="text-sm opacity-80">
              Ainda não temos preço pra {produtor.cultura_principal ?? "sua cultura"} em{" "}
              {produtor.uf ?? "sua região"}.
            </p>
          )}
          <Link
            to="/dashboard/alertas"
            className="mt-3 inline-block text-sm font-medium text-primary-foreground underline underline-offset-2 opacity-90 hover:opacity-100"
          >
            Avisar quando o preço mudar
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Bell className="size-4" />
            Seus lembretes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {lembretes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum lembrete por enquanto.</p>
          )}
          {lembretes.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
            >
              <span className="font-medium text-foreground">{l.titulo}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
            className="mt-2 text-center text-sm font-medium text-primary hover:underline"
          >
            Ver todos / criar novo
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

type TickerEntry = { uf: string; atual: number; variacao: number | null };

function PriceTicker({ entries }: { entries: TickerEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-sm">
      <span className="flex items-center gap-1.5 pl-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        Soja agora
      </span>
      {entries.map((e) => (
        <span
          key={e.uf}
          className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
        >
          <span className="font-semibold text-foreground">{e.uf}</span>
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
  const [stats, setStats] = useState({ produtores: 0, leads: 0, lembretes: 0 });
  const [precoRows, setPrecoRows] = useState<
    { uf: string; preco: number; data_referencia: string }[]
  >([]);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase
        .from("produtores")
        .select("id", { count: "exact", head: true })
        .eq("cooperativa_id", cooperativaId),
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase
        .from("lembretes")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente"),
    ]).then(([produtoresRes, leadsRes, lembretesRes]) => {
      setStats({
        produtores: produtoresRes.count ?? 0,
        leads: leadsRes.count ?? 0,
        lembretes: lembretesRes.count ?? 0,
      });
    });

    supabase
      .from("precos")
      .select("uf, preco, data_referencia")
      .ilike("produto", "%soja%")
      .order("data_referencia", { ascending: false })
      .limit(60)
      .then(({ data }) => setPrecoRows(data ?? []));
  }, [cooperativaId]);

  const ticker = useMemo<TickerEntry[]>(() => {
    const byUf = new Map<string, { preco: number; data_referencia: string }[]>();
    for (const r of precoRows) {
      const list = byUf.get(r.uf) ?? [];
      list.push(r);
      byUf.set(r.uf, list);
    }
    return [...byUf.entries()]
      .map(([uf, list]) => {
        const sorted = list.sort((a, b) => b.data_referencia.localeCompare(a.data_referencia));
        const atual = sorted[0]?.preco;
        const anterior = sorted[1]?.preco;
        const variacao =
          atual != null && anterior != null ? ((atual - anterior) / anterior) * 100 : null;
        return atual != null ? { uf, atual, variacao } : null;
      })
      .filter((e): e is TickerEntry => e != null)
      .sort((a, b) => a.uf.localeCompare(b.uf));
  }, [precoRows]);

  const cards = [
    {
      label: "Produtores cadastrados",
      value: stats.produtores,
      icon: Users,
      to: "/dashboard/produtores",
    },
    { label: "Leads da landing", value: stats.leads, icon: ListChecks, to: "/dashboard/leads" },
    {
      label: "Lembretes pendentes",
      value: stats.lembretes,
      icon: Bell,
      to: "/dashboard/lembretes",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{todayLabel()}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground text-balance">
            {greeting()}, {cooperativaNome}
          </h1>
        </div>
        <PriceTicker entries={ticker} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <c.icon className="size-4" />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
                  {c.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
