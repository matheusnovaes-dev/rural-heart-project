import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { carregarSupabase } from "@/lib/supabaseLazy";

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
  foto_url?: string | null;
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

  async function loadProfile(supabase: SupabaseClient | null, currentSession: Session | null) {
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
    const supabase = await carregarSupabase();
    if (!supabase) return;
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    setSession(currentSession);
    await loadProfile(supabase, currentSession);
  }

  // Na landing ("/") ninguém precisa da sessão para ver a página: o cliente do Supabase (52KB) é carregado com o
  // navegador ocioso, depois do primeiro desenho. Em qualquer outra rota (login, painel, acesso) começa já.
  // Se a pessoa sai da landing antes do ocioso, a mudança de rota dispara a inicialização na hora.
  const naLanding = useLocation({ select: (l) => l.pathname === "/" });
  useEffect(() => {
    let active = true;
    let cancelarEspera: (() => void) | undefined;
    let desinscrever: (() => void) | undefined;

    const iniciar = async () => {
      const supabase = await carregarSupabase();
      if (!active) return;
      if (!supabase) {
        setLoading(false);
        return;
      }
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!active) return;
      setSession(currentSession);
      await loadProfile(supabase, currentSession);
      if (!active) return;
      setLoading(false);
      const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        setSession(newSession);
        await loadProfile(supabase, newSession);
      });
      desinscrever = () => subscription.subscription.unsubscribe();
    };

    if (naLanding) {
      // espera a página terminar de carregar e mais 3s, para o cliente do Supabase não disputar banda com o LCP
      let timer: number | undefined;
      const agendar = () => {
        timer = window.setTimeout(() => void iniciar(), 3000);
      };
      if (document.readyState === "complete") agendar();
      else window.addEventListener("load", agendar, { once: true });
      cancelarEspera = () => {
        window.removeEventListener("load", agendar);
        if (timer !== undefined) window.clearTimeout(timer);
      };
    } else {
      void iniciar();
    }

    return () => {
      active = false;
      cancelarEspera?.();
      desinscrever?.();
    };
  }, [naLanding]);

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

// Não é um papel de admin real ainda (sem tabela/coluna própria) — só o
// dono da conta. A RLS de `leads` já trava leitura/escrita nesse mesmo
// e-mail (ver supabase/leads-restringir-cooperativa.sql), então checar
// aqui é só pra não deixar a página renderizar vazia/quebrada pra mais
// ninguém, nunca a fonte de verdade da permissão.
export const EMAIL_SAFRALUME_ADMIN = "sirmatheus143@gmail.com";

/** Redireciona pra fora de páginas internas do Safralume (ex: Leads) — não
 * depende de cooperativa/produtor, só do e-mail da conta logada. */
export function useRequireSafralumeAdmin() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  const ehAdmin = session?.user.email === EMAIL_SAFRALUME_ADMIN;

  useEffect(() => {
    if (!loading && !ehAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, ehAdmin, navigate]);

  return ehAdmin;
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
