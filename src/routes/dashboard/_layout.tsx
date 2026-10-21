import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { LogOut, Search } from "lucide-react";

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
          items={items}
          itemsConta={itemsConta}
        />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/80 bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            {/* No celular o produtor entra com a sidebar fechada e o ícone
                sozinho (PanelLeft) não é óbvio pra quem não é familiarizado
                com esse padrão de app — vira um botão com rótulo "Menu" até
                o breakpoint sm, onde a sidebar já fica aberta por padrão. */}
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 shadow-sm sm:border-none sm:bg-transparent sm:p-0 sm:shadow-none">
              <SidebarTrigger />
              <span className="text-xs font-medium text-muted-foreground sm:hidden">Menu</span>
            </div>
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
              Inteligência de mercado rural
            </span>
            <AtalhoBusca />
          </header>
          <div id="conteudo" tabIndex={-1} className="flex-1 p-4 outline-none sm:p-6 lg:p-8">
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
      <kbd className="ml-1 font-mono text-xs">⌘K</kbd>
    </span>
  );
}

function AppSidebar({
  headerTitle,
  headerSubtitle,
  avatarUrl,
  items,
  itemsConta,
}: {
  headerTitle: string;
  headerSubtitle: string;
  avatarUrl: string | null;
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
              className="size-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <img src={MIDIA.logo} alt="" className="size-9 rounded-[0.65rem]" />
          )}
          <div className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold text-sidebar-foreground">
              {headerTitle}
            </span>
            <span className="block text-xs font-medium text-sidebar-foreground/65">
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
