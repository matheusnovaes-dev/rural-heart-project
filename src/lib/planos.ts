import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type Plano = "bronze" | "prata" | "ouro";
export type StatusAssinatura = "trial" | "ativa" | "inadimplente" | "cancelada";

export function temAcessoPrata(plano: Plano | null | undefined) {
  return plano === "prata" || plano === "ouro";
}

export function temAcessoOuro(plano: Plano | null | undefined) {
  return plano === "ouro";
}

/** Assinatura (plano) do produtor ou cooperativa logado, pra gating de feature. */
export function useAssinatura() {
  const { produtor, cooperativa } = useAuth();
  const produtorId = produtor?.id;
  const cooperativaId = cooperativa?.id;
  const [plano, setPlano] = useState<Plano | null>(null);
  const [status, setStatus] = useState<StatusAssinatura | null>(null);
  const [trialExpiraEm, setTrialExpiraEm] = useState<string | null>(null);
  const [assinaturaId, setAssinaturaId] = useState<string | null>(null);
  const [asaasSubscriptionId, setAsaasSubscriptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || (!produtorId && !cooperativaId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase
      .from("assinaturas")
      .select("id, plano, status, trial_expira_em, asaas_subscription_id");
    query = produtorId
      ? query.eq("produtor_id", produtorId)
      : query.eq("cooperativa_id", cooperativaId);
    query.maybeSingle().then(({ data }) => {
      setPlano((data?.plano as Plano | undefined) ?? null);
      setStatus((data?.status as StatusAssinatura | undefined) ?? null);
      setTrialExpiraEm(data?.trial_expira_em ?? null);
      setAssinaturaId(data?.id ?? null);
      setAsaasSubscriptionId(data?.asaas_subscription_id ?? null);
      setLoading(false);
    });
  }, [produtorId, cooperativaId]);

  return { plano, status, trialExpiraEm, assinaturaId, asaasSubscriptionId, loading };
}
