import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export type Produtor = {
  id: string;
  user_id: string;
  cooperativa_id: string | null;
  nome: string;
  whatsapp: string;
  cultura_principal: string | null;
  uf: string | null;
  municipio: string | null;
  lat: number | null;
  lon: number | null;
};

export type Cooperativa = {
  id: string;
  nome: string;
  logo_url: string | null;
  cor_primaria: string | null;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  produtor: Produtor | null;
  cooperativa: Cooperativa | null;
  papel: "admin" | "membro" | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [produtor, setProdutor] = useState<Produtor | null>(null);
  const [cooperativa, setCooperativa] = useState<Cooperativa | null>(null);
  const [papel, setPapel] = useState<"admin" | "membro" | null>(null);

  async function loadProfile(currentSession: Session | null) {
    if (!supabase || !currentSession) {
      setProdutor(null);
      setCooperativa(null);
      setPapel(null);
      return;
    }

    const userId = currentSession.user.id;

    // .limit(1) instead of .maybeSingle(): a user could in principle end up
    // with more than one row (e.g. duplicate signup attempts) — maybeSingle()
    // throws on 2+ rows instead of just taking the first one.
    const [{ data: produtorRows }, { data: membroRows }] = await Promise.all([
      supabase.from("produtores").select("*").eq("user_id", userId).limit(1),
      supabase
        .from("cooperativa_membros")
        .select("papel, cooperativas(id, nome, logo_url, cor_primaria)")
        .eq("user_id", userId)
        .limit(1),
    ]);

    const produtorRow = produtorRows?.[0];
    const membroRow = membroRows?.[0];

    setProdutor(produtorRow ?? null);
    if (membroRow) {
      setPapel(membroRow.papel as "admin" | "membro");
      const coop = membroRow.cooperativas as unknown as Cooperativa | Cooperativa[] | null;
      setCooperativa(Array.isArray(coop) ? (coop[0] ?? null) : coop);
    } else {
      setPapel(null);
      setCooperativa(null);
    }
  }

  async function refresh() {
    if (!supabase) return;
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    setSession(currentSession);
    await loadProfile(currentSession);
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!active) return;
      setSession(currentSession);
      await loadProfile(currentSession);
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      await loadProfile(newSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ loading, session, produtor, cooperativa, papel, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Redirects away pages that only make sense for a cooperativa member (not a produtor). */
export function useRequireCooperativa() {
  const { loading, cooperativa } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !cooperativa) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, cooperativa, navigate]);

  return cooperativa;
}

/** Redirects away pages that only make sense for a produtor (not a cooperativa member). */
export function useRequireProdutor() {
  const { loading, produtor } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !produtor) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, produtor, navigate]);

  return produtor;
}
