import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { UpgradeButton } from "@/components/dashboard/UpgradeButton";
import { CancelarAssinaturaDialog } from "@/components/dashboard/CancelarAssinaturaDialog";
import { useAuth } from "@/lib/auth";
import { useAssinatura, type Plano } from "@/lib/planos";
import { listarCobrancas, type Cobranca } from "@/lib/asaas.server";
import { pricingPlans } from "@/config/site";

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
        icon={CreditCard}
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Plano {planoAtual?.name ?? plano}</CardTitle>
            {status && (
              <Badge variant={statusLabel[status]?.variant ?? "secondary"}>
                {statusLabel[status]?.texto ?? status}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {planoAtual ? `${formatReais(planoAtual.price)}/mês` : ""}
              {status === "trial" && diasRestantes !== null && (
                <>
                  {" "}
                  · teste grátis{" "}
                  {diasRestantes === 0
                    ? "expira hoje"
                    : `expira em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`}
                </>
              )}
            </p>
            {status === "inadimplente" && (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                A última cobrança não foi paga. Verifique a fatura mais recente abaixo pra
                regularizar e não perder o acesso.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
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
                  />
                )}
            </div>
          </CardContent>
        </Card>
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
              {cobrancas.map((c) => (
                <div
                  key={c.id}
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
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Ver fatura"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
