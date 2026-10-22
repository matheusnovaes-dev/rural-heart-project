import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, LogOut, Search } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { DashboardTour } from "@/components/dashboard/DashboardTour";
import { EMAIL_SAFRALUME_ADMIN, useAuth } from "@/lib/auth";
import { useAcessoDashboard } from "@/lib/planos";
import { useSair } from "@/components/dashboard/useSair";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PainelEsqueleto } from "@/components/dashboard/PainelEsqueleto";
import { MIDIA } from "@/assets/midia";
import { supabase } from "@/lib/supabase";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";

export const Route = createFileRoute("/dashboard/_layout")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      // O painel é claro (fundo .dashboard-shell), diferente do header
      // escuro da landing/login — sobrescreve o theme-color do root pra
      // não destoar da própria cor que o painel renderiza no topo.
      { name: "theme-color", content: "#f3f3ec" },
    ],
  }),
  component: DashboardGuard,
});

type NavItem = {
  to: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
};

const produtorNavItemsBase: NavItem[] = [
  { to: "/dashboard", label: "Início", icon: IconesSafralume["inicio"] },
  { to: "/dashboard/precos", label: "Preços", icon: IconesSafralume["preco"] },
  { to: "/dashboard/fazenda", label: "Fazenda", icon: IconesSafralume["safra"] },
  {
    to: "/dashboard/calculadora",
    label: "Calculadora",
    icon: IconesSafralume["calculadora-safra"],
  },
  { to: "/dashboard/alertas", label: "Alertas", icon: IconesSafralume["alerta"] },
  { to: "/dashboard/leiloes", label: "Leilões", icon: IconesSafralume["leilao"] },
  { to: "/dashboard/lembretes", label: "Lembretes", icon: IconesSafralume["lembrete"] },
  { to: "/dashboard/funcionarios", label: "Funcionários", icon: IconesSafralume["equipe"] },
  { to: "/dashboard/clima", label: "Clima", icon: IconesSafralume["clima-sol"] },
  { to: "/dashboard/suporte", label: "Suporte", icon: IconesSafralume["suporte"] },
];

// Seção "Conta" (separada da navegação principal, no fim da barra): perfil e assinatura do produtor.
const perfilNavItem: NavItem = {
  to: "/dashboard/perfil",
  label: "Meu perfil",
  icon: IconesSafralume["perfil"],
};

const assinaturaNavItem: NavItem = {
  to: "/dashboard/assinatura",
  label: "Assinatura",
  icon: IconesSafralume["assinatura"],
};

const leadsNavItem: NavItem = {
  to: "/dashboard/leads",
  label: "Leads",
  icon: IconesSafralume["leads"],
};

const cooperativaNavItemsBase: NavItem[] = [
  { to: "/dashboard", label: "Visão geral", icon: IconesSafralume["inicio"] },
  { to: "/dashboard/precos", label: "Preços", icon: IconesSafralume["preco"] },
  {
    to: "/dashboard/calculadora",
    label: "Calculadora",
    icon: IconesSafralume["calculadora-safra"],
  },
  { to: "/dashboard/alertas", label: "Alertas", icon: IconesSafralume["alerta"] },
  { to: "/dashboard/leiloes", label: "Leilões", icon: IconesSafralume["leilao"] },
  { to: "/dashboard/produtores", label: "Produtores", icon: IconesSafralume["produtor"] },
  { to: "/dashboard/lembretes", label: "Lembretes", icon: IconesSafralume["lembrete"] },
  { to: "/dashboard/clima", label: "Clima", icon: IconesSafralume["clima-sol"] },
  { to: "/dashboard/suporte", label: "Suporte", icon: IconesSafralume["suporte"] },
];

const cooperativaAdminNavItems: NavItem[] = [
  { to: "/dashboard/equipe", label: "Equipe", icon: IconesSafralume["equipe"] },
  { to: "/dashboard/marca", label: "Marca própria", icon: IconesSafralume["marca"] },
  { to: "/dashboard/relatorios", label: "Relatórios", icon: IconesSafralume["relatorio"] },
  { to: "/dashboard/assinatura", label: "Assinatura", icon: IconesSafralume["assinatura"] },
];

