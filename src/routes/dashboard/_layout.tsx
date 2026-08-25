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
  Loader2,
  Sprout,
  CloudSun,
  Search,
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
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/dashboard/_layout")({
  component: DashboardGuard,
});

function DashboardGuard() {
  const { loading, session, produtor, cooperativa, papel } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (!produtor && !cooperativa) {
      navigate({ to: "/onboarding" });
    }
  }, [loading, session, produtor, cooperativa, navigate]);

  if (loading || !session || (!produtor && !cooperativa)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (cooperativa) {
    return (
      <TooltipProvider delayDuration={200}>
        <SidebarProvider>
          <CooperativaSidebar cooperativaNome={cooperativa.nome} isAdmin={papel === "admin"} />
          <SidebarInset>
            <header className="flex h-14 items-center gap-2 border-b border-border px-4">
              <SidebarTrigger />
              <AtalhoBusca />
            </header>
            <div className="flex-1 p-4 sm:p-6">
              <Outlet />
            </div>
          </SidebarInset>
          <CommandPalette />
        </SidebarProvider>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <ProdutorHeader nome={produtor!.nome} />
        {/* max-w-6xl, não max-w-lg: a coluna de 512px fazia o painel parecer
            um app de celular esticado no desktop. Mobile segue coluna única. */}
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </TooltipProvider>
  );
}

/** Dica visual de que o ⌘K existe — senão ninguém descobre o atalho. */
function AtalhoBusca() {
  return (
    <span className="ml-auto hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground sm:flex">
      <Search className="size-3" />
      Buscar
      <kbd className="ml-1 font-mono text-[10px] opacity-70">⌘K</kbd>
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
    { to: "/dashboard/alertas", label: "Alertas de preço", icon: TrendingUp },
    { to: "/dashboard/produtores", label: "Produtores", icon: Users },
    { to: "/dashboard/leads", label: "Leads", icon: ListChecks },
    { to: "/dashboard/lembretes", label: "Lembretes", icon: ListChecks },
    { to: "/dashboard/clima", label: "Clima", icon: CloudSun },
    ...(isAdmin
      ? [
          { to: "/dashboard/equipe", label: "Equipe", icon: UsersRound },
          { to: "/dashboard/marca", label: "Marca própria", icon: Palette },
          { to: "/dashboard/relatorios", label: "Relatórios", icon: FileDown },
        ]
      : []),
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sprout className="size-3.5" />
          </span>
          <span className="truncate font-display text-sm font-semibold text-foreground">
            {cooperativaNome}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={pathname === item.to}>
                    <Link to={item.to}>
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
      <SidebarFooter>
        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
  );
}

const produtorNavItems = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/dashboard/alertas", label: "Alertas", icon: TrendingUp },
  { to: "/dashboard/lembretes", label: "Lembretes", icon: ListChecks },
  { to: "/dashboard/clima", label: "Clima", icon: CloudSun },
] as const;

function ProdutorHeader({ nome }: { nome: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sprout className="size-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Olá,</p>
            <p className="text-sm font-semibold text-foreground">{nome}</p>
          </div>
        </div>
        <SignOutButton compact />
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto px-2 pb-2">
        {produtorNavItems.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase?.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <Button variant="ghost" size={compact ? "sm" : "default"} onClick={handleSignOut}>
      <LogOut className="size-4" />
      {!compact && "Sair"}
    </Button>
  );
}
