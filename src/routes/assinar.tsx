import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useAssinatura, type Plano } from "@/lib/planos";
import { criarAssinaturaAsaas } from "@/lib/asaas.server";
import { pricingPlans } from "@/config/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assinar")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AssinarPage,
});

/**
 * Muro que o `/dashboard/_layout` manda quem não tem acesso liberado (trial
 * vencido, pagamento pendente ou assinatura cancelada) — só sai daqui
 * escolhendo um plano e completando o pagamento na Asaas.
 */
function AssinarPage() {
  const { session, produtor, cooperativa, loading: authLoading } = useAuth();
  const {
    plano,
    status,
    trialExpiraEm,
    criadaEm,
    assinaturaId,
    loading: assinaturaLoading,
  } = useAssinatura();
  const navigate = useNavigate();

  const [cpfCnpj, setCpfCnpj] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Plano>("bronze");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (plano) setSelecionado(plano);
  }, [plano]);

  useEffect(() => {
    if (!supabase) return;
    if (produtor) {
      supabase
        .from("produtores")
        .select("cpf_cnpj")
        .eq("id", produtor.id)
        .maybeSingle()
        .then(({ data }) => setCpfCnpj(data?.cpf_cnpj ?? null));
    } else if (cooperativa) {
      supabase
        .from("cooperativas")
        .select("cpf_cnpj")
        .eq("id", cooperativa.id)
        .maybeSingle()
        .then(({ data }) => setCpfCnpj(data?.cpf_cnpj ?? null));
    }
  }, [produtor, cooperativa]);

  const carregando = authLoading || assinaturaLoading;
  const trialValido = status === "trial" && !!trialExpiraEm && new Date(trialExpiraEm) > new Date();

  useEffect(() => {
    if (carregando) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (!produtor && !cooperativa) {
      navigate({ to: "/onboarding" });
      return;
    }
    // Já paga e ativa: não tem o que fazer aqui, não faz sentido segurar no
    // muro. Trial ainda válido é diferente — pode ser visita voluntária (ex:
    // veio do aviso de "seu teste acaba em 2 dias" querendo adiantar o
    // pagamento), então deixa continuar, só muda a mensagem mais abaixo.
    if (status === "ativa") {
      navigate({ to: "/dashboard" });
    }
  }, [carregando, session, produtor, cooperativa, status, navigate]);

  if (carregando || !session || (!produtor && !cooperativa) || status === "ativa") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const diasRestantes = trialExpiraEm
    ? Math.max(0, Math.ceil((new Date(trialExpiraEm).getTime() - Date.now()) / 86_400_000))
    : null;

  // Quem escolheu "prefere assinar direto" (pulou o teste grátis) tem o
  // trial marcado como já vencido desde a criação (ver onboarding.tsx) —
  // ou seja, trial_expira_em cai bem perto de created_at, bem diferente
  // do padrão de +7 dias. Sem essa distinção, quem nunca teve teste grátis
  // veria "seu teste de 7 dias acabou", o que é falso pra esse caso.
  const pulouTrial =
    !!trialExpiraEm &&
    !!criadaEm &&
    new Date(trialExpiraEm).getTime() - new Date(criadaEm).getTime() < 60_000;

  const mensagem = trialValido
    ? `Você ainda tem ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"} de teste grátis. Se preferir, já dá pra escolher um plano e configurar o pagamento agora.`
    : status === "inadimplente"
      ? "O pagamento da sua assinatura não foi confirmado. Escolha um plano (pode ser o mesmo de antes) pra regularizar e continuar."
      : status === "cancelada"
        ? "Sua assinatura foi cancelada. Escolha um plano pra reativar o acesso."
        : pulouTrial
          ? "Você escolheu assinar direto, sem teste grátis. Falta só escolher um plano e concluir o pagamento pra liberar o acesso."
          : "Seu teste grátis de 7 dias acabou. Escolha um plano pra continuar usando o Safralume.";

  async function continuar() {
    if (!supabase || !session) return;
    if (!cpfCnpj) {
      setErro("Não encontramos seu CPF/CNPJ cadastrado. Chama no WhatsApp pra gente ajustar.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      let idAssinatura = assinaturaId;
      if (!idAssinatura) {
        const { data, error } = await supabase
          .from("assinaturas")
          .insert(
            produtor
              ? {
                  produtor_id: produtor.id,
                  plano: selecionado,
                  trial_expira_em: new Date().toISOString(),
                }
              : {
                  cooperativa_id: cooperativa!.id,
                  plano: selecionado,
                  trial_expira_em: new Date().toISOString(),
                },
          )
          .select("id")
          .single();
        if (error || !data) throw new Error("Não foi possível preparar a assinatura.");
        idAssinatura = data.id;
      } else if (selecionado !== plano) {
        await supabase.from("assinaturas").update({ plano: selecionado }).eq("id", idAssinatura);
      }
      if (!idAssinatura) throw new Error("Não foi possível preparar a assinatura.");

      const checkout = await criarAssinaturaAsaas({
        data: {
          plano: selecionado,
          assinaturaId: idAssinatura,
          nome: produtor?.nome ?? cooperativa?.nome ?? "",
          cpfCnpj,
          email: session.user.email,
          whatsapp: produtor?.whatsapp,
          semTrial: true,
        },
      });
      window.location.href = checkout.url;
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Algo deu errado. Tenta de novo.");
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary/40 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Escolha um plano pra continuar
          </h1>
          <p className="mt-2 text-muted-foreground">{mensagem}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {pricingPlans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelecionado(p.id as Plano)}
              className={cn(
                "flex flex-col rounded-2xl border p-5 text-left transition-colors",
                selecionado === p.id
                  ? "border-primary bg-card ring-2 ring-primary"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              <h3 className="font-display font-semibold text-foreground">{p.name}</h3>
              <p className="text-xs text-muted-foreground">{p.audience}</p>
              <p className="mt-2 font-mono text-xl font-bold tabular-nums text-foreground">
                R$ {p.price.toLocaleString("pt-BR")}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <ul className="mt-3 flex-1 space-y-1.5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {erro && <p className="mt-4 text-center text-sm text-destructive">{erro}</p>}

        <div className="mt-6 flex justify-center">
          <Button size="lg" disabled={enviando} onClick={continuar}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : "Continuar para pagamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}
