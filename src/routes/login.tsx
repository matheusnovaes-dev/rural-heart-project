import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Sprout,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  BadgeCheck,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
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

// Ilustrativo — mesma cara do painel/ticker do dashboard (ContextoMercado),
// não é dado ao vivo aqui, só clima da marca na tela de login.
const ticker = [
  "SOJA MT R$142,50/sc",
  "MILHO PR R$68,20/sc",
  "BOI GORDO R$384,49/@",
  "CAFÉ ARÁBICA em alta na semana",
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

  const entrando = mode === "entrar";

  return (
    <div className="flex min-h-screen flex-col bg-secondary/40 lg:flex-row">
      {/* Painel de marca (desktop) */}
      <div className="relative hidden w-full max-w-xl flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <BrandBackdrop />

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
            {destaques.map((item, i) => (
              <li
                key={item}
                className="flex animate-in items-start gap-2.5 fade-in slide-in-from-bottom-2 text-sm text-white/85 fill-mode-both"
                style={{ animationDelay: `${150 + i * 130}ms`, animationDuration: "500ms" }}
              >
                <BadgeCheck className="mt-0.5 size-4.5 shrink-0 text-gold-soft" />
                {item}
              </li>
            ))}
          </ul>

          {/* Chips flutuantes de dado de exemplo */}
          <div className="relative mt-8 hidden h-0 xl:block">
            <div className="absolute -top-44 right-2 animate-float-chip rounded-xl bg-white/95 px-3.5 py-2 text-foreground shadow-lg shadow-black/30">
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                SOJA · MT
              </p>
              <p className="flex items-baseline gap-1.5">
                <span className="font-display text-lg font-bold">R$142,50</span>
                <span className="text-xs font-bold text-primary">+2,1%</span>
              </p>
            </div>
            <div
              className="absolute -top-20 right-16 flex animate-float-chip items-center gap-1.5 rounded-lg bg-secondary/95 px-3 py-1.5 shadow-lg shadow-black/25"
              style={{ animationDelay: "1.4s" }}
            >
              <TrendingUp className="size-3.5 text-gold" />
              <span className="text-xs font-semibold text-foreground">Boi em alta essa semana</span>
            </div>
          </div>
        </div>

        <Ticker />
      </div>

      {/* Faixa compacta (mobile) */}
      <div className="relative overflow-hidden p-5 text-white lg:hidden">
        <BrandBackdrop />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/15 backdrop-blur">
              <Sprout className="size-4" />
            </span>
            <span className="text-base font-bold tracking-tight">{siteConfig.name}</span>
          </div>
          <Link to="/" className="text-xs text-white/60">
            Voltar
          </Link>
        </div>
        <h1 className="relative z-10 mt-4 max-w-72 text-balance font-display text-xl font-bold leading-tight tracking-tight">
          Preço líquido da sua saca, direto no WhatsApp
        </h1>
        <div className="relative z-10 mt-3.5 inline-flex animate-float-chip items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 text-foreground shadow-lg shadow-black/30">
          <span className="text-[10px] font-semibold text-muted-foreground">SOJA MT</span>
          <span className="font-display text-sm font-bold">R$142,50</span>
          <span className="text-[10px] font-bold text-primary">+2,1%</span>
        </div>
        <div className="relative z-10 mt-3.5">
          <Ticker compact />
        </div>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-12">
        <div className="w-full max-w-sm animate-in rounded-2xl border border-border bg-card p-6 shadow-sm fade-in zoom-in-95 duration-300 sm:p-8">
          {/* Seletor de abas com indicador deslizante */}
          <div className="relative flex rounded-full bg-secondary p-1">
            <span
              className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out"
              style={{ transform: entrando ? "translateX(0%)" : "translateX(calc(100% + 8px))" }}
            />
            <button
              type="button"
              onClick={() => {
                setMode("entrar");
                setStatus("idle");
              }}
              className={`relative z-10 flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                entrando ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("criar");
                setStatus("idle");
              }}
              className={`relative z-10 flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                !entrando ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Criar conta
            </button>
          </div>

          <div className="mt-6 text-center">
            <h1 className="font-display text-xl font-semibold text-foreground">
              {entrando ? "Entrar na sua conta" : "Criar sua conta"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {entrando ? "Bom te ver de novo." : "7 dias grátis, sem cartão de crédito."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="group relative rounded-md transition-shadow focus-within:ring-4 focus-within:ring-ring/20">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
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
              <div className="group relative rounded-md transition-shadow focus-within:ring-4 focus-within:ring-ring/20">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete={entrando ? "current-password" : "new-password"}
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {entrando && (
              <Link
                to="/recuperar-senha"
                className="-mt-2 text-right text-sm text-muted-foreground hover:underline"
              >
                Esqueci minha senha
              </Link>
            )}

            {status === "error" && <p className="text-sm text-destructive">{errorMsg}</p>}

            <Button
              type="submit"
              size="lg"
              disabled={status === "loading"}
              className="group mt-1 bg-cta text-cta-foreground transition-all hover:-translate-y-0.5 hover:bg-cta/90 hover:shadow-lg hover:shadow-cta/30"
            >
              {status === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {entrando ? "Entrar" : "Criar conta"}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(entrando ? "criar" : "entrar");
              setStatus("idle");
            }}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:underline"
          >
            {entrando ? "Não tem conta? Criar uma agora" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fundo vivo do painel de marca: wash de gradiente girando bem devagar +
 * textura de pontinhos + duas linhas onduladas no canto (mesmo motivo
 * decorativo usado nos criativos de anúncio) + vinheta pra manter o texto
 * legível por cima. Puramente decorativo (aria-hidden). */
function BrandBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-0 bg-[oklch(0.20_0.028_156.5)]">
      <div
        className="absolute -inset-x-[40%] -inset-y-[60%] animate-slow-drift opacity-55"
        style={{
          background:
            "conic-gradient(from 0deg, oklch(0.331 0.049 156.2), oklch(0.20 0.03 156) 30%, oklch(0.62 0.13 75 / 0.35) 55%, oklch(0.20 0.03 156) 75%, oklch(0.331 0.049 156.2) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(oklch(1 0 0 / 0.16) 1.4px, transparent 1.4px)",
          backgroundSize: "18px 18px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 20% 15%, oklch(0.20 0.028 156.5 / 0.15), oklch(0.16 0.03 156.5 / 0.92) 78%)",
        }}
      />
      <svg
        className="absolute left-6 top-6 opacity-35"
        width="120"
        height="80"
        viewBox="0 0 130 90"
        fill="none"
      >
        <path
          d="M2 70 C 30 70, 30 40, 58 40 S 86 10, 114 10"
          stroke="oklch(0.93 0.045 80)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M2 84 C 26 84, 26 60, 50 60 S 74 36, 98 36"
          stroke="oklch(0.93 0.045 80)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity=".6"
        />
      </svg>
    </div>
  );
}

/** Ticker de mercado ilustrativo, mesma mecânica de loop contínuo do
 * ContextoMercado do dashboard (conteúdo duplicado 1x = -50% sempre bate
 * exato numa cópia). Pausa no hover/foco, respeita prefers-reduced-motion
 * via .animate-marquee. */
function Ticker({ compact = false }: { compact?: boolean }) {
  return (
    <div className="group relative z-10">
      <div
        className={`overflow-hidden ${compact ? "" : "border-t border-white/12 pt-3.5"}`}
      >
        <div className="flex w-max animate-marquee gap-6 group-hover:[animation-play-state:paused]">
          {[...ticker, ...ticker].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className={`whitespace-nowrap ${compact ? "text-[11px]" : "text-xs"} ${
                i % 2 === 0 ? "text-white/65" : "text-gold-soft/85"
              }`}
            >
              {i % ticker.length !== 0 ? "· " : ""}
              {item}
            </span>
          ))}
        </div>
      </div>
      {!compact && (
        <div className="mt-3.5 flex items-center gap-1.5">
          <BadgeCheck className="size-3.5 text-white/50" />
          <span className="text-[11px] text-white/50">Dados oficiais Conab e órgãos estaduais</span>
        </div>
      )}
    </div>
  );
}
