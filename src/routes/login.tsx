import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  BadgeCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { buildWhatsAppLink, siteConfig } from "@/config/site";

const destaques = [
  "Preço da sua saca comparado com o porto, com o frete",
  "Clima, tendência de mercado e alertas direto no WhatsApp",
  "7 dias grátis pra testar, sem cartão de crédito",
];

// Cartões da cena do painel de marca (valores de exemplo; a tela avisa isso).
const cartoes = [
  {
    rotulo: "SOJA · MT",
    valor: 142.5,
    unidade: "/sc",
    delta: 2.1,
    linha: "M0 20 C10 18 14 12 24 14 S40 6 50 8 S68 2 80 3",
    recuo: "ml-0",
  },
  {
    rotulo: "MILHO · PR",
    valor: 68.2,
    unidade: "/sc",
    delta: -0.4,
    linha: "M0 8 C12 10 18 6 28 11 S44 14 54 12 S70 16 80 15",
    recuo: "ml-10",
  },
  {
    rotulo: "BOI GORDO",
    valor: 384.49,
    unidade: "/@",
    delta: 1.3,
    linha: "M0 22 C12 20 18 18 28 15 S46 12 56 8 S70 6 80 4",
    recuo: "ml-4",
  },
];

const tituloDoPainel = "Saiba o preço da sua saca e quanto o porto paga, direto no WhatsApp";

// Ilustrativo — mesma cara do painel/ticker do dashboard (ContextoMercado),
// não é dado ao vivo aqui, só clima da marca na tela de login.
const ticker = [
  "SOJA MT R$142,50/sc",
  "MILHO PR R$68,20/sc",
  "BOI GORDO R$384,49/@",
  "CAFÉ ARÁBICA em alta na semana",
];

import { paramEnum, paramLiteral } from "@/lib/searchParams";

