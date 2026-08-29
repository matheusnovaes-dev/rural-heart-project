import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { criarAssinaturaAsaas } from "@/lib/asaas.server";
import { culturas } from "@/config/culturas";
import { normalizarWhatsapp } from "@/lib/telefone";

const searchSchema = z.object({
  convite: z.string().uuid().optional(),
  equipe: z.string().uuid().optional(),
  plano: z.enum(["bronze", "prata", "ouro"]).optional(),
  // "1" = veio do fluxo "prefere assinar direto" (pulou o teste grátis de
  // propósito) — string em vez de boolean pra não depender de coerção de
  // query param.
  semTrial: z.literal("1").optional(),
});

export const Route = createFileRoute("/onboarding")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { convite, equipe, plano, semTrial } = Route.useSearch();
  const semTrialAtivo = semTrial === "1";
  const { session, refresh } = useAuth();
  const navigate = useNavigate();

  const [tipo, setTipo] = useState<"produtor" | "cooperativa">(convite ? "produtor" : "produtor");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cultura, setCultura] = useState("");
  const [uf, setUf] = useState("");
  const [nomeCooperativa, setNomeCooperativa] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [erroMsg, setErroMsg] = useState("Algo deu errado. Confira os dados e tente de novo.");
  // Cadastro (produtor/cooperativa) já foi criado, mas a cobrança na Asaas
  // falhou — não dá pra deixar isso passar batido pro dashboard, senão a
  // pessoa acha que assinou e nunca vai ser cobrada. Guarda o id pra poder
  // tentar de novo sem duplicar o cadastro.
  const [assinaturaPendenteId, setAssinaturaPendenteId] = useState<string | null>(null);
  const [erroCheckout, setErroCheckout] = useState("");

  const planoEscolhido = plano ?? "bronze";

  // Logo após um cadastro novo, a navegação pra cá pode chegar antes do
  // AuthProvider terminar de propagar a sessão (a troca de auth state é
  // assíncrona). Confirma direto com o Supabase antes de decidir que não
  // há sessão — evita mandar quem acabou de criar conta de volta pro login.
  const [confirmandoSessao, setConfirmandoSessao] = useState(!session);

  useEffect(() => {
    if (session) {
      setConfirmandoSessao(false);
      return;
    }
    refresh().finally(() => setConfirmandoSessao(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (confirmandoSessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <p className="text-muted-foreground">
          Faça login primeiro em{" "}
          <a href="/login" className="text-primary underline">
            /login
          </a>
          .
        </p>
      </div>
    );
  }

  if (equipe) {
    return <ConfirmarEquipe cooperativaId={equipe} onDone={() => navigate({ to: "/dashboard" })} />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session) return;
    setStatus("loading");

    let novaAssinaturaId: string | null = null;

    if (tipo === "produtor") {
      const { data: produtor, error } = await supabase
        .from("produtores")
        .insert({
          user_id: session.user.id,
          nome,
          whatsapp: normalizarWhatsapp(whatsapp),
          cultura_principal: cultura || null,
          uf: uf || null,
          cooperativa_id: convite ?? null,
          cpf_cnpj: cpfCnpj.replace(/\D/g, ""),
        })
        .select("id")
        .single();
      if (error) {
        setErroMsg(
          error.code === "23505"
            ? "Esse número de WhatsApp já está cadastrado."
            : "Algo deu errado. Confira os dados e tente de novo.",
        );
        setStatus("error");
        return;
      }

      // Produtor convidado por uma cooperativa já está coberto pelo plano
      // dela — só produtor solo (sem convite) assina o próprio plano.
      if (!convite) {
        const { data: assinatura, error: assinaturaError } = await supabase
          .from("assinaturas")
          .insert({ produtor_id: produtor.id, plano: planoEscolhido })
          .select("id")
          .single();
        if (assinaturaError) {
          setStatus("error");
          return;
        }
        novaAssinaturaId = assinatura.id;
      }
    } else {
      // Gera o id no cliente: como o usuário só passa a enxergar a
      // cooperativa via RLS depois de virar membro dela, não dá pra inserir
      // com `.select()` (o SELECT de retorno falharia por RLS).
      const cooperativaId = crypto.randomUUID();
      const { error: coopError } = await supabase.from("cooperativas").insert({
        id: cooperativaId,
        nome: nomeCooperativa,
        cpf_cnpj: cpfCnpj.replace(/\D/g, ""),
      });
      if (coopError) {
        setStatus("error");
        return;
      }
      const { error: membroError } = await supabase.from("cooperativa_membros").insert({
        cooperativa_id: cooperativaId,
        user_id: session.user.id,
        papel: "admin",
        nome: session.user.user_metadata?.["nome"] ?? null,
        email: session.user.email ?? null,
      });
      if (membroError) {
        setStatus("error");
        return;
      }

      const { data: assinatura, error: assinaturaError } = await supabase
        .from("assinaturas")
        .insert({ cooperativa_id: cooperativaId, plano: planoEscolhido })
        .select("id")
        .single();
      if (assinaturaError) {
        setStatus("error");
        return;
      }
      novaAssinaturaId = assinatura.id;
    }

    await refresh();

    if (novaAssinaturaId) {
      setAssinaturaPendenteId(novaAssinaturaId);
      await abrirCheckout(novaAssinaturaId);
      return;
    }

    navigate({ to: "/dashboard" });
  }

  async function abrirCheckout(assinaturaId: string) {
    setStatus("loading");
    setErroCheckout("");
    try {
      const checkout = await criarAssinaturaAsaas({
        data: {
          plano: planoEscolhido,
          assinaturaId,
          nome: tipo === "produtor" ? nome : nomeCooperativa,
          cpfCnpj,
          email: session?.user.email,
          whatsapp: tipo === "produtor" ? whatsapp : undefined,
          semTrial: semTrialAtivo,
        },
      });
      window.location.href = checkout.url;
    } catch (err) {
      // Não pode deixar isso passar batido pro dashboard: o cadastro (produtor/
      // cooperativa) já foi criado, mas sem a cobrança configurada a pessoa
      // nunca seria cobrada e pareceria que assinou com sucesso. Mostra o
      // motivo real (a Asaas já devolve mensagem em português, tipo "CPF
      // inválido") e deixa tentar de novo sem duplicar o cadastro.
      setErroCheckout(err instanceof Error ? err.message : "Erro desconhecido.");
      setStatus("error");
    }
  }

  if (assinaturaPendenteId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Cadastro criado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu cadastro foi salvo, mas não conseguimos configurar a cobrança da assinatura.
          </p>
          {erroCheckout && (
            <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {erroCheckout}
            </p>
          )}
          <Button
            className="mt-5 w-full"
            disabled={status === "loading"}
            onClick={() => abrirCheckout(assinaturaPendenteId)}
          >
            {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Tentar de novo"}
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Se o erro continuar, chama no WhatsApp: +55 31 9004-0215
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Só mais um passo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {convite
            ? "Você foi convidado por uma cooperativa. Complete seu cadastro de produtor."
            : "Conta pra gente quem você é."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          {!convite && (
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as "produtor" | "cooperativa")}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${tipo === "produtor" ? "border-primary bg-secondary/50" : "border-border"}`}
              >
                <RadioGroupItem value="produtor" />
                Sou produtor
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${tipo === "cooperativa" ? "border-primary bg-secondary/50" : "border-border"}`}
              >
                <RadioGroupItem value="cooperativa" />
                Represento uma cooperativa
              </label>
            </RadioGroup>
          )}

          {tipo === "produtor" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="nome">Seu nome</Label>
                <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cultura principal</Label>
                <Select value={cultura} onValueChange={setCultura}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
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
              <div className="space-y-2">
                <Label htmlFor="uf">Estado (UF)</Label>
                <Input
                  id="uf"
                  placeholder="Ex: GO"
                  maxLength={2}
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="nomeCooperativa">Nome da cooperativa/corretora</Label>
              <Input
                id="nomeCooperativa"
                required
                value={nomeCooperativa}
                onChange={(e) => setNomeCooperativa(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cpfCnpj">
              {tipo === "produtor" ? "Seu CPF" : "CNPJ da cooperativa/corretora"}
            </Label>
            <Input
              id="cpfCnpj"
              inputMode="numeric"
              placeholder={tipo === "produtor" ? "000.000.000-00" : "00.000.000/0000-00"}
              required
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Exigido pra emitir a cobrança da assinatura.
            </p>
          </div>

          <p className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
            {semTrialAtivo
              ? "Sem teste grátis: ao concluir, você já cai na página de pagamento e a cobrança do plano começa hoje."
              : "7 dias grátis antes da primeira cobrança. Cancele quando quiser."}
          </p>

          {status === "error" && <p className="text-sm text-destructive">{erroMsg}</p>}

          <Button type="submit" size="lg" disabled={status === "loading"}>
            {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Concluir"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ConfirmarEquipe({ cooperativaId, onDone }: { cooperativaId: string; onDone: () => void }) {
  const { session, refresh } = useAuth();
  const [nomeCoop, setNomeCoop] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("cooperativas")
      .select("nome")
      .eq("id", cooperativaId)
      .maybeSingle()
      .then(({ data }) => setNomeCoop(data?.nome ?? null));
  }, [cooperativaId]);

  async function handleConfirm() {
    if (!supabase || !session) return;
    setStatus("loading");
    const { error } = await supabase.from("cooperativa_membros").insert({
      cooperativa_id: cooperativaId,
      user_id: session.user.id,
      papel: "membro",
      nome: session.user.user_metadata?.["nome"] ?? null,
      email: session.user.email ?? null,
    });
    if (error) {
      setStatus("error");
      return;
    }
    await refresh();
    onDone();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Convite de equipe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você foi convidado a entrar na equipe de{" "}
          <strong className="text-foreground">{nomeCoop ?? "carregando..."}</strong>.
        </p>
        {status === "error" && (
          <p className="mt-3 text-sm text-destructive">
            Não foi possível confirmar. Tente de novo.
          </p>
        )}
        <Button
          className="mt-5 w-full"
          onClick={handleConfirm}
          disabled={status === "loading" || !nomeCoop}
        >
          {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Entrar na equipe"}
        </Button>
      </div>
    </div>
  );
}
