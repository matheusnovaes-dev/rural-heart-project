import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Loader2, Plus, Clock, Pencil, Trash2, X } from "lucide-react";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  whatsapp_destino: string;
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
  const [editando, setEditando] = useState<Lembrete | null>(null);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase
      .from("lembretes")
      .select(
        "id, titulo, descricao, enviar_em, status, recorrencia, produtor_id, whatsapp_destino",
      )
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

  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function excluir(id: string) {
    if (!supabase) return;
    setExcluindoId(id);
    const { error } = await supabase.from("lembretes").delete().eq("id", id);
    setExcluindoId(null);
    if (error) {
      toast.error("Não foi possível excluir o lembrete.");
      return;
    }
    toast.success("Lembrete excluído.");
    load();
  }

  // produtorId é sempre o dono real da conta (pra RLS/histórico) — pode
  // ser diferente de quem recebe a mensagem, quando o destino é um
  // funcionário (que não tem linha própria em `produtores`). Uma conta pode
  // ter os dois papéis ao mesmo tempo (admin de cooperativa que também tem
  // cadastro próprio de produtor) — por isso as duas listas se somam em vez
  // de uma excluir a outra; senão os produtores da cooperativa (como a
  // Daniele) somem da lista sempre que a conta também for produtor (bug
  // real, achado testando).
  const destinatarios: { id: string; nome: string; whatsapp: string; produtorId: string }[] = [
    ...(produtor
      ? [
          {
            id: produtor.id,
            nome: "Você mesmo",
            whatsapp: produtor.whatsapp,
            produtorId: produtor.id,
          },
          ...funcionarios.map((f) => ({ ...f, produtorId: produtor.id })),
        ]
      : []),
    ...produtoresOpcoes
      .filter((p) => p.id !== produtor?.id)
      .map((p) => ({ ...p, produtorId: p.id })),
  ];

  const dialogNovo = (
    <Dialog
      open={open || !!editando}
      onOpenChange={(v) => {
        if (!v) {
          setOpen(false);
          setEditando(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={destinatarios.length === 0} onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Novo lembrete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar lembrete" : "Novo lembrete"}</DialogTitle>
        </DialogHeader>
        <LembreteForm
          destinatarios={destinatarios}
          lembrete={editando}
          onDone={() => {
            setOpen(false);
            setEditando(null);
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
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={statusLabel[l.status].variant}
                      className="mr-1 text-[11px] font-semibold"
                    >
                      {statusLabel[l.status].label}
                    </Badge>
                    {l.status === "pendente" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-foreground"
                          aria-label={`Editar ${l.titulo}`}
                          onClick={() => setEditando(l)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={cancelandoId === l.id}
                          aria-label={`Cancelar ${l.titulo}`}
                          title="Cancelar (mantém no histórico)"
                          onClick={() => cancelar(l.id)}
                        >
                          {cancelandoId === l.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <X className="size-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={excluindoId === l.id}
                          aria-label={`Excluir ${l.titulo}`}
                          title="Excluir (remove do histórico)"
                        >
                          {excluindoId === l.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir "{l.titulo}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação não pode ser desfeita — diferente de cancelar, remove o
                            lembrete do histórico por completo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => excluir(l.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

function LembreteForm({
  destinatarios,
  lembrete,
  onDone,
}: {
  destinatarios: { id: string; nome: string; whatsapp: string; produtorId: string }[];
  lembrete: Lembrete | null;
  onDone: () => void;
}) {
  const { session } = useAuth();
  const destinatarioInicial =
    destinatarios.find((d) => d.whatsapp === lembrete?.whatsapp_destino)?.id ??
    destinatarios[0]?.id ??
    "";
  const [destinatarioId, setDestinatarioId] = useState(destinatarioInicial);
  const [titulo, setTitulo] = useState(lembrete?.titulo ?? "");
  const [descricao, setDescricao] = useState(lembrete?.descricao ?? "");
  const dataInicial = lembrete ? new Date(lembrete.enviar_em) : null;
  const [data, setData] = useState(dataInicial ? dataInicial.toISOString().slice(0, 10) : "");
  const [hora, setHora] = useState(
    dataInicial
      ? `${String(dataInicial.getHours()).padStart(2, "0")}:${String(dataInicial.getMinutes()).padStart(2, "0")}`
      : "08:00",
  );
  const [recorrencia, setRecorrencia] = useState<string>(lembrete?.recorrencia ?? "nenhuma");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !data) return;
    const destinatario = destinatarios.find((d) => d.id === destinatarioId);
    if (!destinatario) return;

    setLoading(true);
    const payload = {
      produtor_id: destinatario.produtorId,
      titulo,
      descricao: descricao || null,
      enviar_em: new Date(`${data}T${hora}:00`).toISOString(),
      whatsapp_destino: destinatario.whatsapp,
      recorrencia: recorrencia === "nenhuma" ? null : recorrencia,
    };
    const { error } = lembrete
      ? await supabase.from("lembretes").update(payload).eq("id", lembrete.id)
      : await supabase.from("lembretes").insert({ ...payload, criado_por: session.user.id });
    setLoading(false);
    if (error) {
      toast.error(
        lembrete
          ? "Não foi possível salvar as alterações."
          : "Não foi possível agendar o lembrete.",
      );
      return;
    }
    toast.success(lembrete ? "Lembrete atualizado." : "Lembrete agendado.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label>Para quem</Label>
        {destinatarios.length > 1 ? (
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
        ) : (
          <p className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">
            {destinatarios[0]?.nome ?? "—"}
          </p>
        )}
      </div>
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
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : lembrete ? (
          "Salvar alterações"
        ) : (
          "Agendar lembrete"
        )}
      </Button>
    </form>
  );
}
