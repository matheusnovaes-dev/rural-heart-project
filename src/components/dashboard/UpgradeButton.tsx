import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { buildWhatsAppLink } from "@/config/site";
import { atualizarPlanoAsaas } from "@/lib/asaas.server";
import type { Plano } from "@/lib/planos";

const planoLabel: Record<Plano, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

/**
 * Se já existe assinatura na Asaas, faz o upgrade de verdade (sem pedir
 * cartão de novo — próxima cobrança já sai com o valor novo). Sem isso
 * (ex: produtor coberto pela assinatura da cooperativa), cai pro WhatsApp.
 */
export function UpgradeButton({
  planoAlvo,
  asaasSubscriptionId,
  className,
  variant,
}: {
  planoAlvo: Plano;
  asaasSubscriptionId: string | null;
  className?: string;
  variant?: ButtonProps["variant"];
}) {
  const [loading, setLoading] = useState(false);

  if (!asaasSubscriptionId) {
    return (
      <Button asChild size="sm" variant={variant} className={className}>
        <a
          href={buildWhatsAppLink(
            `Quero fazer upgrade pro plano ${planoLabel[planoAlvo]} do Safralume.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          Fazer upgrade
        </a>
      </Button>
    );
  }

  async function handleUpgrade() {
    setLoading(true);
    try {
      await atualizarPlanoAsaas({
        data: { asaasSubscriptionId: asaasSubscriptionId!, novoPlano: planoAlvo },
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
      onClick={handleUpgrade}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        `Fazer upgrade pro ${planoLabel[planoAlvo]}`
      )}
    </Button>
  );
}
