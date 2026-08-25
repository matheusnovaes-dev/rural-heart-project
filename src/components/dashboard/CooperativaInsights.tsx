import { useEffect, useState } from "react";
import { Bell, CloudRain, Loader2, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/lib/supabase";
import { buscarPrevisao } from "@/lib/clima";
import { temAcessoPrata, useAssinatura } from "@/lib/planos";
import { InsightCard } from "@/components/dashboard/InsightCard";

type ProdutorResumo = { uf: string | null; cultura_principal: string | null };

export function CooperativaInsights({ cooperativaId }: { cooperativaId: string }) {
  const { plano } = useAssinatura();
  const [produtores, setProdutores] = useState<ProdutorResumo[] | null>(null);
  const [alertasDisparados, setAlertasDisparados] = useState<number | null>(null);
  const [ufsComRisco, setUfsComRisco] = useState<number | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("produtores")
      .select("uf, cultura_principal")
      .eq("cooperativa_id", cooperativaId)
      .then(({ data }) => setProdutores(data ?? []));

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    supabase
      .from("alertas_preco")
      .select("id, produtores!inner(cooperativa_id)", { count: "exact", head: true })
      .eq("produtores.cooperativa_id", cooperativaId)
      .not("disparado_em", "is", null)
      .gte("disparado_em", seteDiasAtras.toISOString())
      .then(({ count }) => setAlertasDisparados(count ?? 0));
  }, [cooperativaId]);

  useEffect(() => {
    if (!produtores || !temAcessoPrata(plano)) return;
    const ufsUnicas = [...new Set(produtores.map((p) => p.uf).filter((uf): uf is string => !!uf))];
    if (ufsUnicas.length === 0) {
      setUfsComRisco(0);
      return;
    }
    Promise.all(ufsUnicas.map((uf) => buscarPrevisao(uf))).then((previsoes) => {
      const comRisco = previsoes.filter((p) => p && Math.max(...p.chuvaPct) >= 60).length;
      setUfsComRisco(comRisco);
    });
  }, [produtores, plano]);

  if (produtores === null) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (produtores.length === 0) return null;

  const ufsUnicas = [...new Set(produtores.map((p) => p.uf).filter(Boolean))];
  const culturasUnicas = [...new Set(produtores.map((p) => p.cultura_principal).filter(Boolean))];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <InsightCard icon={MapPin} tone="neutral" title="Cobertura">
        <span className="font-mono font-semibold tabular-nums">{produtores.length}</span> produtor
        {produtores.length === 1 ? "" : "es"} em{" "}
        <span className="font-mono font-semibold tabular-nums">{ufsUnicas.length}</span> UF
        {ufsUnicas.length === 1 ? "" : "s"}
        {culturasUnicas.length > 0 && (
          <>
            {" "}
            e <span className="font-mono font-semibold tabular-nums">
              {culturasUnicas.length}
            </span>{" "}
            cultura{culturasUnicas.length === 1 ? "" : "s"} diferente
            {culturasUnicas.length === 1 ? "" : "s"}.
          </>
        )}
      </InsightCard>

      <InsightCard
        icon={Bell}
        tone={alertasDisparados && alertasDisparados > 0 ? "up" : "neutral"}
        title="Alertas (7 dias)"
      >
        {alertasDisparados == null ? (
          "Carregando..."
        ) : alertasDisparados === 0 ? (
          <>Nenhum alerta disparou nos últimos 7 dias.</>
        ) : (
          <>
            <span className="font-mono font-semibold tabular-nums">{alertasDisparados}</span> alerta
            {alertasDisparados === 1 ? "" : "s"} disparou{alertasDisparados === 1 ? "" : "ram"} nos
            últimos 7 dias.
          </>
        )}{" "}
        <Link
          to="/dashboard/alertas"
          className="underline underline-offset-2 hover:text-foreground"
        >
          ver alertas
        </Link>
      </InsightCard>

      {temAcessoPrata(plano) && (
        <InsightCard
          icon={CloudRain}
          tone={ufsComRisco != null && ufsComRisco > 0 ? "warn" : "neutral"}
          title="Clima"
        >
          {ufsComRisco == null ? (
            "Carregando..."
          ) : ufsComRisco === 0 ? (
            "Nenhuma UF com risco de chuva forte essa semana."
          ) : (
            <>
              <span className="font-mono font-semibold tabular-nums">{ufsComRisco}</span> de{" "}
              <span className="font-mono font-semibold tabular-nums">{ufsUnicas.length}</span> UF
              {ufsUnicas.length === 1 ? "" : "s"} com risco de chuva forte essa semana.
            </>
          )}{" "}
          <Link
            to="/dashboard/clima"
            className="underline underline-offset-2 hover:text-foreground"
          >
            ver detalhes
          </Link>
        </InsightCard>
      )}
    </div>
  );
}
