import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ehContaTecnica } from "@/components/dashboard/CompletarAcessoCard";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Sair do painel. Quem entrou pelo formulário rápido ainda não tem e-mail e
 * senha de verdade: sair sem criar isso deixa a pessoa sem como voltar (só
 * pedindo um link novo pelo WhatsApp) — então antes de sair, avisa e oferece
 * criar agora.
 */
export function useSair() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [avisoAberto, setAvisoAberto] = useState(false);

  async function sairDeVez() {
    await supabase?.auth.signOut();
    navigate({ to: "/login" });
  }

  function sair() {
    if (ehContaTecnica(session?.user.email)) {
      setAvisoAberto(true);
      return;
    }
    void sairDeVez();
  }

  const aviso = (
    <AlertDialog open={avisoAberto} onOpenChange={setAvisoAberto}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Você ainda não criou e-mail e senha</AlertDialogTitle>
          <AlertDialogDescription>
            Sem eles, se você sair agora só consegue voltar pedindo um link novo pelo WhatsApp.
            Leva 10 segundos pra criar e você entra de qualquer aparelho.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => void sairDeVez()}>Sair mesmo assim</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setAvisoAberto(false);
              navigate({ to: "/dashboard" });
              window.setTimeout(() => document.getElementById("acesso-email")?.focus(), 300);
            }}
          >
            Criar e-mail e senha
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { sair, aviso };
}
