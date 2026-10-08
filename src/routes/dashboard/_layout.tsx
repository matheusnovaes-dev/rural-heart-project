import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  LineChart,
  TrendingUp,
  Users,
  ListChecks,
  UsersRound,
  Palette,
  FileDown,
  LogOut,
  Sprout,
  CloudSun,
  Search,
  CreditCard,
  HardHat,
  LifeBuoy,
  Calculator,
  Megaphone,
  Gavel,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { DashboardTour } from "@/components/dashboard/DashboardTour";
import { EMAIL_SAFRALUME_ADMIN, useAuth } from "@/lib/auth";
import { useAcessoDashboard } from "@/lib/planos";
import { useSair } from "@/components/dashboard/useSair";
import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/dashboard/_layout")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: DashboardGuard,
});

type NavItem = { to: string; label: string; icon: LucideIcon };

const produtorNavItemsBase: NavItem[] = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/dashboard/calculadora", label: "Calculadora", icon: Calculator },
  { to: "/dashboard/alertas", label: "Alertas", icon: TrendingUp },
  { to: "/dashboard/leiloes", label: "Leilões", icon: Gavel },
  { to: "/dashboard/lembretes", label: "Lembretes", icon: ListChecks },
  { to: "/dashboard/funcionarios", label: "Funcionários", icon: HardHat },
  { to: "/dashboard/clima", label: "Clima", icon: CloudSun },
  { to: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy },
];

const assinaturaNavItem: NavItem = {
  to: "/dashboard/assinatura",
  label: "Assinatura",
  icon: CreditCard,
};

const leadsNavItem: NavItem = { to: "/dashboard/leads", label: "Leads", icon: Megaphone };

const cooperativaNavItemsBase: NavItem[] = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { to: "/dashboard/precos", label: "Preços", icon: LineChart },
  { to: "/dashboard/calculadora", label: "Calculadora", icon: Calculator },
  { to: "/dashboard/alertas", label: "Alertas", icon: TrendingUp },
  { to: "/dashboard/leiloes", label: "Leilões", icon: Gavel },
  { to: "/dashboard/produtores", label: "Produtores", icon: Users },
  { to: "/dashboard/lembretes", label: "Lembretes", icon: ListChecks },
  { to: "/dashboard/clima", label: "Clima", icon: CloudSun },
  { to: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy },
];

const cooperativaAdminNavItems: NavItem[] = [
  { to: "/dashboard/equipe", label: "Equipe", icon: UsersRound },
  { to: "/dashboard/marca", label: "Marca própria", icon: Palette },
  { to: "/dashboard/relatorios", label: "Relatórios", icon: FileDown },
  { to: "/dashboard/assinatura", label: "Assinatura", icon: CreditCard },
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
        ...(!produtor!.cooperativa_id ? [assinaturaNavItem] : []),
        ...(emailDoUsuario === EMAIL_SAFRALUME_ADMIN ? [leadsNavItem] : []),
      ];
  const headerTitle = cooperativa ? cooperativa.nome : produtor!.nome;
  const headerSubtitle = cooperativa ? "Painel executivo" : "Produtor rural";

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider className="dashboard-shell">
        <AppSidebar headerTitle={headerTitle} headerSubtitle={headerSubtitle} items={items} />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/80 bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            <SidebarTrigger />
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
              Inteligência de mercado rural
            </span>
            <AtalhoBusca />
          </header>
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
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
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

/** Dica visual de que o ⌘K existe — senão ninguém descobre o atalho. */
function AtalhoBusca() {
  return (
    <span className="ml-auto hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm sm:flex">
      <Search className="size-3" />
      Buscar
      <kbd className="ml-1 font-mono text-[10px]">⌘K</kbd>
    </span>
  );
}

function AppSidebar({
  headerTitle,
  headerSubtitle,
  items,
}: {
  headerTitle: string;
  headerSubtitle: string;
  items: NavItem[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 px-1">
          <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Sprout className="size-3.5" />
          </span>
          <div className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold text-sidebar-foreground">
              {headerTitle}
            </span>
            <span className="block text-[10px] font-medium uppercase text-sidebar-foreground/55">
              {headerSubtitle}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 py-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={pathname === item.to}>
                    <Link to={item.to} data-tour={item.to}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
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
