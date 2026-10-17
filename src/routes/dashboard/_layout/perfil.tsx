import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Camera, CreditCard, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { AvatarProdutor } from "@/components/dashboard/AvatarProdutor";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { culturas } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { buscarMunicipio } from "@/lib/clima";
import { esquecerMemoriaDoBot, listarMemoriaDoBot } from "@/lib/perfil.server";
import { supabase } from "@/lib/supabase";
import { useAuth, useRequireProdutor } from "@/lib/auth";
import { reduzirParaQuadrado } from "@/lib/imagem";
import { mascararTelefone } from "@/lib/telefone";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";

export const Route = createFileRoute("/dashboard/_layout/perfil")({
  component: PerfilPage,
});

type Preferencias = {
  resumo_diario_ativo: boolean;
  resumo_diario_hora: number | null;
  mensagem_proativa_ativa: boolean;
};
type Memoria = { id: string; fato: string; categoria: string; criado_em: string };

const HORAS = Array.from({ length: 17 }, (_, i) => i + 5); // 5h às 21h
const ROTULO_CATEGORIA: Record<string, string> = {
  preocupacao: "Preocupação",
  contexto_fazenda: "Sobre a sua propriedade",
  relacao_comercial: "Relação comercial",
  plano_futuro: "Plano futuro",
};

function PerfilPage() {
  const produtor = useRequireProdutor();
  const { refresh, session } = useAuth();
  if (!produtor) return null;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        icon={IconesSafralume.perfil}
        iconePersonalizado
        title="Meu perfil"
        description="Seus dados e preferências. O que você muda aqui vale também para o bot no WhatsApp."
      />
      <FotoCard produtor={produtor} userId={session?.user.id ?? null} refresh={refresh} />
      <DadosCard produtor={produtor} refresh={refresh} />
      <PreferenciasCard produtorId={produtor.id} />
      <MemoriaCard accessToken={session?.access_token ?? null} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" /> Plano e assinatura
          </CardTitle>
          <CardDescription>
            Veja seu plano, o que ele inclui e como mudar ou cancelar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/dashboard/assinatura">Abrir minha assinatura</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const BUCKET_FOTOS = "avatares";

/** Caminho do arquivo dentro do bucket, a partir do endereço público salvo em foto_url. */
function caminhoDaFoto(url: string | null | undefined): string | null {
  const marca = `/${BUCKET_FOTOS}/`;
  const i = url?.indexOf(marca) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marca.length).split("?")[0] ?? "") : null;
}

