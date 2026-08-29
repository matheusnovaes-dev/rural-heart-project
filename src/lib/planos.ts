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
    // Cooperativa tem prioridade: numa conta dupla-função (admin de
    // cooperativa que também é produtor solo), a visão renderizada é a da
    // cooperativa (ver _layout.tsx), então o gating tem que seguir a
    // assinatura DELA, não a pessoal — senão um trial pessoal vencido
    // travaria o admin fora do painel da própria cooperativa, mesmo com o
    // plano da cooperativa ativo.
    query = cooperativaId
      ? query.eq("cooperativa_id", cooperativaId)
      : query.eq("produtor_id", produtorId);
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

/**
 * Decide se a conta pode usar o painel agora: assinatura ativa, ou trial
 * ainda dentro do prazo. Produtor convidado por cooperativa (tem
 * `cooperativa_id` mas não é ele mesmo um membro dela) nunca tem assinatura
 * própria — quem paga é a cooperativa, então sempre libera pra esse caso.
 */
export function useAcessoDashboard() {
  const { produtor, cooperativa } = useAuth();
  const cobertoPelaCooperativa = !cooperativa && !!produtor?.cooperativa_id;
  const { status, trialExpiraEm, loading } = useAssinatura();

  if (cobertoPelaCooperativa) {
    return { liberado: true, carregando: false };
  }
  if (loading) {
    return { liberado: true, carregando: true };
  }

  const trialValido = status === "trial" && !!trialExpiraEm && new Date(trialExpiraEm) > new Date();
  return { liberado: status === "ativa" || trialValido, carregando: false };
}
