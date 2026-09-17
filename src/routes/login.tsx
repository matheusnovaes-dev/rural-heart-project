import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Sprout, Loader2, Mail, Lock, Eye, EyeOff, BadgeCheck } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { siteConfig } from "@/config/site";

const destaques = [
  "Preço líquido da sua saca, com frete já descontado",
  "Clima, tendência de mercado e alertas direto no WhatsApp",
  "7 dias grátis pra testar, sem cartão de crédito",
];

const searchSchema = z.object({
  plano: z.enum(["bronze", "prata", "ouro"]).optional(),
  semTrial: z.literal("1").optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { plano, semTrial } = Route.useSearch();
  const navigate = useNavigate();
  // Quem chega com um plano na URL veio da página de preços — já abre no
  // modo de criar conta, não faz sentido pedir pra ele achar o botão.
  const [mode, setMode] = useState<"entrar" | "criar">(plano ? "criar" : "entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
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
      navigate({ to: "/onboarding", search: { plano, semTrial } });
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
    <div className="flex min-h-screen bg-secondary/40">
      {/* Painel de marca — some no mobile, só o formulário aparece ali */}
      <div className="relative hidden w-full max-w-xl flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <picture>
          <source srcSet="/images/hero-field.webp" type="image/webp" />
          <img
            src="/images/hero-field.jpg"
            alt="Lavoura ao entardecer"
            className="absolute inset-0 size-full object-cover"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.16_0.03_158/0.9)] via-[oklch(0.16_0.03_158/0.82)] to-[oklch(0.16_0.03_158/0.92)]" />

        <Link to="/" className="relative z-10 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur">
            <Sprout className="size-4.5" />
          </span>
          <span className="text-lg font-bold tracking-tight">{siteConfig.name}</span>
        </Link>

        <div className="relative z-10">
          <h2 className="text-balance font-display text-3xl font-bold leading-tight tracking-tight">
            Saiba o preço líquido da sua saca, direto no WhatsApp
          </h2>
          <ul className="mt-6 flex flex-col gap-3">
            {destaques.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/85">
                <BadgeCheck className="mt-0.5 size-4.5 shrink-0 text-white/70" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/50">Dados oficiais Conab e órgãos estaduais</p>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
          <Link to="/" className="mb-6 flex items-center justify-center gap-2 lg:hidden">
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
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {mode === "entrar"
              ? "Bom te ver de novo."
              : "7 dias grátis, sem cartão de crédito."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                  minLength={6}
                  required
                  className="px-9"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
                  aria-pressed={mostrarSenha}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
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
    </div>
  );
}
