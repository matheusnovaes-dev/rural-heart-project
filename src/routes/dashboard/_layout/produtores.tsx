import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useRequireCooperativa } from "@/lib/auth";
import { normalizarWhatsapp } from "@/lib/telefone";
import { ImportarProdutoresDialog } from "@/components/dashboard/ImportarProdutoresDialog";
import { enviarBoasVindasWhatsApp } from "@/lib/notificacoes.server";

export const Route = createFileRoute("/dashboard/_layout/produtores")({
  component: ProdutoresPage,
});

type ProdutorRow = {
  id: string;
  nome: string;
  whatsapp: string;
  cultura_principal: string | null;
  uf: string | null;
};

function ProdutoresPage() {
  const cooperativa = useRequireCooperativa();
  const [produtores, setProdutores] = useState<ProdutorRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<ProdutorRow | null>(null);

  async function load() {
    if (!supabase || !cooperativa) return;
    const { data } = await supabase
      .from("produtores")
      .select("id, nome, whatsapp, cultura_principal, uf")
      .eq("cooperativa_id", cooperativa.id)
      .order("nome");
    setProdutores(data ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperativa]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtores;
    return produtores.filter(
      (p) => p.nome.toLowerCase().includes(termo) || p.whatsapp.includes(termo),
    );
  }, [produtores, busca]);

  async function handleDelete(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("produtores").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover o produtor.");
      return;
    }
    toast.success("Produtor removido.");
    load();
  }

  if (!cooperativa) return null;

  const dialogAdicionar = (
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
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar produtor" : "Adicionar produtor"}</DialogTitle>
        </DialogHeader>
        <ProdutorForm
          cooperativaId={cooperativa?.id ?? ""}
          produtor={editando}
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
        icon={Users}
        title="Produtores"
        description="Produtores associados à sua cooperativa"
        action={
          <div className="flex gap-2">
            <ImportarProdutoresDialog cooperativaId={cooperativa.id} onDone={load} />
            {dialogAdicionar}
          </div>
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          {produtores.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou WhatsApp..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {carregando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : produtores.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum produtor cadastrado"
              description="Cadastre os produtores da sua cooperativa pra acompanhar preço, clima e enviar alertas pra eles."
            />
          ) : filtrados.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nada encontrado"
              description={`Nenhum produtor corresponde a "${busca}".`}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Cultura</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>{p.whatsapp}</TableCell>
                      <TableCell>{p.cultura_principal ?? "—"}</TableCell>
                      <TableCell>{p.uf ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setEditando(p)}
                            aria-label={`Editar ${p.nome}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Remover ${p.nome}`}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover {p.nome}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Essa ação não pode ser desfeita. Alertas e lembretes ligados a
                                  esse produtor também serão removidos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(p.id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProdutorForm({
  cooperativaId,
  produtor,
  onDone,
}: {
  cooperativaId: string;
  produtor: ProdutorRow | null;
  onDone: () => void;
}) {
  const [nome, setNome] = useState(produtor?.nome ?? "");
  const [whatsapp, setWhatsapp] = useState(produtor?.whatsapp ?? "");
  const [cultura, setCultura] = useState(produtor?.cultura_principal ?? "");
  const [uf, setUf] = useState(produtor?.uf ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);

    const payload = {
      nome,
      whatsapp: normalizarWhatsapp(whatsapp),
      cultura_principal: cultura || null,
      uf: uf || null,
    };

    const { error } = produtor
      ? await supabase.from("produtores").update(payload).eq("id", produtor.id)
      : await supabase.from("produtores").insert({ ...payload, cooperativa_id: cooperativaId });

    setLoading(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Esse número de WhatsApp já está cadastrado em outro produtor."
          : "Não foi possível salvar o produtor.",
      );
      return;
    }

    if (!produtor) {
      // Best-effort — mesmo cadastrado pela cooperativa (não pelo próprio
      // produtor), ele precisa saber que existe um WhatsApp pra chamar.
      void enviarBoasVindasWhatsApp({
        data: { nome, whatsapp: payload.whatsapp, cooperativaId },
      });
    }

    toast.success(produtor ? "Produtor atualizado." : "Produtor adicionado.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="p-nome">Nome</Label>
        <Input id="p-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-whatsapp">WhatsApp</Label>
        <Input
          id="p-whatsapp"
          required
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="p-cultura">Cultura</Label>
          <Input id="p-cultura" value={cultura} onChange={(e) => setCultura(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-uf">UF</Label>
          <Input
            id="p-uf"
            maxLength={2}
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase())}
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
      </Button>
    </form>
  );
}
