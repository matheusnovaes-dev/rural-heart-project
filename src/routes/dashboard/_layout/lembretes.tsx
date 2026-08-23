import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Loader2, Plus, Clock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/dashboard/_layout/lembretes")({
  component: LembretesPage,
});

type Lembrete = {
  id: string;
  titulo: string;
  descricao: string | null;
  enviar_em: string;
  status: "pendente" | "enviado" | "erro" | "cancelado";
  recorrencia: "diaria" | "semanal" | null;
  produtor_id: string;
};

const statusLabel: Record<
  Lembrete["status"],
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  pendente: { label: "Pendente", variant: "secondary" },
  enviado: { label: "Enviado", variant: "default" },
  erro: { label: "Erro", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "secondary" },
};

function LembretesPage() {
  const { produtor, cooperativa } = useAuth();
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [produtoresOpcoes, setProdutoresOpcoes] = useState<
    { id: string; nome: string; whatsapp: string }[]
  >([]);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase
      .from("lembretes")
      .select("id, titulo, descricao, enviar_em, status, recorrencia, produtor_id")
      .order("enviar_em", { ascending: true });
    setLembretes(data ?? []);

    if (cooperativa) {
      const { data: prods } = await supabase
        .from("produtores")
        .select("id, nome, whatsapp")
        .eq("cooperativa_id", cooperativa.id);
      setProdutoresOpcoes(prods ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor, cooperativa]);

  const destinatarios = produtor
    ? [{ id: produtor.id, nome: "Você mesmo", whatsapp: produtor.whatsapp }]
    : produtoresOpcoes;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" />
            Lembretes
          </CardTitle>
          <CardDescription>
            Alertas enviados por WhatsApp — o envio liga assim que a integração com o WhatsApp
            estiver ativa; por enquanto ficam agendados aqui.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={destinatarios.length === 0}>
              <Plus className="size-4" />
              Novo lembrete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo lembrete</DialogTitle>
            </DialogHeader>
            <NovoLembreteForm
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
        {lembretes.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum lembrete ainda. Crie o primeiro.
          </p>
        )}
        {lembretes.map((l) => (
          <div
            key={l.id}
            className="flex flex-col gap-1 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-foreground">{l.titulo}</p>
              {l.descricao && <p className="text-sm text-muted-foreground">{l.descricao}</p>}
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {new Date(l.enviar_em).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {l.recorrencia &&
                  ` · repete ${l.recorrencia === "diaria" ? "todo dia" : "toda semana"}`}
              </p>
            </div>
            <Badge variant={statusLabel[l.status].variant}>{statusLabel[l.status].label}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NovoLembreteForm({
  destinatarios,
  onDone,
}: {
  destinatarios: { id: string; nome: string; whatsapp: string }[];
  onDone: () => void;
}) {
  const { session } = useAuth();
  const [produtorId, setProdutorId] = useState(destinatarios[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("08:00");
  const [recorrencia, setRecorrencia] = useState<string>("nenhuma");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !data) return;
    const destinatario = destinatarios.find((d) => d.id === produtorId);
    if (!destinatario) return;

    setLoading(true);
    await supabase.from("lembretes").insert({
      produtor_id: produtorId,
      criado_por: session.user.id,
      titulo,
      descricao: descricao || null,
      enviar_em: new Date(`${data}T${hora}:00`).toISOString(),
      whatsapp_destino: destinatario.whatsapp,
      recorrencia: recorrencia === "nenhuma" ? null : recorrencia,
    });
    setLoading(false);
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
      <div className="space-y-1.5">
        <Label htmlFor="l-titulo">Título</Label>
        <Input
          id="l-titulo"
          placeholder='Ex: "Limpou o curral?"'
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-descricao">Descrição (opcional)</Label>
        <Textarea
          id="l-descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="l-data">Data</Label>
          <Input
            id="l-data"
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-hora">Hora</Label>
          <Input
            id="l-hora"
            type="time"
            required
            value={hora}
            onChange={(e) => setHora(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Repetir</Label>
        <Select value={recorrencia} onValueChange={setRecorrencia}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhuma">Não repetir</SelectItem>
            <SelectItem value="diaria">Todo dia</SelectItem>
            <SelectItem value="semanal">Toda semana</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Agendar lembrete"}
      </Button>
    </form>
  );
}