function DashboardGuard() {
  const { loading, session, produtor, cooperativa, papel } = useAuth();
  const { liberado, carregando: carregandoAcesso } = useAcessoDashboard();
  const navigate = useNavigate();
  // A Asaas manda de volta pra cá logo depois do checkout — o webhook que
  // confirma o pagamento (e libera de verdade) pode levar alguns segundos
  // pra chegar, então esse retorno não pode ser barrado na hora, senão
  // parece um erro pra quem acabou de pagar.
  const voltandoDoCheckout =
    (useRouterState({ select: (s) => s.location.search }) as { checkout?: string }).checkout ===
    "success";

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (!produtor && !cooperativa) {
      navigate({ to: "/onboarding" });
      return;
    }
    if (!carregandoAcesso && !liberado && !voltandoDoCheckout) {
      navigate({ to: "/assinar" });
    }
  }, [
    loading,
    session,
    produtor,
    cooperativa,
    carregandoAcesso,
    liberado,
    voltandoDoCheckout,
    navigate,
  ]);

  // Enquanto confere login e acesso, mostra a casca do painel (a maioria entra logada); só quem vai ser
  // redirecionado (sem sessão, sem cadastro ou sem acesso) vê a tela de carregamento comum.
  if (loading || carregandoAcesso) return <PainelEsqueleto />;

  if (
    loading ||
    !session ||
    (!produtor && !cooperativa) ||
    carregandoAcesso ||
    (!liberado && !voltandoDoCheckout)
  ) {
    return <LoadingScreen />;
  }

  // Produtor e cooperativa usavam dois chassis de navegação diferentes: a
  // cooperativa já tinha sidebar de verdade, o produtor (o tipo de conta mais
  // comum do produto) ficava com uma barra de abas horizontal pequena — a
  // experiência "mais básica" ia pro usuário mais comum. Unificado num só
  // <AppSidebar>, só trocando os itens e o cabeçalho.
  const emailDoUsuario = session.user.email;
  const items: NavItem[] = cooperativa
    ? [
        ...cooperativaNavItemsBase,
        ...(emailDoUsuario === EMAIL_SAFRALUME_ADMIN ? [leadsNavItem] : []),
        ...(papel === "admin" ? cooperativaAdminNavItems : []),
      ]
    : [
        ...produtorNavItemsBase,
        ...(emailDoUsuario === EMAIL_SAFRALUME_ADMIN ? [leadsNavItem] : []),
      ];
  const itemsConta: NavItem[] = cooperativa
    ? []
    : [perfilNavItem, ...(!produtor!.cooperativa_id ? [assinaturaNavItem] : [])];
  const headerTitle = cooperativa ? cooperativa.nome : produtor!.nome;
  const headerSubtitle = cooperativa ? "Painel executivo" : "Produtor rural";

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider className="dashboard-shell">
        <a
          href="#conteudo"
          className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <AppSidebar
          headerTitle={headerTitle}
          headerSubtitle={headerSubtitle}
          avatarUrl={cooperativa ? null : (produtor?.foto_url ?? null)}
          produtorId={cooperativa ? undefined : produtor?.id}
          items={items}
          itemsConta={itemsConta}
        />
        <SidebarInset>
          <header className="cabecalho-painel sticky top-0 z-20 flex h-16 items-center gap-3 px-4 sm:px-6">
            {/* No celular o produtor entra com a sidebar fechada e o ícone sozinho (PanelLeft) não é óbvio para quem não
                é familiarizado com esse padrão de app: vira um botão com rótulo "Menu" até o breakpoint sm, onde a
                sidebar já fica aberta por padrão. */}
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 shadow-sm sm:border-none sm:bg-transparent sm:p-0 sm:shadow-none">
              <SidebarTrigger />
              <span className="text-xs font-medium text-muted-foreground sm:hidden">Menu</span>
            </div>
            <DataAgora />
            <AtalhoBusca />
          </header>
          <div
            id="conteudo"
            tabIndex={-1}
            className="fundo-painel flex-1 p-4 outline-none sm:p-6 lg:p-8"
          >
            <AnimatedOutlet />
          </div>
        </SidebarInset>
        <CommandPalette />
        <DashboardTour />
      </SidebarProvider>
    </TooltipProvider>
  );
}

/** Troca de página dentro do painel ganha uma transição suave em vez de
 * trocar de conteúdo seco — mesma linguagem de motion da landing (Reveal),
 * só mais rápida (180ms) porque aqui é navegação de trabalho, não
 * apresentação: rápido o bastante pra nunca parecer travando o clique. */
function AnimatedOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Só entrada (sem saída em "wait"): antes o conteúdo antigo sumia e o novo entrava de opacidade 0, e no celular a tela
  // toda piscava a cada troca de página. Agora o novo conteúdo já nasce quase opaco e só desliza de leve.
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0.86, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <Outlet />
    </motion.div>
  );
}

/** Botão de busca: abre a paleta de comandos (a mesma do ⌘K / Ctrl K). */
function AtalhoBusca() {
  function abrir() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
  }
  return (
    <button
      type="button"
      onClick={abrir}
      aria-label="Buscar no painel"
      className="group ml-auto flex h-10 items-center gap-2.5 rounded-xl border border-border/80 bg-card/80 px-3 text-sm text-muted-foreground shadow-sm outline-none backdrop-blur transition hover:border-primary/30 hover:text-foreground hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring sm:w-60"
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="hidden flex-1 text-left sm:block">Buscar no painel</span>
      <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.68rem] text-muted-foreground sm:block">
        ⌘K
      </kbd>
    </button>
  );
}

