import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CloudSun,
  CreditCard,
  FileDown,
  HardHat,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Palette,
  TrendingUp,
  Users,
  UsersRound,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Destino = { to: string; label: string; icon: typeof Bell };

const DESTINOS_PRODUTOR: Destino[] = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/dashboard/alertas", label: "Alertas de preço", icon: TrendingUp },
  { to: "/dashboard/lembretes", label: "Lembretes", icon: ListChecks },
  { to: "/dashboard/funcionarios", label: "Funcionários", icon: HardHat },
  { to: "/dashboard/clima", label: "Clima", icon: CloudSun },
];

const DESTINOS_COOPERATIVA: Destino[] = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { to: "/dashboard/precos", label: "Preços", icon: LineChart },
  { to: "/dashboard/alertas", label: "Alertas de preço", icon: TrendingUp },
  { to: "/dashboard/produtores", label: "Produtores", icon: Users },
  { to: "/dashboard/lembretes", label: "Lembretes", icon: Bell },
  { to: "/dashboard/clima", label: "Clima", icon: CloudSun },
];

const DESTINOS_ADMIN: Destino[] = [
  { to: "/dashboard/equipe", label: "Equipe", icon: UsersRound },
  { to: "/dashboard/marca", label: "Marca própria", icon: Palette },
  { to: "/dashboard/relatorios", label: "Relatórios", icon: FileDown },
  { to: "/dashboard/assinatura", label: "Assinatura", icon: CreditCard },
];

const DESTINO_ASSINATURA: Destino = {
  to: "/dashboard/assinatura",
  label: "Assinatura",
  icon: CreditCard,
};

/**
 * Paleta ⌘K — atalho de poder pra quem usa o painel todo dia, sem adicionar
 * complexidade à navegação visível (a pesquisa com produtores mostra que
 * navegação complexa é o que mais afasta esse público).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { produtor, cooperativa, papel } = useAuth();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const destinos = cooperativa
    ? [...DESTINOS_COOPERATIVA, ...(papel === "admin" ? DESTINOS_ADMIN : [])]
    : produtor
      ? [...DESTINOS_PRODUTOR, ...(produtor.cooperativa_id ? [] : [DESTINO_ASSINATURA])]
      : [];

  function ir(to: string) {
    setOpen(false);
    navigate({ to });
  }

  async function sair() {
    setOpen(false);
    await supabase?.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar página ou ação..." />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Ir para">
          {destinos.map((d) => (
            <CommandItem key={d.to} value={d.label} onSelect={() => ir(d.to)}>
              <d.icon className="mr-2 size-4" />
              {d.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Conta">
          <CommandItem value="Sair da conta" onSelect={sair}>
            <LogOut className="mr-2 size-4" />
            Sair da conta
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
