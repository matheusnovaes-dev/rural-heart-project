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
      <SidebarProvider>
        <CooperativaSidebar cooperativaNome={cooperativa.nome} isAdmin={papel === "admin"} />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger />
          </header>
          <div className="flex-1 p-4 sm:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProdutorHeader nome={produtor!.nome} />
      <main className="mx-auto max-w-lg px-4 py-6">
        <Outlet />
      </main>
    </div>
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
          <span className="truncate text-sm font-semibold text-foreground">{cooperativaNome}</span>
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

function ProdutorHeader({ nome }: { nome: string }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
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
