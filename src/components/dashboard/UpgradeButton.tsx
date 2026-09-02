import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { atualizarPlanoAsaas, trocarPlanoTrial } from "@/lib/asaas.server";
import { useAuth } from "@/lib/auth";
import type { Plano } from "@/lib/planos";

const planoLabel: Record<Plano, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

/**
 * Quando ainda não existe assinatura na Asaas (teste grátis em andamento,
 * nunca foi cobrado) trocar de plano é só uma troca local — não tem
 * cobrança nenhuma envolvida até o trial acabar. Só quando já existe uma
 * assinatura real na Asaas (já pagando) é que o upgrade precisa passar
 * por ela, pra próxima cobrança já sair com o valor novo.
 */
export function UpgradeButton({
  planoAlvo,
  assinaturaId,
  asaasSubscriptionId,
  className,
  variant,
}: {
  planoAlvo: Plano;
  assinaturaId: string | null;
  asaasSubscriptionId: string | null;
  className?: string;
  variant?: ButtonProps["variant"];
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleTrocaSemCobranca() {
    if (!session || !assinaturaId) return;
    setLoading(true);
    try {
      await trocarPlanoTrial({
        data: { accessToken: session.access_token, assinaturaId, novoPlano: planoAlvo },
      });
      toast.success(`Seu teste grátis agora é do plano ${planoLabel[planoAlvo]}.`);
      window.location.reload();
    } catch {
      toast.error("Não foi possível trocar de plano agora. Tenta de novo.");
      setLoading(false);
    }
  }

  async function handleUpgradeComCobranca() {
    if (!session) return;
    setLoading(true);
    try {
      await atualizarPlanoAsaas({
        data: {
          accessToken: session.access_token,
          asaasSubscriptionId: asaasSubscriptionId!,
          novoPlano: planoAlvo,
        },
      });
      toast.success(
        `Plano atualizado pra ${planoLabel[planoAlvo]}. A próxima cobrança já sai com o novo valor.`,
      );
      window.location.reload();
    } catch {
      toast.error("Não foi possível atualizar o plano agora. Tenta de novo ou chama no WhatsApp.");
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={variant}
      className={className}
      disabled={loading}
      onClick={asaasSubscriptionId ? handleUpgradeComCobranca : handleTrocaSemCobranca}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : asaasSubscriptionId ? (
        `Fazer upgrade pro ${planoLabel[planoAlvo]}`
      ) : (
        `Trocar pro ${planoLabel[planoAlvo]}`
      )}
    </Button>
  );
}
