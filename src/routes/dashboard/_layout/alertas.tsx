import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrendingUp, Loader2, Plus, ArrowDown, ArrowUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/_layout/alertas")({
  component: AlertasPage,
});

type Alerta = {
  id: string;
  cultura: string;
  uf: string;
  limite: number;
  direcao: "acima" | "abaixo";
  ativo: boolean;
  disparado_em: string | null;
};

function AlertasPage() {
  const { produtor, cooperativa } = useAuth();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [produtoresOpcoes, setProdutoresOpcoes] = useState<
    {
      id: string;
      nome: string;
      whatsapp: string;
      cultura_principal: string | null;
      uf: string | null;
    }[]
  >([]);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase
      .from("alertas_preco")
      .select("id, cultura, uf, limite, direcao, ativo, disparado_em")
      .order("created_at", { ascending: false });
    setAlertas(data ?? []);

    if (cooperativa) {
      const { data: prods } = await supabase
        .from("produtores")
        .select("id, nome, whatsapp, cultura_principal, uf")
        .eq("cooperativa_id", cooperativa.id);
      setProdutoresOpcoes(prods ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor, cooperativa]);

  const destinatarios = produtor
    ? [
        {
          id: produtor.id,
          nome: "Você mesmo",
          whatsapp: produtor.whatsapp,
          cultura_principal: produtor.cultura_principal,
          uf: produtor.uf,
        },
      ]
    : produtoresOpcoes;

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-lg font-semibold">
            <TrendingUp className="size-4" />
            Alertas de preço
          </CardTitle>
          <CardDescription>
            Diferente de lembrete de tarefa — isso avisa quando o preço cruzar um valor. O envio por
            WhatsApp liga junto com o bot; por enquanto o alerta fica marcado como "disparado" aqui
            assim que a condição bater.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={destinatarios.length === 0}>
              <Plus className="size-4" />
              Novo alerta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo alerta de preço</DialogTitle>
            </DialogHeader>
            <NovoAlertaForm
              destinatarios={destinatarios}
              onDone={() => {
                setOpen(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {alertas.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum alerta ainda. Crie o primeiro.
          </p>
        )}
        {alertas.map((a) => (
          <div
            key={a.id}
            className="flex flex-col gap-1 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-2 text-sm">
              {a.direcao === "acima" ? (
                <ArrowUp className="size-4 text-primary" />
              ) : (
                <ArrowDown className="size-4 text-destructive" />
              )}
              <span className="font-medium text-foreground">
                {a.cultura} · {a.uf} {a.direcao} de{" "}
                <span className="font-mono tabular-nums">
                  R${a.limite.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </span>
            </div>
            <Badge
              variant={a.disparado_em ? "default" : "secondary"}
              className="font-mono text-[11px] tabular-nums"
            >
              {a.disparado_em
                ? `Disparado em ${new Date(a.disparado_em).toLocaleDateString("pt-BR")}`
                : "Ativo, aguardando"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NovoAlertaForm({
  destinatarios,
  onDone,
}: {
  destinatarios: {
    id: string;
    nome: string;
    whatsapp: string;
    cultura_principal: string | null;
    uf: string | null;
  }[];
  onDone: () => void;
}) {
  const { session } = useAuth();
  const [produtorId, setProdutorId] = useState(destinatarios[0]?.id ?? "");
  const selecionado = destinatarios.find((d) => d.id === produtorId) ?? destinatarios[0];

  const [cultura, setCultura] = useState(selecionado?.cultura_principal ?? "soja");
  const [uf, setUf] = useState(selecionado?.uf ?? "");
  const [limite, setLimite] = useState("");
  const [direcao, setDirecao] = useState<"acima" | "abaixo">("acima");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !limite || !uf) return;
    const destinatario = destinatarios.find((d) => d.id === produtorId);
    if (!destinatario) return;

    setLoading(true);
    const { error } = await supabase.from("alertas_preco").insert({
      produtor_id: produtorId,
      criado_por: session.user.id,
      cultura,
      uf: uf.toUpperCase(),
      limite: parseFloat(limite.replace(",", ".")),
      direcao,
      whatsapp_destino: destinatario.whatsapp,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível criar o alerta.");
      return;
    }
    toast.success("Alerta criado.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {destinatarios.length > 1 && (
        <div className="space-y-1.5">
          <Label>Para quem</Label>
          <Select value={produtorId} onValueChange={setProdutorId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {destinatarios.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="a-cultura">Cultura</Label>
          <Input
            id="a-cultura"
            required
            value={cultura}
            onChange={(e) => setCultura(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-uf">UF</Label>
          <Input
            id="a-uf"
            required
            maxLength={2}
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase())}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Avisar quando o preço ficar</Label>
        <Select value={direcao} onValueChange={(v) => setDirecao(v as "acima" | "abaixo")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="acima">Acima de</SelectItem>
            <SelectItem value="abaixo">Abaixo de</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-limite">Valor (R$ por saca)</Label>
        <Input
          id="a-limite"
          required
          inputMode="decimal"
          placeholder="Ex: 130,00"
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Criar alerta"}
      </Button>
    </form>
  );
}
