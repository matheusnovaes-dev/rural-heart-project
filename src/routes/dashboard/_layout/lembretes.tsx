import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Loader2, Plus, Clock, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";

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
  const [carregando, setCarregando] = useState(true);
  const [produtoresOpcoes, setProdutoresOpcoes] = useState<
    { id: string; nome: string; whatsapp: string }[]
  >([]);
  const [funcionarios, setFuncionarios] = useState<
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
    setCarregando(false);

    if (cooperativa) {
      const { data: prods } = await supabase
        .from("produtores")
        .select("id, nome, whatsapp")
        .eq("cooperativa_id", cooperativa.id);
      setProdutoresOpcoes(prods ?? []);
    }

    if (produtor) {
      const { data: func } = await supabase
        .from("funcionarios")
        .select("id, nome, whatsapp")
        .eq("produtor_id", produtor.id)
        .order("nome");
      setFuncionarios(func ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor, cooperativa]);

  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  async function cancelar(id: string) {
    if (!supabase) return;
    setCancelandoId(id);
    const { error } = await supabase.from("lembretes").update({ status: "cancelado" }).eq("id", id);
    setCancelandoId(null);
    if (error) {
      toast.error("Não foi possível cancelar o lembrete.");
      return;
    }
    toast.success("Lembrete cancelado.");
    load();
  }

  // produtorId é sempre o dono real da conta (pra RLS/histórico) — pode
  // ser diferente de quem recebe a mensagem, quando o destino é um
  // funcionário (que não tem linha própria em `produtores`).
  const destinatarios: { id: string; nome: string; whatsapp: string; produtorId: string }[] =
    produtor
      ? [
          {
            id: produtor.id,
            nome: "Você mesmo",
            whatsapp: produtor.whatsapp,
            produtorId: produtor.id,
          },
          ...funcionarios.map((f) => ({ ...f, produtorId: produtor.id })),
        ]
      : produtoresOpcoes.map((p) => ({ ...p, produtorId: p.id }));

  const dialogNovo = (
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
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Bell}
        title="Lembretes"
        description="Tarefas agendadas pra chegar no WhatsApp na hora certa."
        action={dialogNovo}
      />
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {carregando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              {lembretes.length === 0 && (
                <EmptyState
                  icon={Bell}
                  title="Nenhum lembrete ainda"
                  description="Agende tarefas da lavoura (aplicação, manutenção, vistoria) pra não depender da memória."
                />
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
                      <span className="font-mono tabular-nums">
                        {new Date(l.enviar_em).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {l.recorrencia &&
                        ` · repete ${l.recorrencia === "diaria" ? "todo dia" : "toda semana"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={statusLabel[l.status].variant}
                      className="text-[11px] font-semibold"
                    >
                      {statusLabel[l.status].label}
                    </Badge>
                    {l.status === "pendente" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={cancelandoId === l.id}
                        onClick={() => cancelar(l.id)}
                      >
                        {cancelandoId === l.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <X className="size-4" />
                            Cancelar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NovoLembreteForm({
  destinatarios,
  onDone,
}: {
  destinatarios: { id: string; nome: string; whatsapp: string; produtorId: string }[];
  onDone: () => void;
}) {
  const { session } = useAuth();
  const [destinatarioId, setDestinatarioId] = useState(destinatarios[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("08:00");
  const [recorrencia, setRecorrencia] = useState<string>("nenhuma");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !data) return;
    const destinatario = destinatarios.find((d) => d.id === destinatarioId);
    if (!destinatario) return;

    setLoading(true);
    const { error } = await supabase.from("lembretes").insert({
      produtor_id: destinatario.produtorId,
      criado_por: session.user.id,
      titulo,
      descricao: descricao || null,
      enviar_em: new Date(`${data}T${hora}:00`).toISOString(),
      whatsapp_destino: destinatario.whatsapp,
      recorrencia: recorrencia === "nenhuma" ? null : recorrencia,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível agendar o lembrete.");
      return;
    }
    toast.success("Lembrete agendado.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {destinatarios.length > 1 && (
        <div className="space-y-1.5">
          <Label>Para quem</Label>
          <Select value={destinatarioId} onValueChange={setDestinatarioId}>
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
