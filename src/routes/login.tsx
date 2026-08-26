import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Sprout, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { siteConfig } from "@/config/site";

const searchSchema = z.object({
  plano: z.enum(["bronze", "prata", "ouro"]).optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { plano } = Route.useSearch();
  const navigate = useNavigate();
  // Quem chega com um plano na URL veio da página de preços — já abre no
  // modo de criar conta, não faz sentido pedir pra ele achar o botão.
  const [mode, setMode] = useState<"entrar" | "criar">(plano ? "criar" : "entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setStatus("loading");
    setErrorMsg("");

    const { error } =
      mode === "entrar"
        ? await supabase.auth.signInWithPassword({ email, password: senha })
        : await supabase.auth.signUp({ email, password: senha });

    if (error) {
      setStatus("error");
      setErrorMsg(
        error.message.includes("Invalid login credentials")
          ? "E-mail ou senha incorretos."
          : error.message.includes("already registered")
            ? "Esse e-mail já tem uma conta. Tente entrar."
            : "Não foi possível continuar. Tente de novo.",
      );
      return;
    }

    // Veio de um plano específico e está criando conta agora: manda direto
    // pro onboarding já com o plano, em vez de deixar o guard do /dashboard
    // redirecionar sem esse contexto. Login normal (sem plano) continua
    // indo pro /dashboard, que redireciona sozinho pro onboarding se for
    // conta nova sem perfil ainda.
    if (plano && mode === "criar") {
      navigate({ to: "/onboarding", search: { plano } });
      return;
    }
    navigate({ to: "/dashboard" });
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <p className="text-muted-foreground">Área logada indisponível no momento.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sprout className="size-4" />
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            {siteConfig.name}
          </span>
        </Link>

        <h1 className="text-center text-xl font-semibold text-foreground">
          {mode === "entrar" ? "Entrar na sua conta" : "Criar sua conta"}
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              minLength={6}
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          {mode === "entrar" && (
            <Link
              to="/recuperar-senha"
              className="-mt-2 text-right text-sm text-muted-foreground hover:underline"
            >
              Esqueci minha senha
            </Link>
          )}

          {status === "error" && <p className="text-sm text-destructive">{errorMsg}</p>}

          <Button type="submit" size="lg" disabled={status === "loading"} className="mt-1">
            {status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "entrar" ? (
              "Entrar"
            ) : (
              "Criar conta"
            )}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "entrar" ? "criar" : "entrar");
            setStatus("idle");
          }}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:underline"
        >
          {mode === "entrar" ? "Não tem conta? Criar uma agora" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}