function FotoCard({
  produtor,
  userId,
  refresh,
}: {
  produtor: NonNullable<ReturnType<typeof useRequireProdutor>>;
  userId: string | null;
  refresh: () => Promise<void> | void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo || !supabase || !userId) return;
    if (!arquivo.type.startsWith("image/")) {
      toast.error("Escolha uma imagem (JPG, PNG ou WebP).");
      return;
    }
    setOcupado(true);
    try {
      const { blob, extensao } = await reduzirParaQuadrado(arquivo);
      const caminho = `${userId}/avatar-${Date.now()}.${extensao}`;
      const { error: erroEnvio } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(caminho, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (erroEnvio) throw erroEnvio;
      const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(caminho);
      const { error: erroSalvar } = await supabase
        .from("produtores")
        .update({ foto_url: data.publicUrl })
        .eq("id", produtor.id);
      if (erroSalvar) throw erroSalvar;
      const antiga = caminhoDaFoto(produtor.foto_url);
      if (antiga) await supabase.storage.from(BUCKET_FOTOS).remove([antiga]);
      await refresh();
      toast.success("Foto atualizada.");
    } catch {
      toast.error("Não consegui enviar a foto. Tente outra imagem.");
    } finally {
      setOcupado(false);
    }
  }

  async function remover() {
    if (!supabase) return;
    setOcupado(true);
    try {
      const { error } = await supabase
        .from("produtores")
        .update({ foto_url: null })
        .eq("id", produtor.id);
      if (error) throw error;
      const antiga = caminhoDaFoto(produtor.foto_url);
      if (antiga) await supabase.storage.from(BUCKET_FOTOS).remove([antiga]);
      await refresh();
      toast.success("Foto removida.");
    } catch {
      toast.error("Não consegui remover agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-5 pt-6">
        <AvatarProdutor
          nome={produtor.nome ?? ""}
          fotoUrl={produtor.foto_url}
          className="size-24 text-2xl"
        />
        <div className="grid gap-2">
          <div>
            <p className="font-medium">Sua foto</p>
            <p className="text-sm text-muted-foreground">
              Aparece no seu painel. A imagem é recortada em quadrado e reduzida antes de enviar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={ocupado}
              onClick={() => entrada.current?.click()}
            >
              {ocupado ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {produtor.foto_url ? "Trocar foto" : "Escolher foto"}
            </Button>
            {produtor.foto_url ? (
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={remover}>
                Remover
              </Button>
            ) : null}
          </div>
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={escolher}
            aria-label="Escolher foto de perfil"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function DadosCard({
  produtor,
  refresh,
}: {
  produtor: NonNullable<ReturnType<typeof useRequireProdutor>>;
  refresh: () => Promise<void> | void;
}) {
  const [nome, setNome] = useState(produtor.nome ?? "");
  const [cultura, setCultura] = useState(produtor.cultura_principal ?? "");
  const [uf, setUf] = useState(produtor.uf ?? "");
  const [cidade, setCidade] = useState(produtor.municipio ?? "");
  const [salvando, setSalvando] = useState(false);

  const original = {
    nome: produtor.nome ?? "",
    cultura: produtor.cultura_principal ?? "",
    uf: produtor.uf ?? "",
    cidade: produtor.municipio ?? "",
  };
  const mudou =
    nome.trim() !== original.nome ||
    cultura !== original.cultura ||
    uf !== original.uf ||
    cidade.trim() !== original.cidade;

  // Avisa quem tenta fechar a aba com alteração não salva (mesmo cuidado da página "Marca própria").
  useEffect(() => {
    if (!mudou) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [mudou]);

  // Cultura antiga ou digitada fora da lista (ex.: "polvilho") continua aparecendo, em vez de sumir do campo.
  const foraDaLista = cultura && !culturas.some((c) => c.value === cultura);

  async function salvar() {
    if (!supabase) return;
    if (nome.trim().length < 2) {
      toast.error("Digite seu nome.");
      return;
    }
    if (!cultura) {
      toast.error("Escolha sua cultura principal.");
      return;
    }
    if (!uf) {
      toast.error("Escolha seu estado.");
      return;
    }
    setSalvando(true);
    try {
      let local: { municipio: string | null; lat: number | null; lon: number | null } = {
        municipio: null,
        lat: null,
        lon: null,
      };
      if (cidade.trim()) {
        const nomeUf = ufs.find((u) => u.value === uf)?.label;
        const achada = nomeUf ? await buscarMunicipio(cidade.trim(), nomeUf) : null;
        if (!achada) {
          toast.error(
            `Não encontrei "${cidade.trim()}" em ${uf}. Confira o nome ou deixe a cidade em branco para usar a capital do estado.`,
          );
          return;
        }
        local = { municipio: achada.nome, lat: achada.lat, lon: achada.lon };
      }
      const { error } = await supabase
        .from("produtores")
        .update({
          nome: nome.trim().slice(0, 80),
          cultura_principal: cultura,
          uf,
          ...local,
        })
        .eq("id", produtor.id);
      if (error) throw error;
      if (local.municipio) setCidade(local.municipio);
      await refresh();
      toast.success("Perfil atualizado.");
    } catch {
      toast.error("Não consegui salvar agora. Tente de novo em instantes.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4" /> Seus dados
        </CardTitle>
        <CardDescription>
          A cidade deixa o clima e o frete precisos para o seu local. Sem cidade, usamos a capital
          do estado. Os alertas que você já criou não mudam.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="perfil-nome">Como podemos te chamar</Label>
          <Input
            id="perfil-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={80}
            autoComplete="name"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Cultura principal</Label>
          <Select value={cultura} onValueChange={setCultura}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha a cultura" />
            </SelectTrigger>
            <SelectContent>
              {foraDaLista ? <SelectItem value={cultura}>{cultura}</SelectItem> : null}
              {culturas.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Estado</Label>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o estado" />
            </SelectTrigger>
            <SelectContent>
              {ufs.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="perfil-cidade">Cidade (opcional)</Label>
          <Input
            id="perfil-cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex.: Sorriso"
            maxLength={80}
          />
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="perfil-whatsapp">WhatsApp</Label>
          <Input
            id="perfil-whatsapp"
            value={mascararTelefone(produtor.whatsapp ?? "")}
            readOnly
            disabled
          />
          <p className="text-xs text-muted-foreground">
            Para trocar o número, fale com a gente pelo Suporte (ele identifica você no bot).
          </p>
        </div>
        <div className="sm:col-span-2">
          <Button onClick={salvar} disabled={!mudou || salvando}>
            {salvando ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PreferenciasCard({ produtorId }: { produtorId: string }) {
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    let vivo = true;
    supabase
      .from("produtores")
      .select("resumo_diario_ativo, resumo_diario_hora, mensagem_proativa_ativa")
      .eq("id", produtorId)
      .maybeSingle()
      .then(({ data }) => {
        if (vivo && data) setPrefs(data as Preferencias);
      });
    return () => {
      vivo = false;
    };
  }, [produtorId]);

  async function gravar(novo: Preferencias) {
    if (!supabase) return;
    const anterior = prefs;
    setPrefs(novo);
    setSalvando(true);
    const { error } = await supabase
      .from("produtores")
      .update({
        resumo_diario_ativo: novo.resumo_diario_ativo,
        resumo_diario_hora: novo.resumo_diario_ativo ? novo.resumo_diario_hora : null,
        mensagem_proativa_ativa: novo.mensagem_proativa_ativa,
      })
      .eq("id", produtorId);
    setSalvando(false);
    if (error) {
      setPrefs(anterior);
      toast.error("Não consegui salvar agora. Tente de novo.");
    } else {
      toast.success("Preferência salva.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mensagens no WhatsApp</CardTitle>
        <CardDescription>
          Escolha o que você quer receber. Dá para mudar quando quiser.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {!prefs ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted/60" aria-busy="true" />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <Label htmlFor="pref-resumo">Resumo diário</Label>
                <p className="text-sm text-muted-foreground">
                  Todo dia, no horário escolhido: preço, safra, clima e sinal de venda da sua
                  cultura.
                </p>
                {prefs.resumo_diario_ativo ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm">Horário (Brasília):</span>
                    <Select
                      value={String(prefs.resumo_diario_hora ?? 8)}
                      onValueChange={(v) => gravar({ ...prefs, resumo_diario_hora: Number(v) })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HORAS.map((h) => (
                          <SelectItem key={h} value={String(h)}>
                            {String(h).padStart(2, "0")}h
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
              <Switch
                id="pref-resumo"
                checked={prefs.resumo_diario_ativo}
                disabled={salvando}
                onCheckedChange={(v) =>
                  gravar({
                    ...prefs,
                    resumo_diario_ativo: v,
                    resumo_diario_hora: v ? (prefs.resumo_diario_hora ?? 8) : null,
                  })
                }
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <Label htmlFor="pref-proativa">Aviso quando algo mexer</Label>
                <p className="text-sm text-muted-foreground">
                  Uma mensagem só quando o preço, o clima ou o câmbio da sua região mudam de
                  verdade.
                </p>
              </div>
              <Switch
                id="pref-proativa"
                checked={prefs.mensagem_proativa_ativa}
                disabled={salvando}
                onCheckedChange={(v) => gravar({ ...prefs, mensagem_proativa_ativa: v })}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MemoriaCard({ accessToken }: { accessToken: string | null }) {
  const [itens, setItens] = useState<Memoria[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!accessToken) return undefined;
    let vivo = true;
    listarMemoriaDoBot({ data: { accessToken } })
      .then((r) => vivo && setItens(r))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [accessToken]);

  async function esquecer(id?: string) {
    if (!accessToken) return;
    const r = await esquecerMemoriaDoBot({ data: id ? { accessToken, id } : { accessToken } });
    if (!r.ok) {
      toast.error("Não consegui apagar agora. Tente de novo.");
      return;
    }
    setItens((atual) => (id ? (atual ?? []).filter((m) => m.id !== id) : []));
    toast.success(id ? "Esquecido." : "O bot esqueceu tudo o que sabia.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BrainCircuit className="size-4" /> O que o bot sabe sobre você
        </CardTitle>
        <CardDescription>
          Quando você conta algo importante na conversa (uma preocupação, um plano), o bot guarda
          para te atender melhor depois. Aqui você vê e apaga.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {erro ? (
          <p className="text-sm text-muted-foreground">
            Não consegui carregar agora. Atualize a página.
          </p>
        ) : itens === null ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted/60" aria-busy="true" />
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">O bot ainda não guardou nada sobre você.</p>
        ) : (
          <>
            <ul className="grid gap-2">
              {itens.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {ROTULO_CATEGORIA[m.categoria] ?? m.categoria}
                    </p>
                    <p className="text-sm">{m.fato}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => esquecer(m.id)}>
                    Esquecer
                  </Button>
                </li>
              ))}
            </ul>
            <div>
              <Button variant="outline" size="sm" onClick={() => esquecer()}>
                Esquecer tudo
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
