import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { cancelarAssinaturaAsaas } from "@/lib/asaas.server";

const motivos = [
  { value: "muito_caro", label: "Achei muito caro" },
  { value: "nao_uso_o_suficiente", label: "Não estou usando o suficiente" },
  { value: "faltou_funcionalidade", label: "Faltou uma funcionalidade que eu precisava" },
  { value: "vou_usar_outro_servico", label: "Vou usar outro serviço" },
  {
    value: "problema_tecnico_ou_dados",
    label: "Tive problema técnico ou com a qualidade dos dados",
  },
  { value: "outro", label: "Outro motivo" },
] as const;

export function CancelarAssinaturaDialog({
  assinaturaId,
  asaasSubscriptionId,
}: {
  assinaturaId: string;
  asaasSubscriptionId: string | null;
}) {
  const { session, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState<(typeof motivos)[number]["value"] | "">("");
  const [detalhe, setDetalhe] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleConfirmar() {
    if (!session || !motivo) return;
    setEnviando(true);
    try {
      await cancelarAssinaturaAsaas({
        data: {
          accessToken: session.access_token,
          assinaturaId,
          asaasSubscriptionId: asaasSubscriptionId ?? undefined,
          motivo,
          motivoDetalhe: detalhe.trim() || undefined,
        },
      });
      toast.success("Assinatura cancelada.");
      await refresh();
      setOpen(false);
      navigate({ to: "/assinar" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cancelar. Tenta de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-muted-foreground hover:text-destructive">
          Cancelar assinatura
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar assinatura</DialogTitle>
          <DialogDescription>
            Seu acesso é cortado assim que confirmar. Nos ajuda a entender o motivo — isso não muda
            o cancelamento, só nos ajuda a melhorar.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={motivo} onValueChange={(v) => setMotivo(v as typeof motivo)}>
          <div className="flex flex-col gap-2.5">
            {motivos.map((m) => (
              <label
                key={m.value}
                className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
              >
                <RadioGroupItem value={m.value} />
                {m.label}
              </label>
            ))}
          </div>
        </RadioGroup>

        <div className="space-y-1.5">
          <Label htmlFor="motivo-detalhe">Quer contar mais? (opcional)</Label>
          <Textarea
            id="motivo-detalhe"
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder="Fica à vontade pra detalhar."
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={enviando}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={handleConfirmar} disabled={!motivo || enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
