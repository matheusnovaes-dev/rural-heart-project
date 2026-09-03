import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, HardHat } from "lucide-react";
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
import { useRequireProdutor } from "@/lib/auth";
import { normalizarWhatsapp } from "@/lib/telefone";
import { limiteFuncionarios, useAssinatura, type Plano } from "@/lib/planos";
import { UpgradeButton } from "@/components/dashboard/UpgradeButton";

export const Route = createFileRoute("/dashboard/_layout/funcionarios")({
  component: FuncionariosPage,
});

type FuncionarioRow = { id: string; nome: string; whatsapp: string };

function FuncionariosPage() {
  const produtor = useRequireProdutor();
  const { plano, assinaturaId, asaasSubscriptionId } = useAssinatura();
  const [funcionarios, setFuncionarios] = useState<FuncionarioRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [open, setOpen] = useState(false);

  const limite = limiteFuncionarios(plano);
  const atingiuLimite = funcionarios.length >= limite;
  // Bronze não tem direito a nenhum funcionário (limite 0) — o próximo
  // plano que já resolve é o Prata. Quem já é Prata e bateu no teto de 3
  // precisa do Ouro (sem limite).
  const planoAlvo: Plano = limite === 0 ? "prata" : "ouro";

  async function load() {
    if (!supabase || !produtor) return;
    const { data } = await supabase
      .from("funcionarios")
      .select("id, nome, whatsapp")
      .eq("produtor_id", produtor.id)
      .order("nome");
    setFuncionarios(data ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor]);

  async function handleDelete(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("funcionarios").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover o funcionário.");
      return;
    }
    toast.success("Funcionário removido.");
    load();
  }

  if (!produtor) return null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={HardHat}
        title="Funcionários"
        description={
          limite === 0
            ? "Adicionar funcionários é um recurso dos planos Prata e Ouro."
            : "Quem trabalha com você e pode receber lembretes direcionados"
        }
        action={
          atingiuLimite ? (
            <UpgradeButton
              planoAlvo={planoAlvo}
              assinaturaId={assinaturaId}
              asaasSubscriptionId={asaasSubscriptionId}
            />
          ) : (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar funcionário</DialogTitle>
                </DialogHeader>
                <FuncionarioForm
                  produtorId={produtor.id}
                  onDone={() => {
                    setOpen(false);
                    load();
                  }}
                />
              </DialogContent>
            </Dialog>
          )
        }
      />
      {limite > 0 && atingiuLimite && (
        <p className="text-sm text-muted-foreground">
          Você já usou os {limite} funcionários do plano atual. Pra adicionar mais gente, é só fazer
          upgrade.
        </p>
      )}
      <Card>
        <CardContent className="pt-6">
          {carregando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : funcionarios.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title="Nenhum funcionário cadastrado"
              description={
                limite === 0
                  ? 'No plano Prata ou Ouro, você pode adicionar quem trabalha com você pra mandar um lembrete só pra essa pessoa (ex: "Jorge, checa o curral") em vez de pra todo mundo.'
                  : 'Adicione quem trabalha com você pra poder mandar um lembrete só pra essa pessoa (ex: "Jorge, checa o curral") em vez de pra todo mundo.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funcionarios.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell>{f.whatsapp}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Remover ${f.nome}`}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover {f.nome}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Lembretes já enviados pra essa
                                pessoa continuam no histórico.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(f.id)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

function FuncionarioForm({ produtorId, onDone }: { produtorId: string; onDone: () => void }) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);

    const { error } = await supabase.from("funcionarios").insert({
      produtor_id: produtorId,
      nome,
      whatsapp: normalizarWhatsapp(whatsapp),
    });

    setLoading(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Esse número de WhatsApp já está cadastrado pra outro funcionário."
          : "Não foi possível salvar o funcionário.",
      );
      return;
    }
    toast.success("Funcionário adicionado.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="f-nome">Nome</Label>
        <Input id="f-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-whatsapp">WhatsApp</Label>
        <Input
          id="f-whatsapp"
          type="tel"
          placeholder="(00) 00000-0000"
          required
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
      </Button>
    </form>
  );
}
