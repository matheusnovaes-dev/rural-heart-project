import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
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
import { useAuth } from "@/lib/auth";
import { useAcessoDashboard } from "@/lib/planos";
import { supabase } from "@/lib/supabase";
import { useSair } from "@/components/dashboard/useSair";
import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/dashboard/_layout")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: DashboardGuard,
});

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

  if (cooperativa) {
    return (
      <TooltipProvider delayDuration={200}>
        <SidebarProvider className="dashboard-shell">
          <CooperativaSidebar cooperativaNome={cooperativa.nome} isAdmin={papel === "admin"} />
          <SidebarInset>
            <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/80 bg-background/95 px-4 backdrop-blur-sm sm:px-6">
              <SidebarTrigger />
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                Inteligência de mercado rural
              </span>
              <AtalhoBusca />
            </header>
            <div className="flex-1 p-4 sm:p-6 lg:p-8">
              <Outlet />
            </div>
          </SidebarInset>
          <CommandPalette />
          <DashboardTour />
        </SidebarProvider>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="dashboard-shell min-h-screen bg-background">
        <ProdutorHeader nome={produtor!.nome} temAssinaturaPropria={!produtor!.cooperativa_id} />
        {/* max-w-6xl, não max-w-lg: a coluna de 512px fazia o painel parecer
            um app de celular esticado no desktop. Mobile segue coluna única. */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <DashboardTour />
    </TooltipProvider>
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

function CooperativaSidebar({
  cooperativaNome,
  isAdmin,
}: {
  cooperativaNome: string;
  isAdmin: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
    { to: "/dashboard/precos", label: "Preços", icon: LineChart },
    { to: "/dashboard/alertas", label: "Alertas", icon: TrendingUp },
    { to: "/dashboard/produtores", label: "Produtores", icon: Users },
    { to: "/dashboard/lembretes", label: "Lembretes", icon: ListChecks },
    { to: "/dashboard/clima", label: "Clima", icon: CloudSun },
    { to: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy },
    ...(isAdmin
      ? [
          { to: "/dashboard/equipe", label: "Equipe", icon: UsersRound },
          { to: "/dashboard/marca", label: "Marca própria", icon: Palette },
          { to: "/dashboard/relatorios", label: "Relatórios", icon: FileDown },
          { to: "/dashboard/assinatura", label: "Assinatura", icon: CreditCard },
        ]
      : []),
  ];

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 px-1">
          <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Sprout className="size-3.5" />
          </span>
          <div className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold text-sidebar-foreground">
              {cooperativaNome}
            </span>
            <span className="block text-[10px] font-medium uppercase text-sidebar-foreground/55">
              Painel executivo
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

const produtorNavItemsBase = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/dashboard/alertas", label: "Alertas", icon: TrendingUp },
  { to: "/dashboard/lembretes", label: "Lembretes", icon: ListChecks },
  { to: "/dashboard/funcionarios", label: "Funcionários", icon: HardHat },
  { to: "/dashboard/clima", label: "Clima", icon: CloudSun },
  { to: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy },
] as const;

const assinaturaNavItem = {
  to: "/dashboard/assinatura",
  label: "Assinatura",
  icon: CreditCard,
} as const;

function ProdutorHeader({
  nome,
  temAssinaturaPropria,
}: {
  nome: string;
  temAssinaturaPropria: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const produtorNavItems = temAssinaturaPropria
    ? [...produtorNavItemsBase, assinaturaNavItem]
    : produtorNavItemsBase;

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sprout className="size-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Olá,</p>
            <p className="text-sm font-semibold text-foreground">{nome}</p>
          </div>
        </div>
        <SignOutButton compact />
      </div>
      <nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 pb-2 sm:px-5">
        {produtorNavItems.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              data-tour={item.to}
              className={`flex shrink-0 items-center gap-1.5 rounded-md border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-accent text-primary"
                  : "border-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              }`}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
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
