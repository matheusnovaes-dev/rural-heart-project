import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, CreditCard, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { UpgradeButton } from "@/components/dashboard/UpgradeButton";
import { CancelarAssinaturaDialog } from "@/components/dashboard/CancelarAssinaturaDialog";
import { useAuth } from "@/lib/auth";
import { useAssinatura, type Plano } from "@/lib/planos";
import { listarCobrancas, type Cobranca } from "@/lib/asaas.server";
import { pricingPlans } from "@/config/site";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";
import { aoMoverSpotlight, aoSairSpotlight } from "@/lib/useSpotlight";

export const Route = createFileRoute("/dashboard/_layout/assinatura")({
  component: AssinaturaPage,
});

const ordemPlanos: Plano[] = ["bronze", "prata", "ouro"];

const statusLabel: Record<
  string,
  { texto: string; variant: "default" | "secondary" | "destructive" }
> = {
  trial: { texto: "Teste grátis", variant: "secondary" },
  ativa: { texto: "Ativa", variant: "default" },
  inadimplente: { texto: "Pagamento pendente", variant: "destructive" },
  cancelada: { texto: "Cancelada", variant: "secondary" },
};

const cobrancaStatusLabel: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  CONFIRMED: "Confirmada",
  RECEIVED: "Paga",
  OVERDUE: "Vencida",
  REFUNDED: "Estornada",
  DELETED: "Cancelada",
};

function formatReais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

function AssinaturaPage() {
  const { session } = useAuth();
  const { plano, status, trialExpiraEm, assinaturaId, asaasSubscriptionId, loading } =
    useAssinatura();
  const [cobrancas, setCobrancas] = useState<Cobranca[] | null>(null);
  const [carregandoCobrancas, setCarregandoCobrancas] = useState(true);

  useEffect(() => {
    if (!asaasSubscriptionId || !session) {
      setCarregandoCobrancas(false);
      return;
    }
    setCarregandoCobrancas(true);
    listarCobrancas({ data: { accessToken: session.access_token, asaasSubscriptionId } })
      .then((r) => setCobrancas(r.cobrancas))
      .catch(() => setCobrancas([]))
      .finally(() => setCarregandoCobrancas(false));
  }, [asaasSubscriptionId, session]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const planoAtual = pricingPlans.find((p) => p.id === plano);
  const diasRestantes = trialExpiraEm
    ? Math.max(0, Math.ceil((new Date(trialExpiraEm).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={IconesSafralume.assinatura}
        iconePersonalizado
        title="Assinatura"
        description="Seu plano atual e o histórico de cobranças"
      />

      {!plano ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={CreditCard}
              title="Nenhuma assinatura configurada"
              description="Fale com a gente no WhatsApp pra ativar seu plano."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card
            data-testid="assinatura-plano"
            onPointerMove={aoMoverSpotlight}
            onPointerLeave={aoSairSpotlight}
            data-tilt=""
            className="kpi-hero spot borda-viva card-premium relative overflow-hidden border-0 py-0"
          >
            <CardContent className="relative flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-70">
                    Seu plano
                  </p>
                  <h2 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                    {planoAtual?.name ?? plano}
                  </h2>
                  <p className="mt-2 font-mono text-lg tabular-nums opacity-90">
                    {planoAtual ? `${formatReais(planoAtual.price)}/mês` : ""}
                  </p>
                </div>
                {status && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ring-1 ${
                      status === "ativa"
                        ? "bg-emerald-400/20 text-emerald-100 ring-emerald-300/40"
                        : status === "inadimplente"
                          ? "bg-red-400/25 text-red-100 ring-red-300/40"
                          : "bg-white/15 text-primary-foreground ring-white/25"
                    }`}
                  >
                    {statusLabel[status]?.texto ?? status}
                  </span>
                )}
              </div>
              {status === "trial" && diasRestantes !== null && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs opacity-80">
                    <span>Teste grátis</span>
                    <span>
                      {diasRestantes === 0
                        ? "expira hoje"
                        : `${diasRestantes} dia${diasRestantes === 1 ? "" : "s"} restante${diasRestantes === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="barra-x h-full rounded-full bg-[var(--gold)]"
                      style={{ width: `${Math.min(100, Math.max(6, (diasRestantes / 7) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
              {planoAtual && (
                <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  {planoAtual.features
                    .filter((f) => !/^tudo do /i.test(f))
                    .slice(0, 6)
                    .map((f) => (
                      <li key={f} className="flex items-start gap-2 opacity-90">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-[var(--gold)]"
                          aria-hidden="true"
                        />
                        <span className="text-pretty">{f}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {status === "inadimplente" && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm text-red-800">
                  A última cobrança não foi paga. Verifique a fatura mais recente abaixo pra
                  regularizar e não perder o acesso.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {status === "trial" && (
                  <Button asChild size="sm">
                    <Link to="/assinar">Confirmar plano e assinar agora</Link>
                  </Button>
                )}
                {ordemPlanos
                  .filter((p) => p !== plano && ordemPlanos.indexOf(p) > ordemPlanos.indexOf(plano))
                  .map((p) => (
                    <UpgradeButton
                      key={p}
                      planoAlvo={p}
                      assinaturaId={assinaturaId}
                      asaasSubscriptionId={asaasSubscriptionId}
                      variant="outline"
                    />
                  ))}
                {(status === "ativa" || status === "inadimplente" || status === "trial") &&
                  assinaturaId && (
                    <CancelarAssinaturaDialog
                      assinaturaId={assinaturaId}
                      asaasSubscriptionId={asaasSubscriptionId}
                      status={status}
                    />
                  )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de cobranças</CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoCobrancas ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !cobrancas || cobrancas.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Nenhuma cobrança ainda"
              description="As cobranças da sua assinatura aparecem aqui assim que forem geradas."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {cobrancas.map((c, index) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{formatReais(c.value)}</p>
                    <p className="text-xs text-muted-foreground">
                      Vencimento {formatData(c.dueDate)}
                      {c.paymentDate && ` · paga em ${formatData(c.paymentDate)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === "OVERDUE" ? "destructive" : "secondary"}>
                      {cobrancaStatusLabel[c.status] ?? c.status}
                    </Badge>
                    <a
                      href={c.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-10 items-center justify-center text-muted-foreground hover:text-foreground pointer-coarse:size-11"
                      aria-label="Ver fatura"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
