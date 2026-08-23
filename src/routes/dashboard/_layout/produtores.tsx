import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabase } from "@/lib/supabase";
import { useRequireCooperativa } from "@/lib/auth";

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
  const [open, setOpen] = useState(false);

  async function load() {
    if (!supabase || !cooperativa) return;
    const { data } = await supabase
      .from("produtores")
      .select("id, nome, whatsapp, cultura_principal, uf")
      .eq("cooperativa_id", cooperativa.id)
      .order("nome");
    setProdutores(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperativa]);

  if (!cooperativa) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Produtores</CardTitle>
          <CardDescription>Produtores associados à sua cooperativa</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar produtor</DialogTitle>
            </DialogHeader>
            <NovoProdutorForm
              cooperativaId={cooperativa?.id ?? ""}
              onDone={() => {
                setOpen(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {produtores.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum produtor cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Cultura</TableHead>
                  <TableHead>UF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtores.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.whatsapp}</TableCell>
                    <TableCell>{p.cultura_principal ?? "—"}</TableCell>
                    <TableCell>{p.uf ?? "—"}</TableCell>
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

function NovoProdutorForm({
  cooperativaId,
  onDone,
}: {
  cooperativaId: string;
  onDone: () => void;
}) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cultura, setCultura] = useState("");
  const [uf, setUf] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    await supabase.from("produtores").insert({
      nome,
      whatsapp,
      cultura_principal: cultura || null,
      uf: uf || null,
      cooperativa_id: cooperativaId,
    });
    setLoading(false);
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