/** Data de hoje no cabeçalho (só desktop): um ponto de referência discreto, sempre verdadeiro. */
function DataAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const dia = agora.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <span className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground lg:inline-flex">
      <CalendarDays className="size-3.5" aria-hidden="true" />
      <span>{dia.replace(".", "").replace(/^./, (c) => c.toUpperCase())}</span>
      <span className="h-3 w-px bg-border" aria-hidden="true" />
      <span className="font-mono tabular-nums">{hora}</span>
    </span>
  );
}

/** Luz suave que segue o cursor pelo fundo do painel. Só desktop com mouse e movimento permitido. */
function LuzDoCursor() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ok =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ok) return;
    let quadro = 0;
    let x = 0;
    let y = 0;
    const mover = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        el.style.setProperty("--cx", `${x}px`);
        el.style.setProperty("--cy", `${y}px`);
        el.dataset["ativa"] = "true";
      });
    };
    const sair = () => {
      el.dataset["ativa"] = "false";
    };
    window.addEventListener("pointermove", mover, { passive: true });
    document.addEventListener("pointerleave", sair);
    return () => {
      window.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerleave", sair);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);
  return <div ref={ref} className="luz-cursor" aria-hidden="true" data-ativa="false" />;
}

/** Selo do plano no menu lateral (só quem tem assinatura própria). */
function PlanoChip({ produtorId }: { produtorId: string | undefined }) {
  const [plano, setPlano] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase || !produtorId) return;
    let vivo = true;
    supabase
      .from("assinaturas")
      .select("plano")
      .eq("produtor_id", produtorId)
      .maybeSingle()
      .then(({ data }) => vivo && setPlano((data?.plano as string | undefined) ?? null));
    return () => {
      vivo = false;
    };
  }, [produtorId]);
  if (!plano) return null;
  return (
    <Link
      to="/dashboard/assinatura"
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-sidebar-primary/15 px-2 py-0.5 text-[0.68rem] font-bold tracking-wide text-sidebar-primary uppercase ring-1 ring-sidebar-primary/30 outline-none transition hover:bg-sidebar-primary/25 focus-visible:ring-2"
    >
      <span className="size-1.5 rounded-full bg-sidebar-primary" aria-hidden="true" />
      Plano {plano.charAt(0).toUpperCase() + plano.slice(1)}
    </Link>
  );
}

function AppSidebar({
  headerTitle,
  headerSubtitle,
  avatarUrl,
  produtorId,
  items,
  itemsConta,
}: {
  headerTitle: string;
  headerSubtitle: string;
  avatarUrl: string | null;
  produtorId?: string | undefined;
  items: NavItem[];
  itemsConta: NavItem[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();

  // No celular a sidebar é um Sheet por cima da tela inteira: sem isso, ela
  // ficava aberta depois de escolher a página — o produtor tinha que fechar
  // na mão (tocando fora) antes de ver o conteúdo que acabou de abrir.
  function aoSelecionar() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 px-1">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={36}
              height={36}
              className="size-10 shrink-0 rounded-full object-cover ring-2 ring-white/15"
            />
          ) : (
            <img
              src={MIDIA.logo}
              alt=""
              className="size-10 rounded-xl shadow-lg ring-1 ring-white/10"
            />
          )}
          <div className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold text-sidebar-foreground">
              {headerTitle}
            </span>
            <span className="block text-xs font-medium text-sidebar-foreground/65">
              {headerSubtitle}
            </span>
            <PlanoChip produtorId={produtorId} />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 py-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  {pathname === item.to && <IndicadorDoMenu />}
                  <SidebarMenuButton asChild isActive={pathname === item.to}>
                    <Link to={item.to} data-tour={item.to} onClick={aoSelecionar}>
                      <item.icon className="size-6 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {itemsConta.length > 0 ? (
          <SidebarGroup className="mt-auto border-t border-sidebar-border px-3 py-3">
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-sidebar-foreground/55 uppercase">
              Conta
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {itemsConta.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    {pathname === item.to && <IndicadorDoMenu />}
                    <SidebarMenuButton asChild isActive={pathname === item.to}>
                      <Link to={item.to} data-tour={item.to} onClick={aoSelecionar}>
                        <item.icon className="size-6 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
  );
}

/** Barrinha dourada do item ativo: desliza de um item para o outro ao trocar de página. */
function IndicadorDoMenu() {
  return (
    <motion.span
      layoutId="menu-indicador"
      aria-hidden="true"
      className="absolute top-1.5 bottom-1.5 -left-3 z-10 w-[3px] rounded-r-full bg-sidebar-primary shadow-[0_0_14px_2px] shadow-sidebar-primary/50"
      transition={{ type: "spring", stiffness: 520, damping: 38 }}
    />
  );
}

function SignOutButton({ compact }: { compact?: boolean }) {
  const { sair, aviso } = useSair();

  return (
    <>
      <Button variant="ghost" size={compact ? "sm" : "default"} onClick={sair} aria-label="Sair">
        <LogOut className="size-4" />
        {!compact && "Sair"}
      </Button>
      {aviso}
    </>
  );
}
