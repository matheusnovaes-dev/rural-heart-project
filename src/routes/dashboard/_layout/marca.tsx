import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Palette, Upload } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth, useRequireCooperativa } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const Route = createFileRoute("/dashboard/_layout/marca")({
  component: MarcaPage,
});

function MarcaPage() {
  const { refresh } = useAuth();
  const cooperativa = useRequireCooperativa();
  const [cor, setCor] = useState(cooperativa?.cor_primaria ?? "#1F3D2B");
  const [logoPreview, setLogoPreview] = useState(cooperativa?.logo_url ?? null);
  const [status, setStatus] = useState<"idle" | "loading" | "saved">("idle");

  if (!cooperativa) return null;

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !supabase || !cooperativa) return;

    setStatus("loading");
    const path = `${cooperativa.id}/logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, {
      upsert: true,
    });
    if (uploadError) {
      setStatus("idle");
      toast.error("Não foi possível enviar a logo.");
      return;
    }

    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    setLogoPreview(data.publicUrl);

    const { error: updateError } = await supabase
      .from("cooperativas")
      .update({ logo_url: data.publicUrl })
      .eq("id", cooperativa.id);
    await refresh();
    setStatus("saved");
    if (updateError) {
      toast.error("Logo enviada, mas não foi possível salvar no perfil.");
      return;
    }
    toast.success("Logo atualizada.");
  }

  async function handleSaveCor() {
    if (!supabase || !cooperativa) return;
    setStatus("loading");
    const { error } = await supabase
      .from("cooperativas")
      .update({ cor_primaria: cor })
      .eq("id", cooperativa.id);
    await refresh();
    setStatus("saved");
    if (error) {
      toast.error("Não foi possível salvar a cor.");
      return;
    }
    toast.success("Cor atualizada.");
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Palette}
        title="Marca própria"
        description="Sua identidade nos relatórios e no painel da equipe"
      />
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Aparece no topo do painel da sua equipe.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo"
              className="size-16 rounded-lg border border-border object-contain"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
              <Upload className="size-5" />
            </div>
          )}
          <div>
            <Label htmlFor="logo-upload" className="cursor-pointer">
              <span className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent">
                {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Trocar logo"}
              </span>
            </Label>
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cor principal</CardTitle>
          <CardDescription>Usada em relatórios e no cabeçalho.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Cor principal"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            className="size-10 cursor-pointer rounded border border-border"
          />
          <Button onClick={handleSaveCor} disabled={status === "loading"}>
            {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Salvar cor"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
