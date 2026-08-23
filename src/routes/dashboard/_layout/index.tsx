import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, TrendingUp, Users, ListChecks } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth, type Produtor } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/_layout/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { produtor, cooperativa } = useAuth();

  if (produtor) return <ProdutorHome produtor={produtor} />;
  if (cooperativa) return <CooperativaHome cooperativaId={cooperativa.id} />;
  return null;
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
              <p className="text-4xl font-bold">R$ {preco.preco.toFixed(2).replace(".", ",")}</p>
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
              <span className="text-muted-foreground">
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

function CooperativaHome({ cooperativaId }: { cooperativaId: string }) {
  const [stats, setStats] = useState({ produtores: 0, leads: 0, lembretes: 0 });

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
  }, [cooperativaId]);

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
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.label} to={c.to}>
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <c.icon className="size-4" />
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{c.value}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
