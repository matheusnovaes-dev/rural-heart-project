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
import { cancelarAssinaturaAsaas, pausarAssinatura } from "@/lib/asaas.server";

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

const formatarData = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function CancelarAssinaturaDialog({
  assinaturaId,
  asaasSubscriptionId,
  status,
}: {
  assinaturaId: string;
  asaasSubscriptionId: string | null;
  status?: "trial" | "ativa" | "inadimplente" | "cancelada" | null;
}) {
  const { session, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState<(typeof motivos)[number]["value"] | "">("");
  const [detalhe, setDetalhe] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pausando, setPausando] = useState<30 | 60 | null>(null);
  const [pausaIndisponivel, setPausaIndisponivel] = useState(false);

  // Quem sente que "não usa o suficiente" (o feedback real que mais pesa) recebe a opção de pausar antes de cancelar. Em
  // inadimplência há cobrança vencida a resolver, então não há pausa.
  const podePausar =
    motivo === "nao_uso_o_suficiente" &&
    !pausaIndisponivel &&
    (status === "ativa" || status === "trial");
  const comCobranca = !!asaasSubscriptionId;

  async function handlePausar(dias: 30 | 60) {
    if (!session) return;
    setPausando(dias);
    try {
      const r = await pausarAssinatura({
        data: { accessToken: session.access_token, assinaturaId, dias },
      });
      toast.success(
        comCobranca
          ? `Cobrança pausada. A próxima fica para ${formatarData(r.ate)}.`
          : `Teste estendido até ${formatarData(r.ate)}.`,
      );
      setOpen(false);
      // useAssinatura não refaz a leitura sozinho: recarrega para a tela mostrar o novo vencimento.
      window.setTimeout(() => window.location.reload(), 1800);
    } catch (err) {
      setPausaIndisponivel(true);
      toast.error(err instanceof Error ? err.message : "Não foi possível pausar agora.");
    } finally {
      setPausando(null);
    }
  }

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
            Seu acesso é cortado assim que confirmar. Nos ajuda a entender o motivo: isso não muda o
            cancelamento, só nos ajuda a melhorar.
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

        {podePausar && (
          <div className="border-border bg-muted/40 space-y-3 rounded-lg border p-4">
            <div>
              <p className="text-foreground text-sm font-semibold">
                {comCobranca
                  ? "Em vez de cancelar, que tal pausar?"
                  : "Que tal mais um tempo de teste?"}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {comCobranca
                  ? "A cobrança fica pausada e seu acesso continua."
                  : "Nada é cobrado e seu acesso continua."}{" "}
                Se você já conversou com o Safralume no WhatsApp, ele te avisa lá quando o preço da
                sua cultura mexer 3% ou mais, sem você precisar abrir nada.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(comCobranca ? ([30, 60] as const) : ([30] as const)).map((d) => (
                <Button
                  key={d}
                  size="sm"
                  disabled={pausando !== null || enviando}
                  onClick={() => handlePausar(d)}
                >
                  {pausando === d ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : comCobranca ? (
                    `Pausar por ${d} dias`
                  ) : (
                    `Ganhar mais ${d} dias de teste`
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

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
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={!motivo || enviando || pausando !== null}
          >
            {enviando ? <Loader2 className="size-4 animate-spin" /> : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
