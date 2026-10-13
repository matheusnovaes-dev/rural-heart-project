import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { CadastroConcluido } from "@/components/onboarding/CadastroConcluido";
import { culturas } from "@/config/culturas";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/boas-vindas")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: BoasVindasPage,
});

/** Chave que o formulário da landing grava ao concluir o cadastro (ver LeadForm). */
const CHAVE_BOAS_VINDAS = "safralume_boas_vindas";

/**
 * Passo "Conta criada, peça seu primeiro preço" para quem se cadastra pelo
 * formulário da landing (o caminho que a maior parte do tráfego de anúncio
 * usa, e que antes caía direto no painel). Só aparece logo depois de um
 * cadastro: sem a marca, ou sem sessão/produtor, segue pro lugar certo.
 */
function BoasVindasPage() {
  const { loading, session, produtor } = useAuth();
  const navigate = useNavigate();

  const veioDoCadastro = (() => {
    try {
      return window.sessionStorage.getItem(CHAVE_BOAS_VINDAS) === "1";
    } catch {
      return true; // storage bloqueado: melhor mostrar o passo que perdê-lo
    }
  })();

  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/login" });
    else if (!produtor || !veioDoCadastro) void navigate({ to: "/dashboard" });
  }, [loading, session, produtor, veioDoCadastro, navigate]);

  if (loading || !session || !produtor || !veioDoCadastro) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <CadastroConcluido
      nome={produtor.nome}
      cultura={
        culturas.find((c) => c.value === produtor.cultura_principal)?.label ??
        produtor.cultura_principal
      }
      aoIrParaOPainel={() => {
        try {
          window.sessionStorage.removeItem(CHAVE_BOAS_VINDAS);
        } catch {
          // sem storage: nada a limpar
        }
        void navigate({ to: "/dashboard" });
      }}
    />
  );
}
