import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/dashboard/_layout/leads")({
  component: LeadsPage,
});

type Lead = {
  id: string;
  name: string;
  whatsapp: string;
  crop: string;
  created_at: string;
  contatado: boolean;
};

function LeadsPage() {
  const cooperativa = useRequireCooperativa();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busca, setBusca] = useState("");

  async function load() {
    if (!supabase) return;
    const { data } = await supabase
      .from("leads")
      .select("id, name, whatsapp, crop, created_at, contatado")
      .order("created_at", { ascending: false });
    setLeads(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return leads;
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(termo) ||
        l.whatsapp.includes(termo) ||
        l.crop.toLowerCase().includes(termo),
    );
  }, [leads, busca]);

  async function toggleContatado(lead: Lead) {
    if (!supabase) return;
    const { error } = await supabase
      .from("leads")
      .update({ contatado: !lead.contatado })
      .eq("id", lead.id);
    if (error) {
      toast.error("Não foi possível atualizar o status.");
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, contatado: !l.contatado } : l)));
  }

  async function handleDelete(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover o lead.");
      return;
    }
    toast.success("Lead removido.");
    load();
  }

  if (!cooperativa) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads</CardTitle>
        <CardDescription>Quem preencheu o formulário da landing page</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {leads.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, WhatsApp ou cultura..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lead ainda.</p>
        ) : filtrados.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum lead encontrado para "{busca}".
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Cultura</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.whatsapp}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{lead.crop}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleContatado(lead)}
                        className="cursor-pointer"
                        title="Marcar como contatado/pendente"
                      >
                        <Badge variant={lead.contatado ? "default" : "outline"}>
                          {lead.contatado ? "Contatado" : "Pendente"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover {lead.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Essa ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(lead.id)}>
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
  );
}
