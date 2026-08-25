import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type Plano = "bronze" | "prata" | "ouro";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || (!produtorId && !cooperativaId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase.from("assinaturas").select("plano");
    query = produtorId
      ? query.eq("produtor_id", produtorId)
      : query.eq("cooperativa_id", cooperativaId);
    query.maybeSingle().then(({ data }) => {
      setPlano((data?.plano as Plano | undefined) ?? null);
      setLoading(false);
    });
  }, [produtorId, cooperativaId]);

  return { plano, loading };
}
