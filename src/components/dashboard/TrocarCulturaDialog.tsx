import { useState, type ReactNode } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAuth, type Produtor } from "@/lib/auth";
import { culturas } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { buscarMunicipioServidor } from "@/lib/clima.server";

const gatilhoPadrao = (
  <button
    type="button"
    className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
    aria-label="Trocar cultura ou UF"
  >
    <Pencil className="size-3" />
  </button>
);

export function TrocarCulturaDialog({
  produtor,
  trigger,
}: {
  produtor: Produtor;
  trigger?: ReactNode;
}) {
  const { refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [cultura, setCultura] = useState(produtor.cultura_principal ?? "soja");
  const [uf, setUf] = useState(produtor.uf ?? "");
  const [municipio, setMunicipio] = useState(produtor.municipio ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    const ufFinal = uf.toUpperCase() || null;

    // Cidade é opcional e só faz sentido geocodificar se ela mudou (senão
    // repete a mesma chamada de rede toda vez que só a cultura é trocada).
    let lat: number | null = produtor.lat;
    let lon: number | null = produtor.lon;
    let municipioFinal: string | null = produtor.municipio;
    if (municipio.trim() !== (produtor.municipio ?? "")) {
      if (!municipio.trim()) {
        municipioFinal = null;
        lat = null;
        lon = null;
      } else if (!ufFinal) {
        toast.error("Escolha o estado antes de informar a cidade.");
        setLoading(false);
        return;
      } else {
        const nomeCompletoUf = ufs.find((u) => u.value === ufFinal)?.label;
        const encontrado = nomeCompletoUf
          ? await buscarMunicipioServidor({ data: { nome: municipio.trim(), nomeCompletoUf } })
          : null;
        if (!encontrado) {
          toast.error(
            `Não encontrei "${municipio}" em ${ufFinal}. Confira o nome e tente de novo.`,
          );
          setLoading(false);
          return;
        }
        municipioFinal = encontrado.nome;
        lat = encontrado.lat;
        lon = encontrado.lon;
      }
    }

    await supabase
      .from("produtores")
      .update({ cultura_principal: cultura, uf: ufFinal, municipio: municipioFinal, lat, lon })
      .eq("id", produtor.id);
    await refresh();
    setLoading(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? gatilhoPadrao}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar cultura / UF</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label>Cultura principal</Label>
            <Select value={cultura} onValueChange={setCultura}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {culturas.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trocar-uf">Estado (UF)</Label>
            <Input
              id="trocar-uf"
              maxLength={2}
              value={uf}
              onChange={(e) => setUf(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trocar-municipio">Cidade (opcional)</Label>
            <Input
              id="trocar-municipio"
              placeholder="Ex: Bambuí"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deixa a previsão de clima mais precisa (usa a sua cidade em vez da capital do estado).
              Sem isso, continua funcionando pela UF.
            </p>
          </div>
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
