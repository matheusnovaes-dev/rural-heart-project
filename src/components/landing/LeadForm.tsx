import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { normalizarWhatsapp } from "@/lib/telefone";
import { useAuth } from "@/lib/auth";
import { pricingPlans } from "@/config/site";
import { enviarBoasVindasWhatsApp } from "@/lib/notificacoes.server";

const leadSchema = z.object({
  name: z.string().min(2, "Digite seu nome completo"),
  whatsapp: z
    .string()
    .min(10, "Digite um WhatsApp válido com DDD")
    .regex(/^[\d\s()+-]+$/, "Use apenas números, espaços e símbolos de telefone"),
  crop: z.string().min(1, "Selecione sua cultura principal"),
  plano: z.enum(["bronze", "prata", "ouro"]),
});

type LeadFormValues = z.infer<typeof leadSchema>;

const cropOptions = [
  { value: "soja", label: "Soja" },
  { value: "milho", label: "Milho" },
  { value: "outra", label: "Outra cultura" },
];

export function LeadForm({ className }: { className?: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [erroMsg, setErroMsg] = useState("");
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: { name: "", whatsapp: "", crop: "", plano: "bronze" },
  });

  async function onSubmit(values: LeadFormValues) {
    if (!isSupabaseConfigured || !supabase) return;
    setStatus("submitting");
    setErroMsg("");

    // Preenchendo esse formulário já é o cadastro inteiro — sem e-mail/senha
    // pra pedir, gera uma conta técnica a partir do próprio WhatsApp (único
    // por produtor) só pra existir uma sessão logada. A pessoa nunca
    // precisa saber desse e-mail/senha: ela já sai daqui direto pro painel.
    const whatsapp = normalizarWhatsapp(values.whatsapp);
    const email = `lead-${whatsapp}@safralume.app`;
    const senha = crypto.randomUUID();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
    });
    if (authError || !authData.user) {
      setErroMsg(
        authError?.message.includes("already registered")
          ? "Esse WhatsApp já tem um teste iniciado. Chama no WhatsApp pra gente ajudar a recuperar o acesso."
          : "Não conseguimos iniciar seu teste agora. Chama no WhatsApp pra gente ajudar.",
      );
      setStatus("error");
      return;
    }

    // signUp() às vezes resolve antes da sessão estar de fato "commitada"
    // no cliente — sem isso, o insert seguinte pode sair sem autenticação
    // e falhar por RLS de forma intermitente. Fixa a sessão explicitamente
    // antes de continuar.
    if (authData.session) {
      await supabase.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      });
    }

    const { data: produtor, error: produtorError } = await supabase
      .from("produtores")
      .insert({
        user_id: authData.user.id,
        nome: values.name,
        whatsapp,
        cultura_principal: values.crop || null,
      })
      .select("id")
      .single();
    if (produtorError || !produtor) {
      setErroMsg("Não conseguimos salvar seu cadastro agora. Chama no WhatsApp pra gente ajudar.");
      setStatus("error");
      return;
    }

    const { error: assinaturaError } = await supabase
      .from("assinaturas")
      .insert({ produtor_id: produtor.id, plano: values.plano });
    if (assinaturaError) {
      setErroMsg("Não conseguimos configurar seu teste agora. Chama no WhatsApp pra gente ajudar.");
      setStatus("error");
      return;
    }

    // Best-effort: mantém o registro pra acompanhamento/analytics, mas não
    // trava o fluxo se falhar — a conta já foi criada com sucesso.
    void supabase.from("leads").insert({
      name: values.name,
      whatsapp: values.whatsapp,
      crop: values.crop,
    });

    // Também best-effort: quem se cadastra precisa saber que existe um
    // WhatsApp pra chamar — em vez de esperar ela descobrir sozinha, o bot
    // já chama primeiro se apresentando.
    void enviarBoasVindasWhatsApp({
      data: {
        nome: values.name,
        whatsapp,
        plano: pricingPlans.find((p) => p.id === values.plano)?.name ?? values.plano,
      },
    }).then((r) => console.log("DIAG boas-vindas:", JSON.stringify(r)));

    // O AuthProvider já buscou o perfil (produtor) reagindo ao signUp() —
    // ANTES de este código ter criado a linha em `produtores`. Sem recarregar
    // agora, o guard do /dashboard ainda vê "sem produtor" e manda pro
    // /onboarding, mesmo com o cadastro já criado com sucesso.
    await refresh();
    navigate({ to: "/dashboard" });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={`flex flex-col gap-4 ${className ?? ""}`}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome completo</FormLabel>
              <FormControl>
                <Input placeholder="Seu nome" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp</FormLabel>
              <FormControl>
                <Input placeholder="(00) 00000-0000" type="tel" autoComplete="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="crop"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cultura principal</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione sua cultura" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cropOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="plano"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plano pra testar</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {pricingPlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — R$ {p.price}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="lg"
          disabled={status === "submitting"}
          className="bg-cta text-cta-foreground hover:bg-cta/90 mt-2"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Preparando seu painel...
            </>
          ) : (
            "Testar grátis por 7 dias"
          )}
        </Button>

        {status === "error" && <p className="text-sm text-destructive">{erroMsg}</p>}

        <p className="text-center text-xs text-muted-foreground">
          Sem cartão de crédito. Cancele quando quiser.
        </p>
      </form>
    </Form>
  );
}