const searchSchema = z.object({
  plano: paramEnum(["bronze", "prata", "ouro"]),
  semTrial: paramLiteral("1"),
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
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
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

    // Transição com checkmark em vez de navegar na hora — dá tempo da
    // animação de sucesso ser percebida antes da troca de tela (achado de
    // pesquisa: 300-500ms é a janela certa pra transição de página, menos
    // que isso passa batido, mais vira demora).
    setStatus("success");
    setTimeout(() => {
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
    }, 850);
  }

  // clipPath/pathLength (checkmark de sucesso) e o background da luz não são
  // "positional keys" do framer-motion, então o <MotionConfig
  // reducedMotion="user"> do root (achado da auditoria 2026-10-09) não os
  // desativa sozinho — checagem manual aqui, igual no Hero da landing.
  const prefereMenosMovimento = useReducedMotion();

  // Luz que segue o cursor no painel de marca — mesma técnica do Hero da
  // landing (useMotionValue/useMotionTemplate, sem re-render por frame).
  // Só desktop: é onde o painel de marca aparece.
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(30);
  const luz = useMotionTemplate`radial-gradient(500px circle at ${mouseX}% ${mouseY}%, color-mix(in oklab, var(--gold) 45%, transparent), transparent 70%)`;
  function seguirCursor(e: MouseEvent<HTMLDivElement>) {
    if (prefereMenosMovimento) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(((e.clientX - rect.left) / rect.width) * 100);
    mouseY.set(((e.clientY - rect.top) / rect.height) * 100);
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
    <div className="flex h-dvh flex-col overflow-hidden bg-secondary/40 lg:h-screen lg:flex-row lg:overflow-visible">
      {/* Painel de marca (desktop) */}
      <div
        className="relative hidden w-full max-w-xl flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        onMouseMove={seguirCursor}
      >
        <BrandBackdrop />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 mix-blend-soft-light motion-reduce:hidden"
          style={{ background: luz }}
        />

        <Link to="/" className="relative z-10 flex items-center gap-2">
          <img src="/logo-icon.webp" alt="" className="size-9 rounded-[0.65rem]" />
          <span className="text-lg font-bold tracking-tight">{siteConfig.name}</span>
        </Link>

        <div className="relative z-10 flex flex-1 flex-col justify-center gap-9 py-8">
          <CartoesDeMercado />
          <div>
            <h2 className="text-balance font-display text-3xl font-bold leading-tight tracking-tight">
              {tituloDoPainel.split(" ").map((palavra, i) => (
                <span key={`${palavra}-${i}`}>
                  <span
                    className="login-rise inline-block"
                    style={{ "--d": `${200 + i * 45}ms` } as React.CSSProperties}
                  >
                    {palavra}
                  </span>{" "}
                </span>
              ))}
            </h2>
            <ul className="mt-6 flex flex-col gap-3">
              {destaques.map((item, i) => (
                <li
                  key={item}
                  className="login-rise flex items-start gap-2.5 text-sm text-white/85"
                  style={{ "--d": `${900 + i * 140}ms` } as React.CSSProperties}
                >
                  <BadgeCheck className="mt-0.5 size-4.5 shrink-0 text-gold-soft" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Ticker />
      </div>

      {/* Faixa compacta (mobile) — pedido do Matheus 2026-10-12: a tela de
          login tem que caber inteira num quadrante só, sem rolar. Cortado o
          título grande, o chip flutuante e deixado só a marca + ticker
          pequeno, pra sobrar espaço pro que importa aqui (o formulário). */}
      <div className="sticky top-0 z-20 min-w-0 shrink-0 overflow-hidden px-5 py-3 text-white lg:hidden">
        <BrandBackdrop animado={false} />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.webp" alt="" className="size-7 rounded-[0.55rem]" />
            <span className="text-sm font-bold tracking-tight">{siteConfig.name}</span>
          </div>
          <Link to="/" className="alvo-toque min-w-11 justify-end text-sm text-white/70">
            Voltar
          </Link>
        </div>
        <div className="relative z-10 mt-2">
          <Ticker compact />
        </div>
      </div>

      {/* Formulário */}
      <div className="relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-4 py-3 lg:items-center lg:justify-center lg:overflow-hidden lg:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
        >
          <div
            className="login-drift-b absolute -top-24 -right-24 size-[34rem] rounded-full"
            style={{
              background: "radial-gradient(closest-side, oklch(0.66 0.13 76 / 0.16), transparent)",
            }}
          />
          <div
            className="login-drift-c absolute -bottom-32 -left-20 size-[36rem] rounded-full"
            style={{
              background: "radial-gradient(closest-side, oklch(0.5 0.1 156 / 0.14), transparent)",
            }}
          />
        </div>
        <div
          className="login-rise relative mx-auto w-full max-w-sm"
          style={{ "--d": "80ms" } as React.CSSProperties}
        >
          {/* Anel dourado que dá a volta no cartão (só desktop): um único
              elemento girando, sem filtro nem repintura de layout. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-px hidden overflow-hidden rounded-2xl lg:block"
          >
            <div className="absolute inset-0 grid place-items-center">
              <div
                className="login-spin aspect-square w-[170%] shrink-0"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0 60%, oklch(0.66 0.13 76 / 0.95) 80%, transparent 95%)",
                }}
              />
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm lg:border-transparent lg:p-8 lg:shadow-xl lg:shadow-black/5">
            {status === "success" && (
              <SucessoCheckmark semAnimacao={prefereMenosMovimento ?? false} />
            )}
            {/* Seletor de abas com indicador deslizante (spring, não CSS ease
              — fica mais "vivo", com leve overshoot ao trocar de aba) */}
            <div className="relative flex rounded-full bg-secondary p-1">
              <motion.span
                className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-primary shadow-sm"
                animate={{ x: entrando ? 0 : "calc(100% + 8px)" }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              />
              <button
                type="button"
                onClick={() => {
                  setMode("entrar");
                  setStatus("idle");
                }}
                className={`relative z-10 flex-1 rounded-full py-2 text-sm font-semibold transition-colors pointer-coarse:min-h-11 ${
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
                className={`relative z-10 flex-1 rounded-full py-2 text-sm font-semibold transition-colors pointer-coarse:min-h-11 ${
                  !entrando ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Criar conta
              </button>
            </div>

            <div className="mt-3 text-center lg:mt-6">
              <h1 className="font-display text-xl font-semibold text-foreground">
                {entrando ? "Entrar na sua conta" : "Criar sua conta"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {entrando ? "Bom te ver de novo." : "7 dias grátis, sem cartão de crédito."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2.5 lg:mt-6 lg:gap-4">
              <div
                className="animate-in space-y-2 fade-in slide-in-from-bottom-3 fill-mode-both"
                style={{ animationDelay: "80ms", animationDuration: "400ms" }}
              >
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
              <div
                className="animate-in space-y-2 fade-in slide-in-from-bottom-3 fill-mode-both"
                style={{ animationDelay: "160ms", animationDuration: "400ms" }}
              >
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
                    className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground pointer-coarse:size-11"
                  >
                    {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {entrando && (
                <Link
                  to="/recuperar-senha"
                  className="alvo-toque -mt-2 justify-end text-right text-sm text-muted-foreground hover:underline"
                >
                  Esqueci minha senha
                </Link>
              )}

              {status === "error" && <p className="text-sm text-destructive">{errorMsg}</p>}

              <div
                className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both"
                style={{ animationDelay: "240ms", animationDuration: "400ms" }}
              >
                <Button
                  type="submit"
                  size="lg"
                  disabled={status === "loading"}
                  className="group relative mt-1 w-full overflow-hidden bg-cta text-cta-foreground transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-cta/90 hover:shadow-lg hover:shadow-cta/30 active:translate-y-0 active:scale-[0.97]"
                >
                  <span
                    aria-hidden="true"
                    className="login-btn-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                  />
                  {status === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {entrando ? "Entrar" : "Criar conta"}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(entrando ? "criar" : "entrar");
                setStatus("idle");
              }}
              className="mt-2.5 w-full text-center text-sm text-muted-foreground hover:underline pointer-coarse:min-h-11 lg:mt-4"
            >
              {entrando ? "Não tem conta? Criar uma agora" : "Já tem conta? Entrar"}
            </button>

            {entrando && (
              <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 text-center lg:mt-6 lg:gap-2 lg:pt-5">
                <p className="text-xs text-muted-foreground">
                  Se cadastrou pelo WhatsApp ou pelo formulário e não criou e-mail e senha?
                </p>
                <a
                  href={buildWhatsAppLink("Quero acessar meu painel")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary pointer-coarse:min-h-11 lg:py-2"
                >
                  <MessageCircle className="size-4 text-[#25D366]" />
                  Pedir meu acesso pelo WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Transição de sucesso, tela cheia: a versão anterior (checkmark discreto
 * sobre o card branco) ficou sutil demais ("parece que não mudou nada" —
 * feedback real do Matheus). Agora é um circle-reveal verde que toma o card
 * inteiro (clip-path 0% → 150%, mesma técnica de "container transform" dos
 * apps premium), checkmark bem maior desenhado em branco, e um estouro de
 * partículas douradas saindo do centro — sensação de celebração, não só
 * "carregando". */
function SucessoCheckmark({ semAnimacao }: { semAnimacao: boolean }) {
  // clipPath e pathLength não são "positional keys" do framer-motion, então
  // reducedMotion="user" (root) não os desativa sozinho (achado da auditoria
  // 2026-10-09) — com duration 0, o resultado final aparece na hora (círculo
  // já tomado, checkmark já desenhado), sem o efeito de revelação. O estouro
  // de partículas é só decorativo, sem estado final que importe, então nem
  // renderiza.
  const t = (duracao: number, delay = 0) =>
    semAnimacao ? { duration: 0 } : { duration: duracao, delay };
  return (
    <motion.div
      initial={{ clipPath: "circle(0% at 50% 50%)" }}
      animate={{ clipPath: "circle(150% at 50% 50%)" }}
      transition={semAnimacao ? { duration: 0 } : { duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-primary text-primary-foreground"
    >
      <div className="relative flex items-center justify-center">
        {!semAnimacao && <ParticulasSucesso />}
        <motion.svg
          width="96"
          height="96"
          viewBox="0 0 64 64"
          fill="none"
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={
            semAnimacao
              ? { duration: 0 }
              : { delay: 0.2, duration: 0.4, type: "spring", stiffness: 260, damping: 18 }
          }
        >
          <motion.circle
            cx="32"
            cy="32"
            r="28"
            stroke="var(--primary-foreground)"
            strokeWidth="4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={t(0.45, 0.2)}
          />
          <motion.path
            d="M19 33 L28 42 L46 23"
            stroke="var(--primary-foreground)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={t(0.35, 0.55)}
          />
        </motion.svg>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={t(0.35, 0.7)}
        className="text-center"
      >
        <p className="font-display text-xl font-semibold">Tudo certo!</p>
        <p className="text-sm text-primary-foreground/75">Preparando seu painel...</p>
      </motion.div>
    </motion.div>
  );
}

/** Estouro de partículas douradas saindo do centro do checkmark — 10 pontos
 * em círculo completo, cada um com uma distância levemente diferente (i % 3)
 * pra não ficar um anel perfeito demais, o que lia como "gerado por
 * computador" em vez de orgânico. */
function ParticulasSucesso() {
  const particulas = Array.from({ length: 10 });
  return (
    <>
      {particulas.map((_, i) => {
        const angulo = (i / particulas.length) * 2 * Math.PI;
        const distancia = 70 + (i % 3) * 22;
        return (
          <motion.span
            key={i}
            className="absolute size-2 rounded-full bg-gold"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angulo) * distancia,
              y: Math.sin(angulo) * distancia,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ duration: 0.75, delay: 0.25, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

/** Fundo do painel de marca. Três luzes à deriva (gradiente radial, sem blur:
 * o `blur-3xl` animado era caro de GPU), pontinhos, um gráfico de mercado que
 * rola sem parar e um brilho que cruza o painel de tempos em tempos. Tudo é
 * transform/opacity via CSS (compositor, zero JS por quadro). `animado=false`
 * (faixa do celular) deixa as luzes paradas: dão cor sem custo de movimento.
 * Puramente decorativo (aria-hidden). */
function BrandBackdrop({ animado = true }: { animado?: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-0 overflow-hidden bg-[oklch(0.17_0.028_156.5)]">
      <div
        className={`absolute top-[-20%] left-[-25%] size-[40rem] rounded-full ${animado ? "login-drift-a" : ""}`}
        style={{
          background: "radial-gradient(closest-side, oklch(0.5 0.1 156 / 0.55), transparent)",
        }}
      />
      <div
        className={`absolute right-[-25%] bottom-[-15%] size-[36rem] rounded-full ${animado ? "login-drift-b" : ""}`}
        style={{
          background: "radial-gradient(closest-side, oklch(0.66 0.13 76 / 0.42), transparent)",
        }}
      />
      <div
        className={`absolute top-[30%] left-[30%] size-[30rem] rounded-full ${animado ? "login-drift-c" : ""}`}
        style={{
          background: "radial-gradient(closest-side, oklch(0.45 0.09 190 / 0.32), transparent)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(oklch(1 0 0 / 0.14) 1.4px, transparent 1.4px)",
          backgroundSize: "18px 18px",
        }}
      />
      {animado && <GraficoAoVivo />}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 20% 15%, oklch(0.20 0.028 156.5 / 0.1), oklch(0.16 0.03 156.5 / 0.9) 80%)",
        }}
      />
      {animado && (
        <div className="login-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
      )}
    </div>
  );
}

/** Linha de mercado larga, repetida duas vezes, rolando para a esquerda em
 * loop perfeito (o fim de uma cópia encaixa no começo da outra). Fica baixa,
 * bem fraca, atrás do texto: dá a sensação de "mercado ao vivo". */
function GraficoAoVivo() {
  return (
    <div className="absolute inset-x-0 bottom-20 h-44 overflow-hidden opacity-[0.16]">
      <svg
        className="login-chart h-full w-[200%]"
        viewBox="0 0 1200 160"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <path
            id="login-linha"
            d="M0 110 C50 110 70 70 130 82 S210 130 270 92 S380 22 440 52 S540 112 600 110"
          />
        </defs>
        {[0, 600].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <use
              href="#login-linha"
              stroke="oklch(0.93 0.045 80)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M0 110 C50 110 70 70 130 82 S210 130 270 92 S380 22 440 52 S540 112 600 110 L600 160 L0 160 Z"
              fill="oklch(0.93 0.045 80)"
              fillOpacity="0.35"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Número que sobe até o valor (uma vez, ~1,2s) só quando há movimento e tela
 * grande; no celular e com movimento reduzido já nasce no valor final. */
function Contagem({ valor, atraso = 0 }: { valor: number; atraso?: number }) {
  const [n, setN] = useState(valor);
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(min-width: 1024px)").matches
    ) {
      return;
    }
    let raf = 0;
    let inicio = 0;
    setN(0);
    const t = setTimeout(() => {
      const passo = (agora: number) => {
        inicio ||= agora;
        const k = Math.min(1, (agora - inicio) / 1200);
        setN(valor * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    }, atraso);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [valor, atraso]);
  return <>{n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

/** Cartões de preço de exemplo (desktop, telas altas). Ficam no fluxo da
 * página, acima do título, então nunca cobrem texto. Cada um entra em
 * sequência, desenha a própria linha e depois flutua devagar. */
function CartoesDeMercado() {
  return (
    <div
      className="hidden flex-col gap-3 [@media(min-height:780px)]:flex"
      role="img"
      aria-label="Exemplo de cartões de preço: soja, milho e boi gordo"
    >
      {cartoes.map((c, i) => {
        const sobe = c.delta >= 0;
        const Seta = sobe ? TrendingUp : TrendingDown;
        return (
          <div
            key={c.rotulo}
            className={`login-rise w-fit ${c.recuo}`}
            style={{ "--d": `${450 + i * 170}ms` } as React.CSSProperties}
          >
            <div
              className="animate-float-chip flex items-center gap-5 rounded-2xl border border-white/15 bg-white/[0.09] px-4 py-3 shadow-xl shadow-black/25"
              style={{ animationDelay: `${i * 1.3}s` }}
            >
              <div>
                <p className="text-xs font-semibold text-white/65">{c.rotulo}</p>
                <p className="mt-0.5 flex items-baseline gap-1 font-display text-2xl font-bold tabular-nums">
                  <span className="text-sm font-semibold text-white/70">R$</span>
                  <Contagem valor={c.valor} atraso={650 + i * 170} />
                  <span className="text-xs font-medium text-white/55">{c.unidade}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <svg width="80" height="26" viewBox="0 0 80 26" fill="none" aria-hidden="true">
                  <path
                    d={c.linha}
                    pathLength={100}
                    className="login-draw"
                    style={{ "--d": `${800 + i * 170}ms` } as React.CSSProperties}
                    stroke={sobe ? "oklch(0.86 0.12 150)" : "oklch(0.78 0.12 25)"}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold ${
                    sobe ? "text-[oklch(0.86_0.12_150)]" : "text-[oklch(0.8_0.12_25)]"
                  }`}
                >
                  <Seta className="size-3.5" aria-hidden="true" />
                  {sobe ? "+" : "−"}
                  {Math.abs(c.delta).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <p className="ml-1 flex items-center gap-1.5 text-xs text-white/50">
        <span className="login-blink size-1.5 rounded-full bg-[oklch(0.86_0.12_150)]" />
        Valores de exemplo
      </p>
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
      <div className={`overflow-hidden ${compact ? "" : "border-t border-white/12 pt-3.5"}`}>
        <div className="flex w-max animate-marquee gap-6 group-hover:[animation-play-state:paused]">
          {[...ticker, ...ticker].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className={`whitespace-nowrap ${compact ? "text-xs" : "text-xs"} ${
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
          <span className="text-xs text-white/60">
            Valores de exemplo · dados oficiais Conab e órgãos estaduais
          </span>
        </div>
      )}
    </div>
  );
}
